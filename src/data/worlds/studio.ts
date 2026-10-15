import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('studio', 16, 14);

b.wall('window', 'ne', 1, 3);
b.wall('backdrop', 'ne', 5, 4);
b.wall('moodboard', 'ne', 10, 3);
b.wall('door', 'ne', 14, 1);
b.wall('window', 'nw', 2, 3);
b.wall('assetwall', 'nw', 6, 3);
b.wall('poster', 'nw', 10, 1, { color: '#5b8def' });
b.wall('mugShelf', 'nw', 11, 2);

b.patch('rug', 9, 9, 6, 4, { color: '#ef7aa8' });
b.patch('pad', 5, 0, 4, 2, { color: '#f7d9a8' });
b.patch('rug', 1, 4, 6, 3, { color: '#c8a878' });
b.patch('rug', 4, 8, 4, 3, { color: '#2a8a86' });

b.prop('softbox', 4, 1);
b.prop('softbox', 9, 1);
b.station('tripod', 6, 3, 'WORKSTATION', 'Photo & video set', { verb: 'shooting' });
b.station('desk', 1, 5, 'WORKSTATION', 'Drawing desk 1', { variant: 'tablet', verb: 'illustrating' });
b.station('desk', 4, 5, 'WORKSTATION', 'Drawing desk 2', { variant: 'tablet', verb: 'sketching' });
b.station('desk', 9, 5, 'WORKSTATION', 'Edit bay 1', { variant: 'edit', verb: 'editing' });
b.station('desk', 12, 5, 'WORKSTATION', 'Edit bay 2', { variant: 'edit', verb: 'color grading' });
b.station('easel', 1, 9, 'WORKSTATION', 'Easel A', { verb: 'painting' });
b.station('easel', 3, 9, 'WORKSTATION', 'Easel B', { verb: 'painting' });
b.station('podcast', 5, 9, 'WORKSTATION', 'Podcast corner', { slots: 2, verb: 'recording' });

b.seats('sofa', 10, 10, 'LOUNGE', 'Lounge sofa', { color: '#5b8def' });
b.prop('coffeeTable', 10, 11);
b.seats('armchair', 13, 11, 'LOUNGE', 'Armchair', { color: '#f2b84b' });
b.station('counter', 0, 11, 'COFFEE', 'Coffee bar', { rot: 1, slots: 2 });
b.point('DECORATIVE', 11.5, 0.5, 'ne', 'Moodboard');
b.point('DECORATIVE', 7.5, 0.5, 'ne', 'Backdrop');

b.ring('MEETING', 8, 12, 'Creative review');
for (const [x, y] of [[15, 0], [0, 0], [15, 13], [8, 7]]) b.prop(y === 7 ? 'plantTall' : 'plant', x, y);

// the clutter of a working studio
b.prop('std_shelf', 0, 1, { rot: 1 });
b.prop('std_canvases', 0, 7, { rot: 1 });
b.prop('std_paintCart', 2, 9);
b.prop('std_rail', 15, 3, { rot: 1 });
b.prop('std_reflector', 8, 3);
b.prop('std_stool', 7, 1);
b.prop('std_ringLight', 3, 2);
b.prop('std_beanbag', 14, 12);
b.prop('std_records', 15, 10);
b.prop('std_floorLamp', 13, 10);
b.prop('std_boxes', 15, 6);
b.prop('std_planChest', 3, 5);
b.prop('std_surfboards', 0, 13, { rot: 1 });
b.prop('std_dogbed', 11, 8);
b.prop('std_flamingo', 10, 2);
b.prop('std_cases', 11, 3);

b.spawn(14, 0);
b.spawn(14, 1);
b.node('center', 8, 8);

// ── the boardwalk ────────────────────────────────────────────
// The shore: the sea is everything with x ≥ coastX(y). The same polyline
// drives the sand and sea shaders in src/render/hd4/packs/studio/ground.ts.
const COAST: [number, number][] = [
  [-80, 4],
  [-60, 10],
  [-40, 17],
  [-20, 23],
  [-6, 27],
  [4, 28],
  [14, 26],
  [22, 22],
  [32, 16],
  [44, 7],
  [60, -6],
  [80, -24],
];
function coastX(y: number): number {
  if (y <= COAST[0][0]) return COAST[0][1];
  for (let i = 1; i < COAST.length; i++) {
    const [y1, x1] = COAST[i];
    if (y <= y1) {
      const [y0, x0] = COAST[i - 1];
      return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return COAST[COAST.length - 1][1];
}

// The studio is a converted boathouse at the corner of two boardwalks in a
// seaside arts district. North along the east boardwalk: a row of beach
// houses facing the sea (the surf shop first), their back gardens and a lane
// of crushed shell; behind the studio's back corner, the gallery with its
// murals and more houses climbing away into a roofscape. West along the south
// boardwalk: the café, artists' studios and beach houses. Across the
// boardwalks: palms, the beach with parasols and deckchairs, the lifeguard hut,
// a groyne, the pier on piles with its kiosk, boats on the sea; to the south-west
// a row of bathing huts, the dunes with marram grass and sand fences, and the
// gelato truck on its little deck.
function studioBoardwalk(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 14, outer: 'sand', frontWalls: true, light: { tint: '#ffe0a8', strength: 0.36 }, grade: { tone: [0, 0.085, 0.18, 0.28, 0.39, 0.5, 0.61, 0.72, 0.82, 0.92, 1] } });
  const hash = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 1442695041, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ── ground ────────────────────────────────────────────────
  // the sea, laid in one-tile strips along the shore
  for (let y = -90; y < 100; y++) b.ground('water', Math.round(coastX(y + 0.5)), y, 140, 1);
  // dune grass on the dunes south-west of the studio
  for (const [x, y, w, d] of [
    [-24, 21, 8, 6], [-15, 22, 7, 5], [-9, 25, 6, 5], [-1, 23, 5, 4], [-20, 28, 9, 7], [-9, 31, 8, 6], [1, 30, 6, 5], [-14, 37, 9, 6], [-2, 37, 7, 5], [-30, 30, 8, 9],
  ] as const)
    b.ground('meadow', x, y, w, d);
  // lanes of crushed shell between the houses, with dry grass on their verges
  b.ground('meadow', 2, -60, 5, 58);
  b.ground('meadow', -60, 0, 58, 5);
  b.ground('gravel', 3, -60, 3, 58);
  b.ground('gravel', -60, 1, 58, 3);
  // the boardwalks along the studio's two street fronts, the deck by the gelato truck
  b.ground('deck', C, -90, 4, 90 + R + 3);
  b.ground('deck', -90, R, 90 + C + 4, 3);
  b.ground('deck', 1, R + 3, 9, 3);

  // cut front walls of the studio
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // ── the houses ────────────────────────────────────────────
  // the east row, facing the boardwalk and the sea (the surf shop by the studio)
  const east: [number, string, string][] = [[-7, 'surf', 'sky:3'], [-16, 'cottage', 'lemon'], [-25, 'twin', 'pink'], [-34, 'cafe-far', 'mint']];
  for (const [y, v, col] of east) b.scenic('std_house', 10, y, { w: 6, d: 6, rot: 1, variant: v, color: col });
  // the south row, facing the south boardwalk and the dunes
  const south: [number, string, string][] = [[-7, 'cafe', 'white:2'], [-16, 'studio', 'mint:5'], [-25, 'twin', 'sky'], [-34, 'cottage-far', 'butter']];
  for (const [x, v, col] of south) b.scenic('std_house', x, 8, { w: 6, d: 6, variant: v, color: col });
  // behind the studio's back corner: the gallery, houses along the two lanes
  b.scenic('std_house', -9, -9, { w: 7, d: 7, variant: 'gallery', color: 'white' });
  b.scenic('std_house', -4, -18, { w: 6, d: 6, rot: 1, variant: 'cottage', color: 'lilac:3' });
  b.scenic('std_house', -4, -27, { w: 6, d: 6, rot: 1, variant: 'twin-far', color: 'coral' });
  b.scenic('std_house', -14, -17, { w: 6, d: 6, variant: 'twin', color: 'butter' });
  b.scenic('std_house', -18, -6, { w: 6, d: 6, variant: 'cottage', color: 'teal:3' });
  b.scenic('std_house', -27, -6, { w: 6, d: 6, variant: 'studio', color: 'lemon' });
  // the roofscape beyond, to the frame's edge
  for (const [x, y, w, d] of [
    [-13, -30, 9, 12], [-30, -30, 17, 12], [-30, -18, 12, 11], [-18, -11, 4, 4], [-45, -30, 15, 18], [-45, -12, 18, 11], [-60, -12, 15, 20], [-60, 1, 15, 14], [-30, -45, 15, 15], [-15, -45, 11, 15], [-4, -45, 13, 15], [-60, 15, 15, 12],
  ] as const)
    b.scenic('std_roofs', x, y, { w, d });

  // ── back gardens and side yards ───────────────────────────
  for (const [x, y, v] of [[12, -10, 'coco'], [12, -19, 'fan'], [-9, 9, 'coco'], [-18, 10, 'date'], [-27, 9, 'coco'], [-2, -8, 'fan'], [7, -6, 'coco'], [7, -15, 'date'], [-12, -3, 'coco'], [-1, -11, 'coco'], [-20, -3, 'fan'], [-36, 9, 'fan']] as const)
    b.scenic('std_palm', x, y, { variant: v });
  for (const [x, y, v] of [[8, -3, 'oleander'], [6, -9, 'agave'], [9, -12, 'hibiscus'], [6, -21, 'pampas'], [8, -24, 'oleander'], [-3, 5, 'hibiscus'], [-12, 5, 'oleander'], [-14, 6, 'agave'], [-21, 5, 'pampas'], [-30, 5, 'hibiscus'], [-5, -2, 'seagrape'], [1, -3, 'oleander'], [-10, -1, 'pampas']] as const)
    b.scenic('std_bush', x, y, { variant: v });
  b.scenic('std_boat', 6, -12, { w: 2, d: 1, variant: 'kayaks' });
  b.scenic('std_bikes', 13, -9, { w: 2, rot: 1 });
  b.scenic('std_bikes', -9, 6, { w: 2 });
  b.scenic('std_picnic', -24, 5, { w: 2 });
  b.scenic('std_surfRack', 7, -18, { w: 2, rot: 1 });
  b.scenic('std_shed', 8, -11, { w: 2, d: 2, color: 'butter' });
  b.scenic('std_shed', -16, 4, { w: 2, d: 2, color: 'pink' });
  b.scenic('std_shed', 1, -11, { w: 2, d: 2, color: 'sky' });
  b.scenic('std_laundry', 7, -22, { w: 3, rot: 1 });
  b.scenic('std_laundry', -6, 5, { w: 3 });
  b.scenic('std_laundry', -27, 5, { w: 3 });
  b.scenic('std_shower', 9, -6);
  b.scenic('std_shower', -20, 6);
  for (const [x, y, w] of [[6, -7, 3], [6, -17, 3], [6, -27, 3]] as const) b.scenic('std_picket', x, y, { w, rot: 1 });
  for (const [x, y, w] of [[-12, 4, 3], [-31, 4, 3], [-9, 4, 2]] as const) b.scenic('std_picket', x, y, { w });
  for (const [x, y, v] of [[8, -20, 'seagrape'], [0, -6, 'frangipani'], [-7, -12, 'tamarisk'], [-33, 5, 'frangipani'], [-11, 6, 'seagrape'], [-38, 3, 'tamarisk']] as const)
    b.scenic('std_tree', x, y, { variant: v });
  b.scenic('std_camper', 3, -14, { w: 3, d: 2, rot: 1, variant: 'camper' });
  // murals on garden walls along the lanes, a totem in the corner garden, a sea grape for shade
  b.scenic('std_muralWall', 2, -6, { w: 4, rot: 1 });
  b.scenic('std_muralWall', -8, 0, { w: 4 });
  b.scenic('std_muralWall', 6, -31, { w: 4, rot: 1 });
  b.scenic('std_muralWall', -31, 0, { w: 4 });
  b.scenic('std_totem', -1, -4);
  for (const [x, y, w, d] of [[-7, -13, 6, 3], [-3, -12, 4, 2], [-12, -9, 3, 5], [8, -27, 2, 6]] as const) b.ground('meadow', x, y, w, d);
  for (const [x, y, v] of [[-4, -11, 'agave'], [-6, -14, 'oleander'], [-11, -8, 'hibiscus'], [-3, -2, 'pampas']] as const) b.scenic('std_bush', x, y, { variant: v });
  b.scenic('std_bench', -3, -10, { w: 2 });
  b.scenic('std_tree', 1, -9, { variant: 'seagrape' });
  b.scenic('std_camper', -22, 1, { w: 3, d: 2, variant: 'bus' });
  b.scenic('std_bikes', 4, -5, { w: 2, rot: 1 });
  b.scenic('std_bikes', -14, 2, { w: 2 });
  // dry grass and flowering mats in the gardens
  for (const [x, y, w, d] of [[6, -24, 4, 5], [6, -10, 2, 2], [-30, 5, 4, 3], [-14, 5, 2, 2], [-2, -16, 3, 4]] as const) b.ground('meadow', x, y, w, d);
  for (const [x, y, v] of [[9, -4, 'iceplant'], [7, -8, 'gazania'], [9, -14, 'iceplant'], [8, -20, 'gazania'], [-4, 6, 'iceplant'], [-11, 6, 'gazania'], [-22, 7, 'iceplant'], [-29, 7, 'gazania'], [0, -6, 'iceplant'], [-3, -12, 'gazania']] as const)
    b.decor('std_decal', x, y, { variant: v });

  // ── the east boardwalk ────────────────────────────────────
  for (const y of [-34, -28, -22, -16, -10, -4, 0, 10]) b.scenic('std_festoon', 19, y, { w: 4, rot: 1, variant: y % 12 === 0 ? 'flags' : 'bulbs' });
  for (const y of [-31, -19, -7, 2, 12]) b.scenic('std_bench', 18, y, { w: 2, rot: 1 });
  for (const y of [-26, -17, -8]) b.scenic('std_lamp', 16, y);
  b.scenic('std_surfRack', 16, -6, { w: 2, rot: 1 });
  b.scenic('std_planter', 16, -3, { w: 2, rot: 1, variant: 'bloom' });
  b.scenic('std_signpost', 19, 5);
  // ── the south boardwalk ───────────────────────────────────
  for (const x of [-40, -34, -28, -22, -16, -10, -4]) b.scenic('std_festoon', x, 16, { w: 4, variant: x % 12 === 0 ? 'flags' : 'bulbs' });
  for (const x of [-37, -31, -25, -19, -13]) b.scenic('std_bench', x, 14, { w: 2 });
  for (const x of [-8, -17, -26, -35]) b.scenic('std_lamp', x, 14);
  b.scenic('std_planter', -3, 14, { w: 2, variant: 'bloom' });
  b.scenic('std_signpost', -6, 16);
  b.scenic('std_bikes', 18, 15, { w: 2, rot: 1 });
  for (const [x, y] of [[16, 12], [16, -12], [-11, 14], [-20, 14], [13, 16]] as const) b.scenic('std_bin', x, y);
  for (const [x, y] of [[17, 4], [17, -5], [3, 16], [-15, 16]] as const) b.scenic('std_aboard', x, y);
  for (const [x, y] of [[6, 15], [10, 16], [18, 9], [-2, 15], [-9, 15], [17, -20], [18, -1]] as const) b.decor('std_decal', x, y, { variant: 'chalk' });

  // ── the beach along the east boardwalk ────────────────────
  b.scenic('std_pier', 20, 6, { w: 27, d: 3 });
  b.scenic('std_lifeguard', 22, -12, { w: 3, d: 3 });
  b.scenic('std_groyne', 24, -18, { w: 9 });
  for (const [x, y] of [[21, -22], [21, -3], [21, -15], [15, 22]] as const) b.scenic('std_palm', x, y, { variant: 'coco' });
  b.scenic('std_boat', 22, 11, { w: 2, d: 1, variant: 'row' });
  b.scenic('std_boat', 22, 16, { w: 2, d: 1, variant: 'kayaks' });
  b.scenic('std_castle', 25, 0);
  b.scenic('std_pleinAir', 23, -6);
  // parasols with deckchairs facing the sea, towels between them
  for (let y = -40; y < 34; y += 2) {
    if ((y > -14 && y < -8) || (y > -20 && y < -16) || (y > 4 && y < 11) || (y > 10 && y < 18)) continue;
    const xs = coastX(y) - 2.6;
    for (let x = 22; x < xs; x += 2.6) {
      const h = hash(Math.round(x * 3), y, 7);
      if (h < 0.16) continue;
      const xi = Math.floor(x + (h - 0.5));
      b.scenic('std_umbrella', xi, y);
      if (hash(xi, y, 8) < 0.7) b.scenic('std_deckchair', xi + 1, y, { rot: 1 });
      if (hash(xi, y, 9) < 0.5) b.scenic('std_deckchair', xi + 1, y + 1, { rot: 1 });
      if (hash(xi, y, 10) < 0.6) b.decor('std_decal', xi, y + 1, { variant: 'towel' });
      else if (hash(xi, y, 12) < 0.5 && b.isFree(xi - 1, y + 1) && b.isFree(xi, y + 1)) b.scenic('std_windbreak', xi - 1, y + 1, { w: 2 });
    }
  }
  // pedalos and kayaks drawn up on the shore, one pedalo out on the water
  for (const [y, v, dx] of [[25, 'pedalo', 2.6], [28, 'kayaks', 2.4], [31, 'pedalo', 2.6], [35, 'pedalo', 2.4], [39, 'kayaks', 2.6], [44, 'pedalo', 2.4], [-26, 'pedalo', 2.6], [-2, 'kayaks', 2.4], [30, 'pedalo', -2.5]] as const) {
    const x = Math.floor(coastX(y + 0.5) - dx);
    if (b.isFree(x, y) && b.isFree(x + 1, y)) b.scenic('std_boat', x, y, { w: 2, d: 1, variant: v });
  }
  // the swim zone's buoys, the surf on the sand, boats at sea
  for (let y = -34; y < 66; y += 4) if (y < 3 || y > 12) b.scenic('std_buoy', Math.round(coastX(y) + 4.5), y, { variant: 'red' });
  for (let y = -32; y < 66; y += 7) if (y < 2 || y > 13) b.scenic('std_buoy', Math.round(coastX(y) + 9), y, { variant: 'yellow' });
  for (let y = -40; y < 60; y += 6) b.scenic('std_surf', Math.floor(Math.min(coastX(y), coastX(y + 6))) - 2, y, { w: Math.ceil(Math.abs(coastX(y) - coastX(y + 6))) + 4, d: 6 });
  b.scenic('std_boat', 31, 10, { w: 3, d: 2, variant: 'sail' });
  b.scenic('std_boat', 27, 13, { w: 3, d: 2, variant: 'motor' });
  b.scenic('std_boat', 34, 1, { w: 3, d: 2, variant: 'sailUp' });
  b.scenic('std_boat', 40, 14, { w: 3, d: 2, variant: 'sailUp', rot: 1 });
  b.scenic('std_boat', 36, 22, { w: 3, d: 2, variant: 'motor', rot: 1 });
  b.scenic('std_boat', 43, 1, { w: 3, d: 2, variant: 'sailUp' });
  b.scenic('std_boat', 33, 31, { w: 3, d: 2, variant: 'sailUp' });
  b.scenic('std_boat', 50, 18, { w: 3, d: 2, variant: 'sail' });

  // ── south: the gelato truck, the bathing huts, the dunes ──
  b.scenic('std_foodTruck', 1, 17, { w: 3, d: 2 });
  b.scenic('std_picnic', 5, 17, { w: 2 });
  b.scenic('std_umbrella', 4, 18);
  b.decor('std_aboard', 4, 17);
  // bike racks full of rental cruisers: on the deck's end and on the sand under the truck
  b.scenic('std_bikes', 6, 19, { w: 3, variant: 'rack' });
  b.scenic('std_bikes', 1, 20, { w: 3, variant: 'rack' });
  b.scenic('std_planter', 7, 17, { w: 2, variant: 'bloom' });
  // the beach volleyball court in the dunes behind the bathing huts, roped off
  const COURT = { x: -6, y: 22, w: 5, d: 5 };
  b.scenic('std_court', COURT.x, COURT.y, { w: COURT.w, d: COURT.d });
  const offCourt = (x: number, y: number, w = 1, d = 1) => x + w <= COURT.x - 1 || x >= COURT.x + COURT.w + 1 || y + d <= COURT.y - 1 || y >= COURT.y + COURT.d + 1;
  const huts = ['coral', 'mint', 'lemon', 'sky', 'pink', 'white', 'lilac', 'teal', 'butter'];
  for (let x = -22; x < 0; x++) if (x !== -5 && x !== -4 && x !== -13) b.scenic('std_hut', x, 18, { color: huts[(x + 40) % huts.length] });
  for (const [x, y] of [[-20, 20], [-16, 20], [-9, 20], [-1, 20]] as const) b.decor('std_decal', x, y, { variant: 'towel' });
  b.scenic('std_windbreak', -12, 20, { w: 2 });
  b.scenic('std_umbrella', -18, 20);
  b.scenic('std_deckchair', -17, 20);
  for (const [x, y, w, d] of [[-15, 22, 5, 4], [-11, 27, 6, 4], [-1, 23, 4, 3], [1, 30, 5, 4], [-9, 32, 6, 4], [-20, 30, 5, 4], [-2, 36, 5, 4], [-16, 37, 6, 4], [5, 37, 4, 3], [-25, 22, 5, 4], [6, 22, 4, 3], [-8, 38, 4, 3], [-26, 31, 5, 4], [-20, 42, 6, 4]] as const)
    if (offCourt(x, y, w, d)) b.scenic('std_dune', x, y, { w, d });
  for (const [x, y] of [[-20, 26], [-9, 24], [-16, 33], [4, 26], [-5, 41]] as const) if (offCourt(x, y, 2, 2)) b.scenic('std_palm', x, y, { variant: 'date' });
  for (const [x, y] of [[-17, 25], [-7, 30], [3, 34], [-12, 35], [-22, 33], [0, 28]] as const) if (offCourt(x, y, 4, 1)) b.scenic('std_sandFence', x, y, { w: x === 0 ? 3 : 4 });
  // red-and-white striped windbreaks, towels with cool boxes and beach bags all over the south beach
  for (let i = 0; i < 60; i++) {
    const y = 20 + Math.floor(hash(i, 1, 81) * 34);
    const x = Math.floor(coastX(y + 0.5) - 3 - hash(i, 2, 81) * 14);
    if (!b.isFree(x, y) || !b.isFree(x + 1, y) || !offCourt(x, y, 2, 1) || b.groundAt(x, y) === 'deck' || b.groundAt(x + 1, y) === 'deck') continue;
    const h = hash(i, 3, 81);
    if (h < 0.4) b.scenic('std_windbreak', x, y, { w: 2, variant: 'red' });
    else b.decor('std_decal', x, y, { variant: h < 0.7 ? 'cooler' : 'kit' });
  }
  for (let i = 0; i < 150; i++) {
    const x = -26 + Math.floor(hash(i, 1, 21) * 36);
    const y = 21 + Math.floor(hash(i, 2, 21) * 24);
    if (x >= coastX(y) - 2 || !offCourt(x, y) || x < y - 38) continue;
    b.decor('std_marram', x, y);
  }
  for (let i = 0; i < 26; i++) b.decor('std_decal', -24 + Math.floor(hash(i, 11, 21) * 30), 21 + Math.floor(hash(i, 12, 21) * 20), { variant: hash(i, 13, 21) < 0.6 ? 'iceplant' : 'gazania' });
  // the beach south of the studio, down to the sea
  for (const [x, y] of [[11, 22], [14, 21], [12, 25], [16, 24], [9, 28], [13, 28]] as const) {
    if (x >= coastX(y) - 1) continue;
    b.scenic('std_umbrella', x, y);
    b.scenic('std_deckchair', x, y + 1);
  }
  b.scenic('std_castle', 17, 27);
  // by the studio's front corner: a family's spot on the sand
  b.scenic('std_umbrella', 18, 19);
  b.scenic('std_deckchair', 19, 19, { rot: 1 });
  b.scenic('std_windbreak', 17, 21, { w: 2 });
  b.decor('std_decal', 18, 20, { variant: 'towel' });
  b.decor('std_decal', 19, 21, { variant: 'ball' });
  b.decor('std_decal', 20, 18, { variant: 'steps' });
  b.scenic('std_castle', 20, 21);
  b.scenic('std_totem', 11, 18);
  b.scenic('std_windbreak', 15, 26, { w: 2 });
  b.scenic('std_windbreak', 7, 24, { w: 2 });
  for (const [x, y] of [[12, 23], [15, 23], [10, 26], [14, 27], [11, 29]] as const) b.decor('std_decal', x, y, { variant: 'towel' });
  b.scenic('std_boat', 15, 31, { w: 2, d: 1, variant: 'dinghy' });

  // ── density: the district is a jungle of palms and bougainvillea ──
  /** Free, outside the room, on sand or verge (not on a lane, a boardwalk or the sea). */
  const open = (x: number, y: number, w = 1, d = 1) => {
    for (let j = 0; j < d; j++)
      for (let i = 0; i < w; i++) {
        const X = x + i;
        const Y = y + j;
        if (!b.isFree(X, Y) || b.inside(X, Y) || X >= coastX(Y + 0.5) - 1) return false;
        const g = b.groundAt(X, Y);
        if (g === 'gravel' || g === 'deck' || g === 'water') return false;
      }
    return true;
  };
  const shrubs = ['bougain', 'bougain', 'hibiscus', 'oleander', 'seagrape', 'bougain', 'agave', 'hibiscus'];
  // lamp posts and picket fences along the two lanes
  for (let y = -44; y < -2; y += 5) {
    if (open(2, y)) b.scenic('std_lamp', 2, y, { variant: 'banner' });
    if (open(6, y + 2)) b.scenic('std_lamp', 6, y + 2);
  }
  for (let x = -46; x < -2; x += 5) {
    if (open(x, 0)) b.scenic('std_lamp', x, 0, { variant: 'banner' });
    if (open(x + 2, 4)) b.scenic('std_lamp', x + 2, 4);
  }
  for (let y = -44; y < -3; y += 4) if (open(1, y, 1, 3)) b.scenic('std_picket', 1, y, { w: 3, rot: 1 });
  for (let x = -46; x < -3; x += 4) if (open(x, 5, 3, 1)) b.scenic('std_picket', x, 5, { w: 3 });
  // the gardens between the houses
  for (let y = -46; y < 13; y++)
    for (let x = -48; x < 16; x++) {
      if (x >= -1 && y >= -1) continue;
      const h = hash(x, y, 61);
      if (h < 0.09 && open(x, y, 2, 2)) b.scenic('std_palm', x, y, { variant: hash(x, y, 62) < 0.7 ? 'coco' : 'fan' });
      else if (h < 0.42 && open(x, y)) b.scenic('std_bush', x, y, { variant: shrubs[Math.floor(hash(x, y, 63) * shrubs.length)] });
      else if (h < 0.55 && open(x, y)) b.decor('std_decal', x, y, { variant: hash(x, y, 64) < 0.5 ? 'gazania' : 'iceplant' });
    }
  // post-and-rope railings along the beach side of both boardwalks, palms over them
  for (let x = -48; x < 0; x += 4) if (open(x, 17, 4, 1)) b.scenic('std_ropeFence', x, 17, { w: 4 });
  for (let y = -44; y < 4; y += 4) if (open(20, y, 1, 4)) b.scenic('std_ropeFence', 20, y, { w: 4, rot: 1 });
  for (let x = -46; x < 0; x += 7) if (open(x, 19, 2, 2)) b.scenic('std_palm', x, 19, { variant: 'coco' });
  for (let y = -42; y < 4; y += 9) if (open(21, y, 2, 2)) b.scenic('std_palm', 21, y, { variant: 'coco' });
  // the boardwalk in front of the studio: lamps on the outer edge, railings down to the sand
  const freeRow = (x: number, y: number, w: number, d: number) => {
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) if (!b.isFree(x + i, y + j) || b.inside(x + i, y + j)) return false;
    return true;
  };
  for (let x = 1; x < 16; x += 4) if (freeRow(x, R + 2, 1, 1)) b.scenic('std_lamp', x, R + 2);
  for (let y = 1; y < 13; y += 4) if (freeRow(C + 3, y, 1, 1)) b.scenic('std_lamp', C + 3, y);
  for (const x of [1, 5]) if (open(x, R + 6, 4, 1)) b.scenic('std_ropeFence', x, R + 6, { w: 4 });
  for (const x of [10, 13]) if (open(x, R + 3, 3, 1)) b.scenic('std_ropeFence', x, R + 3, { w: 3 });
  for (const y of [6, 10]) if (open(C + 4, y, 1, 3)) b.scenic('std_ropeFence', C + 4, y, { w: 3, rot: 1 });
  // by the bathing huts and the dune path: a volleyball court, palms, bikes and planters on the deck
  for (const [x, y] of [[-10, 21], [-1, 28], [2, 23], [-18, 27], [-8, 33]] as const) if (open(x, y, 2, 2)) b.scenic('std_palm', x, y, { variant: 'coco' });
  for (const [x, y] of [[0, 21], [-2, 22], [1, 26], [-9, 24], [-12, 22], [-16, 21], [3, 21], [-1, 25]] as const)
    if (open(x, y)) b.scenic('std_bush', x, y, { variant: shrubs[(x * 7 + y * 3 + 80) % shrubs.length] });
  for (const [x, y, w, r] of [[10, 17, 2, 0], [12, 17, 2, 0]] as const) if (freeRow(x, y, w, 1)) b.scenic('std_bikes', x, y, { w, rot: r });
  for (const x of [-30, -24, -14, -1]) if (freeRow(x, R + 2, 2, 1)) b.scenic('std_planter', x, R + 2, { w: 2, variant: 'bloom' });
  for (const y of [-38, -29, -20, -11, -2]) if (freeRow(C + 3, y, 1, 2)) b.scenic('std_planter', C + 3, y, { w: 2, rot: 1, variant: 'bloom' });
  // benches and flower boxes all along both boardwalks, on the house side and the beach side
  for (const x of [-43, -40, -34, -28, -22, -16, -10, -6]) if (freeRow(x, R, 2, 1)) b.scenic('std_planter', x, R, { w: 2, variant: 'bloom' });
  for (const x of [-46, -41, -36, -27, -20, -11, -5]) if (freeRow(x, R + 2, 2, 1)) b.scenic('std_bench', x, R + 2, { w: 2 });
  for (const y of [-44, -40, -35, -25, -22, -13, -1]) if (freeRow(C, y, 1, 2)) b.scenic('std_planter', C, y, { w: 2, rot: 1, variant: 'bloom' });
  for (const y of [-42, -34, -26, -16, -6]) if (freeRow(C + 3, y, 1, 2)) b.scenic('std_bench', C + 3, y, { w: 2, rot: 1 });
  for (const x of [3, 7, 11]) if (freeRow(x, R + 2, 2, 1)) b.scenic('std_planter', x, R + 2, { w: 2, variant: 'bloom' });
  for (const y of [3, 7, 11]) if (freeRow(C + 3, y, 1, 2)) b.scenic('std_planter', C + 3, y, { w: 2, rot: 1, variant: 'bloom' });
  // the beach side of the east boardwalk: shrubs, grass, palms
  for (let y = -44; y < 14; y++) {
    const h = hash(20, y, 65);
    if (h < 0.3 && open(20, y)) b.scenic('std_bush', 20, y, { variant: shrubs[Math.floor(hash(y, 1, 66) * shrubs.length)] });
    else if (h < 0.75 && open(20, y)) b.decor('std_marram', 20, y);
    if (hash(21, y, 67) < 0.4 && open(21, y)) b.decor('std_marram', 21, y);
  }
  // the beach side of the south boardwalk and round the gelato truck
  for (let x = -48; x < 16; x++) {
    const h = hash(x, 17, 68);
    if (h < 0.25 && open(x, 17)) b.scenic('std_bush', x, 17, { variant: shrubs[Math.floor(hash(x, 2, 66) * shrubs.length)] });
    else if (h < 0.7 && open(x, 17)) b.decor('std_marram', x, 17);
    if (hash(x, 19, 69) < 0.5 && open(x, 19)) b.decor('std_marram', x, 19);
  }
  // more parasols down the south beach, a few tiles back from the sea
  for (let i = 0; i < 70; i++) {
    const y = 18 + Math.floor(hash(i, 7, 71) * 40);
    const x = Math.floor(coastX(y) - 3.5 - hash(i, 6, 71) * 7);
    if (!open(x, y, 2, 2)) continue;
    b.scenic('std_umbrella', x, y);
    b.scenic('std_deckchair', x + 1, y, { rot: 1 });
    if (hash(i, 8, 71) < 0.6) b.scenic('std_deckchair', x + 1, y + 1, { rot: 1 });
    else b.decor('std_decal', x, y + 1, { variant: 'towel' });
  }
  // the busy beach below the studio: rows of parasols with deckchairs, a palm here and there
  for (let y = 18; y < 44; y += 3)
    for (let x = -34 + (y % 2) * 1.5; x < 26; x += 3.2) {
      const X = Math.floor(x + (hash(Math.round(x), y, 73) - 0.5) * 1.2);
      const dSea = coastX(y + 0.5) - X;
      if (dSea < 3 || dSea > 16 || hash(X, y, 74) < 0.22 || !open(X, y, 2, 2)) continue;
      if (hash(X, y, 75) < 0.12) {
        b.scenic('std_palm', X, y, { variant: 'coco' });
        continue;
      }
      b.scenic('std_umbrella', X, y);
      b.scenic('std_deckchair', X + 1, y, { rot: 1 });
      if (hash(X, y, 76) < 0.6) b.scenic('std_deckchair', X + 1, y + 1, { rot: 1 });
      else if (hash(X, y, 77) < 0.5) b.scenic('std_deckchair', X, y + 1);
      else b.decor('std_decal', X, y + 1, { variant: 'towel' });
    }
  // the strip of sand between the boardwalk's corner, the pier and the sea: parasols, towels, toys
  for (let y = 15; y < 36; y += 2)
    for (let k2 = 0; k2 < 4; k2++) {
      const X = Math.floor(coastX(y + 0.5) - 2.4 - k2 * 2.6 - hash(y, k2, 78) * 1.2);
      if (!open(X, y, 2, 2)) continue;
      const h = hash(X, y, 79);
      if (h < 0.55) {
        b.scenic('std_umbrella', X, y);
        b.scenic('std_deckchair', X + 1, y, { rot: 1 });
        if (h < 0.3) b.scenic('std_deckchair', X + 1, y + 1, { rot: 1 });
        b.decor('std_decal', X, y + 1, { variant: 'towel' });
      } else if (h < 0.7) b.scenic('std_windbreak', X, y, { w: 2 });
      else if (h < 0.8) b.scenic('std_castle', X, y);
      else b.decor('std_marram', X, y);
    }
  // grass in the sand between the parasols of the east beach
  for (let i = 0; i < 260; i++) {
    const y = -44 + Math.floor(hash(i, 1, 72) * 60);
    const x = 21 + Math.floor(hash(i, 2, 72) * 10);
    if (open(x, y) && x < coastX(y) - 2.5) b.decor('std_marram', x, y);
  }
  // thick dune grass all over the dunes and the back of the beach
  for (let i = 0; i < 900; i++) {
    const x = -46 + Math.floor(hash(i, 1, 70) * 60);
    const y = 18 + Math.floor(hash(i, 2, 70) * 30);
    if (!open(x, y) || x >= coastX(y) - 3 || !offCourt(x, y)) continue;
    b.decor('std_marram', x, y);
  }
  for (let i = 0; i < 80; i++) {
    const x = -44 + Math.floor(hash(i, 3, 70) * 50);
    const y = 18 + Math.floor(hash(i, 4, 70) * 26);
    if (open(x, y) && x < coastX(y) - 4) b.scenic('std_bush', x, y, { variant: ['agave', 'seagrape', 'bougain', 'agave'][Math.floor(hash(i, 5, 70) * 4)] });
  }

  // ── flat details ──────────────────────────────────────────
  for (let i = 0; i < 160; i++) {
    const y = -36 + Math.floor(hash(i, 3, 31) * 74);
    const x = 21 + Math.floor(hash(i, 4, 31) * 12);
    const d = coastX(y) - x;
    if (d < 0.5) continue;
    const v = d < 2.2 ? (hash(i, 5, 31) < 0.6 ? 'wrack' : 'shells') : ['steps', 'shells', 'towel', 'steps', 'ball', 'heart'][Math.floor(hash(i, 6, 31) * 6)];
    b.decor('std_decal', x, y, { variant: v });
  }
  for (let i = 0; i < 40; i++) b.decor('std_decal', -20 + Math.floor(hash(i, 7, 31) * 40), 21 + Math.floor(hash(i, 8, 31) * 14), { variant: hash(i, 9, 31) < 0.5 ? 'steps' : 'shells' });
  // inside: a camera cable taped down, a dropped sketch, paint by the easels
  b.decor('std_decal', 7, 4, { variant: 'cable' });
  b.decor('std_decal', 11, 6, { variant: 'cable' });
  b.decor('std_decal', 3, 7, { variant: 'paper' });
  b.decor('std_decal', 4, 10, { variant: 'splat' });

  // ── things that move ──────────────────────────────────────
  // strollers along the two boardwalks, round the studio's front corner (both ends off the frame)
  b.walkers([[17.6, -46], [17.6, 15.5], [-44, 15.5]], 6, { speed: 0.55 });
  // the water taxi crosses the bay past the end of the pier (both ends off the frame)
  b.vehicle({ type: 'std_ferry', x: 48, y: -40, axis: 'y', length: 110, w: 3, speed: 1.3, endWait: 8, phase: 30 });

  // ── life ──────────────────────────────────────────────────
  b.critters('std_gull', 21, -24, 4, 30, 7);
  b.critters('std_gull', 16, -12, 4, 26, 4);
  b.critters('std_gull', 9, 21, 10, 8, 4);
  b.critters('std_gull', 1, 18, 8, 3, 3);
  b.critters('std_gullFly', 22, -30, 20, 56, 7);
  b.critters('std_gullFly', -10, -20, 20, 20, 3);
  b.critters('std_crab', 24, -24, 2, 10, 2);
  b.critters('std_crab', 25, -8, 2, 10, 2);
  b.critters('std_crab', 22, 17, 2, 6, 2);
  b.critters('dog', 21, 12, 4, 6, 1);
  b.critters('std_gull', 21, 0, 5, 18, 4);
  b.critters('std_gull', -20, 19, 18, 6, 4);
  b.critters('dog', 8, 22, 6, 6, 1);
  b.critters('cat', -9, 14.4, 3, 2, 1);
  b.critters('cat', 16.5, 1, 2, 4, 1);
}

studioBoardwalk(b);
decorateWalls(b, ['plantShelf', 'neon', 'sketches', 'pegboard', 'surfboard', 'mirror']);

export const studio = b.build({
  name: 'Creative Studio',
  description: 'A sunny loft for content: drawing desks, edit bays, a photo/video set, a moodboard wall and a lounge.',
  tagline: 'Ideate, design and bring ideas to life.',
  emoji: '🎨',
  theme: {
    floorA: '#e0b98c',
    floorB: '#d6ae80',
    floorDetail: '#c39b6f',
    wall: '#f7d9c4',
    wallTrim: '#e2553b',
    slab: '#8a5e3c',
    accent: '#ef7aa8',
    accent2: '#f2b84b',
    ui: '#f2b98a',
    sky: ['#2c2246', '#e08a6a'],
  },
  outfitCategory: 'studio',
  defaultOutfitId: 'studio.artist',
  environment: { floor: 'planks', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Sketch brand mascot',
    'Color-grade launch reel',
    'Shoot product flatlay',
    'Record podcast ep. 12',
    'Storyboard launch video',
    'Kern the logotype',
    'Edit short-form clips',
    'Write social captions',
  ],
});

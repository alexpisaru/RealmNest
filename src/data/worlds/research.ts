import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('research', 18, 14);

b.wall('window', 'ne', 1, 3);
b.wall('screen', 'ne', 6, 4);
b.wall('window', 'ne', 11, 3);
b.wall('door', 'ne', 16, 1);
b.wall('window', 'nw', 1, 3);
b.wall('pinboard', 'nw', 5, 3);
b.wall('window', 'nw', 9, 3);
// the library's own wall pieces: star charts over the archives, specimen shelves, the climbers' pegs by the door
b.wall('res_starchart', 'ne', 14, 2);
b.wall('res_shelf', 'ne', 4, 2);
b.wall('res_pegs', 'ne', 17, 1);
b.wall('res_starchart', 'nw', 8, 1);
b.wall('res_starchart', 'nw', 12, 2);

b.patch('rug', 6, 1, 6, 5, { color: '#9b7bea' });
b.patch('rug', 11, 10, 6, 4, { color: '#c98a5a' });
b.patch('gravel', 11, 5, 7, 4);

b.station('desk', 1, 2, 'WORKSTATION', 'Research desk 1', { variant: 'books', verb: 'reading papers' });
b.station('desk', 1, 11, 'WORKSTATION', 'Research desk 2', { variant: 'books', verb: 'writing a review' });
b.station('labbench', 4, 6, 'LAB_BENCH', 'Analysis station', { variant: 'microscope', slots: 2, verb: 'analysing samples' });
b.station('terrarium', 12, 6, 'CROP', 'Experimental greenhouse A', { verb: 'measuring growth' });
b.station('terrarium', 15, 6, 'CROP', 'Experimental greenhouse B', { verb: 'measuring growth' });
b.station('hydro', 8, 9, 'CROP', 'Seed planters', { verb: 'sampling seedlings' });
b.station('desk', 4, 2, 'WORKSTATION', 'Data desk', { variant: 'dual', verb: 'modelling data' });

const brief = b.prop('table', 7, 2);
b.around(brief, 'MEETING', 'Briefing zone');
b.prop('globe', 11, 3);

b.station('bookshelf', 0, 5, 'STORAGE', 'Archive A', { rot: 1, variant: 'archive' });
b.station('bookshelf', 0, 8, 'STORAGE', 'Archive B', { rot: 1, variant: 'archive' });
b.station('bookshelf', 14, 0, 'STORAGE', 'Archive C', { variant: 'archive' });

b.seats('sofa', 12, 11, 'LOUNGE', 'Reading nook', { color: '#9b7bea' });
b.seats('armchair', 15, 11, 'LOUNGE', 'Armchair', { color: '#c98a5a' });
b.station('counter', 8, 12, 'COFFEE', 'Tea station', { slots: 2 });
b.point('DECORATIVE', 11.5, 4.5, 'ne', 'Globe');
for (const [x, y] of [[17, 13], [0, 0], [17, 4], [10, 0]]) b.prop(y === 4 ? 'plantTall' : 'plant', x, y);
// the library's smaller treasures, on free tiles along the walls and by the globe
b.prop('res_planchest', 2, 0);
b.prop('res_telescope', 12, 0);
b.prop('res_archboxes', 13, 0);
b.prop('res_orrery', 13, 3);
b.prop('res_trolley', 7, 6);
b.prop('res_stove', 0, 13);

b.spawn(16, 0);
b.spawn(16, 1);
b.node('atrium', 9, 7);

// ── the summit ───────────────────────────────────────────────
// The library is the stone wing of an observatory lodge on a mountain top.
// Behind it the summit plateau: the old granite dome with its slit open and
// the telescope looking out, a second dome, the radio dish, the weather
// station and the summit cross on its knoll, the far peaks beyond the brink.
// The lodge's chalet block stands to the west with its sun terrace, then the
// chapel and the larch woods; in front, the brink: the viewpoint with its coin
// telescope, the cable car's top station and its pylon, a tarn, the road
// winding off east along its parapet — and far below, the valley and its lake.
/** The far brink and the front brink as v = x + y for a screen column u = x − y (keep in sync with the pack's ground.ts). */
const vFar = (u: number) => -19.5 - 0.04 * Math.abs(u - 2) + 1.6 * Math.sin(u * 0.19 + 1.3) + 0.8 * Math.sin(u * 0.53 + 0.4);
/** The stream's tiles from the pond down to the front brink (its last tile's u = x − y is STREAM_U in ground.ts). */
const STREAM: [number, number][] = [[11, 22], [11, 23], [12, 24], [12, 25], [12, 26], [13, 27], [13, 28], [13, 29], [13, 30], [14, 31], [14, 32], [14, 33]];
const vFront = (u: number) => 43 + 0.6 * Math.max(0, u - 18) + 1.2 * Math.sin(u * 0.23 + 1) + 0.6 * Math.sin(u * 0.61 + 0.3);

function observatorySummit(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 16, outer: 'meadow', frontWalls: true, light: { tint: '#ffe2b0', strength: 0.34 }, grade: { tone: [0, 0.115, 0.205, 0.302, 0.4, 0.5, 0.602, 0.705, 0.807, 0.908, 1] } });
  const H = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 1442695041, 1274126177);
    h ^= h >>> 16;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  /** A tile well inside the summit (m: margin in v from both brinks). */
  const onSummit = (x: number, y: number, m = 1) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const u = x + dx - (y + dy);
      const v = x + dx + y + dy;
      if (v < vFar(u) + m || v > vFront(u) - m) return false;
    }
    return true;
  };
  const nearRoom = (x: number, y: number) => x >= -1 && x <= C && y >= -1 && y <= R;
  const free = (x: number, y: number, m = 1) => onSummit(x, y, m) && !nearRoom(x, y) && b.isFree(x, y) && !onRoute.has(`${x},${y}`);

  // ── ground ──
  // the sun terrace along the lodge and the library, flags by the north door
  b.ground('paving', -11, 14, 31, 3);
  b.ground('paving', 14, -3, 6, 3);
  // the forecourt and the road winding east along the brink
  b.ground('gravel', 18, 0, 6, 14);
  b.ground('gravel', 24, 3, 30, 3);
  // footpaths: to the cable car, to the viewpoint, to the chapel, up to the domes and the cross
  for (const [x, y, w, d] of [[5, 17, 2, 2], [6, 19, 2, 3], [12, 17, 2, 1], [13, 17, 5, 2], [-2, 17, 2, 2], [-1, 18, 1, 1], [15, -6, 2, 3], [12, -7, 4, 2], [3, -6, 3, 2], [1, -6, 2, 1]] as const) b.ground('dirt', x, y, w, d);
  // flagged walks: a loop round the chapel and its doorstep, a ring round the open dome
  for (const [x, y, w, d] of [[-6, 17, 1, 8], [-6, 24, 8, 1], [1, 17, 1, 8], [-4, 23, 5, 1], [10, -13, 2, 9], [3, -13, 9, 2], [3, -13, 1, 9], [3, -6, 9, 2], [12, -6, 4, 1]] as const) b.ground('dirt', x, y, w, d);
  b.ground('dirt', 11, -5, 7, 2);
  b.ground('dirt', 12, -10, 5, 1);
  // scree under the far brink, glacier-polished slabs, old snow in the hollows
  for (const [x, y, w, d] of [[-7, -12, 5, 3], [23, -16, 5, 4], [33, -12, 4, 4], [-17, 1, 3, 4], [28, 9, 2, 2]] as const) b.ground('sand', x, y, w, d);
  // the larch woods' floor, west of the lodge and on the east shoulder
  b.ground('forest', -22, 3, 9, 26);
  b.ground('forest', 33, -14, 9, 11);
  // a pond in the meadow before the brink, fed by a little waterfall, and the stream running from it
  // down to the brink, where it falls over the crags into the lake (keep STREAM_U in the pack's ground.ts in sync)
  b.ground('water', 9, 19, 4, 2);
  b.ground('water', 10, 21, 3, 1);
  for (const [x, y] of STREAM) b.ground('water', x, y, 1, 1);

  // beyond the brinks: tiles that reach past either brink become 'roof' (the far peaks / the drop),
  // merged into runs along x; the pack's shader draws the brink itself. They win over the areas above.
  const beyond = (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
      const u = x + dx - (y + dy);
      const v = x + dx + y + dy;
      if (v < vFar(u) + 0.6 || v > vFront(u) - 0.6) return true;
    }
    return false;
  };
  for (let y = -70; y < 80; y++) {
    let run: number | null = null;
    for (let x = -70; x <= 80; x++) {
      const on = x < 80 && beyond(x, y) && !b.inside(x, y);
      if (on && run === null) run = x;
      if (!on && run !== null) {
        b.ground('roof', run, y, x - run, 1);
        run = null;
      }
    }
  }

  // ── the library's cut front walls, the lodge, the chapel ──
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });
  b.scenic('res_lodge', -10, -3, { w: 10, d: 18 });
  b.scenic('res_flag', -12, 9);
  b.scenic('res_chapel', -3, 19, { w: 3, d: 4 });
  b.scenic('res_falls', 10, 18);
  // stone steps down from the terrace to the walks, and up from the north door to the domes
  for (const [x, y, w, rot] of [[-2, 17, 2, 0], [5, 17, 2, 0], [13, 17, 2, 0], [15, -4, 2, 0], [11, -4, 1, 0], [16, -7, 1, 1]] as const) b.scenic('res_steps', x, y, { w, rot });

  // the sun terrace: tables, a log fountain, the woodpile, skis by the door, lanterns, benches
  b.scenic('res_woodpile', -10, 15);
  b.scenic('res_table', -8, 16);
  b.scenic('res_gear', -6, 15);
  b.scenic('res_table', -3, 16);
  b.scenic('res_trough', -1, 16);
  b.scenic('res_lamp', 2, 16);
  b.scenic('res_bench', 3, 16);
  b.scenic('res_bench', 9, 16);
  b.scenic('res_lamp', 12, 16);
  b.scenic('res_crates', 17, 16);
  // more picnic tables on the turf below the terrace
  for (const [x, y] of [[7, 18], [16, 18]] as const) if (b.isFree(x, y) && b.isFree(x + 1, y)) b.scenic('res_table', x, y);
  // a dry-stone retaining wall along the terrace's foot, broken by the steps
  for (let x = -10; x < 19; ) {
    let w = 0;
    while (w < 3 && x + w < 19 && (x + w < -7 || x + w > -4) && b.isFree(x + w, 17) && b.groundAt(x + w, 17) !== 'dirt' && b.groundAt(x + w, 17) !== 'water') w++;
    if (w >= 2) {
      b.scenic('res_drywall', x, 17, { w });
      x += w;
    } else x++;
  }
  // geraniums everywhere: boxes and pots along the terrace, by the lodge's door, the chapel and the forecourt
  for (const [x, y, v] of [[-11, 13, 'box'], [-11, 15, 'pot'], [-7, 16, 'box'], [2, 17, 'pot'], [5, 17, 'box'], [7, 16, 'pot'], [11, 17, 'box'], [14, 16, 'pot'], [16, 17, 'box'], [18, 14, 'pot'], [24, 14, 'pink'], [19, 13, 'pot'], [0, 23, 'box'], [24, 1, 'pot'], [20, -1, 'box'], [14, -2, 'pink'], [-2, 26, 'pink']] as const)
    if (b.isFree(x, y)) b.scenic('res_planter', x, y, { variant: v });

  // ── the observatory behind the library ──
  b.scenic('res_cross', -5, -14, { w: 2, d: 2 });
  b.scenic('res_dome', 5, -11, { w: 5, d: 5, variant: 'open' });
  b.scenic('res_dome', 12, -9, { w: 4, d: 4, variant: 'shut' });
  b.scenic('res_dish', 18, -10, { w: 5, d: 5 });
  b.scenic('res_dome', 25, -14, { w: 3, d: 3, variant: 'small' });
  b.scenic('res_weather', 24, -4, { w: 2, d: 2 });
  for (const [x, y] of [[27, -7], [27, -5], [29, -6]] as const) if (b.isFree(x, y) && b.isFree(x + 1, y)) b.scenic('res_solar', x, y);
  b.scenic('res_hut', 28, -11, { w: 2, d: 2 });
  b.scenic('res_mast', 25, -10);
  b.scenic('res_windsock', 19, -3);
  b.scenic('res_signpost', 14, -4);
  // the observers' pad: telescopes on concrete piers, one under its cover
  b.ground('gravel', 17, -5, 3, 2);
  for (const [x, y] of [[17, -5], [18, -4], [19, -5]] as const) b.scenic('res_pier', x, y);

  // ── the forecourt and the road ──
  b.scenic('res_jeep', 20, 10);
  b.scenic('res_timber', 19, 5, { rot: 1 });
  b.scenic('res_crates', 19, 2);
  b.scenic('res_crates', 19, 3);
  b.scenic('res_signpost', 24, 8);
  b.scenic('res_board', 23, 11);
  b.scenic('res_lamp', 19, 12);
  b.scenic('res_board', 5, 20);
  // slat fences along the paths: west of the chapel, up to the summit cross, round the pasture by the woods
  b.scenic('res_fence', -7, 18, { w: 3, rot: 1 });
  b.scenic('res_fence', -1, -5, { w: 3 });
  b.scenic('res_fence', -12, 12, { w: 4, rot: 1 });
  // snow poles on both sides of the road, a mortared parapet here and there on the lake side
  for (let x = 26; x < 52; x += 3) {
    if (onSummit(x, 2, 0.3)) b.scenic('res_snowpole', x, 2);
    if (onSummit(x + 1, 6, 0.3)) b.scenic('res_snowpole', x + 1, 6);
  }
  for (const x of [29, 38]) if (onSummit(x, 6, 0.3)) b.scenic('res_drywall', x - 2, 6, { w: 2, variant: 'parapet' });

  // ── the viewpoint at the brink before the library ──
  b.scenic('res_scope', 19, 16);
  b.scenic('res_orient', 20, 14);
  b.scenic('res_bench', 15, 17);
  // a larch rail along the brink near the viewpoint: a line over the tiles' corners hugging the edge,
  // across a tile's diagonal where the brink runs level, down or up a tile edge where it falls or
  // climbs; one piece per tile (a tile can carry two edges)
  const railAt = new Map<string, string[]>();
  const addRail = (x: number, y: number, v: string) => railAt.set(`${x},${y}`, [...(railAt.get(`${x},${y}`) ?? []), v]);
  const target = (u: number) => vFront(u) - 1.15;
  let ru = -37;
  let rv = Math.floor(target(ru));
  if ((rv - ru) % 2 !== 0) rv -= 1;
  while (ru < 17) {
    const cx = (ru + rv) / 2;
    const cy = (rv - ru) / 2;
    if (target(ru + 1) - rv > 1.5) {
      addRail(cx, cy - 1, 'sw');
      ru += 1;
      rv += 1;
    } else if (rv <= target(ru + 1) && rv <= target(ru + 2)) {
      addRail(cx, cy - 1, 'diag');
      ru += 2;
    } else {
      addRail(cx - 1, cy - 1, 'se');
      ru += 1;
      rv -= 1;
    }
  }
  for (const [key, parts] of railAt) {
    const [x, y] = key.split(',').map(Number);
    if (!nearRoom(x, y) && b.isFree(x, y) && b.groundAt(x, y) !== 'water') b.scenic('res_railing', x, y, { w: 1, variant: parts.join(',') });
  }

  // ── the cable car's top station and its pylon at the brink ──
  b.scenic('res_station', 6, 22, { w: 4, d: 3 });
  b.scenic('res_pylon', 6, 27, { w: 2, d: 2, variant: '0,-5' });
  b.scenic('res_signpost', 4, 21);

  // ── spruces: a dark wood along the far skyline, the west wood by the lodge and the chapel, groups on
  // the east shoulder, a few at the brink; never in front of the room or the buildings (screen boxes in u, v)
  // (u0, u1: the thing's screen columns; vb, vf: its back and front in v; a tree hides it when it
  // stands in front of its back and its crown reaches up over its front)
  const keepClear: [number, number, number, number][] = [
    [-14.5, 18.5, -1, 33], // the library
    [-26, 4, -14, 16], // the lodge
    [-27.5, -17.5, 15, 25], // the chapel
    [-21, -10.5, 27, 35.5], // the cable car station
    [10, 22.5, -7, 5], // the open dome
    [15.5, 26.5, 2, 11.5], // the shut dome
    [21.5, 34, 7, 18.5], // the dish
    [26, 33, 19, 23], // the weather station
  ];
  // the cable car's line (see CABLE in the pack's lodge.ts): from the pylon's head at 150 z out over the
  // brink to 30 z far beyond the frame, sagging 10 z; screen points (px at k = 4, X = u · 64, Y = v · 32 − z · 4)
  const cableLine: [number, number][] = [];
  for (const off of [0.42, 1.58])
    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      const x = 6 + off + 13 * t;
      const y = 28 + 40 * t;
      const z = 150 - 120 * t - Math.sin(t * Math.PI) * 10;
      cableLine.push([(x - y) * 64, (x + y) * 32 - z * 4]);
    }
  // and from the station's bull wheel up to the pylon's head
  for (const off of [0.42, 1.58])
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = 7.3 + off - 1.3 * t;
      const y = 25 + 3 * t;
      const z = 18 + 132 * t;
      cableLine.push([(x - y) * 64, (x + y) * 32 - z * 4]);
    }
  /** Would a tree (or anything hgt v-units tall) at (x, y) reach the cable car's line on the screen? */
  const underCable = (x: number, y: number, hgt: number) => {
    const X = (x - y) * 64;
    const Yb = (x + y + 1) * 32;
    const top = Yb - hgt * 32;
    return cableLine.some(([cx, cy]) => Math.abs(cx - X) < 80 && cy > top - 24 && cy < Yb + 8);
  };
  const hides = (x: number, y: number, hgt: number) => {
    const u = x - y;
    const v = x + y + 1;
    return underCable(x, y, hgt) || keepClear.some(([u0, u1, vb, vf]) => u + 1.3 > u0 && u - 1.3 < u1 && v > vb && v - hgt < vf);
  };
  // passers-by: hikers coming up the road to the lodge, round the open dome, round the chapel
  const routes: { path: [number, number][]; count: number; loop?: boolean; speed?: number }[] = [
    { path: [[47, 3.3], [22.5, 3.3], [22.5, 15.5], [-4.5, 15.5]], count: 3, speed: 0.5 },
    { path: [[11, -5], [11, -12.5], [3.5, -12.5], [3.5, -5]], count: 2, loop: true, speed: 0.42 },
    { path: [[-5.5, 18], [-5.5, 24.5], [1.5, 24.5], [1.5, 18]], count: 1, loop: true, speed: 0.4 },
  ];
  const onRoute = new Set<string>();
  for (const r of routes) {
    const pts = r.loop ? [...r.path, r.path[0]] : r.path;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
      for (let j = 0; j <= n; j++) {
        const x = x0 + ((x1 - x0) * j) / n;
        const y = y0 + ((y1 - y0) * j) / n;
        for (const [dx, dy] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) onRoute.add(`${Math.floor(x + dx)},${Math.floor(y + dy)}`);
      }
    }
    b.walkers(r.path, r.count, { loop: r.loop, speed: r.speed });
  }
  // the red runabout drives the road down to the valley and back, parking in the forecourt
  b.vehicle({ type: 'res_jeep', variant: 'red', backVariant: 'red-back', x: 20, y: 4, axis: 'x', length: 40, w: 2, speed: 1.5, endWait: 16, phase: 5 });
  for (let x = 20; x < 60; x++) for (const y of [4]) onRoute.add(`${x},${y}`);
  /** Near the stream's last run over the turf and its fall down the crags (see streamU / STREAM_X in ground.ts). */
  const nearFall = (x: number, y: number) => {
    const v = x + y + 1;
    const uf = v < 43 ? -14 - (v - 39) * 0.66 : -16.3;
    return v > 37 && Math.abs(x - y - uf) < 1.6;
  };
  const treeOk = (x: number, y: number) => {
    if (onRoute.has(`${x},${y}`)) return false;
    const g = b.groundAt(x, y);
    const u = x - y;
    const v = x + y + 1;
    const onCrags = v > vFront(u) + 0.3 && v < vFront(u) + 4.5;
    return (onSummit(x, y, 0.4) || onCrags) && !nearFall(x, y) && !nearRoom(x, y) && b.isFree(x, y) && g !== 'gravel' && g !== 'paving' && g !== 'water' && g !== 'dirt' && !hides(x, y, 14);
  };
  for (let y = -40; y < 56; y++)
    for (let x = -42; x < 56; x++) {
      const u = x - y;
      const v = x + y;
      if (u < -36 || u > 40) continue;
      const fromFar = v - vFar(u);
      const toFront = vFront(u) - v;
      let dens = 0.03;
      if (fromFar < 5) dens = 0.42;
      else if (u < -24) dens = 0.12;
      else if (u > 27) dens = 0.16;
      else if (toFront < 4) dens = toFront < 0 ? 0.16 : 0.12;
      if (H(x, y, 21) < dens && treeOk(x, y)) b.scenic('res_spruce', x, y);
    }
  // the old larches and an arolla pine or two by the lodge, a lightning-struck snag on the east shoulder
  for (const [t, x, y] of [['res_larch', -13, 2], ['res_pine', -11, -1], ['res_larch', -15, 15], ['res_snag', 38, -9]] as const) if (treeOk(x, y)) b.scenic(t, x, y);

  // ── stones: boulders big and small, cairns along the paths, a few shrubs ──
  const boulders: [number, number, string][] = [
    [-2, -11, 'big'], [3, -12, 'cluster'], [11, -13, 'slab'], [15, -14, 'big'], [21, -14, 'cluster'], [27, -15, 'mossy'], [31, -13, 'big'], [-8, -10, 'cluster'],
    [-12, -6, 'big'], [24, 1, 'slab'], [31, 8, 'cluster'], [36, 6, 'big'], [27, 12, 'mossy'], [23, 15, 'cluster'], [14, 22, 'big'], [11, 25, 'cluster'],
    [2, 25, 'slab'], [-3, 25, 'big'], [-8, 21, 'mossy'], [13, 19, 'slab'], [17, 20, 'mossy'], [4, -8, 'slab'], [9, -5, 'big'],
  ];
  for (const [x, y, v] of boulders) if (free(x, y, 0.6)) b.scenic('res_boulder', x, y, { variant: v });
  for (const [x, y] of [[4, -6], [14, -6], [-1, 18], [8, 18], [16, 19], [30, 1], [22, -6]] as const) if (free(x, y, 0.5)) b.scenic('res_cairn', x, y);
  const shrubs: [number, number, string][] = [[-6, -6, 'mugo'], [-4, -9, 'juniper'], [7, -14, 'alpenrose'], [19, -13, 'juniper'], [29, 4, 'mugo'], [22, 18, 'alpenrose'], [12, 23, 'juniper'], [-10, 19, 'alpenrose'], [-6, 28, 'mugo'], [26, -10, 'alpenrose'], [33, 5, 'juniper']];
  for (const [x, y, v] of shrubs) if (free(x, y, 0.6)) b.scenic('res_shrub', x, y, { variant: v });
  // alpenrose and juniper bushes all over the meadows
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const h = H(x, y, 13);
      const g = b.groundAt(x, y);
      if (h < 0.05 && g !== 'gravel' && g !== 'paving' && g !== 'water' && g !== 'dirt' && free(x, y, 0.8)) b.scenic('res_shrub', x, y, { variant: h < 0.03 ? 'alpenrose' : h < 0.042 ? 'juniper' : 'mugo' });
    }
  // scattered boulders over the open meadows
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const h = H(x, y, 3);
      const g = b.groundAt(x, y);
      if (h < 0.065 && g !== 'gravel' && g !== 'paving' && g !== 'water' && g !== 'dirt' && free(x, y, 1.4)) b.scenic('res_boulder', x, y, { variant: h < 0.016 ? 'slab' : h < 0.035 ? 'big' : h < 0.05 ? 'cluster' : 'mossy' });
    }
  // the rich slope: rocky outcrops, alpenrose bushes, young spruces, hummocks and drifts of flowers everywhere
  const open = (x: number, y: number, m = 1) => {
    const g = b.groundAt(x, y);
    return g !== 'gravel' && g !== 'paving' && g !== 'water' && g !== 'dirt' && free(x, y, m);
  };
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      if (H(x, y, 63) < 0.05 && [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => open(x + dx, y + dy, 1.2)) && !hides(x + 1, y + 1, 2)) b.scenic('res_outcrop', x, y, { w: 2, d: 2 });
    }
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const h = H(x, y, 64);
      if (!open(x, y, 1)) continue;
      if (h < 0.07) b.scenic('res_boulder', x, y, { variant: h < 0.03 ? 'big' : h < 0.05 ? 'cluster' : 'mossy' });
      else if (h < 0.085) b.scenic('res_rhodo', x, y);
      else if (h < 0.11 && !hides(x, y, 9)) b.scenic('res_spruce', x, y, { variant: 'young' });
    }
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const h = H(x, y, 65);
      if (!open(x, y, 0.8)) continue;
      if (h < 0.06) b.decor('res_hummock', x, y);
      else if (h < 0.3) b.decor('res_bloom', x, y, { variant: h < 0.12 ? 'mixed' : undefined });
    }

  // big grey boulders among the trees of the west wood and the east shoulder
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const u = x - y;
      if (u > -24 && u < 27) continue;
      const h = H(x, y, 17);
      if (h < 0.06 && free(x, y, 0.8) && b.groundAt(x, y) !== 'gravel') b.scenic('res_boulder', x, y, { variant: h < 0.03 ? 'big' : 'cluster' });
    }
  // picnic tables below the terrace, rocks round the tarn, lamps along the walks
  for (const [x, y] of [[13, 18], [3, 19]] as const) if (b.isFree(x, y) && b.isFree(x + 1, y) && !onRoute.has(`${x},${y}`) && !onRoute.has(`${x + 1},${y}`)) b.scenic('res_table', x, y);
  // the pond: the waterfall at its back, rocks all round it, rocks and alpenrose along the stream
  for (const [x, y, v] of [[8, 19, 'big'], [8, 20, 'cluster'], [9, 18, 'mossy'], [11, 18, 'big'], [12, 18, 'cluster'], [13, 19, 'mossy'], [13, 20, 'big'], [9, 21, 'cluster'], [13, 21, 'cluster'], [10, 22, 'mossy'], [12, 22, 'big'], [10, 23, 'cluster'], [13, 24, 'big'], [11, 25, 'mossy'], [13, 26, 'cluster'], [12, 27, 'big'], [14, 28, 'mossy'], [12, 29, 'cluster'], [14, 29, 'big']] as const)
    if (b.isFree(x, y) && b.groundAt(x, y) !== 'water' && !onRoute.has(`${x},${y}`)) b.scenic('res_boulder', x, y, { variant: v });
  for (const [x, y] of [[11, 24], [13, 23], [14, 27], [12, 28], [11, 26]] as const) if (b.isFree(x, y) && b.groundAt(x, y) !== 'water') b.scenic('res_rhodo', x, y);
  for (const [x, y] of [[22, 13], [24, 3], [-6, 26], [3, -3]] as const) if (b.isFree(x, y) && !onRoute.has(`${x},${y}`)) b.scenic('res_lamp', x, y);
  // flowering bushes along the walks
  for (const [x, y] of [[-7, 17], [-7, 21], [-7, 25], [3, 18], [3, 22], [-1, 26], [2, -14], [7, -14], [13, -12], [2, -9], [13, -4]] as const)
    if (b.isFree(x, y) && !onRoute.has(`${x},${y}`)) b.scenic('res_shrub', x, y, { variant: 'alpenrose' });
  // rail fences along the walks: west of the domes' terrace, west of the chapel's walk
  for (const [x, y] of [[2, -13], [2, -9], [-8, 17], [-8, 21]] as const) if ([0, 1, 2, 3].every((j) => b.isFree(x, y + j))) b.scenic('res_railing', x, y, { w: 4, rot: 1 });
  // grey rock outcrops on the skyline among the spruces
  for (let u = -34; u < 40; u += 3) {
    if (H(u, 9, 41) > 0.5) continue;
    const v = Math.round(vFar(u) + 1.5 + H(u, 10, 41) * 2.5);
    if ((u + v) % 2) continue;
    const x = (u + v) / 2;
    const y = (v - u) / 2;
    if (free(x, y, 0.3)) b.scenic('res_boulder', x, y, { variant: H(u, 11, 41) < 0.5 ? 'big' : 'cluster' });
  }
  // fences and a bench round the domes' terrace, flowers by the chapel
  for (const x of [3, 6]) if (b.isFree(x, -4)) b.scenic('res_railing', x, -4, { w: 3 });
  for (const [x, y, v] of [[2, -5, 'pink'], [11, -4, 'box'], [-5, 25, 'pink'], [2, 20, 'pot'], [-6, 22, 'box']] as const) if (b.isFree(x, y) && !onRoute.has(`${x},${y}`)) b.scenic('res_planter', x, y, { variant: v });
  if (b.isFree(12, -13) && b.isFree(13, -13)) b.scenic('res_bench', 12, -13);
  // larch rails along the walks round the domes
  for (const [x, y, w, rot] of [[4, -14, 3, 0], [7, -14, 3, 0], [12, -13, 3, 1], [16, -9, 3, 1]] as const)
    if ([...Array(w).keys()].every((j) => (rot ? b.isFree(x, y + j) : b.isFree(x + j, y)))) b.scenic('res_railing', x, y, { w, rot });

  // big blocks at the brink, snow on their tops
  for (let u = -36; u < 40; u += 2) {
    if (H(u, 5, 31) > 0.45) continue;
    const v = Math.floor(vFront(u) + 0.6 + H(u, 6, 31) * 1.6);
    if ((u + v) % 2) continue;
    const x = (u + v) / 2;
    const y = (v - u) / 2;
    if (b.isFree(x, y) && !nearRoom(x, y) && !hides(x, y, 3)) b.scenic('res_boulder', x, y, { variant: 'snowy' });
  }

  // rocks round the plunge pool at the foot of the stream's fall (the pool is painted by the pack's ground.ts)
  for (const [x, y, v] of [[16, 35, 'snowy'], [19, 32, 'snowy'], [18, 37, 'big'], [20, 35, 'cluster'], [17, 36, 'mossy']] as const) if (b.isFree(x, y)) b.scenic('res_boulder', x, y, { variant: v });
  // dwarf mountain pines, young spruces and snowy blocks clinging to the crags under the brink
  for (let y = -10; y < 80; y++)
    for (let x = -40; x < 70; x++) {
      const u = x - y;
      if (u < -38 || u > 42) continue;
      const dv = x + y + 1 - vFront(u);
      if (dv < 0.8 || dv > 6.5 || !b.isFree(x, y) || hides(x, y, 6) || nearFall(x, y)) continue;
      const h = H(x, y, 71);
      if (h < 0.1) b.scenic('res_shrub', x, y, { variant: 'mugo' });
      else if (h < 0.15) b.scenic('res_spruce', x, y, { variant: 'young' });
      else if (h < 0.19) b.scenic('res_boulder', x, y, { variant: 'snowy' });
    }

  // ── wildflowers in drifts of one kind, tussocks, flat details ──
  const kinds = ['gentian', 'alpenrose', 'edelweiss', 'arnica', 'bellflower', 'globeflower'];
  for (let i = 0; i < 420; i++) {
    const cx = -30 + Math.floor(H(i, 1, 7) * 76);
    const cy = -26 + Math.floor(H(i, 2, 7) * 66);
    const kind = kinds[Math.floor(H(i, 3, 7) * kinds.length)];
    for (let j = 0; j < 4; j++) {
      const x = cx + Math.floor(H(i, j + 10, 7) * 3) - 1;
      const y = cy + Math.floor(H(i, j + 20, 7) * 3) - 1;
      const g = b.groundAt(x, y);
      if (free(x, y, 0.8) && g !== 'water' && g !== 'gravel' && g !== 'paving') b.decor('res_flowers', x, y, { variant: kind });
    }
  }
  for (let y = -30; y < 44; y++)
    for (let x = -36; x < 52; x++) {
      const h = H(x, y, 9);
      const g = b.groundAt(x, y);
      if (g === 'gravel' || g === 'paving' || g === 'water') continue;
      if (h < 0.12 && free(x, y, 0.8)) b.decor('res_grass', x, y);
      else if (h > 0.985 && free(x, y, 1)) b.decor('res_decal', x, y, { variant: 'burrow' });
      else if (h > 0.97 && free(x, y, 1)) b.decor('res_decal', x, y, { variant: g === 'forest' ? 'needles' : g === 'sand' ? 'snow' : 'stones' });
    }
  for (const [x, y] of [[21, 4], [22, 6], [23, 9], [20, 7]] as const) b.decor('res_decal', x, y, { variant: 'tracks' });
  for (const [x, y] of [[24, 11], [-5, 18]] as const) b.decor('res_decal', x, y, { variant: 'puddle' });
  // glacier-polished slabs breaking through the turf, old snow lying in the north hollows
  for (const [x, y, w, d] of [[8, -14, 3, 2], [29, 8, 2, 2], [-12, 25, 3, 2], [2, -12, 2, 2], [-4, 27, 2, 2], [19, 19, 2, 1], [35, 9, 2, 2], [-9, 23, 2, 1]] as const)
    if (onSummit(x, y, 0.6) && onSummit(x + w - 1, y + d - 1, 0.6)) b.decor('res_decal', x, y, { variant: 'slab', w, d });
  for (const [x, y, w, d] of [[-3, -12, 3, 2], [16, -15, 3, 2], [30, -15, 3, 2], [34, -9, 2, 2], [-14, -3, 2, 2], [22, -16, 2, 1]] as const)
    if (onSummit(x, y, 0.4) && onSummit(x + w - 1, y + d - 1, 0.4)) b.decor('res_decal', x, y, { variant: 'snowfield', w, d });

  // ── life ──
  b.critters('res_marmot', 1, -10, 11, 5, 4);
  b.critters('res_marmot', 12, 18, 5, 3, 3);
  b.critters('res_ibex', -2, -13, 5, 3, 2);
  b.critters('res_ibex', 27, -13, 7, 4, 3);
  b.critters('res_eagle', 0, 34, 30, 12, 1);
  b.critters('res_eagle', 26, -24, 14, 8, 1);
  b.critters('res_chough', -9, 0, 8, 14, 5);
  b.critters('butterfly', 8, 17, 7, 6, 5);
  b.critters('butterfly', 24, -12, 8, 6, 3);
  b.critters('cat', -6, 15, 4, 1, 1);
}

observatorySummit(b);
decorateWalls(b, ['res_sconce', 'res_clock', 'res_barometer', 'res_sconce']);

export const research = b.build({
  name: 'Research Hub',
  description: 'Research desks, deep archives, an analysis station, an experimental greenhouse and a briefing zone.',
  tagline: 'Investigate, uncover and push the boundaries.',
  emoji: '🔭',
  theme: {
    floorA: '#b98f68',
    floorB: '#b08661',
    floorDetail: '#9a7452',
    wall: '#e8dcc6',
    wallTrim: '#6b4f8a',
    slab: '#5a4232',
    accent: '#9b7bea',
    accent2: '#7bc35a',
    ui: '#f2b98a',
    sky: ['#231f3c', '#a07ab0'],
  },
  outfitCategory: 'research',
  defaultOutfitId: 'research.researcher',
  environment: { floor: 'planks', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Literature sweep',
    'Annotate field notes',
    'Run regression model',
    'Measure seedling growth',
    'Prepare briefing slides',
    'Catalogue archive box',
    'Peer-review draft',
    'Analyse soil samples',
  ],
});

// ─────────────────────────────────────────────────────────────
// Surroundings generators: turn a playable room into a place.
// Deterministic (seeded by world id), data-only.
// ─────────────────────────────────────────────────────────────

import type { MaterialId } from '../../domain/world';
import type { WorldBuilder } from './builder';

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Ground ring around [x0,x1)×[y0,y1), `t` tiles thick. */
function ring(b: WorldBuilder, x0: number, y0: number, x1: number, y1: number, t: number, mat: MaterialId) {
  b.ground(mat, x0 - t, y0 - t, x1 - x0 + 2 * t, t);
  b.ground(mat, x0 - t, y1, x1 - x0 + 2 * t, t);
  b.ground(mat, x0 - t, y0, t, y1 - y0);
  b.ground(mat, x1, y0, t, y1 - y0);
}

export interface BuildingOpts {
  facades: string[];
  outer: MaterialId;
  plaza: MaterialId;
  wallColor: string;
  trees?: boolean;
  fountain?: boolean;
  light?: { tint: string; strength: number };
  seed?: number;
}

/** An indoor room inside a building on a street block. */
export function building(b: WorldBuilder, o: BuildingOpts) {
  const C = b.cols;
  const R = b.rows;
  const s = o.seed ?? C * 7 + R;
  b.setScene({ ext: 14, outer: o.outer, frontWalls: true, light: o.light ?? { tint: '#ffd49a', strength: 0.36 } });

  // ground: sidewalk → plaza → road → sidewalk → outer
  ring(b, 0, 0, C, R, 2, 'sidewalk');
  ring(b, -2, -2, C + 2, R + 2, 3, o.plaza);
  b.ground('asphalt', -30, R + 5, C + 60, 3);
  b.ground('asphalt', C + 5, -30, 3, R + 35);
  b.ground('sidewalk', -30, R + 8, C + 60, 1);
  b.ground('sidewalk', C + 8, -30, 1, R + 38);

  // cutaway front walls
  b.scenic('lowWall', 0, R, { w: C, color: o.wallColor });
  b.scenic('lowWall', C, 0, { w: R, rot: 1, color: o.wallColor });

  // street furniture along the front sidewalks
  for (let x = 1; x < C; x += 3) {
    if (o.trees !== false) b.scenic('tree', x, R + 3);
    if (x % 6 === 4) b.scenic('streetLamp', x + 1, R + 4);
  }
  for (let y = 1; y < R; y += 3) {
    if (o.trees !== false) b.scenic('tree', C + 3, y);
    if (y % 6 === 4) b.scenic('streetLamp', C + 4, y + 1);
  }
  b.scenic('bench', 2, R + 2);
  b.scenic('bin', 5, R + 2);
  b.scenic('planter', 8, R + 2);
  b.scenic('bikeRack', C + 2, 2, { rot: 1 });
  b.scenic('planter', C + 2, 6, { rot: 1 });
  b.scenic('bench', C + 2, 9, { rot: 1 });
  b.scenic('bin', C + 2, 12);
  if (o.fountain) b.scenic('fountain', C + 2, R + 2);
  else b.scenic('planter', C + 2, R + 2);

  // parked cars
  const cars = ['#5b8def', '#e2553b', '#f2b84b', '#3fb68b', '#ef9ac0', '#e4e7ec'];
  for (let i = 0; i < 3; i++) b.scenic('car', 1 + i * 6 + Math.floor(hash(i, s) * 2), R + 5, { color: cars[(i + s) % cars.length] });
  for (let i = 0; i < 2; i++) b.scenic('car', C + 5, 2 + i * 7, { rot: 1, color: cars[(i + s + 3) % cars.length] });

  // neighbours: behind (north / west) and across the road
  const f = (i: number) => `${o.facades[i % o.facades.length]}-${3 + Math.floor(hash(i, s, 2) * 3)}`;
  b.scenic('facade', 0, -10, { w: 6, d: 5, variant: f(0) });
  b.scenic('facade', 8, -10, { w: Math.max(4, C - 8), d: 5, variant: f(1) });
  b.scenic('facade', -10, 0, { w: 6, d: 5, rot: 1, variant: f(2) });
  b.scenic('facade', -10, 8, { w: Math.max(4, R - 8), d: 5, rot: 1, variant: f(3) });
  const low = (i: number) => `${o.facades[i % o.facades.length]}-2`;
  b.scenic('facade', 0, R + 11, { w: 7, d: 5, variant: low(4) });
  b.scenic('facade', 9, R + 11, { w: 7, d: 5, variant: low(5) });
  b.scenic('facade', C + 11, 0, { w: 7, d: 5, rot: 1, variant: low(6) });
  b.scenic('facade', C + 11, 9, { w: 7, d: 5, rot: 1, variant: low(7) });
  b.scenic('facade', C + 11, R + 11, { w: 6, d: 5, variant: low(8) });
  b.scenic('facade', -10, -10, { w: 6, d: 5, variant: f(9) });

  // greenery on the plaza ring
  if (o.plaza === 'grass')
    for (let i = 0; i < 26; i++) {
      const side = i % 2;
      const x = side ? C + 2 + Math.floor(hash(i, s, 4) * 3) : Math.floor(hash(i, s, 5) * (C + 4)) - 2;
      const y = side ? Math.floor(hash(i, s, 6) * (R + 4)) - 2 : R + 2 + Math.floor(hash(i, s, 7) * 3);
      if (x < C && y < R) continue;
      b.scenic(hash(i, s, 8) > 0.5 ? 'flowerPatch' : 'tallGrass', x, y);
    }
  b.critters('bird', -2, R + 2, C + 4, 3, 3);
}

/** A station module: hull ring, external modules, trusses and solar wings over open space. */
export function station(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 16, outer: 'space', frontWalls: true, light: { tint: '#a8c8ff', strength: 0.3 } });
  ring(b, 0, 0, C, R, 3, 'hull');
  b.ground('hull', -8, 3, 5, 6);
  b.ground('hull', 4, -8, 6, 5);
  b.ground('hull', C + 3, 5, 5, 4);
  b.scenic('lowWall', 0, R, { w: C, color: '#5a6280' });
  b.scenic('lowWall', C, 0, { w: R, rot: 1, color: '#5a6280' });
  b.scenic('module', 4, -7, { w: 6, d: 3 });
  b.scenic('module', -7, 4, { w: 5, d: 3, rot: 1 });
  b.scenic('module', C + 3, 5, { w: 4, d: 3, rot: 1 });
  b.scenic('truss', -12, 5, { w: 5 });
  b.scenic('truss', C + 7, 6, { w: 6 });
  b.scenic('truss', 5, R + 3, { w: 6, rot: 1 });
  b.scenic('solarPanel', -16, 3, { w: 4, d: 3 });
  b.scenic('solarPanel', -16, 8, { w: 4, d: 3 });
  b.scenic('solarPanel', C + 13, 3, { w: 4, d: 3 });
  b.scenic('solarPanel', C + 13, 9, { w: 4, d: 3 });
  b.scenic('solarPanel', 3, R + 9, { w: 4, d: 3 });
  b.scenic('solarPanel', 8, R + 9, { w: 4, d: 3 });
  b.scenic('antenna', 1, -2);
  b.scenic('antenna', C + 1, R + 1);
}

/**
 * Fill free stretches of the back walls with the given wall decor kinds, in turn.
 * Kinds listed in `wide` take two tiles where there is room.
 */
export function decorateWalls(b: WorldBuilder, kinds = ['frames', 'shelfPlant', 'sconce', 'hangingPlant'], wide: string[] = ['frames', 'shelfPlant']) {
  for (const side of ['ne', 'nw'] as const) {
    const len = side === 'ne' ? b.cols : b.rows;
    const used = new Set<number>();
    for (const wp of b.wallSpans(side)) for (let u = wp.at; u < wp.at + wp.w; u++) used.add(u);
    let k = side === 'ne' ? 0 : 2;
    for (let u = 0; u < len; u++) {
      if (used.has(u)) continue;
      const kind = kinds[k++ % kinds.length];
      const w = wide.includes(kind) ? (used.has(u + 1) || u + 1 >= len ? 1 : 2) : 1;
      b.wall(kind, side, u, w);
      for (let i = 0; i < w; i++) used.add(u + i);
      u += w - 1;
    }
  }
}

// Logistics Port — the harbour's geometry, shared by the world file (ground
// areas, scenery placement) and the pack (quay walls, water depth).
//
// The quay deck is the ground plane (z = 0). The sea lies QD z-units lower:
// wherever water meets the quay, the vertical quay wall shows in the band of
// water pixels right "below" the edge on screen. A pixel of water at (x, y)
// shows the wall when the land is reached by walking straight up the screen
// — the ray (x − t, y − t) — within t < QD / 16 tiles; the wall depth there is
// 16·t z-units below the deck. Walls facing +y are lit, walls facing +x shaded.

/** water surface below the quay deck, in z units (1 z ≈ 10 cm) */
export const QD = 9;
/** the wall band on the water, in tiles (diagonal offset) */
export const TWALL = QD / 16;

/** [x0, y0, x1, y1) in tiles: quay land with vertical walls */
export type Rect = readonly [number, number, number, number];

export const LAND: readonly Rect[] = [
  // the waterfront: everything north of the quay line, frame edge to frame edge
  [-90, -90, 45, 13],
  // the container terminal's south mole (east of the basin)
  [45, -90, 90, 30],
  // the breakwater, from the mole out to the lighthouse
  [9, 28, 45, 30],
  // the old fish pier, west of the playable quay
  [-11, 13, -6, 23],
];

/** Is the tile point on quay land (deck level)? */
export function landAt(x: number, y: number) {
  for (const r of LAND) if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) return true;
  return false;
}

/**
 * The quay wall seen at a water point: walking straight up the screen
 * (x − t, y − t), the first land is met at t. Returns t, the wall it is
 * (1 = front face, facing +y, lit; 0 = side face, facing +x, shaded) and the
 * position along that wall in tiles; null when no wall is within `reach`.
 */
export interface WallHit {
  t: number;
  face: 0 | 1;
  u: number;
  /** the wall's line: y of a front wall, x of a side wall */
  edge: number;
}
const hit: WallHit = { t: 0, face: 1, u: 0, edge: 0 };
export function wallAt(x: number, y: number, reach: number): WallHit | null {
  let best = Infinity;
  let face: 0 | 1 = 1;
  let edge = 0;
  for (const r of LAND) {
    // quick reject: the ray only travels toward −x −y
    if (x < r[0] || y < r[1] || x - reach > r[2] + 1e-9 || y - reach > r[3] + 1e-9) continue;
    const ex = x - r[2];
    const ey = y - r[3];
    const te = ex > ey ? ex : ey;
    const tx = Math.min(x - r[0], y - r[1]);
    if (te >= tx || tx <= 0) continue;
    const t = te < 0 ? 0 : te;
    if (t < best) {
      best = t;
      face = ex > ey ? 0 : 1;
      edge = ex > ey ? r[2] : r[3];
    }
  }
  if (best > reach) return null;
  hit.t = best;
  hit.face = face;
  hit.u = face === 1 ? x - best : y - best;
  hit.edge = edge;
  return hit;
}

/** Crane rails sunk in the quay: [y, x0, x1] (the old portal crane; the terminal's gantries). */
export const RAILS: readonly (readonly [number, number, number])[] = [
  [10.25, -34, 13.6],
  [11.75, -34, 13.6],
  [5.3, 18.6, 60],
  [12.3, 18.6, 60],
];

/** Ladders let into the quay wall: [x along a front wall at y, y] (rungs down to the water). */
export const LADDERS: readonly (readonly [number, number])[] = [
  [3.35, 13],
  [9.6, 13],
  [-14.4, 13],
  [-22.6, 13],
  [-2.6, 13],
  [21.4, 13],
  [36.2, 13],
  [17.4, 30],
  [27.6, 30],
  [39.4, 30],
];

/** Tyre fenders hang from the quay every few metres (not at ladders). */
export function fenderAt(u: number, y: number): number {
  // fender centres every 2.5 tiles along the wall; returns the local offset or NaN
  const p = 2.5;
  const k = Math.round((u - 1.25) / p);
  const c = 1.25 + k * p;
  for (const [lx, ly] of LADDERS) if (ly === y && Math.abs(lx - c) < 0.8) return NaN;
  return u - c;
}

/** How open the water is: 0 in the harbour basin, 1 out at sea (south of the breakwater and the entrance). */
export function openness(x: number, y: number) {
  const edge = x < -11 ? 23 : x < 9 ? 23 + (x + 11) * 0.27 : 29.5;
  const t = (y - edge) / 5;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** The coaster under way off the breakwater (rot 0, her stern at x + w): the sea draws her wake. */
export const COASTER = { x: 6, y: 35.6, w: 16, d: 3.6 } as const;

/** The far shore: the coast's waterline (tiles, y) at x — a headland across the frame's south-west corner. */
export function coastY(x: number) {
  return 44 + Math.sin(x * 0.21) * 1.6 + Math.sin(x * 0.07 + 1.3) * 2.4 - Math.max(0, x - 30) * 0.5;
}

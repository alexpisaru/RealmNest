// ─────────────────────────────────────────────────────────────
// Navigation: collision grid derived from world data + 4-dir A*.
// Pure TypeScript (no DOM) — unit tested.
// ─────────────────────────────────────────────────────────────

import { PROP_META } from '../data/props';
import type { PropPlacement, WorldDef } from '../domain/world';

export interface Tile {
  x: number;
  y: number;
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.blocked = new Uint8Array(cols * rows);
  }

  static fromWorld(w: WorldDef): NavGrid {
    const g = new NavGrid(w.cols, w.rows);
    for (const p of w.props) {
      const meta = PROP_META[p.type];
      if (meta?.solid === false) continue;
      for (const t of footprint(p)) g.block(t.x, t.y);
    }
    for (const patch of w.environment.patches)
      if (patch.blocking)
        for (let j = 0; j < patch.d; j++) for (let i = 0; i < patch.w; i++) g.block(patch.x + i, patch.y + j);
    return g;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }
  block(x: number, y: number) {
    if (this.inside(x, y)) this.blocked[y * this.cols + x] = 1;
  }
  walkable(x: number, y: number) {
    return this.inside(x, y) && !this.blocked[y * this.cols + x];
  }

  /**
   * A* from tile to tile. The goal may be a blocked tile (a seat on a sofa,
   * a bench); every intermediate tile must be walkable. Returns the tiles
   * after the start, or null if unreachable.
   */
  findPath(sx: number, sy: number, tx: number, ty: number): Tile[] | null {
    if (!this.inside(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    const W = this.cols;
    const key = (x: number, y: number) => y * W + x;
    const g = new Map<number, number>([[key(sx, sy), 0]]);
    const came = new Map<number, number>();
    const open: { x: number; y: number; f: number; g: number }[] = [{ x: sx, y: sy, f: 0, g: 0 }];
    const closed = new Set<number>();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (cur.x === tx && cur.y === ty) {
        const out: Tile[] = [];
        let k = ck;
        while (k !== key(sx, sy)) {
          out.unshift({ x: k % W, y: Math.floor(k / W) });
          k = came.get(k)!;
        }
        return out;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const isGoal = nx === tx && ny === ty;
        if (!this.inside(nx, ny) || (!isGoal && !this.walkable(nx, ny))) continue;
        const nk = key(nx, ny);
        const ng = cur.g + 1;
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, ck);
          open.push({ x: nx, y: ny, g: ng, f: ng + Math.abs(nx - tx) + Math.abs(ny - ty) });
        }
      }
    }
    return null;
  }

  /** Random walkable tile within `r` of a point (Chebyshev), or null. */
  randomNear(cx: number, cy: number, r: number, rand: () => number): Tile | null {
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(cx) + Math.round((rand() * 2 - 1) * r);
      const y = Math.floor(cy) + Math.round((rand() * 2 - 1) * r);
      if (this.walkable(x, y)) return { x, y };
    }
    return null;
  }
}

/** Tiles covered by a prop in world space (handles rotation). */
export function footprint(p: PropPlacement): Tile[] {
  const [wx, wy] = p.rot === 0 ? [p.w, p.d] : [p.d, p.w];
  const out: Tile[] = [];
  for (let j = 0; j < wy; j++) for (let i = 0; i < wx; i++) out.push({ x: p.x + i, y: p.y + j });
  return out;
}

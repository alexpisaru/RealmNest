// ─────────────────────────────────────────────────────────────
// Small authoring helper for world data. It only produces plain
// WorldDef objects — no behaviour, no rendering.
// ─────────────────────────────────────────────────────────────

import type {
  CritterSpawn,
  Facing,
  GroundArea,
  MaterialId,
  FloorPatch,
  FloorPatchStyle,
  InteractionPoint,
  InteractionType,
  PropPlacement,
  VehicleRun,
  WallPropPlacement,
  WallSide,
  WorldDef,
  WorldEnvironment,
  SceneDef,
  WorldTheme,
} from '../../domain/world';
import { PROP_META } from '../props';

interface PropOpts {
  w?: number;
  d?: number;
  rot?: 0 | 1;
  variant?: string;
  color?: string;
}

interface PointOpts {
  verb?: string;
  capacity?: number;
  tags?: string[];
  sit?: boolean;
}

export class WorldBuilder {
  private props: PropPlacement[] = [];
  private points: InteractionPoint[] = [];
  private wallProps: WallPropPlacement[] = [];
  private patches: FloorPatch[] = [];
  private spawns: { x: number; y: number }[] = [];
  private nodes: { id: string; x: number; y: number }[] = [];
  private seq = 0;
  /** tiles covered by any prop or scenery footprint, and tiles with an interaction point */
  private occupied = new Set<number>();
  private pointTiles = new Set<number>();
  private static key = (x: number, y: number) => (x + 2048) * 8192 + (y + 2048);
  private occupy(p: PropPlacement) {
    const [wx, wy] = p.rot === 0 ? [p.w, p.d] : [p.d, p.w];
    for (let j = 0; j < wy; j++) for (let i = 0; i < wx; i++) this.occupied.add(WorldBuilder.key(p.x + i, p.y + j));
  }
  readonly sceneDef: SceneDef = { ext: 10, outer: 'meadow', ground: [], props: [], critters: [], light: { tint: '#ffd9a0', strength: 0.35 } };

  constructor(
    readonly id: string,
    readonly cols: number,
    readonly rows: number,
  ) {}

  prop(type: string, x: number, y: number, o: PropOpts = {}): PropPlacement {
    const meta = PROP_META[type];
    if (!meta) throw new Error(`[${this.id}] unknown prop "${type}"`);
    const p: PropPlacement = {
      id: `${type}-${++this.seq}`,
      type,
      x,
      y,
      w: o.w ?? meta.w,
      d: o.d ?? meta.d,
      rot: o.rot ?? 0,
      variant: o.variant,
      color: o.color,
    };
    this.props.push(p);
    // flat ground decals never take a tile: things can stand on them
    if (!meta.flat) this.occupy(p);
    return p;
  }

  point(type: InteractionType, x: number, y: number, facing: Facing, label: string, o: PointOpts = {}): InteractionPoint {
    const p: InteractionPoint = {
      id: `${type.toLowerCase()}-${++this.seq}`,
      type,
      x,
      y,
      facing,
      label,
      capacity: o.capacity ?? 1,
      worldId: this.id,
      tags: o.tags ?? [],
      verb: o.verb,
      sit: o.sit,
    };
    this.points.push(p);
    this.pointTiles.add(WorldBuilder.key(Math.floor(x), Math.floor(y)));
    return p;
  }

  /**
   * A prop plus N interaction points evenly spaced along its front.
   * rot 0 → workers stand at +y facing 'ne'; rot 1 → at +x facing 'nw'.
   */
  station(propType: string, x: number, y: number, type: InteractionType, label: string, o: PropOpts & PointOpts & { slots?: number } = {}) {
    const p = this.prop(propType, x, y, o);
    const n = o.slots ?? 1;
    for (let i = 0; i < n; i++) {
      const a = (p.w * (i + 0.5)) / n;
      if (p.rot === 0) this.point(type, x + a, y + p.d + 0.5, 'ne', label, o);
      else this.point(type, x + p.d + 0.5, y + p.w - a, 'nw', label, o);
    }
    return p;
  }

  /** Sittable prop (sofa, bench, armchair): one seat per tile, facing the front. */
  seats(propType: string, x: number, y: number, type: InteractionType, label: string, o: PropOpts = {}) {
    const p = this.prop(propType, x, y, o);
    for (let i = 0; i < p.w; i++) {
      if (p.rot === 0) this.point(type, x + i + 0.5, y + 0.5, 'sw', label, { sit: true });
      else this.point(type, x + 0.5, y + i + 0.5, 'se', label, { sit: true });
    }
    return p;
  }

  /** Eight points around a free centre tile, everyone facing inward. */
  ring(type: InteractionType, cx: number, cy: number, label: string) {
    const c = (dx: number, dy: number, f: Facing) => this.point(type, cx + dx + 0.5, cy + dy + 0.5, f, label);
    c(-1, 0, 'se');
    c(1, 0, 'nw');
    c(0, -1, 'sw');
    c(0, 1, 'ne');
    c(-1, -1, 'se');
    c(1, 1, 'nw');
    c(1, -1, 'sw');
    c(-1, 1, 'ne');
  }

  /** Meeting points around a table prop (all four sides). */
  around(p: PropPlacement, type: InteractionType, label: string) {
    const [w, d] = p.rot === 0 ? [p.w, p.d] : [p.d, p.w];
    for (let i = 0; i < d; i++) {
      this.point(type, p.x - 0.5, p.y + i + 0.5, 'se', label);
      this.point(type, p.x + w + 0.5, p.y + i + 0.5, 'nw', label);
    }
    for (let i = 0; i < w; i++) {
      this.point(type, p.x + i + 0.5, p.y - 0.5, 'sw', label);
      this.point(type, p.x + i + 0.5, p.y + d + 0.5, 'ne', label);
    }
  }

  wallSpans(side: WallSide) {
    return this.wallProps.filter((p) => p.wall === side);
  }

  wall(type: string, wall: WallSide, at: number, w = 1, o: { variant?: string; color?: string } = {}) {
    this.wallProps.push({ id: `w-${type}-${++this.seq}`, type, wall, at, w, ...o });
  }

  patch(style: FloorPatchStyle, x: number, y: number, w: number, d: number, o: { color?: string; blocking?: boolean } = {}) {
    this.patches.push({ style, x, y, w, d, ...o });
  }

  // ── extended environment (visual only) ─────────────────────
  /** A scenic prop outside (or on the edge of) the playable grid. Never blocks agents. */
  scenic(type: string, x: number, y: number, o: PropOpts = {}): PropPlacement {
    const meta = PROP_META[type];
    if (!meta) throw new Error(`[${this.id}] unknown prop "${type}"`);
    const p: PropPlacement = { id: `s-${type}-${++this.seq}`, type, x, y, w: o.w ?? meta.w, d: o.d ?? meta.d, rot: o.rot ?? 0, variant: o.variant, color: o.color };
    this.sceneDef.props.push(p);
    if (!meta.flat) this.occupy(p);
    return p;
  }

  /** Ground material of a tile from the scene ground areas (last area wins), if any. */
  groundAt(x: number, y: number): MaterialId | null {
    for (let i = this.sceneDef.ground.length - 1; i >= 0; i--) {
      const g = this.sceneDef.ground[i];
      if (x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.d) return g.mat;
    }
    return null;
  }

  /** True if no prop (playable or scenic) covers the tile and no interaction point stands on it. */
  isFree(x: number, y: number) {
    const k = WorldBuilder.key(x, y);
    return !this.occupied.has(k) && !this.pointTiles.has(k);
  }

  /**
   * Walk-through decoration (flowers, tufts, pebbles, crop rows) anywhere:
   * a playable prop inside the grid, scenery outside. Skips occupied tiles.
   */
  decor(type: string, x: number, y: number, o: PropOpts = {}): PropPlacement | null {
    const meta = PROP_META[type];
    if (!meta) throw new Error(`[${this.id}] unknown prop "${type}"`);
    const w = o.w ?? meta.w;
    const d = o.d ?? meta.d;
    const [wx, wy] = (o.rot ?? 0) === 0 ? [w, d] : [d, w];
    let inside = false;
    for (let j = 0; j < wy; j++)
      for (let i = 0; i < wx; i++) {
        if (!this.isFree(x + i, y + j)) return null;
        if (type !== 'lilies' && this.groundAt(x + i, y + j) === 'water') return null;
        if (this.inside(x + i, y + j)) inside = true;
      }
    if (inside && meta.solid !== false) throw new Error(`[${this.id}] decor "${type}" would block the playable grid`);
    return inside ? this.prop(type, x, y, o) : this.scenic(type, x, y, o);
  }

  ground(mat: MaterialId, x: number, y: number, w: number, d: number) {
    const g: GroundArea = { mat, x, y, w, d };
    this.sceneDef.ground.push(g);
  }

  critters(kind: CritterSpawn['kind'], x: number, y: number, w: number, d: number, count: number) {
    this.sceneDef.critters.push({ kind, x, y, w, d, count });
  }

  /** Passers-by on a route outside the playable grid (decorative; see src/render/ambient.ts). */
  walkers(path: [number, number][], count: number, o: { loop?: boolean; speed?: number } = {}) {
    (this.sceneDef.walkers ??= []).push({ path, count, ...o });
  }

  /** A vehicle running back and forth along a straight line (see src/render/ambient.ts). */
  vehicle(run: VehicleRun) {
    (this.sceneDef.vehicles ??= []).push(run);
  }

  setScene(patch: Partial<SceneDef>) {
    Object.assign(this.sceneDef, patch);
  }

  /** Is a tile inside the playable grid? */
  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  spawn(x: number, y: number) {
    this.spawns.push({ x, y });
  }

  node(id: string, x: number, y: number) {
    this.nodes.push({ id, x, y });
  }

  build(meta: {
    name: string;
    description: string;
    tagline: string;
    emoji: string;
    theme: WorldTheme;
    outfitCategory: string;
    defaultOutfitId: string;
    environment: Omit<WorldEnvironment, 'patches' | 'wallProps'>;
    camera?: { zoom: number; padding: number };
    tasks: string[];
  }): WorldDef {
    return {
      id: this.id,
      name: meta.name,
      description: meta.description,
      tagline: meta.tagline,
      emoji: meta.emoji,
      theme: meta.theme,
      outfitCategory: meta.outfitCategory,
      defaultOutfitId: meta.defaultOutfitId,
      cols: this.cols,
      rows: this.rows,
      environment: { ...meta.environment, patches: this.patches, wallProps: this.wallProps },
      props: this.props,
      points: this.points,
      spawnPoints: this.spawns,
      navigationNodes: this.nodes,
      camera: meta.camera ?? { zoom: 3, padding: 24 },
      tasks: meta.tasks,
      scene: this.sceneDef,
    };
  }
}

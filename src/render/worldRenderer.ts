// ─────────────────────────────────────────────────────────────
// WorldRenderer — draws one WorldDef + a WorldSim snapshot.
//
// Pipeline per frame:
//   background (ground + flat decals + floor overlays, baked once)
//   → wall props (animated)
//   → props & agents, depth-sorted for isometric occlusion
//   → bubbles & effects (pixel art)
//   → composite to screen with the camera (integer zoom, nearest)
//   → labels & debug text in screen space (crisp)
//
// Art scales: k = 1 (32×16 tiles), 2 (64×32) or 4 (128×64, the Farm's 2×
// fidelity art). World-space proportions never depend on k; only pixel
// density does. For k = 4 every sprite and the ground also carry a
// pixel-art-safe half-resolution level of detail (mode of each 2×2 block),
// used below 1× zoom so a standard-DPI screen keeps the same framing with
// crisp pixels; HiDPI screens and close zooms show the native art 1:1.
//
// The frame canvas only covers the camera view (not the whole scene).
//
// Renderer ≠ engine: it only reads sim state. A PixiJS renderer could
// replace this class without touching engine/ or runtime/.
// ─────────────────────────────────────────────────────────────

import { PROP_META } from '../data/props';
import type { AgentState } from '../domain/sim';
import { sceneMarginPx, tileScale, type InteractionType, type PropPlacement, type VehicleRun, type WorldDef } from '../domain/world';
import { footprint } from '../engine/nav';
import type { VisualAgent, WorldSim } from '../engine/worldSim';
import { STATE_COLORS } from '../i18n';
import { propImage } from './assets';
import { vehicleAt, walkerPoses } from './ambient';
import { bakedSceneUrl, loadBakedScene } from './baked';
import { lighten, withAlpha } from './color';
import { critterPoses, drawCritter, type CritterPose } from './critters';
import { drawFloorOverlays, drawWall } from './environment';
import { bakeGround, bakeGroundBuffer } from './ground';
import { drawCritterHD } from './hd/crittersHD';
import { HD_ART } from './hd/farmProps';
import { gradeBuffer } from './hd/grade';
import { SCENE_TONES } from './hd/tones';
import { drawNight, NightLevel, NightMap, roomOutline, worldLights } from './night';
import { bufferToCanvas, cropBuffer, downsampleMode, opaqueBounds, outlineBuffer, SoftCtx } from './hd/soft';
import { getSpriteHD, HD_FOOT_X, HD_FOOT_Y, HD_H } from './hd/spritesHD';
import { drawAnimal } from './hd4/animals';
import { HD4_ART } from './hd4';
import { PACKS } from './hd4/packs';
import type { WorldPack } from './hd4/packs/types';
import { getPerson, PERSON_FOOT_X, PERSON_FOOT_Y, PERSON_H } from './hd4/people';
import { castBox, castSprite, preloadCast } from './cast/castPeople';
import { line, OUT, Painter, poly, PropPainter, rect, WALL_H } from './iso';
import { disc, type PropArt, type PropCtx } from './props';
import { ART as PROP_ART } from './propRegistry';
import { getSprite, type Look, type Pose, type SpriteDir, SPRITE_FOOT_X, SPRITE_FOOT_Y, SPRITE_H } from './sprites';

/** px a sitting pose sits lower than its anchor (the seat point is on the floor at the seat's back row) */
const SEAT_DROP = 8;

// the Cast (docs/charpipe/CAST.md): every person in the worlds, once its atlases are loaded
preloadCast();

/** dev only: prototype character sheets, loaded when the URL has ?proto= (src/render/protoSprites.ts) */
let protoSprite: typeof import('./protoSprites').protoSprite | null = null;
if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('proto'))
  void import('./protoSprites').then((m) => (protoSprite = m.protoSprite));

/**
 * Scenic props whose sprites are shared between instances: type → variations
 * at 128×64 (every coarser world keeps 12). The 128×64 library gets its
 * variety from species and variants, so fewer seeds per variant are needed.
 */
const REUSE = new Map<string, number>([
  ['tree', 8],
  ['fruitTree', 8],
  ['bush', 6],
  ['shrub', 6],
  ['flowerPatch', 6],
  ['flowers', 6],
  ['tallGrass', 6],
  ['fern', 6],
  ['rock', 6],
  ['pebbles', 6],
  ['lilies', 6],
  ['reeds', 6],
  ['hedgeRow', 6],
  ['fenceRow', 6],
  ['stoneWall', 4],
  ['sunflowers', 6],
  ['haystack', 6],
  ['hay', 6],
  ['beehive', 4],
  ['stump', 6],
]);

export interface RenderOptions {
  labels: boolean;
  showPaths: boolean;
  showPoints: boolean;
  showTargets: boolean;
  showGrid: boolean;
  animSpeed: number;
  selected: Set<string>;
  hover?: string | null;
  /** night (eased in and out by the renderer); left out = day, without easing */
  night?: boolean;
}

/** A region of the frame in native frame pixels, plus the camera zoom it will be shown at. */
export type View = { x0: number; y0: number; x1: number; y1: number; zoom?: number };

export const DEFAULT_RENDER: RenderOptions = {
  labels: true,
  showPaths: false,
  showPoints: false,
  showTargets: false,
  showGrid: false,
  animSpeed: 1,
  selected: new Set(),
};

/**
 * A sprite as pixels: built anywhere (a Web Worker has no canvas), uploaded to
 * a canvas the first time it is drawn.
 */
export interface Img {
  cv?: HTMLCanvasElement;
  data?: Uint32Array;
  w: number;
  h: number;
}
const imgOf = (data: Uint32Array, w: number, h: number): Img => ({ data, w, h });
const cvImg = (cv: HTMLCanvasElement): Img => ({ cv, w: cv.width, h: cv.height });
function cnv(i: Img): HTMLCanvasElement {
  if (!i.cv) {
    i.cv = bufferToCanvas(i.data!, i.w, i.h);
    i.data = undefined;
  }
  return i.cv;
}

/** Everything a renderer builds before its first frame: sent from a build worker as transferable pixels. */
export interface WorldPayload {
  fw: number;
  fh: number;
  ox: number;
  oy: number;
  bg: Img;
  bgLod?: Img;
  items: PropItem[];
  /** prop types whose animation is not drawn (a baked picture shows them differently) */
  noAnim?: string[];
  /** a baked scene's own effects */
  fx?: SceneFx;
  /** the background is a picture that already shows every prop; items are its cut-outs */
  baked?: boolean;
}

/**
 * Effects a baked scene brings along, drawn in frame px: `x0`, `y0` is the frame
 * position of the canvas origin and `s` the drawing scale.
 */
export interface SceneFx {
  /** the scene draws its own water glints (the per-tile ones are skipped) */
  ownWater?: boolean;
  /** on the ground, under props, people and animals */
  under?(c: CanvasRenderingContext2D, t: number, x0: number, y0: number, s: number): void;
  /** over everything (lights, insects) */
  over?(c: CanvasRenderingContext2D, t: number, x0: number, y0: number, s: number): void;
}

interface PropItem {
  p: PropPlacement;
  key: number;
  wx0: number;
  wy0: number;
  wx1: number;
  wy1: number;
  bx0: number;
  bx1: number;
  by0: number;
  by1: number;
  sprite?: Img;
  /** half-resolution level of detail (k = 4) */
  lod?: Img;
  live: boolean;
  seed: number;
  /** back wall pieces are depth-sorted like props */
  wall?: 'ne' | 'nw';
  /** a half-tile column of a long thin prop: x offset of this column inside the sprite (frame px) */
  sprX?: number;
}

interface SharedSprite {
  sprite: Img;
  lod?: Img;
  dx0: number;
  dy0: number;
  w: number;
  h: number;
}

export interface StaticFigure {
  look: Look;
  x: number;
  y: number;
  dir: SpriteDir;
  mode: Pose['mode'];
  /** seconds added to the clock for its animation (passers-by don't step in time) */
  phase?: number;
}

/** Something drawn among the props at a ground point: its own box in frame px when it isn't person-sized. */
interface Mover {
  x: number;
  y: number;
  box?: [number, number, number, number];
  /** on a seat: the whole seat prop is behind it (its body overlaps the neighbouring seats' columns) */
  sitting?: boolean;
  draw: () => void;
}

/** a seated mover sits in this prop (any of its slices): the prop is drawn behind it */
const sitsIn = (m: { x: number; y: number; sitting?: boolean }, it: PropItem) => !!m.sitting && footprint(it.p).some((t) => t.x === Math.floor(m.x) && t.y === Math.floor(m.y));

/** A vehicle's sprite, as rasterised at the start of its line (frame px). */
interface VehicleSprite {
  sprite: Img;
  lod?: Img;
  bx0: number;
  by0: number;
  w: number;
  h: number;
}

const POINT_COLORS: Record<InteractionType, string> = {
  WORKSTATION: STATE_COLORS.working,
  MACHINE: STATE_COLORS.working,
  LAB_BENCH: STATE_COLORS.working,
  SERVER: STATE_COLORS.working,
  CROP: STATE_COLORS.working,
  CONTROL_PANEL: STATE_COLORS.working,
  BREAK: STATE_COLORS.on_break,
  COFFEE: STATE_COLORS.on_break,
  LOUNGE: STATE_COLORS.on_break,
  MEETING: STATE_COLORS.interacting,
  STORAGE: STATE_COLORS.idle,
  DECORATIVE: '#ffffff',
};

export class WorldRenderer {
  private _frame?: HTMLCanvasElement;
  private _fctx?: CanvasRenderingContext2D;
  /** drawing surface: covers the last rendered view (see renderFrame); made on first use */
  get frame(): HTMLCanvasElement {
    if (!this._frame) {
      this._frame = document.createElement('canvas');
      this._frame.width = 16;
      this._frame.height = 16;
    }
    return this._frame;
  }
  private get fctx(): CanvasRenderingContext2D {
    return (this._fctx ??= this.frame.getContext('2d')!);
  }
  /** full scene size in native frame pixels */
  readonly fw: number;
  readonly fh: number;
  /** native frame coordinates (world → frame px); not used for drawing */
  readonly painter: Painter;
  /** pixel scale: 1 (32×16), 2 (64×32) or 4 (128×64) */
  readonly k: number;
  private bg: Img;
  private bgLod?: Img;
  private items: PropItem[] = [];
  /** painter for the current frame canvas (view origin and scale applied) */
  private dp: Painter;
  /** native frame position of the frame canvas origin, its scale and used size */
  private vx0 = 0;
  private vy0 = 0;
  private vs = 1;
  private vw = 0;
  private vh = 0;

  /** this world's art pack at 128×64 (its own props, floors, walls, patches) */
  readonly pack: WorldPack | undefined;
  /** prop types whose animation is skipped (see WorldPayload.noAnim) */
  private readonly noAnim: Set<string>;
  /** a baked scene's own effects */
  private readonly fx: SceneFx | undefined;
  /** the scene is a picture showing every prop (see drawBakedMovers) */
  private readonly baked: boolean;

  /** Build a world's scene, or adopt one already built (by a build worker). */
  constructor(
    readonly world: WorldDef,
    pre?: WorldPayload,
  ) {
    this.k = tileScale(world);
    this.pack = this.k >= 4 ? PACKS[world.id] : undefined;
    const ext = sceneMarginPx(this.k);
    // playable bounds relative to world origin (same box as bounds()), then an equal margin all round
    const pb = WorldRenderer.playableBox(world);
    const even = (n: number) => Math.ceil(n / 2) * 2;
    this.fw = pre?.fw ?? even(Math.round(pb.x1 - pb.x0 + ext * 2));
    this.fh = pre?.fh ?? even(Math.round(pb.y1 - pb.y0 + ext * 2));
    // integer, even origin so the half-resolution level of detail stays aligned (coordinates only)
    this.painter = new Painter(null as unknown as CanvasRenderingContext2D, pre?.ox ?? even(Math.round(ext - pb.x0)), pre?.oy ?? even(Math.round(ext - pb.y0)), this.k);
    this.dp = this.painter;
    this.noAnim = new Set(pre?.noAnim);
    this.fx = pre?.fx;
    this.baked = !!pre?.baked;
    if (pre) {
      this.items = pre.items;
      this.bg = pre.bg;
      this.bgLod = pre.bgLod;
      return;
    }
    const flat: PropPlacement[] = [];
    this.items = this.buildProps(flat);
    this.bg = this.bakeBackground(flat);
  }

  /** The built scene as pixels plus the buffers to transfer (for a build worker's reply). */
  exportPayload(): { payload: WorldPayload; transfer: ArrayBuffer[] } {
    const transfer = new Set<ArrayBuffer>();
    const take = (i?: Img) => {
      if (i?.data) transfer.add(i.data.buffer as ArrayBuffer);
    };
    take(this.bg);
    take(this.bgLod);
    for (const it of this.items) {
      take(it.sprite);
      take(it.lod);
    }
    return { payload: { fw: this.fw, fh: this.fh, ox: this.painter.ox, oy: this.painter.oy, bg: this.bg, bgLod: this.bgLod, items: this.items }, transfer: [...transfer] };
  }

  /** world → frame pixel */
  P(x: number, y: number, z = 0) {
    return this.painter.P(x, y, z);
  }

  /** frame pixel → world tile coordinates (z = 0) */
  unproject(fx: number, fy: number) {
    const X = fx - this.painter.ox;
    const Y = fy - this.painter.oy;
    const k = this.k;
    return { x: (Y / (8 * k) + X / (16 * k)) / 2, y: (Y / (8 * k) - X / (16 * k)) / 2 };
  }

  /** playable-area box relative to world (0,0,0), including walls / tall edge props */
  static playableBox(w: WorldDef) {
    const top = w.environment.backdrop === 'walls' ? WALL_H + 6 : 24;
    const k = tileScale(w);
    return { x0: (-w.rows * 16 - 24) * k, x1: (w.cols * 16 + 24) * k, y0: (-top - 12) * k, y1: ((w.cols + w.rows) * 8 + 28) * k };
  }

  /** playable-area bounds in frame pixels (what the camera frames by default) */
  bounds() {
    const b = WorldRenderer.playableBox(this.world);
    const { ox, oy } = this.painter;
    return { x0: b.x0 + ox, x1: b.x1 + ox, y0: b.y0 + oy, y1: b.y1 + oy };
  }

  /** the whole painted scene: the camera never leaves it */
  sceneBounds() {
    return { x0: 0, y0: 0, x1: this.fw, y1: this.fh };
  }

  // ── background ─────────────────────────────────────────────
  private bakeBackground(flat: PropPlacement[]) {
    const k = this.k;
    const { ox, oy } = this.painter;
    if (k < 2) {
      const cv = document.createElement('canvas');
      cv.width = this.fw;
      cv.height = this.fh;
      const ctx = cv.getContext('2d')!;
      bakeGround(ctx, this.world, ox, oy);
      drawFloorOverlays(new Painter(ctx, ox, oy, k), this.world);
      return cvImg(cv);
    }
    // HD: ground shaded into a buffer, then flat decals and floor overlays on top (CPU), then one upload
    const buf = bakeGroundBuffer(this.world, this.fw, this.fh, ox, oy, k, this.pack);
    const soft = new SoftCtx(this.fw, this.fh, buf);
    const sp = new Painter(soft.asContext(), ox, oy, k);
    const patch = this.pack?.patch;
    if (patch) for (const s of this.world.environment.patches) patch(sp, s, this.world);
    else drawFloorOverlays(sp, this.world);
    flat.sort((a, b) => a.x + a.y - (b.x + b.y));
    flat.forEach((p, i) => {
      const art = this.artFor(p.type);
      if (!art) return;
      art.draw(new PropPainter(sp, p.x, p.y, p.w, p.d, p.rot), { w: p.w, d: p.d, variant: p.variant, color: p.color, th: this.world.theme, t: 0, seed: i + 1 });
    });
    this.gradeScene(buf);
    if (k >= 4) this.bgLod = imgOf(downsampleMode(buf, this.fw, this.fh), this.fw / 2, this.fh / 2);
    return imgOf(buf, this.fw, this.fh);
  }

  // ── props ──────────────────────────────────────────────────
  private buildProps(flat: PropPlacement[]): PropItem[] {
    const out: PropItem[] = [];
    const w = this.world;
    if (w.environment.backdrop === 'walls') {
      const [nx0] = this.P(-0.3, w.rows);
      const [nx1] = this.P(0, 0);
      const [ex0] = this.P(0, 0);
      const [ex1] = this.P(w.cols, -0.3);
      const [, top] = this.P(0, 0, WALL_H + 6);
      const [, nb] = this.P(0, w.rows);
      const [, eb] = this.P(w.cols, 0);
      const base = { live: true, seed: 0, p: { id: 'wall', type: 'wall', x: 0, y: 0, w: 1, d: 1, rot: 0 } as PropPlacement };
      const nw: PropItem = { ...base, wall: 'nw', key: w.rows - 0.01, wx0: -0.3, wy0: 0, wx1: 0, wy1: w.rows, bx0: nx0 - 4, bx1: nx1 + 4, by0: top, by1: nb + 4 };
      const ne: PropItem = { ...base, wall: 'ne', key: w.cols - 0.01, wx0: 0, wy0: -0.3, wx1: w.cols, wy1: 0, bx0: ex0 - 4, bx1: ex1 + 4, by0: top, by1: eb + 4 };
      if (this.pack?.walls) for (const it of [nw, ne]) this.rasterizeWall(it);
      out.push(nw, ne);
    }
    const k = this.k;
    const hd = k >= 2;
    const scenic = new Set(w.scene.props);
    const shared = new Map<string, SharedSprite | null>();
    [...w.props, ...w.scene.props].forEach((p, i) => {
      const art = this.artFor(p.type);
      const meta = PROP_META[p.type];
      if (!art || !meta) return;
      // flat ground decals are baked into the background (they never occlude anything)
      if (meta.flat && hd) {
        flat.push(p);
        return;
      }
      const item = this.placeItem(p, meta, i + 1, !!art.live);
      if (!art.live) {
        // repeated scenery (trees, shrubs, flowers…) shares a handful of sprite variations
        const packN = this.pack?.reuse?.[p.type];
        const nv = scenic.has(p) && (packN || REUSE.has(p.type)) ? (packN ?? (k >= 4 ? REUSE.get(p.type)! : 12)) : 0;
        const reuse = nv > 0;
        const key = reuse ? `${p.type}|${p.variant}|${p.w}|${p.d}|${p.rot}|${p.color}|${i % nv}` : '';
        if (reuse) item.seed = (i % nv) + 1;
        let s = reuse ? shared.get(key) : undefined;
        if (s === undefined) {
          s = this.rasterize(item, art);
          if (reuse) shared.set(key, s);
        }
        if (!s) return; // nothing drawn
        const ox = item.bx0;
        const oy = item.by0;
        item.bx0 = ox + s.dx0;
        item.by0 = oy + s.dy0;
        item.bx1 = item.bx0 + s.w;
        item.by1 = item.by0 + s.h;
        item.sprite = s.sprite;
        item.lod = s.lod;
      }
      out.push(...this.slice(item, art));
    });
    // back walls: everything standing behind them first, then the walls, then the room and the street
    const C = w.cols;
    const Rw = w.rows;
    const tier = (it: PropItem) => (it.wall ? 1 : w.environment.backdrop === 'walls' && ((it.wy1 <= 0 && it.wx0 < C) || (it.wx1 <= 0 && it.wy0 < Rw)) ? 0 : 2);
    out.sort((a, b) => tier(a) - tier(b) || a.key - b.key || a.wx1 - b.wx1);
    return out;
  }

  /**
   * Long thin props (walls, fences, hedges, benches, crop rows) are cut into
   * half-tile columns, each depth-sorted by the front-most tile it touches, so
   * whatever stands in front of one part of a long wall is drawn over it.
   */
  private slice(it: PropItem, art: PropArt): PropItem[] {
    if (!it.sprite || it.live || it.wall || art.anim) return [it];
    const tiles = footprint(it.p);
    if (tiles.length < 2) return [it];
    const alongY = new Set(tiles.map((t) => t.x)).size === 1;
    const alongX = new Set(tiles.map((t) => t.y)).size === 1;
    if (!alongX && !alongY) return [it];
    const half = 16 * this.k;
    const ox = this.painter.ox;
    const us = tiles.map((t) => t.x - t.y);
    const m0 = Math.min(...us) - 1;
    const m1 = Math.max(...us);
    const out: PropItem[] = [];
    for (let m = m0; m <= m1; m++) {
      // the column between half-tile marks m and m + 1 touches the tiles with u = m or m + 1
      let front: { x: number; y: number } | null = null;
      for (const t of tiles) if ((t.x - t.y === m || t.x - t.y === m + 1) && (!front || t.x + t.y > front.x + front.y)) front = t;
      if (!front) continue;
      const x0 = m === m0 ? it.bx0 : Math.max(it.bx0, ox + m * half);
      const x1 = m === m1 ? it.bx1 : Math.min(it.bx1, ox + (m + 1) * half);
      if (x1 <= x0) continue;
      out.push({ ...it, key: front.x + front.y + 2, wx0: front.x, wy0: front.y, wx1: front.x + 1, wy1: front.y + 1, bx0: x0, bx1: x1, sprX: x0 - it.bx0 });
    }
    return out.length ? out : [it];
  }

  /** A back wall of a 128×64 room, drawn by the world's pack into a sprite (wall props included). */
  private rasterizeWall(it: PropItem) {
    const walls = this.pack!.walls!;
    const w = this.world;
    const side = it.wall!;
    const H = walls.height ?? WALL_H;
    const T = 0.3;
    // the wall slab plus room for things that stand out of it (shelves, plants, lamps)
    const pts = side === 'ne' ? [[-T, -T], [w.cols + 0.2, -T], [w.cols + 0.2, 0.8], [-T, 0.8]] : [[-T, -T], [0.8, -T], [0.8, w.rows + 0.2], [-T, w.rows + 0.2]];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [a, b] of pts)
      for (const z of [0, H + 16]) {
        const [x, y] = this.P(a, b, z);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    const bx0 = Math.floor(x0) - 8;
    const by0 = Math.floor(y0) - 8;
    const cw = Math.ceil(x1) + 8 - bx0;
    const ch = Math.ceil(y1) + 8 - by0;
    const soft = new SoftCtx(cw, ch);
    const sp = new Painter(soft.asContext(), this.painter.ox - bx0, this.painter.oy - by0, this.k);
    const pp = new PropPainter(sp, 0, 0, w.cols, w.rows, 0);
    walls.draw(pp, side, w);
    w.environment.wallProps.forEach((wp, i) => {
      if (wp.wall !== side) return;
      walls.art[wp.type]?.draw(pp, side, { wp, th: w.theme, t: 0, seed: i + 1 });
    });
    const b = opaqueBounds(soft.data, cw, ch);
    if (!b) return;
    let cx0 = b.x0;
    let cy0 = b.y0;
    if ((bx0 + cx0) & 1) cx0 -= 1;
    if ((by0 + cy0) & 1) cy0 -= 1;
    const sw = Math.ceil((b.x1 - cx0) / 2) * 2;
    const sh = Math.ceil((b.y1 - cy0) / 2) * 2;
    const data = cropBuffer(soft.data, cw, cx0, cy0, sw, sh);
    this.gradeScene(data);
    it.sprite = imgOf(data, sw, sh);
    it.lod = imgOf(downsampleMode(data, sw, sh), sw / 2, sh / 2);
    it.bx0 = bx0 + cx0;
    it.by0 = by0 + cy0;
    it.bx1 = it.bx0 + sw;
    it.by1 = it.by0 + sh;
  }

  /** colours already graded for this scene (pixel art has few) */
  private gradeCache = new Map<number, number>();
  /** agent id → top of its drawn figure this frame (frame pixels) */
  private heads = new Map<string, number>();
  /** The world's colour grade on a finished buffer (128×64 only). */
  private gradeScene(data: Uint32Array) {
    const tone = SCENE_TONES[this.world.id];
    const g = tone ? { ...this.world.scene.grade, tone } : this.world.scene.grade;
    if (g && this.k >= 4) gradeBuffer(data, g, this.gradeCache);
  }

  /** A prop's footprint, depth key and raster box (frame px, generous enough for shadows and crowns). */
  private placeItem(p: PropPlacement, meta: { h: number }, seed: number, live = false): PropItem {
    const k = this.k;
    const hd = k >= 2;
    const tiles = footprint(p);
    const wx0 = p.x;
    const wy0 = p.y;
    const wx1 = Math.max(...tiles.map((t) => t.x)) + 1;
    const wy1 = Math.max(...tiles.map((t) => t.y)) + 1;
    const [bx0] = this.P(wx0, wy1);
    const [bx1] = this.P(wx1, wy0);
    const [, by0] = this.P(wx0, wy0, meta.h + 30);
    const [, by1] = this.P(wx1, wy1);
    // HD art casts shadows to the lower right and has foliage overhanging its footprint
    const sx = hd ? meta.h * 0.5 * k + 10 * k : 6 * k;
    const sy = hd ? meta.h * 0.2 * k + 6 * k : 8 * k;
    const pad = hd ? 12 * k : 6 * k;
    // crowns and canopies spread as far left as right: the raster box mirrors the shadow side
    const padL = hd ? Math.max(pad, meta.h * 0.5 * k + 10 * k) : pad;
    return {
      p,
      key: wx1 + wy1,
      wx0,
      wy0,
      wx1,
      wy1,
      bx0: Math.floor(bx0 - padL),
      bx1: Math.ceil(bx1 + sx),
      by0: Math.floor(by0 - pad),
      by1: Math.ceil(by1 + sy),
      live,
      seed,
    };
  }

  /** Draw one static prop into a sprite (CPU raster for HD art), tightly cropped. */
  private rasterize(item: PropItem, art: PropArt): SharedSprite | null {
    const k = this.k;
    const p = item.p;
    const cw = Math.max(1, item.bx1 - item.bx0);
    const ch = Math.max(1, item.by1 - item.by0);
    const ctx = this.ctxFor(item, 0);
    if (k < 2) {
      const cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
      const sp = new Painter(cv.getContext('2d')!, this.painter.ox - item.bx0, this.painter.oy - item.by0, k);
      art.draw(new PropPainter(sp, p.x, p.y, p.w, p.d, p.rot), ctx);
      return { sprite: cvImg(cv), dx0: 0, dy0: 0, w: cw, h: ch };
    }
    const soft = new SoftCtx(cw, ch);
    const sp = new Painter(soft.asContext(), this.painter.ox - item.bx0, this.painter.oy - item.by0, k);
    art.draw(new PropPainter(sp, p.x, p.y, p.w, p.d, p.rot), ctx);
    if (art.outline) outlineBuffer(soft.data, cw, ch);
    const b = opaqueBounds(soft.data, cw, ch);
    if (!b) return null;
    // keep the crop on even frame coordinates so the half-resolution copy lines up
    let x0 = b.x0;
    let y0 = b.y0;
    if ((item.bx0 + x0) & 1) x0 -= 1;
    if ((item.by0 + y0) & 1) y0 -= 1;
    const w = Math.ceil((b.x1 - x0) / 2) * 2;
    const h = Math.ceil((b.y1 - y0) / 2) * 2;
    const data = cropBuffer(soft.data, cw, x0, y0, w, h);
    this.gradeScene(data);
    const sprite = imgOf(data, w, h);
    const lod = k >= 4 ? imgOf(downsampleMode(data, w, h), w / 2, h / 2) : undefined;
    return { sprite, lod, dx0: x0, dy0: y0, w, h };
  }

  /** The art set for this world's scale, falling back to coarser sets for anything not redrawn. */
  private artFor(type: string): PropArt | undefined {
    if (this.pack) return this.pack.props[type];
    if (this.k >= 4) return HD4_ART[type] ?? HD_ART[type] ?? PROP_ART[type];
    if (this.k === 2) return HD_ART[type] ?? PROP_ART[type];
    return PROP_ART[type];
  }

  private ctxFor(item: PropItem, t: number): PropCtx {
    return { w: item.p.w, d: item.p.d, variant: item.p.variant, color: item.p.color, th: this.world.theme, t, seed: item.seed };
  }

  // ── frame ──────────────────────────────────────────────────
  /** The part of the frame (native frame px) a camera shows in a vw×vh viewport. */
  viewOf(cam: { zoom: number; cx: number; cy: number }, vw: number, vh: number): View {
    const hw = vw / 2 / cam.zoom;
    const hh = vh / 2 / cam.zoom;
    return { x0: cam.cx - hw, y0: cam.cy - hh, x1: cam.cx + hw, y1: cam.cy + hh, zoom: cam.zoom };
  }

  /** current drawing scale of the frame canvas (k · level of detail) */
  private get ks() {
    return this.k * this.vs;
  }

  /**
   * Draw the world into the frame canvas. With `view`, only that part of the
   * scene is drawn and props outside it are skipped: big outdoor scenes carry
   * thousands of scenic props and the camera only ever shows a slice.
   * Below 1× zoom a 128×64 world draws its half-resolution level of detail.
   */
  renderFrame(sim: WorldSim | null, t: number, o: RenderOptions, figures: StaticFigure[] = [], view?: View) {
    const lod = this.k >= 4 && !!this.bgLod && view?.zoom !== undefined && view.zoom < 1;
    const s = lod ? 0.5 : 1;
    let v: View = { x0: 0, y0: 0, x1: this.fw, y1: this.fh };
    if (view) {
      v = {
        x0: Math.max(0, Math.floor(view.x0) - 4),
        y0: Math.max(0, Math.floor(view.y0) - 4),
        x1: Math.min(this.fw, Math.ceil(view.x1) + 4),
        y1: Math.min(this.fh, Math.ceil(view.y1) + 4),
      };
      if (v.x1 <= v.x0 || v.y1 <= v.y0) return;
    }
    v.x0 -= v.x0 & 1;
    v.y0 -= v.y0 & 1;
    const w = Math.ceil((v.x1 - v.x0) * s);
    const h = Math.ceil((v.y1 - v.y0) * s);
    if (this.frame.width < w || this.frame.height < h) {
      this.frame.width = Math.max(this.frame.width, w);
      this.frame.height = Math.max(this.frame.height, h);
    }
    this.vx0 = v.x0;
    this.vy0 = v.y0;
    this.vs = s;
    this.vw = w;
    this.vh = h;
    const c = this.fctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    const bg = cnv(lod ? this.bgLod! : this.bg);
    c.drawImage(bg, v.x0 * s, v.y0 * s, w, h, 0, 0, w, h);
    this.dp = new Painter(c, (this.painter.ox - v.x0) * s, (this.painter.oy - v.y0) * s, this.k * s);
    const visible = (it: PropItem) => it.bx1 > v.x0 && it.bx0 < v.x1 && it.by1 > v.y0 && it.by0 < v.y1;
    this.fx?.under?.(c, t, v.x0, v.y0, s);
    if (!this.fx?.ownWater) drawFloorWater(this.painter, this.dp, this.world, t, v);
    if (o.showGrid) this.drawGrid(sim);

    const agents = sim ? sim.agents.filter((a) => a.spawnIn <= 0) : [];
    const pc = this.pack?.critters;
    const critters = critterPoses(
      this.world.scene.critters,
      t,
      pc ? Object.fromEntries(Object.entries(pc).map(([k2, v2]) => [k2, v2.speed ?? 0.1])) : undefined,
      pc ? new Set(Object.entries(pc).filter(([, v2]) => v2.fly).map(([k2]) => k2)) : undefined,
    );
    const flying = (k2: string) => k2 === 'butterfly' || !!pc?.[k2]?.fly;
    const grounded = critters.filter((k) => !flying(k.kind));
    // the city's own life: passers-by on their routes, vehicles on their lines
    const passers: StaticFigure[] = walkerPoses(this.world, this.world.scene.walkers, t).map((p) => ({ look: p.look, x: p.x, y: p.y, dir: p.dir, mode: 'walk', phase: p.phase }));
    const people = passers.length ? [...figures, ...passers] : figures;
    const vehicles = this.vehicleColumns(t, v);
    if (this.baked)
      this.drawBakedMovers(
        [
          ...agents.map((a) => ({ x: a.x, y: a.y, sitting: a.sitting && a.state !== 'walking', draw: () => this.drawAgent(a, sim!, o, t) })),
          ...people.map((f) => ({ x: f.x, y: f.y, draw: () => this.drawFigure(f, t) })),
          ...grounded.map((k) => ({ x: k.x, y: k.y, draw: () => this.drawCritterAt(k) })),
          ...vehicles,
        ],
        t,
        visible,
      );
    else
      for (const d of this.order(agents, people, grounded, vehicles)) {
        if (d.kind === 'prop') {
          if (visible(d.item)) this.drawProp(d.item, t);
        } else if (d.kind === 'agent') this.drawAgent(d.agent, sim!, o, t);
        else if (d.kind === 'critter') this.drawCritterAt(d.critter);
        else if (d.kind === 'custom') d.draw();
        else this.drawFigure(d.fig, t);
      }
    for (const b of critters) if (flying(b.kind)) this.drawCritterAt(b);
    this.fx?.over?.(c, t, v.x0, v.y0, s);
    if (sim) {
      for (const a of agents) this.drawBubble(a, sim.time);
      this.drawEffects(sim);
    }
    if (o.showPoints) this.drawPoints(sim);
    if (sim && (o.showPaths || o.showTargets)) this.drawPaths(agents, o);
  }

  /** the vehicles' sprites (rasterised on first use) */
  private vehicleSprites?: (VehicleSprite | null)[];
  /** the same, for the art they show while running back (VehicleRun.backVariant) */
  private vehicleBackSprites?: (VehicleSprite | null)[];

  /** A vehicle drawn as a prop at the start of its line: along x it is rot 0, along y rot 1. */
  private rasterizeVehicle(r: VehicleRun, variant = r.variant): VehicleSprite | null {
    const art = this.artFor(r.type);
    const meta = PROP_META[r.type];
    if (!art || !meta || this.k < 2) return null;
    const p: PropPlacement = { id: `vehicle:${r.type}:${r.x},${r.y}`, type: r.type, x: r.x, y: r.y, w: r.w, d: r.d ?? 1, rot: r.axis === 'x' ? 0 : 1, variant };
    const item = this.placeItem(p, meta, 1);
    const s = this.rasterize(item, art);
    if (!s) return null;
    return { sprite: s.sprite, lod: s.lod, bx0: item.bx0 + s.dx0, by0: item.by0 + s.dy0, w: s.w, h: s.h };
  }

  /**
   * The vehicles at time t, cut into half-tile columns like long props: each
   * column sorts by the front-most point of the vehicle's footprint inside it.
   */
  private vehicleColumns(t: number, v: View): Mover[] {
    const runs = this.world.scene.vehicles;
    if (!runs?.length) return [];
    this.vehicleSprites ??= runs.map((r) => this.rasterizeVehicle(r));
    this.vehicleBackSprites ??= runs.map((r) => (r.backVariant ? this.rasterizeVehicle(r, r.backVariant) : null));
    const out: Mover[] = [];
    const half = 16 * this.k;
    const ox = this.painter.ox;
    const even = (n: number) => Math.round(n / 2) * 2;
    runs.forEach((r, i) => {
      const s = vehicleAt(r, t);
      // running back toward the start: its back art, if it has one
      const back = this.vehicleBackSprites![i] && vehicleAt(r, t + 0.05) < s - 1e-4;
      const vs = back ? this.vehicleBackSprites![i] : this.vehicleSprites![i];
      if (!vs) return;
      const ax = r.axis === 'x';
      const bx0 = even(vs.bx0 + (ax ? 1 : -1) * s * half);
      const by0 = even(vs.by0 + (s * half) / 2);
      const bx1 = bx0 + vs.w;
      const by1 = by0 + vs.h;
      if (bx1 < v.x0 || bx0 > v.x1 || by1 < v.y0 || by0 > v.y1) return;
      const X0 = r.x + (ax ? s : 0);
      const Y0 = r.y + (ax ? 0 : s);
      const X1 = X0 + (ax ? r.w : (r.d ?? 1));
      const Y1 = Y0 + (ax ? (r.d ?? 1) : r.w);
      for (let m = Math.floor(X0 - Y1); m < Math.ceil(X1 - Y0); m++) {
        const cx0 = Math.max(bx0, ox + m * half);
        const cx1 = Math.min(bx1, ox + (m + 1) * half);
        if (cx1 <= cx0) continue;
        // the column holds the points with x − y in [m, m + 1]; its front-most one
        const fx = ax ? Math.min(X1 - 0.01, Math.max(X0 + 0.01, m + Y1)) : X1 - 0.01;
        const fy = ax ? Y1 - 0.01 : Math.min(Y1 - 0.01, Math.max(Y0 + 0.01, X1 - m));
        out.push({ x: fx, y: fy, box: [cx0, by0, cx1, by1], draw: () => this.drawVehicleColumn(vs, bx0, by0, cx0, cx1) });
      }
    });
    return out;
  }

  private drawVehicleColumn(vs: VehicleSprite, bx0: number, by0: number, cx0: number, cx1: number) {
    const s = this.vs;
    const img = s < 1 && vs.lod ? vs.lod : vs.sprite;
    const f = img === vs.lod ? 0.5 : 1;
    const sx = Math.round((cx0 - bx0) * f);
    const sw = Math.round((cx1 - cx0) * f);
    if (sw > 0) this.fctx.drawImage(cnv(img), sx, 0, sw, img.h, Math.round((cx0 - this.vx0) * s), Math.round((by0 - this.vy0) * s), sw, img.h);
  }

  private drawCritterAt(p: CritterPose) {
    const [sx, sy] = this.dp.P(p.x, p.y);
    if (this.k >= 4) drawAnimal(this.fctx, p, sx, sy, this.vs < 1, this.pack?.critters?.[p.kind]);
    else if (this.k === 2) drawCritterHD(this.fctx, p, sx, sy);
    else drawCritter(this.fctx, p, sx, sy);
  }

  /** Depth order: props by footprint, agents inserted where occlusion requires. */
  private order(agents: VisualAgent[], figures: StaticFigure[], critters: CritterPose[] = [], extra: Mover[] = []) {
    type D =
      | { kind: 'prop'; item: PropItem }
      | { kind: 'agent'; agent: VisualAgent }
      | { kind: 'fig'; fig: StaticFigure }
      | { kind: 'critter'; critter: CritterPose }
      | { kind: 'custom'; draw: () => void };
    const movers: { x: number; y: number; box?: [number, number, number, number]; sitting?: boolean; d: D }[] = [
      ...agents.map((a) => ({ x: a.x, y: a.y, sitting: a.sitting && a.state !== 'walking', d: { kind: 'agent', agent: a } as D })),
      ...figures.map((f) => ({ x: f.x, y: f.y, d: { kind: 'fig', fig: f } as D })),
      ...critters.map((k) => ({ x: k.x, y: k.y, d: { kind: 'critter', critter: k } as D })),
      ...extra.map((m) => ({ x: m.x, y: m.y, box: m.box, d: { kind: 'custom', draw: m.draw } as D })),
    ];
    const slots = new Map<number, { k: number; d: D }[]>();
    const k = this.k;
    const hw = k >= 4 ? 24 : 9 * k;
    const top = k >= 4 ? PERSON_FOOT_Y + 2 : k === 2 ? HD_FOOT_Y + 2 : 32;
    for (const m of movers) {
      const [sx, sy] = this.P(m.x, m.y);
      const [bx0, by0, bx1, by1] = m.box ?? [sx - hw, sy - top, sx + hw, sy + 2 * k];
      let after = -1;
      let before = Infinity;
      this.items.forEach((it, idx) => {
        if (it.bx1 < bx0 || it.bx0 > bx1 || it.by1 < by0 || it.by0 > by1) return;
        const inside = (m.x > it.wx0 && m.x < it.wx1 && m.y > it.wy0 && m.y < it.wy1) || sitsIn(m, it);
        const front = inside || m.x >= it.wx1 || m.y >= it.wy1;
        if (front) after = Math.max(after, idx);
        else before = Math.min(before, idx);
      });
      let slot: number;
      if (after >= 0) slot = after;
      else if (before !== Infinity) slot = before - 1;
      else {
        const key = m.x + m.y;
        slot = -1;
        this.items.forEach((it, idx) => {
          if (it.key <= key) slot = idx;
        });
      }
      const list = slots.get(slot) ?? [];
      list.push({ k: m.x + m.y, d: m.d });
      slots.set(slot, list);
    }
    const out: D[] = [];
    const flush = (i: number) => (slots.get(i) ?? []).sort((a, b) => a.k - b.k).forEach((x) => out.push(x.d));
    flush(-1);
    this.items.forEach((it, i) => {
      out.push({ kind: 'prop', item: it });
      flush(i);
    });
    for (const [k2] of slots) if (k2 < -1) flush(k2);
    return out;
  }

  private drawProp(it: PropItem, t: number) {
    if (it.wall && it.sprite) {
      const s = this.vs;
      const img = s < 1 && it.lod ? it.lod : it.sprite;
      this.fctx.drawImage(cnv(img), Math.round((it.bx0 - this.vx0) * s), Math.round((it.by0 - this.vy0) * s));
      this.drawPropAnim(it, t);
      return;
    }
    if (it.wall) return drawWall(this.dp, this.world, it.wall, t);
    const override = propImage(it.p.type, it.p.variant);
    if (override) {
      const [ax, ay] = this.dp.P(it.p.x, it.p.y);
      this.fctx.drawImage(override.img, Math.round(ax - override.anchorX), Math.round(ay - override.anchorY));
      return;
    }
    if (!this.drawPropSprite(it)) this.artFor(it.p.type)?.draw(new PropPainter(this.dp, it.p.x, it.p.y, it.p.w, it.p.d, it.p.rot), this.ctxFor(it, t));
    this.drawPropAnim(it, t);
  }

  /** A prop's sprite (or its column of a sliced one); false when it has none. */
  private drawPropSprite(it: PropItem) {
    const s = this.vs;
    const img = s < 1 && it.lod ? it.lod : it.sprite;
    if (!img) return false;
    if (it.sprX !== undefined) {
      // one column of a sliced sprite
      const f = img === it.lod ? 0.5 : 1;
      const sx = Math.round(it.sprX * f);
      const sw = Math.round((it.bx1 - it.bx0) * f);
      if (sw > 0) this.fctx.drawImage(cnv(img), sx, 0, sw, img.h, Math.round((it.bx0 - this.vx0) * s), Math.round((it.by0 - this.vy0) * s), sw, img.h);
    } else this.fctx.drawImage(cnv(img), Math.round((it.bx0 - this.vx0) * s), Math.round((it.by0 - this.vy0) * s));
    return true;
  }

  private drawPropAnim(it: PropItem, t: number) {
    if (it.wall) {
      // the wall props' animations (a clock's hands, a sconce's glow)
      const walls = this.pack?.walls;
      if (!walls) return;
      const pp = new PropPainter(this.dp, 0, 0, this.world.cols, this.world.rows, 0);
      this.world.environment.wallProps.forEach((wp, i) => {
        if (wp.wall === it.wall) walls.art[wp.type]?.anim?.(pp, it.wall!, { wp, th: this.world.theme, t, seed: i + 1 });
      });
      return;
    }
    // a baked scene's cut-outs of objects only its picture has come without art
    const art = this.artFor(it.p.type);
    if (art?.anim && !this.noAnim.has(it.p.type)) art.anim(new PropPainter(this.dp, it.p.x, it.p.y, it.p.w, it.p.d, it.p.rot), this.ctxFor(it, t));
  }

  /**
   * People, animals and vehicles on a baked scene. Its picture already shows
   * every prop, so instead of sorting props and movers into one list, movers go
   * back to front and each gets the props standing in front of it painted back
   * over it, clipped to its box: the props' order among themselves never
   * matters. A prop's animation comes after the last mover it covers (once, so
   * glows don't double up), every other one before them all.
   */
  private drawBakedMovers(movers: Mover[], t: number, visible: (it: PropItem) => boolean) {
    const k = this.k;
    const s = this.vs;
    const c = this.fctx;
    const hw = k >= 4 ? 36 : 12 * k;
    const top = k >= 4 ? PERSON_FOOT_Y + 10 : k === 2 ? HD_FOOT_Y + 6 : 36;
    movers.sort((a, b) => a.x + a.y - (b.x + b.y));
    const boxes = movers.map((m): [number, number, number, number] => {
      if (m.box) return m.box;
      const [sx, sy] = this.P(m.x, m.y);
      return [sx - hw, sy - top, sx + hw, sy + 3 * k];
    });
    const fronts = movers.map((m, i) => {
      const [bx0, by0, bx1, by1] = boxes[i];
      return this.items.filter((it) => {
        if (it.bx1 < bx0 || it.bx0 > bx1 || it.by1 < by0 || it.by0 > by1) return false;
        const inside = (m.x > it.wx0 && m.x < it.wx1 && m.y > it.wy0 && m.y < it.wy1) || sitsIn(m, it);
        if (inside) return !!this.artFor(it.p.type)?.overhead; // under a bridge, standing in the prop, or sitting on it
        return !(m.x >= it.wx1 || m.y >= it.wy1); // it stands in front
      });
    });
    const last = new Map<PropItem, number>();
    fronts.forEach((list, i) => list.forEach((it) => last.set(it, i)));
    for (const it of this.items) if (!last.has(it) && visible(it)) this.drawPropAnim(it, t);
    movers.forEach((m, i) => {
      m.draw();
      const list = fronts[i];
      if (!list.length) return;
      const [bx0, by0, bx1, by1] = boxes[i];
      c.save();
      c.beginPath();
      c.rect(Math.round((bx0 - this.vx0) * s), Math.round((by0 - this.vy0) * s), Math.round((bx1 - bx0) * s), Math.round((by1 - by0) * s));
      c.clip();
      for (const it of list) this.drawPropSprite(it);
      c.restore();
      for (const it of list) if (last.get(it) === i) this.drawPropAnim(it, t);
    });
  }

  private poseFor(a: VisualAgent, time: number, speed: number): Pose {
    const blink = time < a.blinkUntil;
    const t = a.anim * speed;
    const sit = a.sitting || undefined;
    switch (a.state) {
      case 'walking':
        return { dir: a.facing, mode: 'walk', frame: Math.floor(t * 14) % 8 };
      case 'working':
        return { dir: a.facing, mode: 'work', frame: Math.floor(t * 4) % 2, blink, sit };
      case 'interacting':
        return { dir: a.facing, mode: 'talk', frame: Math.floor(t * 5) % 2, blink, sit };
      default:
        return { dir: a.facing, mode: 'stand', frame: 0, blink, sit };
    }
  }

  /** Character sprite for this scale: [canvas, foot x, foot y]; `sitting` crops the legs. */
  private personSprite(look: Look, pose: Pose): [HTMLCanvasElement, number, number] {
    if (this.k >= 4) {
      const lod = this.vs < 1;
      return [getPerson(look, pose, lod), lod ? PERSON_FOOT_X / 2 : PERSON_FOOT_X, lod ? PERSON_FOOT_Y / 2 : PERSON_FOOT_Y];
    }
    // the small figures draw a 4-frame walk (frames here run 0..7)
    const p4 = pose.mode === 'walk' ? { ...pose, frame: pose.frame >> 1 } : pose;
    if (this.k === 2) return [getSpriteHD(look, p4), HD_FOOT_X, HD_FOOT_Y];
    return [getSprite(look, p4), SPRITE_FOOT_X, SPRITE_FOOT_Y];
  }

  private drawAgent(a: VisualAgent, sim: WorldSim, o: RenderOptions, t: number) {
    const pose = this.poseFor(a, sim.time, o.animSpeed);
    const c = this.fctx;
    const [sx, sy] = this.dp.P(a.x, a.y);
    const x = Math.round(sx);
    const y = Math.round(sy);
    const sitting = a.sitting && a.state !== 'walking';
    const ks = this.ks;
    if (!sitting) this.footShadow(x, y);
    if (o.selected.has(a.id) || o.hover === a.id) {
      const col = o.selected.has(a.id) ? (Math.sin(t * 6) > 0 ? '#ffffff' : a.look.signature) : withAlpha('#ffffff', 0.6);
      ringIso(c, x, y, 9 * ks, col);
    }
    // dev only: a prototype character's sheet (?proto=…, src/render/protoSprites.ts), at full scale
    const proto = this.k >= 4 && this.vs >= 1 ? protoSprite?.(a, pose, a.anim * o.animSpeed) : null;
    // the Cast figure (null while its atlases load: the previous figure meanwhile)
    const cast = !proto && this.k >= 4 ? castSprite(a.look, pose, a.anim * o.animSpeed, this.vs < 1) : null;
    const seated = proto || cast;
    const [sp, fx, fy] = seated || this.personSprite(a.look, pose);
    if (a.state === 'paused') c.globalAlpha = 0.85;
    let dy = y - fy;
    if (sitting && seated?.[3]) {
      // a real sitting pose: its anchor is the floor under the hips; down onto the seat cushions
      dy = y - fy + (cast && this.vs < 1 ? SEAT_DROP / 2 : SEAT_DROP);
      c.drawImage(sp, x - fx, dy);
    } else if (sitting) {
      // seated: drop the sprite onto the seat and hide the lower legs behind it
      const cut = Math.round(fy * (ks >= 2 ? 0.14 : 0.1));
      const drop = Math.round(fy * (ks >= 2 ? 0.22 : 0.21));
      dy = y - fy - drop;
      c.drawImage(sp, 0, 0, sp.width, fy - cut, x - fx, dy, sp.width, fy - cut);
    } else c.drawImage(sp, x - fx, dy);
    // where the head of the figure just drawn is (the bubbles sit above it); Cast figures are taller
    const box = cast ? castBox(a.look, false) : null;
    if (box) this.heads.set(a.id, Math.round(dy + box.y * (this.vs < 1 ? 0.5 : 1)));
    else this.heads.delete(a.id);
    c.globalAlpha = 1;
    if (a.state === 'error') {
      c.globalAlpha = 0.25 + Math.abs(Math.sin(t * 4)) * 0.2;
      disc(c, x, y - 12 * ks, 10 * ks, '#ef6a5a', 1.2);
      c.globalAlpha = 1;
    }
  }

  /** soft contact shadow under a character, cast a little toward the lower right (sun from the upper left) */
  private footShadow(x: number, y: number) {
    const c = this.fctx;
    const ks = this.ks;
    if (ks >= 2) {
      const u = ks / 2;
      c.globalAlpha = 0.22;
      disc(c, x + 3 * u, y + u, 9 * u, '#2a1a2a', 0.42);
      c.globalAlpha = 0.18;
      disc(c, x + u, y, 6 * u, '#2a1a2a', 0.45);
    } else {
      c.globalAlpha = 0.28;
      disc(c, x, y, 6, '#1c1228', 0.45);
    }
    c.globalAlpha = 1;
  }

  private drawFigure(f: StaticFigure, t: number) {
    const [sx, sy] = this.dp.P(f.x, f.y);
    this.footShadow(Math.round(sx), Math.round(sy));
    const tt = t + (f.phase ?? 0);
    const frame = f.mode === 'walk' ? Math.floor(tt * 14) % 8 : Math.floor(tt * 4) % 2;
    const pose: Pose = { dir: f.dir, mode: f.mode, frame };
    const [sp, fx, fy] = (this.k >= 4 && castSprite(f.look, pose, tt, this.vs < 1)) || this.personSprite(f.look, pose);
    this.fctx.drawImage(sp, Math.round(sx) - fx, Math.round(sy) - fy);
  }

  /** integer pixel size for UI-ish pixel art (bubbles, icons, markers) at this scale */
  private get m() {
    return Math.max(1, Math.floor(this.ks / 2));
  }

  private drawBubble(a: VisualAgent, time: number) {
    const c = this.fctx;
    const [sx, sy] = this.dp.P(a.x, a.y);
    const x = Math.round(sx);
    const ks = this.ks;
    const m = this.m;
    const footY = ks >= 4 ? PERSON_FOOT_Y : ks >= 2 ? HD_FOOT_Y : SPRITE_FOOT_Y;
    const lift = ks >= 2 ? Math.round(footY * 0.13) : 2;
    let top = Math.round(sy) - footY + lift - (a.sitting ? Math.round(footY * 0.22) : 0);
    const head = this.heads.get(a.id);
    if (head !== undefined) top = head;
    let kind = a.bubble?.kind;
    if (!kind) {
      const persistent: Partial<Record<AgentState, string>> = { paused: 'pause', waiting: 'wait', error: 'alert' };
      kind = persistent[a.state] as typeof kind;
      if (!kind && a.state === 'on_break' && Math.floor(time * 0.6 + a.anim) % 5 === 0) kind = 'coffee';
    }
    if (!kind) return;
    if (kind === 'chat') {
      bubble(c, x - 6 * m, top - 9 * m, 11, 6, '#fffaf0', m);
      for (let i = 0; i < 3; i++) rect(c, x - 4 * m + i * 3 * m, top - 6 * m - (Math.floor(time * 6) % 3 === i ? m : 0), 2 * m, 2 * m, '#5a6378');
      return;
    }
    const bg = kind === 'alert' ? '#ffe3df' : kind === 'pause' ? '#fff3d6' : kind === 'wait' ? '#efe6ff' : '#fffaf0';
    bubble(c, x - 4 * m, top - 9 * m, 7, 7, bg, m);
    icon(c, kind, x - 3 * m, top - 8 * m, time, m);
  }

  private drawEffects(sim: WorldSim) {
    const c = this.fctx;
    const m = this.m;
    for (const e of sim.effects) {
      const k = e.t / 1.2;
      const [ex, ey] = this.dp.P(e.x, e.y, e.kind === 'sparkle' ? 30 : 10);
      for (let i = 0; i < (e.kind === 'sparkle' ? 8 : 6); i++) {
        const ang = (i / 8) * Math.PI * 2;
        const d = (2 + k * (e.kind === 'sparkle' ? 12 : 8)) * m;
        c.globalAlpha = 1 - k;
        const px = Math.round(ex + Math.cos(ang) * d);
        const py = Math.round(ey + Math.sin(ang) * d * 0.7 - k * 4 * m);
        rect(c, px, py, m, m, i % 2 ? '#fff6a8' : e.color);
        if (e.kind === 'sparkle' && i % 2 === 0) {
          rect(c, px - m, py, 3 * m, m, e.color);
          rect(c, px, py - m, m, 3 * m, e.color);
        }
      }
      c.globalAlpha = 1;
    }
  }

  private drawGrid(sim: WorldSim | null) {
    const c = this.fctx;
    const w = this.world;
    const P = this.dp;
    c.globalAlpha = 0.35;
    for (let y = 0; y <= w.rows; y++) P.line3([0, y, 0], [w.cols, y, 0], '#ffffff');
    for (let x = 0; x <= w.cols; x++) P.line3([x, 0, 0], [x, w.rows, 0], '#ffffff');
    if (sim)
      for (let y = 0; y < w.rows; y++)
        for (let x = 0; x < w.cols; x++)
          if (!sim.grid.walkable(x, y)) P.quad([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], '#ef6a5a');
    c.globalAlpha = 1;
  }

  private drawPoints(sim: WorldSim | null) {
    const c = this.fctx;
    const m = this.m;
    for (const p of this.world.points) {
      const [x, y] = this.dp.P(p.x, p.y);
      const col = POINT_COLORS[p.type];
      const busy = sim ? sim.occupants(p.id).length > 0 || !!sim.reservedBy(p.id) : false;
      poly(c, [[x, y - 4 * m], [x + 6 * m, y - m], [x, y + 2 * m], [x - 6 * m, y - m]], OUT);
      poly(c, [[x, y - 3 * m], [x + 4 * m, y - m], [x, y + m], [x - 4 * m, y - m]], busy ? lighten(col, 0.3) : col);
      const dir = { ne: [6, -3], nw: [-6, -3], se: [6, 3], sw: [-6, 3] }[p.facing];
      line(c, x, y - m, x + dir[0] * m, y - m + dir[1] * m, col);
    }
  }

  private drawPaths(agents: VisualAgent[], o: RenderOptions) {
    const c = this.fctx;
    const m = this.m;
    for (const a of agents) {
      if (o.showPaths && a.path.length) {
        let [px, py] = this.dp.P(a.x, a.y);
        for (const wp of a.path) {
          const [nx, ny] = this.dp.P(wp.x, wp.y);
          dashed(c, px, py, nx, ny, a.look.signature);
          px = nx;
          py = ny;
        }
      }
      if (o.showTargets && a.target) {
        const [tx, ty] = this.dp.P(a.target.x, a.target.y);
        line(c, tx - 3 * m, ty - 2 * m, tx + 3 * m, ty + 2 * m, a.look.signature);
        line(c, tx - 3 * m, ty + 2 * m, tx + 3 * m, ty - 2 * m, a.look.signature);
      }
    }
  }

  // ── screen composite ───────────────────────────────────────
  /**
   * Draw the frame onto a screen canvas through the camera, then labels.
   * Returns the transform used (for picking).
   */
  composite(ctx: CanvasRenderingContext2D, vw: number, vh: number, cam: { zoom: number; cx: number; cy: number }, sim: WorldSim | null, o: RenderOptions, dpr: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#17131a';
    ctx.fillRect(0, 0, vw, vh);
    const tx = Math.round(vw / 2 - cam.cx * cam.zoom);
    const ty = Math.round(vh / 2 - cam.cy * cam.zoom);
    const scale = cam.zoom / this.vs;
    // crisp nearest-neighbour at integer scales; only a zoomed-out overview without a
    // level of detail (≤ 64×32 worlds below 1×) is filtered instead of dropping pixels
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(this.frame, 0, 0, this.vw, this.vh, tx + this.vx0 * cam.zoom, ty + this.vy0 * cam.zoom, this.vw * scale, this.vh * scale);
    ctx.imageSmoothingEnabled = false;
    const night = o.night === undefined ? 0 : this.nightLevel.step(o.night, performance.now());
    this.grade(ctx, vw, vh, 1 - night);
    if (night > 0) {
      this.nightMap ??= new NightMap(this.fw, this.fh, worldLights(this.world, this.painter, (type) => this.artFor(type)), roomOutline(this.world, this.painter, (this.pack?.walls?.height ?? WALL_H) + 6));
      drawNight(ctx, vw, vh, tx, ty, cam.zoom, this.nightMap, night);
    }
    if (sim && o.labels) this.drawLabels(ctx, sim, tx, ty, cam.zoom, dpr, o);
    return { tx, ty, zoom: cam.zoom };
  }

  /** day (0) to night (1), eased */
  private nightLevel = new NightLevel();
  /** the scene's lights at night, painted once (made on first use) */
  private nightMap?: NightMap;

  /** One warm sun for the whole scene: soft-light tint, a little bloom and a vignette (`day` fades it at night). */
  grade(ctx: CanvasRenderingContext2D, vw: number, vh: number, day = 1) {
    const { tint } = this.world.scene.light;
    const strength = this.world.scene.light.strength * day;
    const g = ctx.createLinearGradient(0, 0, vw, vh);
    g.addColorStop(0, withAlpha(tint, strength));
    g.addColorStop(0.55, withAlpha(tint, strength * 0.35));
    g.addColorStop(1, withAlpha('#5a5aa0', strength * 0.5));
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'screen';
    const sun = ctx.createRadialGradient(vw * 0.12, -vh * 0.1, 0, vw * 0.12, -vh * 0.1, Math.max(vw, vh) * 0.7);
    sun.addColorStop(0, withAlpha(tint, strength * 0.35));
    sun.addColorStop(1, withAlpha(tint, 0));
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.8);
    v.addColorStop(0, 'rgba(20,12,24,0)');
    v.addColorStop(1, 'rgba(20,12,24,0.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, vw, vh);
  }

  private drawLabels(ctx: CanvasRenderingContext2D, sim: WorldSim, tx: number, ty: number, zoom: number, dpr: number, o: RenderOptions) {
    const zf = this.k === 1 ? zoom * 3.4 : zoom * this.k * 1.7;
    const fs = Math.round(Math.max(9, Math.min(13, zf)) * dpr) / dpr;
    ctx.font = `600 ${fs * dpr}px "Inter Variable", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const below = this.k === 1 ? 6 * dpr : 6 * dpr * Math.max(1, (this.k * zoom) / 2) * 2;
    for (const a of sim.agents) {
      if (a.spawnIn > 0) continue;
      const [fx, fy] = this.P(a.x, a.y);
      const x = Math.round(tx + fx * zoom);
      const y = Math.round(ty + fy * zoom + below);
      const name = a.look.name;
      const tw = ctx.measureText(name).width;
      const pad = 6 * dpr;
      const w = tw + pad * 2 + (a.look.founder ? 10 * dpr : 0) + 6 * dpr;
      const h = fs * dpr + 6 * dpr;
      const lx = x - w / 2;
      ctx.fillStyle = 'rgba(20,16,26,0.82)';
      roundRect(ctx, lx, y, w, h, h / 2);
      ctx.fill();
      if (a.state === 'working' && a.task) {
        ctx.save();
        roundRect(ctx, lx, y, w, h, h / 2);
        ctx.clip();
        ctx.fillStyle = withAlpha(STATE_COLORS.working, 0.32);
        ctx.fillRect(lx, y, w * Math.min(1, a.task.progress), h);
        ctx.restore();
      }
      ctx.fillStyle = STATE_COLORS[a.state];
      ctx.beginPath();
      ctx.arc(lx + pad + 2 * dpr, y + h / 2, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
      let tx2 = lx + pad + 8 * dpr;
      if (a.look.founder) {
        ctx.fillStyle = '#f3c843';
        ctx.fillText('★', tx2, y + h / 2 + 0.5);
        tx2 += 10 * dpr;
      }
      ctx.fillStyle = o.selected.has(a.id) ? '#ffffff' : '#f3e9dc';
      ctx.fillText(name, tx2, y + h / 2 + 0.5);
    }
  }

  // ── picking ────────────────────────────────────────────────
  pickAgent(sim: WorldSim, fx: number, fy: number): string | null {
    let best: VisualAgent | null = null;
    const k = this.k;
    const hw = k >= 4 ? 22 : k === 2 ? 11 : 8;
    const hh = k >= 4 ? PERSON_H - 16 : k === 2 ? HD_H - 8 : SPRITE_H - 2;
    for (const a of sim.agents) {
      if (a.spawnIn > 0) continue;
      const [sx, sy] = this.P(a.x, a.y);
      if (fx >= sx - hw && fx <= sx + hw && fy >= sy - hh && fy <= sy + 3 * k) if (!best || a.x + a.y > best.x + best.y) best = a;
    }
    return best?.id ?? null;
  }

  /** Copy a native-pixel region of the scene (as last rendered by renderFrame) into a canvas. */
  copyRegion(x0: number, y0: number, w: number, h: number, out: HTMLCanvasElement) {
    const ctx = out.getContext('2d')!;
    const s = this.vs;
    ctx.imageSmoothingEnabled = out.width < w * s;
    ctx.drawImage(this.frame, (x0 - this.vx0) * s, (y0 - this.vy0) * s, w * s, h * s, 0, 0, out.width, out.height);
  }
}

// ── small helpers ────────────────────────────────────────────

function drawFloorWater(native: Painter, P: Painter, w: WorldDef, t: number, v: View) {
  const areas = [...w.environment.patches.filter((p) => p.style === 'water'), ...w.scene.ground.filter((g) => g.mat === 'water')];
  const k = P.k;
  for (const s of areas)
    for (let j = 0; j < s.d; j++)
      for (let i = 0; i < s.w; i++) {
        const [sx, sy] = native.P(s.x + i + 0.5, s.y + j + 0.5);
        if (sx < v.x0 - 80 || sx > v.x1 + 80 || sy < v.y0 - 80 || sy > v.y1 + 80) continue;
        const ph = (t * 0.6 + (i * 7 + j * 3) * 0.37) % 4;
        if (ph < 0.6) P.dot(s.x + i + 0.4, s.y + j + 0.5, 0, '#d8eefc', 3 * k, Math.max(1, k / 2));
        else if (ph > 2 && ph < 2.4) P.dot(s.x + i + 0.7, s.y + j + 0.2, 0, '#9fd0f2', 2 * k, Math.max(1, k / 2));
      }
}

function ringIso(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const pts: [number, number][] = [];
  const n = Math.max(24, Math.round(r * 2));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5)]);
  }
  for (let i = 0; i < pts.length; i++) line(c, pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], col);
}

function dashed(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let i = 0; i < n; i += 2) rect(c, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1, 1, col);
}

/** Speech bubble in pixel art; `m` = size of one art pixel in frame pixels. */
function bubble(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bg: string, m = 1) {
  rect(c, x - m, y, (w + 2) * m, h * m, OUT);
  rect(c, x, y - m, w * m, (h + 2) * m, OUT);
  rect(c, x, y, w * m, h * m, bg);
  const mid = x + Math.floor(w / 2) * m;
  rect(c, mid - m, y + (h + 1) * m, 3 * m, m, OUT);
  rect(c, mid, y + h * m, m, 2 * m, OUT);
  rect(c, mid - m, y + h * m, 2 * m, m, bg);
}

const ICONS: Record<string, string[]> = {
  done: ['....#', '...#.', '#.#..', '.#...', '.....'],
  idea: ['.###.', '#####', '.###.', '..#..', '.###.'],
  coffee: ['.#.#.', '####.', '#####', '####.', '.##..'],
  heart: ['##.##', '#####', '#####', '.###.', '..#..'],
  zz: ['###..', '..#..', '.#.##', '###.#', '...##'],
  wave: ['#.#.#', '#.#.#', '#####', '.###.', '.###.'],
  alert: ['..#..', '..#..', '..#..', '.....', '..#..'],
  pause: ['##.##', '##.##', '##.##', '##.##', '##.##'],
  wait: ['#####', '.#.#.', '..#..', '.#.#.', '#####'],
  question: ['.###.', '#...#', '..##.', '.....', '..#..'],
  music: ['..###', '..#.#', '..#.#', '###.#', '##.##'],
  search: ['.##..', '#..#.', '#..#.', '.###.', '....#'],
};
const ICON_COLOR: Record<string, string> = {
  done: '#3fb68b',
  idea: '#e8a53d',
  coffee: '#8a5a3c',
  heart: '#e2553b',
  zz: '#5b8def',
  wave: '#d09060',
  alert: '#e2553b',
  pause: '#c98a2a',
  wait: '#8a6ad0',
  question: '#5b8def',
  music: '#ef7aa8',
  search: '#2a9d8f',
};

function icon(c: CanvasRenderingContext2D, name: string, x: number, y: number, t: number, m = 1) {
  const rows = ICONS[name];
  if (!rows) return;
  const col = ICON_COLOR[name];
  const flip = name === 'wait' && Math.floor(t * 1.5) % 2 === 1;
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && rect(c, x + i * m, y + (flip ? 4 - j : j) * m, m, m, col)));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── renderer + thumbnail caches ─────────────────────────────
// 128×64 worlds take seconds to build (pixels painted on the CPU), so they are
// built in Web Workers: readyRenderer() returns null until the world is ready
// and listeners hear when it is. rendererFor() still builds synchronously
// (tests, or when workers are unavailable).

const renderers = new Map<string, WorldRenderer>();
const building = new Map<string, Promise<WorldRenderer>>();
// a 128×64 scene holds ~100 MB of pixels: keep only a few, least recently used go first
const MAX_RENDERERS = 3;
let lastEvict = 0;
/** the world the app is on: never evicted */
let pinned = '';
export function pinRenderer(id: string) {
  pinned = id;
}
const used = new Map<string, number>();
const readyAt = new Map<string, number>();
const touch = (id: string) => used.set(id, performance.now());
function evict(keep: string) {
  if (renderers.size <= MAX_RENDERERS) return;
  const now = performance.now();
  const victims = [...renderers.keys()]
    // a fresh renderer gets a moment for its thumbnail; the session's world is touched every frame
    .filter((id) => id !== keep && id !== pinned && now - (readyAt.get(id) ?? 0) > 4000 && now - (used.get(id) ?? 0) > 3000)
    .sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0));
  while (renderers.size > MAX_RENDERERS && victims.length) {
    const id = victims.shift()!;
    renderers.delete(id);
    used.delete(id);
  }
}
const readyListeners = new Set<() => void>();
let readyVersion = 0;

export function rendererFor(w: WorldDef) {
  let r = renderers.get(w.id);
  if (!r) {
    r = new WorldRenderer(w);
    renderers.set(w.id, r);
    readyAt.set(w.id, performance.now());
  }
  touch(w.id);
  return r;
}

/** Ids of the worlds whose scenes are in memory (diagnostics). */
export const rendererIds = () => [...renderers.keys()];
// dev builds: the cache is reachable from the console for memory checks
if (import.meta.env.DEV) (globalThis as { __realmnestRenderers?: unknown }).__realmnestRenderers = renderers;

/** Notify when any renderer finishes building (returns an unsubscribe). */
export function onRendererReady(fn: () => void) {
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}
/** Bumps every time a renderer becomes ready (for memo keys). */
export const rendererReadyVersion = () => readyVersion;

function ready(w: WorldDef, r: WorldRenderer) {
  renderers.set(w.id, r);
  building.delete(w.id);
  readyAt.set(w.id, performance.now());
  touch(w.id);
  evict(w.id);
  // once its thumbnail is made, a world nobody is looking at can go
  setTimeout(() => evict(''), 4500);
  readyVersion++;
  readyListeners.forEach((l) => l());
  return r;
}

// a small pool of build workers
let pool: Worker[] | null = null;
let next = 0;
const waiting = new Map<string, { w: WorldDef; resolve: (r: WorldRenderer) => void; reject: (e: unknown) => void }>();
function workers(): Worker[] | null {
  if (pool) return pool;
  if (typeof Worker === 'undefined') return null;
  try {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    pool = [];
    for (let i = 0; i < n; i++) {
      const wk = new Worker(new URL('./buildWorker.ts', import.meta.url), { type: 'module' });
      wk.onmessage = (e: MessageEvent<{ id: string; payload?: WorldPayload; error?: string }>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if (e.data.payload) job.resolve(ready(job.w, new WorldRenderer(job.w, e.data.payload)));
        else job.reject(new Error(e.data.error));
      };
      pool.push(wk);
    }
  } catch {
    pool = null;
  }
  return pool;
}

/** The renderer for a world: its baked scene if it has one, else built off the main thread when it can be. */
export function rendererAsync(w: WorldDef): Promise<WorldRenderer> {
  const r = renderers.get(w.id);
  if (r) return Promise.resolve(r);
  let job = building.get(w.id);
  if (job) return job;
  const baked = bakedSceneUrl(w.id);
  job = baked
    ? loadBakedScene(baked, w)
        .then((p) => ready(w, new WorldRenderer(w, p)))
        .catch((err) => {
          // a missing or broken picture: paint the scene instead
          console.warn('[render] baked scene failed, building the scene instead', err);
          return build(w);
        })
    : build(w);
  building.set(w.id, job);
  return job;
}

/** Paint a world's scene, in a build worker when it can. */
function build(w: WorldDef): Promise<WorldRenderer> {
  const pw = tileScale(w) >= 4 ? workers() : null;
  return new Promise<WorldRenderer>((resolve, reject) => {
    if (!pw) {
      // small worlds (or no workers): build on the main thread, after this frame
      setTimeout(() => {
        try {
          resolve(ready(w, new WorldRenderer(w)));
        } catch (err) {
          reject(err);
        }
      }, 0);
      return;
    }
    waiting.set(w.id, { w, resolve, reject });
    pw[next++ % pw.length].postMessage({ id: w.id });
  }).catch((err) => {
    // a worker failed: fall back to building here
    console.warn('[render] worker build failed, building on the main thread', err);
    return ready(w, new WorldRenderer(w));
  });
}

/** The renderer if it is ready; otherwise starts building it and returns null. */
export function readyRenderer(w: WorldDef): WorldRenderer | null {
  const r = renderers.get(w.id);
  if (r) {
    touch(w.id);
    // trim the cache now and then (renderers are asked for every frame)
    const now = performance.now();
    if (now - lastEvict > 1000) {
      lastEvict = now;
      evict(w.id);
    }
    return r;
  }
  void rendererAsync(w);
  return null;
}

/** Start building these worlds in the background (e.g. all of them, at startup). */
export function prebuild(ws: WorldDef[]) {
  for (const w of ws) void rendererAsync(w);
}

const thumbs = new Map<string, string>();
/** A pretty static render of a world (with posed figures) as a data URL; '' until the world is built. */
export function worldThumbnail(w: WorldDef, figures: StaticFigure[] = [], width = 480): string {
  const key = `${w.id}|${width}|${figures.length}`;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const r = readyRenderer(w);
  if (!r) return '';
  const b = r.bounds();
  const cw = b.x1 - b.x0;
  const ch = Math.round(cw * 0.62);
  const cy = (b.y0 + b.y1) / 2 - ch / 2;
  const zoom = width / cw;
  r.renderFrame(null, 1.3, { ...DEFAULT_RENDER, labels: false }, figures, { x0: b.x0, y0: cy, x1: b.x1, y1: cy + ch, zoom: Math.min(1, zoom * 2) });
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = Math.round(width * 0.62);
  r.copyRegion(b.x0, cy, cw, ch, cv);
  r.grade(cv.getContext('2d')!, cv.width, cv.height);
  const url = cv.toDataURL('image/png');
  thumbs.set(key, url);
  return url;
}

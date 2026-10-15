// ─────────────────────────────────────────────────────────────
// WORLD = data. Layout, props, interaction points, navigation and camera.
// Coordinates are tile units on an isometric grid: x grows to the
// screen's lower-right, y to the lower-left. (0,0) is the back corner.
// Walls sit outside the grid (along y=0 → "ne" wall, x=0 → "nw" wall).
// ─────────────────────────────────────────────────────────────

export type Facing = 'ne' | 'nw' | 'se' | 'sw';

export type InteractionType =
  | 'WORKSTATION'
  | 'BREAK'
  | 'COFFEE'
  | 'MEETING'
  | 'MACHINE'
  | 'LAB_BENCH'
  | 'SERVER'
  | 'CROP'
  | 'CONTROL_PANEL'
  | 'LOUNGE'
  | 'STORAGE'
  | 'DECORATIVE';

export const WORK_TYPES: InteractionType[] = ['WORKSTATION', 'MACHINE', 'LAB_BENCH', 'SERVER', 'CROP', 'CONTROL_PANEL'];
export const BREAK_TYPES: InteractionType[] = ['BREAK', 'COFFEE', 'LOUNGE'];
export const OBSERVE_TYPES: InteractionType[] = ['DECORATIVE', 'STORAGE'];

export interface InteractionPoint {
  id: string;
  type: InteractionType;
  /** continuous tile coordinates where the agent stands / sits */
  x: number;
  y: number;
  facing: Facing;
  capacity: number;
  worldId: string;
  tags: string[];
  label: string;
  /** what the agent is doing here: "coding", "watering"… */
  verb?: string;
  /** agent sits (sofa, bench, stool) */
  sit?: boolean;
}

export interface PropPlacement {
  id: string;
  type: string;
  x: number;
  y: number;
  /** local width (along the prop's front) and depth, in tiles */
  w: number;
  d: number;
  /** 0 = front faces south-west (+y), 1 = front faces south-east (+x) */
  rot: 0 | 1;
  variant?: string;
  color?: string;
}

export type WallSide = 'ne' | 'nw';

export interface WallPropPlacement {
  id: string;
  type: string;
  wall: WallSide;
  /** start along the wall in tiles, and width */
  at: number;
  w: number;
  variant?: string;
  color?: string;
}

export type FloorStyle = 'wood' | 'tile' | 'carpet' | 'grass' | 'metal' | 'concrete' | 'lab' | 'raised' | 'planks' | 'paving';
export type FloorPatchStyle = 'rug' | 'path' | 'hazard' | 'soil' | 'water' | 'lane' | 'pad' | 'grate' | 'gravel' | 'deck';

export interface FloorPatch {
  style: FloorPatchStyle;
  x: number;
  y: number;
  w: number;
  d: number;
  color?: string;
  /** water and similar patches block movement */
  blocking?: boolean;
}

export interface WorldTheme {
  floorA: string;
  floorB: string;
  floorDetail: string;
  wall: string;
  wallTrim: string;
  slab: string;
  accent: string;
  accent2: string;
  /** UI tint when this world is active */
  ui: string;
  /** sky behind the diorama */
  sky: [string, string];
}

export interface WorldEnvironment {
  floor: FloorStyle;
  outdoor: boolean;
  /** draw back walls (indoor) or a fence/hedge line (outdoor) */
  backdrop: 'walls' | 'fence' | 'hedge' | 'none';
  patches: FloorPatch[];
  wallProps: WallPropPlacement[];
  /**
   * Ground tile width in pixels: 32 (default, 32×16 tiles), 64 (64×32) or 128
   * (128×64, the Farm's 2× fidelity art — see docs/FARM_ART_BIBLE.md).
   * World-space proportions never change with the tile size: only the pixel
   * density of the art does.
   */
  tile?: 32 | 64 | 128;
}

/** Pixel scale of a world's art over the base 32×16 projection (1 or 2). */
export const tileScale = (w: { environment: { tile?: number } }) => (w.environment.tile ?? 32) / 32;

/** Ground materials, shaded per pixel by the renderer (src/render/materials.ts). */
export type MaterialId =
  | 'grass'
  | 'meadow'
  | 'paving'
  | 'cobble'
  | 'dirt'
  | 'soil'
  | 'water'
  | 'wood'
  | 'planks'
  | 'carpet'
  | 'concrete'
  | 'lab'
  | 'tile'
  | 'metal'
  | 'raised'
  | 'asphalt'
  | 'sidewalk'
  | 'sand'
  | 'gravel'
  | 'deck'
  | 'hull'
  | 'space'
  | 'hazard'
  | 'grate'
  | 'roof'
  /** shaded woodland floor: dark grass, moss and leaf litter */
  | 'forest';

export interface GroundArea {
  x: number;
  y: number;
  w: number;
  d: number;
  mat: MaterialId;
}

/** Built-in kinds, or any kind a world pack brings along (WorldPack.critters). */
export type CritterKind = 'chicken' | 'butterfly' | 'duck' | 'cat' | 'bird' | 'rooster' | 'sheep' | 'dog' | 'frog' | 'cow' | 'pigeon' | (string & {});

export interface CritterSpawn {
  kind: CritterKind;
  /** wander area in tiles (may be outside the playable grid) */
  x: number;
  y: number;
  w: number;
  d: number;
  count: number;
}

/** Scenic margin (frame px, at zoom 1) painted on every side of the playable area. */
export const SCENE_MARGIN_PX = 600;

/**
 * Margin for a given art scale: the same world-space margin as the 64×32 Farm
 * for HD scales (so framing and panning room are preserved), 600 px otherwise.
 */
export const sceneMarginPx = (k: number) => SCENE_MARGIN_PX * Math.max(1, k / 2);

/**
 * Tile-space extent of the painted scene, as ranges of u = x − y and v = x + y
 * (screen columns / rows). Use it to fill the surroundings right up to the frame edge.
 */
export function sceneTileRange(cols: number, rows: number, outdoor = true, k = 1) {
  const top = outdoor ? 24 : 70;
  const M = sceneMarginPx(k) / k;
  return {
    u0: Math.floor((-rows * 16 - 24 - M) / 16) - 2,
    u1: Math.ceil((cols * 16 + 24 + M) / 16) + 2,
    v0: Math.floor((-top - 12 - M) / 8) - 2,
    v1: Math.ceil(((cols + rows) * 8 + 28 + M) / 8) + 10,
  };
}

/** A route of passers-by (src/render/ambient.ts): a polyline of tile points, walked there and back, or round if `loop`. */
export interface WalkerRoute {
  path: [number, number][];
  count: number;
  loop?: boolean;
  /** tiles per second (default 0.55) */
  speed?: number;
}

/** A vehicle on a straight line (src/render/ambient.ts). Its art is a prop type drawn w × 1 tiles along the line. */
export interface VehicleRun {
  type: string;
  variant?: string;
  /** the line starts at tile (x, y) and runs `length` tiles along the axis */
  x: number;
  y: number;
  axis: 'x' | 'y';
  length: number;
  /** the vehicle's own length in tiles, and its width across the line (default 1) */
  w: number;
  d?: number;
  /** tiles per second */
  speed: number;
  /** offsets of its stops from the line's start (where its own start halts), seconds at each */
  stops?: number[];
  dwell?: number;
  /** seconds waiting at each end of the line (best placed off the frame) */
  endWait?: number;
  /** seconds into its timetable at t = 0 */
  phase?: number;
  /** the art variant drawn while it runs back toward the line's start (its other end facing forward); default: the same art */
  backVariant?: string;
}

/** A colour grade for a painted scene (see src/render/hd/grade.ts). */
export interface ColorGrade {
  /** saturation multiplier */
  saturation?: number;
  /** degrees the greens turn toward yellow */
  greenHue?: number;
  /** lightness contrast of the greens around a mid tone (1 = unchanged) */
  greenContrast?: number;
  /** lift of the mid tones of earth and wood (0 = unchanged) */
  earthLift?: number;
  /** a brightness curve: the output lightness for input 0, 0.1 … 1 (11 values), e.g. matched to a reference picture */
  tone?: number[];
}

/**
 * The world beyond the playable grid: extended environment + scenic ground.
 * Purely visual. Agents never leave the playable grid.
 */
export interface SceneDef {
  /** tiles of authored surroundings on every side */
  ext: number;
  /** ground everywhere not covered by `ground` areas (infinite) */
  outer: MaterialId;
  /** ground areas, later entries win; may extend outside the playable grid */
  ground: GroundArea[];
  /** scenic props (non-interactive); positions usually outside the grid */
  props: PropPlacement[];
  critters: CritterSpawn[];
  /** warm sun tint and strength of the colour grade */
  light: { tint: string; strength: number };
  /** colour grade baked into the painted scene (ground and props) at 128×64 */
  grade?: ColorGrade;
  /** low cutaway walls on the front edges of indoor rooms */
  frontWalls?: boolean;
  /** passers-by walking routes outside the playable grid (decorative) */
  walkers?: WalkerRoute[];
  /** vehicles running back and forth along straight lines (a tram, a monorail train) */
  vehicles?: VehicleRun[];
}

export interface WorldDef {
  id: string;
  name: string;
  description: string;
  tagline: string;
  emoji: string;
  theme: WorldTheme;
  /** outfit collection id used by this world */
  outfitCategory: string;
  defaultOutfitId: string;
  cols: number;
  rows: number;
  environment: WorldEnvironment;
  props: PropPlacement[];
  /** every interaction point, all types */
  points: InteractionPoint[];
  spawnPoints: { x: number; y: number }[];
  /** named waypoints used for wandering and future scripted routes */
  navigationNodes: { id: string; x: number; y: number }[];
  /** camera hints: default zoom (device px per art px) and padding */
  camera: { zoom: number; padding: number };
  /** task titles for the mock runtime */
  tasks: string[];
  /** extended environment around the playable area */
  scene: SceneDef;
  /** cached thumbnail slot; generated at runtime from the renderer */
  thumbnail?: string;
}

/** Derived views over points (kept as helpers rather than duplicate data). */
export const pointsOf = (w: WorldDef, types: InteractionType[]) => w.points.filter((p) => types.includes(p.type));
export const workPoints = (w: WorldDef) => pointsOf(w, WORK_TYPES);
export const breakPoints = (w: WorldDef) => pointsOf(w, BREAK_TYPES);
export const interactionPoints = (w: WorldDef) => pointsOf(w, ['MEETING']);
export const decorativePoints = (w: WorldDef) => pointsOf(w, OBSERVE_TYPES);

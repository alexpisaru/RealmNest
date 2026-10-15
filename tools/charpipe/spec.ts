// Character pipeline prototype: the data files under art/charpipe and where things go.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Rect = [number, number, number, number];
export type Pt = [number, number];

export interface RigJoint {
  id: string;
  kind?: 'null';
  parent?: string;
}
export interface Rig {
  id: string;
  frame: { w: number; h: number };
  foot: Pt;
  joints: RigJoint[];
  /** back to front, the joints that carry art */
  drawOrder: string[];
  /** screen rows per px along the facing ground diagonal, per view (se: forward is down-right) */
  groundSlope: Record<string, number>;
}

export interface CharacterSpec {
  id: string;
  name: string;
  rig: string;
  view: string;
  source: { file: string };
  pivots: Record<string, Pt>;
  /** points on the bottom of each foot part (rest pose), for groundLock */
  soles: Record<string, Pt[]>;
  /** px from a stepping joint's pivot to the far end of its limb (foot sole, hand), for `step` tracks */
  reach: Record<string, number>;
  /** cut-out characters: one flat rest-pose sprite cut into the rig's parts */
  cut?: { order: string[]; rects: Record<string, Rect[]>; rest: string };
  overlap?: Record<string, Rect[]>;
  fill?: Record<string, { rect: Rect; from: 'left' | 'right'; outline?: string }[]>;
  /**
   * layered characters (drawn in parts, e.g. by the PhotoCraft factory): the art layers back to
   * front, each riding on a joint; files are parts/<variant>/<id>.png in the character folder
   */
  layers?: { id: string; joint: string; folder?: string }[];
  /** a character drawn at another density than the rig's cast (e.g. the HD base: 160×256, feet at 80,240) */
  frame?: { w: number; h: number };
  foot?: Pt;
  /** the first is the default (the one the template is built with) */
  variants: Record<string, { label: string; recolor?: Record<string, string> }>;
  /** drawn once in the rest pose; `offset` moves art drawn for another character onto this one's head */
  accessories: Record<string, { label: string; file: string; joint: string; offset?: Pt }>;
}

/** Per-frame values; a missing track or value means 0 (rest pose). */
export interface Track {
  /** degrees, clockwise on screen (After Effects convention) */
  rot?: number[];
  /** art pixels, whole numbers */
  dx?: number[];
  dy?: number[];
  /** px the far end of the limb moves along the ground diagonal (a shear, as the shipped rig walks) */
  step?: number[];
}
export interface AnimationSpec {
  id: string;
  label: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** offsets are literal pixels at any body density (scaleAnimation leaves them alone) */
  pixelExact?: boolean;
  /** solve the pelvis height per frame so the lowest sole stays on its rest row */
  groundLock?: boolean;
  /** replaces the rig's draw order for this animation (e.g. hands in front at a desk) */
  drawOrder?: string[];
  /** px the whole figure is moved in this animation (root dy), so the app moves its anchor too (sit: the seat point) */
  anchorDy?: number;
  tracks: Record<string, Track>;
}

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const ART = join(ROOT, 'art/charpipe');
export const BUILD = join(ART, 'build');
/** the result the app loads (dev preview only for now) */
export const ASSETS = join(ROOT, 'src/assets/characters/prototype');

const json = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

export const loadRig = (id: string) => json<Rig>(join(ART, 'rig', `${id}.json`));
export const loadCharacter = (id: string) => json<CharacterSpec>(join(ART, 'characters', id, 'character.json'));
export const charDir = (id: string) => join(ART, 'characters', id);
export function loadAnimations(only?: string[]): AnimationSpec[] {
  const dir = join(ART, 'animations');
  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => json<AnimationSpec>(join(dir, f)));
  const order = ['idle', 'walk', 'work', 'walk_planar'];
  all.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  return only?.length ? all.filter((a) => only.includes(a.id)) : all;
}

/** The EffectCraft CLI: $EFFECTCRAFT_CLI, else the Windows installer's default folder, else PATH. */
export function effectcraftCli(): string {
  if (process.env.EFFECTCRAFT_CLI) return process.env.EFFECTCRAFT_CLI;
  const win = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'EffectCraft', 'effectcraft-cli.exe');
  if (process.platform === 'win32' && existsSync(win)) return win;
  return 'effectcraft-cli';
}

/** the joints that draw something, i.e. not nulls */
export const artJoints = (rig: Rig) => rig.joints.filter((j) => j.kind !== 'null').map((j) => j.id);

/** Object.entries without the human-readable "note" keys the JSON files carry. */
export const specEntries = <T>(o: Record<string, T>): [string, T][] => Object.entries(o).filter(([k]) => k !== 'note');

/**
 * The shared animations are written in pixels for the 80×128 cast; a body drawn at another
 * density moves its offsets and steps by `scale` (whole pixels stay whole).
 */
export function scaleAnimation(a: AnimationSpec, scale: number): AnimationSpec {
  if (scale === 1 || a.pixelExact) return a;
  const px = (v?: number[]) => v?.map((x) => Math.round(x * scale));
  const tracks = Object.fromEntries(Object.entries(a.tracks).map(([j, t]) => [j, { ...t, dx: px(t.dx), dy: px(t.dy), step: t.step?.map((x) => x * scale) }]));
  return { ...a, tracks };
}

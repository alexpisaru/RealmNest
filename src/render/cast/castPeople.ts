// ─────────────────────────────────────────────────────────────
// The Cast: the approved character model (docs/charpipe/CAST.md), drawn from the pack in
// src/assets/characters/cast (cast.json + 5 atlases per body shape). A port of drawFrame in
// tools/charpipe/cast/cast-page.html:
//
//   look (castLookFor) → shape kind-build, height offset
//   for each band in the animation's band order, each asset of the look in slot order:
//     crop (atlas, rect) recoloured canonical ramp → wearer's ramp, drawn at (dx, dy [+ height])
//
// One view (front 3/4, facing SE); SW is the same frame mirrored, and walking away (NE / NW)
// shows the front too. Frames are 80×128 with the feet at (40, 120), the same canvas the world
// renderer already uses for people. Atlases load once; until they are ready (or if they fail)
// callers get null and keep the previous figures.
// ─────────────────────────────────────────────────────────────

import type { Look, Pose } from '../sprites';
import { castLookFor, rampFor, TONES, type CastLook, type LookAsset } from './looks';

type Entry = [number, number, number, number, number, number, number] | null;
interface CastPack {
  frame: { w: number; h: number };
  anchor: { x: number; y: number };
  heightDy: Record<string, number>;
  legBands: string[];
  bandOrder: Record<string, string[]>;
  anims: { id: string; frames: number; fps: number; anchorDy?: number }[];
  canon: Record<string, Record<string, string>>;
  shapes: Record<string, { atlases: string[]; frames: Record<string, Record<string, Record<string, Record<string, Entry[]>>>> }>;
}

export type CastAnim = 'idle' | 'walk' | 'work' | 'sit';

const packs = import.meta.glob<CastPack>('/src/assets/characters/cast/cast.json', { eager: true, import: 'default' });
const atlasUrls = import.meta.glob<string>('/src/assets/characters/cast/*/*.png', { eager: true, query: '?url', import: 'default' });
const M: CastPack | undefined = Object.values(packs)[0];

export const CAST_W = M?.frame.w ?? 80;
export const CAST_H = M?.frame.h ?? 128;
export const CAST_FOOT_X = M?.anchor.x ?? 40;
export const CAST_FOOT_Y = M?.anchor.y ?? 120;

// ── atlases ──────────────────────────────────────────────────

/** an atlas, drawn once into a canvas so crops can be read and recoloured */
const atlases = new Map<string, HTMLCanvasElement | 'loading' | 'failed'>();
const readyListeners = new Set<() => void>();
let readyAll = false;

function atlas(path: string): HTMLCanvasElement | null {
  const got = atlases.get(path);
  if (got instanceof HTMLCanvasElement) return got;
  if (got) return null;
  const url = atlasUrls[`/src/assets/characters/cast/${path}`];
  if (!url || typeof Image === 'undefined') {
    atlases.set(path, 'failed');
    return null;
  }
  atlases.set(path, 'loading');
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = im.naturalWidth;
    cv.height = im.naturalHeight;
    cv.getContext('2d', { willReadFrequently: true })!.drawImage(im, 0, 0);
    atlases.set(path, cv);
    checkReady();
  };
  im.onerror = () => {
    atlases.set(path, 'failed');
    checkReady();
  };
  im.src = url;
  return null;
}

function checkReady() {
  if (readyAll || !M) return;
  const all = Object.values(M.shapes).flatMap((s) => s.atlases);
  if (all.some((p) => atlases.get(p) === 'loading' || !atlases.has(p))) return;
  readyAll = true;
  for (const fn of readyListeners) fn();
}

/** start loading every atlas (about 2 MB); figures appear as their atlases arrive */
export function preloadCast() {
  if (!M) return;
  for (const s of Object.values(M.shapes)) for (const p of s.atlases) atlas(p);
}

/** the pack is there and its atlases are loaded */
export const castReady = () => readyAll;

/** called once every atlas has loaded (or failed); returns the unsubscribe */
export function onCastReady(fn: () => void): () => void {
  if (readyAll) {
    fn();
    return () => undefined;
  }
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}

// ── looks and crops ──────────────────────────────────────────

const looks = new Map<string, CastLook>();
const lookKey = (l: Look) => `${JSON.stringify(l.profile)}|${l.signature}|${l.outfitId}|${l.outfitVariant ?? ''}`;

function castLookOf(l: Look): CastLook {
  const k = lookKey(l);
  let c = looks.get(k);
  if (!c) {
    c = castLookFor(l.profile, l.signature, l.outfitId, l.outfitVariant);
    if (looks.size > 500) looks.clear();
    looks.set(k, c);
  }
  return c;
}

/** canonical colour → the wearer's colour, per asset (exact pixel match, as in the pack) */
const maps = new Map<string, Map<number, number>>();
function colourMap(la: LookAsset): Map<number, number> {
  const key = la.asset + JSON.stringify(la.colors);
  let map = maps.get(key);
  if (map) return map;
  map = new Map();
  for (const [m, c] of Object.entries(la.colors)) {
    const canon = M!.canon[m];
    if (!c || !canon) continue;
    const r = rampFor(m, c) as unknown as Record<string, string>;
    for (const t of TONES) map.set(parseInt(canon[t].slice(1), 16), parseInt(r[t].slice(1), 16));
  }
  maps.set(key, map);
  return map;
}

const crops = new Map<string, HTMLCanvasElement>();
function crop(shape: string, la: LookAsset, e: NonNullable<Entry>): HTMLCanvasElement | null {
  const [ai, sx, sy, w, h] = e;
  const key = `${shape}|${ai}|${sx},${sy}|${la.asset}${JSON.stringify(la.colors)}`;
  const hit = crops.get(key);
  if (hit) return hit;
  const src = atlas(M!.shapes[shape].atlases[ai]);
  if (!src) return null;
  const d = src.getContext('2d', { willReadFrequently: true })!.getImageData(sx, sy, w, h);
  const p = d.data;
  const map = colourMap(la);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const to = map.get((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]);
    if (to !== undefined) {
      p[i] = to >> 16;
      p[i + 1] = (to >> 8) & 255;
      p[i + 2] = to & 255;
    }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(d, 0, 0);
  if (crops.size > 20_000) crops.clear();
  crops.set(key, c);
  return c;
}

// ── frames ───────────────────────────────────────────────────

const frames = new Map<string, HTMLCanvasElement>();

/**
 * One composited 80×128 frame (40×64 when `lod`), mirrored for the SW side; null while the
 * atlases it needs are still loading, or when the pack has no such shape.
 */
export function getCastFrame(look: Look, anim: CastAnim, f: number, mirror: boolean, lod = false): HTMLCanvasElement | null {
  if (!M) return null;
  const L = castLookOf(look);
  const shape = `${L.shape.kind}-${L.shape.build}`;
  const S = M.shapes[shape];
  if (!S) return null;
  const key = `${lookKey(look)}|${anim}|${f}|${mirror ? 1 : 0}|${lod ? 1 : 0}`;
  const hit = frames.get(key);
  if (hit) return hit;
  // every atlas of this shape first: a half-drawn figure is never cached
  if (S.atlases.some((p) => !atlas(p))) return null;
  const full = document.createElement('canvas');
  full.width = CAST_W;
  full.height = CAST_H;
  const c = full.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const hDy = M.heightDy[L.shape.height] ?? 0;
  for (const band of M.bandOrder[anim] ?? M.bandOrder.default)
    for (const la of L.assets) {
      const fr = S.frames[la.asset]?.[band];
      if (!fr) continue;
      const leg = M.legBands.includes(band);
      const e = (leg ? fr[L.shape.height] : fr.all)?.[anim]?.[f];
      if (!e) continue;
      const cr = crop(shape, la, e);
      if (!cr) return null;
      c.drawImage(cr, e[5], e[6] + (leg ? 0 : hDy));
    }
  let out = full;
  if (mirror || lod) {
    out = document.createElement('canvas');
    out.width = lod ? CAST_W / 2 : CAST_W;
    out.height = lod ? CAST_H / 2 : CAST_H;
    const o = out.getContext('2d')!;
    o.imageSmoothingEnabled = false;
    if (mirror) o.setTransform(-1, 0, 0, 1, out.width, 0);
    o.drawImage(full, 0, 0, out.width, out.height);
  }
  if (frames.size > 3000) frames.clear();
  frames.set(key, out);
  return out;
}

const anim = (id: CastAnim) => M?.anims.find((a) => a.id === id);

/** the world's pose → the Cast animation (talk has none: idle; seated: sit) */
export function castAnimFor(pose: Pose): CastAnim {
  if (pose.mode === 'walk') return 'walk';
  if (pose.sit) return 'sit';
  if (pose.mode === 'work') return 'work';
  return 'idle';
}

/** the frame at time t: the walk follows the renderer's own phase, the others their own rate */
export function castFrameAt(a: CastAnim, pose: Pose, t: number): number {
  const spec = anim(a);
  if (!spec) return 0;
  return a === 'walk' ? pose.frame % spec.frames : Math.floor(Math.max(0, t) * spec.fps) % spec.frames;
}

/** SW (and NW, walking away) is the SE frame mirrored; S / N are drawn as SE */
export const castMirror = (pose: Pose) => pose.dir === 'sw' || pose.dir === 'nw';

/**
 * The figure for the world renderer: [frame, foot x, foot y, seated] or null (not loaded yet).
 * A seated frame's anchor is the floor under the hips, like the prototype sheets.
 */
export function castSprite(look: Look, pose: Pose, t: number, lod = false): [HTMLCanvasElement, number, number, boolean] | null {
  const a = castAnimFor(pose);
  const cv = getCastFrame(look, a, castFrameAt(a, pose, t), castMirror(pose), lod);
  if (!cv) return null;
  const s = lod ? 0.5 : 1;
  const fx = (castMirror(pose) ? CAST_W - CAST_FOOT_X : CAST_FOOT_X) * s;
  const fy = (CAST_FOOT_Y + (anim(a)?.anchorDy ?? 0)) * s;
  return [cv, fx, fy, a === 'sit'];
}

const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();

/**
 * The part of the 80×128 frame a portrait shows: the figure's visible box (idle, frame 0, with
 * room for the walk's swing), symmetric around the feet so the mirrored side fits too; `bust`
 * keeps the head and shoulders. null while the look's atlases load.
 */
export function castBox(look: Look, bust: boolean): { x: number; y: number; w: number; h: number } | null {
  const key = `${lookKey(look)}|${bust ? 1 : 0}`;
  const hit = boxes.get(key);
  if (hit) return hit;
  const fr = getCastFrame(look, 'idle', 0, false);
  if (!fr) return null;
  const d = fr.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, fr.width, fr.height).data;
  let x0 = fr.width;
  let x1 = 0;
  let y0 = fr.height;
  let y1 = 0;
  for (let y = 0; y < fr.height; y++)
    for (let x = 0; x < fr.width; x++)
      if (d[(y * fr.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < x0) return null;
  const half = Math.min(CAST_FOOT_X, Math.max(CAST_FOOT_X - x0, x1 + 1 - CAST_FOOT_X) + 4);
  const top = Math.max(0, y0 - 2);
  const bottom = bust ? top + Math.round((y1 - top) * 0.5) : Math.min(fr.height, y1 + 3);
  const box = { x: CAST_FOOT_X - half, y: top, w: half * 2, h: bottom - top };
  boxes.set(key, box);
  return box;
}

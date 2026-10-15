// Baked scenes: a world whose static scene is one picture instead of being
// painted at load time — the engine's own pixel art baked once (the Farm), or
// an artist's retouch of it. The picture is warped onto the scene frame; only
// the objects that people or animals can pass behind are cut out of it, using
// the engine's silhouettes as stencils, so they still sort in depth. Animals,
// people, water glints and the props' animations are drawn on top as usual.
//
// public/baked/<world>/scene.json describes the picture (image → frame
// transform), the stencil atlas and the cut-out props (see BakedScene).
// Add `?procedural` to the app's URL to see the engine-painted scene instead.
import type { PropPlacement, WorldDef } from '../domain/world';
import type { SceneFx, WorldPayload } from './worldRenderer';

/** Worlds with a baked scene, and where their scene.json lives (under public/). */
const SCENES: Record<string, string> = {
  farm: 'baked/farm/scene.json',
  office: 'baked/office/scene.json',
  research: 'baked/research/scene.json',
  port: 'baked/port/scene.json',
  datacenter: 'baked/datacenter/scene.json',
  robotics: 'baked/robotics/scene.json',
  studio: 'baked/studio/scene.json',
  chemlab: 'baked/chemlab/scene.json',
  factory: 'baked/factory/scene.json',
  space: 'baked/space/scene.json',
};
/** The worlds the app loads from a baked picture. */
export const BAKED_WORLDS = Object.keys(SCENES);

interface BakedItem {
  p: PropPlacement;
  /** depth key (as the engine computed it for this prop) */
  key: number;
  /** footprint in tiles: x0, y0, x1, y1 */
  w: [number, number, number, number];
  /** box in frame px: x0, y0, x1, y1 */
  b: [number, number, number, number];
  /** a half-tile column of a long prop: x offset of the column inside its cut-out */
  sprX?: number;
  /** index into maskRects; -1 for a prop that only brings its animation */
  m: number;
  seed: number;
  /** a back wall: brings its wall props' animations (clocks, sconces) */
  wall?: 'ne' | 'nw';
}

interface BakedScene {
  version: 1;
  world: string;
  /** fingerprint of the layout it was baked from (pixel bakes; see sceneFingerprint) */
  source?: string;
  /** scene frame size and origin (must match the engine's frame for this world) */
  fw: number;
  fh: number;
  ox: number;
  oy: number;
  /** the picture, next to scene.json */
  image: string;
  /** the picture at half resolution (the engine's own level of detail for zooming out) */
  imageHalf?: string;
  /** pixel art: never smoothed when scaled or cut */
  pixel?: boolean;
  /** picture px → frame px, as canvas setTransform(a, b, c, d, e, f) */
  warp: [number, number, number, number, number, number];
  /** stencil atlas: white, alpha = silhouette */
  masks: string;
  /** per stencil: atlas x, y, width, height, then its frame position x, y */
  maskRects: [number, number, number, number, number, number][];
  /** prop types whose animation is not drawn (the picture shows them differently) */
  noAnim?: string[];
  /** cut-out props (in the engine's draw order) and props that only animate */
  items: BakedItem[];
  /** effects fitted to the picture, in frame px */
  fx?: {
    /** glints on the picture's water: x, y, phase */
    water?: [number, number, number][];
    /** lit lanterns: x, y */
    lights?: [number, number][];
    /** beehives: x, y */
    bees?: [number, number][];
  };
}

/** The effects a baked scene fitted to its picture (frame px; see SceneFx). */
function sceneFx(fx: NonNullable<BakedScene['fx']>): SceneFx {
  return {
    ownWater: !!fx.water,
    under(c, t, x0, y0, s) {
      // glints come and go on the water, each on its own beat
      if (!fx.water) return;
      const w = Math.max(2, Math.round(8 * s));
      const h = Math.max(1, Math.round(2 * s));
      c.fillStyle = '#eaf7ff';
      for (const [x, y, ph] of fx.water) {
        const p = (t * 0.5 + ph * 1.4) % 4;
        if (p > 0.55) continue;
        c.globalAlpha = Math.sin((p / 0.55) * Math.PI) * 0.7;
        c.fillRect(Math.round((x - x0) * s - w / 2), Math.round((y - y0) * s), w, h);
      }
      c.globalAlpha = 1;
    },
    over(c, t, x0, y0, s) {
      // lanterns glow and flicker a little
      if (fx.lights) {
        const prev = c.globalCompositeOperation;
        c.globalCompositeOperation = 'lighter';
        fx.lights.forEach(([x, y], i) => {
          const cx = (x - x0) * s;
          const cy = (y - y0) * s;
          const r = 30 * s;
          const a = 0.22 + Math.sin(t * 2.6 + i * 1.9) * 0.04 + Math.sin(t * 9.1 + i) * 0.02;
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(255,214,130,${a.toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,214,130,0)');
          c.fillStyle = g;
          c.fillRect(cx - r, cy - r, r * 2, r * 2);
        });
        c.globalCompositeOperation = prev;
      }
      // bees around the hives
      if (fx.bees) {
        const d = Math.max(1, Math.round(2 * s));
        fx.bees.forEach(([x, y], i) => {
          for (let j = 0; j < 5; j++) {
            const a = t * (1.6 + j * 0.23) + j * 1.3 + i;
            const bx = (x - x0 + Math.cos(a) * (14 + j * 3) + Math.sin(t * 3 + j) * 3) * s;
            const by = (y - y0 + Math.sin(a * 1.3) * (7 + j) - 12 + Math.cos(t * 4 + j) * 3) * s;
            c.fillStyle = '#2a2018';
            c.fillRect(Math.round(bx), Math.round(by), d * 2, d);
            c.fillStyle = '#f2c84b';
            c.fillRect(Math.round(bx), Math.round(by) - d, d, d);
          }
        });
      }
    },
  };
}

/**
 * A fingerprint of a world's layout and colour grade: a pixel bake made from
 * another layout is out of date, and the app paints the scene instead. Changes
 * to the art code itself are not seen: re-bake after those too.
 */
export function sceneFingerprint(w: WorldDef): string {
  const src = JSON.stringify([w.cols, w.rows, w.props, w.environment.patches, w.scene.props, w.scene.ground, w.scene.ext, w.scene.outer, w.scene.grade ?? null]);
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + src.length;
}

/** URL of a world's baked scene, or null when it has none (or `?procedural` is set). */
export function bakedSceneUrl(worldId: string): string | null {
  const path = SCENES[worldId];
  if (!path || typeof document === 'undefined') return null;
  if (new URLSearchParams(location.search).has('procedural')) return null;
  return import.meta.env.BASE_URL + path;
}

/** URL of a world's small preview picture (cut from its baked scene for Home), or null when it has none. */
export function bakedPreviewUrl(worldId: string): string | null {
  const path = SCENES[worldId];
  return path ? import.meta.env.BASE_URL + path.replace('scene.json', 'preview.webp') : null;
}

function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('baked scene: cannot load ' + src));
    i.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Load a baked scene into what a renderer needs before its first frame (`w`: refuse an out-of-date pixel bake). */
export async function loadBakedScene(url: string, w?: WorldDef): Promise<WorldPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`baked scene: ${url} (${res.status})`);
  const s = (await res.json()) as BakedScene;
  if (w && s.source && s.source !== sceneFingerprint(w)) throw new Error(`baked scene: ${url} was baked from another layout of ${w.id}; re-bake it (src/dev/bake.ts)`);
  const dir = url.slice(0, url.lastIndexOf('/') + 1);
  const [pic, masks, half] = await Promise.all([image(dir + s.image), image(dir + s.masks), s.imageHalf ? image(dir + s.imageHalf) : null]);
  const smooth = !s.pixel;

  // the picture on the scene frame, at full and half resolution
  const warp = (k: number) => {
    const c = canvas(Math.round(s.fw * k), Math.round(s.fh * k));
    const g = c.getContext('2d')!;
    if (k < 1 && half) {
      g.drawImage(half, 0, 0);
      return c;
    }
    g.imageSmoothingEnabled = smooth;
    g.imageSmoothingQuality = 'high';
    const [a, b, cc, d, e, f] = s.warp;
    g.setTransform(a * k, b * k, cc * k, d * k, e * k, f * k);
    g.drawImage(pic, 0, 0);
    return c;
  };
  const bg = warp(1);
  const bgLod = warp(0.5);

  // each stencil cuts its prop out of the picture
  const cut = (src: HTMLCanvasElement, [ax, ay, w, h, ox, oy]: BakedScene['maskRects'][number], k: number) => {
    const cw = Math.ceil(w * k);
    const ch = Math.ceil(h * k);
    const c = canvas(cw, ch);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = smooth && k < 1;
    g.drawImage(masks, ax, ay, w, h, 0, 0, cw, ch);
    g.globalCompositeOperation = 'source-in';
    g.drawImage(src, Math.round(ox * k), Math.round(oy * k), cw, ch, 0, 0, cw, ch);
    return { cv: c, w: cw, h: ch };
  };
  const cuts = s.maskRects.map((r) => ({ sprite: cut(bg, r, 1), lod: cut(bgLod, r, 0.5) }));

  const items: WorldPayload['items'] = s.items.map((it) => ({
    p: it.p,
    key: it.key,
    wx0: it.w[0],
    wy0: it.w[1],
    wx1: it.w[2],
    wy1: it.w[3],
    bx0: it.b[0],
    by0: it.b[1],
    bx1: it.b[2],
    by1: it.b[3],
    sprX: it.sprX,
    sprite: cuts[it.m]?.sprite,
    lod: cuts[it.m]?.lod,
    live: false,
    seed: it.seed,
    wall: it.wall,
  }));
  return {
    fw: s.fw,
    fh: s.fh,
    ox: s.ox,
    oy: s.oy,
    bg: { cv: bg, w: bg.width, h: bg.height },
    bgLod: { cv: bgLod, w: bgLod.width, h: bgLod.height },
    items,
    noAnim: s.noAnim,
    fx: s.fx ? sceneFx(s.fx) : undefined,
    baked: true,
  };
}

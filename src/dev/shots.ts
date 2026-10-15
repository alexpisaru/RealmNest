// Dev-only capture helpers (not imported by the app). Load from the console:
//   const S = await import('/src/dev/shots.ts'); await S.shoot('x.png')
// Images are POSTed to a local receiver on :5199.
import { WORLDS } from '../data/worlds';
import { PRESETS } from '../data/presets';
import { OUTFITS } from '../data/outfits';
import { demoCrew } from '../data/seed';
import { DEFAULT_RENDER, WorldRenderer, type StaticFigure } from '../render/worldRenderer';
import { getSpriteHD } from '../render/hd/spritesHD';
import type { Pose, SpriteDir } from '../render/sprites';

async function post(name: string, c: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res));
  await fetch('http://localhost:5199/' + name, { method: 'POST', body: blob });
}

export interface ShotOpts {
  world?: string;
  w?: number;
  h?: number;
  zoom?: number;
  /** centre on a tile (x, y) instead of the playable centre */
  at?: [number, number];
  cx?: number;
  cy?: number;
  crew?: boolean;
  t?: number;
}

let cached: WorldRenderer | null = null;

export async function shoot(name: string, o: ShotOpts = {}) {
  const w = WORLDS.find((x) => x.id === (o.world ?? 'farm'))!;
  const t0 = performance.now();
  const r = cached && cached.world === w ? cached : new WorldRenderer(w);
  cached = r;
  const build = performance.now() - t0;
  const vw = o.w ?? 1600;
  const vh = o.h ?? 900;
  const zoom = o.zoom ?? 1;
  const b = r.bounds();
  let cx = o.cx ?? (b.x0 + b.x1) / 2;
  let cy = o.cy ?? (b.y0 + b.y1) / 2;
  if (o.at) [cx, cy] = r.P(o.at[0], o.at[1], 20);
  const cam = { zoom, cx, cy };
  const figs: StaticFigure[] = [];
  if (o.crew) {
    let crew = demoCrew().filter((c) => c.worldId === w.id);
    // worlds without a demo crew borrow a few characters, dressed in the world's default outfit
    if (!crew.length) crew = demoCrew().slice(0, 6).map((c) => ({ ...c, worldId: w.id, outfitId: w.defaultOutfitId, outfitVariant: undefined }));
    const spots = w.points.filter((p) => p.type !== 'DECORATIVE');
    crew.forEach((c, i) => {
      const s = spots[(i * 5) % spots.length];
      figs.push({ look: { profile: c.profile, outfitId: c.outfitId, outfitVariant: c.outfitVariant, signature: c.signature, name: c.name } as never, x: s.x, y: s.y, dir: (['se', 'sw', 'ne', 'se'] as SpriteDir[])[i % 4], mode: i % 2 ? 'work' : 'stand' });
    });
  }
  const t1 = performance.now();
  r.renderFrame(null, o.t ?? 1.3, { ...DEFAULT_RENDER, labels: false }, figs, r.viewOf(cam, vw, vh));
  const frame = performance.now() - t1;
  const c = document.createElement('canvas');
  c.width = vw;
  c.height = vh;
  r.composite(c.getContext('2d')!, vw, vh, cam, null, { ...DEFAULT_RENDER, labels: false }, 1);
  await post(name, c);
  return { build: Math.round(build), frame: Math.round(frame), fw: r.fw, fh: r.fh };
}

export function reset() {
  cached = null;
}

/** Character sheet: rows = presets, columns = poses. */
export async function sheet(name: string, idxs: number[], scale = 5) {
  const outfits = OUTFITS.filter((o) => o.worldCategory === 'farm').map((o) => o.id);
  const poses: [SpriteDir, Pose['mode'], number][] = [['se', 'stand', 0], ['ne', 'stand', 0], ['se', 'walk', 1], ['se', 'work', 0], ['se', 'talk', 1]];
  const cw = 34;
  const ch = 50;
  const c = document.createElement('canvas');
  c.width = poses.length * cw * scale;
  c.height = idxs.length * ch * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#7fb04e';
  ctx.fillRect(0, 0, c.width, c.height);
  idxs.forEach((i, r) => {
    const pr = PRESETS[i];
    const look = { profile: pr.profile, outfitId: outfits[i % outfits.length], signature: pr.signature, name: pr.label } as never;
    poses.forEach(([d, m, f], col) => ctx.drawImage(getSpriteHD(look, { dir: d, mode: m, frame: f }), col * cw * scale, r * ch * scale, 32 * scale, 48 * scale));
  });
  await post(name, c);
  return [c.width, c.height];
}

/** Before/after: the same layout drawn with the 0.3 art (32×16, shown at 2×) and the HD art (64×32, 1×). */
export async function compare(name: string, at: [number, number], w = 900, h = 640) {
  const hd = WORLDS.find((x) => x.id === 'farm')!;
  const old = { ...hd, environment: { ...hd.environment, tile: 32 as const } };
  const out = document.createElement('canvas');
  out.width = w * 2 + 24;
  out.height = h;
  const o = out.getContext('2d')!;
  o.fillStyle = '#17131a';
  o.fillRect(0, 0, out.width, out.height);
  for (const [i, world, zoom] of [[0, old, 2], [1, hd, 1]] as const) {
    const r = new WorldRenderer(world);
    const [cx, cy] = r.P(at[0], at[1], 20);
    const cam = { zoom, cx, cy };
    r.renderFrame(null, 1.3, { ...DEFAULT_RENDER, labels: false }, [], r.viewOf(cam, w, h));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    r.composite(c.getContext('2d')!, w, h, cam, null, { ...DEFAULT_RENDER, labels: false }, 1);
    o.drawImage(c, i * (w + 24), 0);
  }
  await post(name, out);
}

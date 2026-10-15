// ─────────────────────────────────────────────────────────────
// Ground bake: every pixel of the frame becomes ground, so the camera
// never sees a void. Material resolution per tile:
//   scene.outer → scene.ground areas → playable floor → floor patches
// Then window light pools and wall ambient occlusion (dithered).
// ─────────────────────────────────────────────────────────────

import { tileScale, type FloorPatchStyle, type FloorStyle, type MaterialId, type WorldDef } from '../domain/world';
import { bakeGroundHDInto } from './hd/groundHD';
import type { WorldPack } from './hd4/packs/types';
import { dith, type Packed, SHADERS, vnoise } from './materials';

const FLOOR_MAT: Record<FloorStyle, MaterialId> = {
  wood: 'wood',
  planks: 'planks',
  tile: 'tile',
  carpet: 'carpet',
  grass: 'grass',
  metal: 'metal',
  concrete: 'concrete',
  lab: 'lab',
  raised: 'raised',
  paving: 'paving',
};

const PATCH_MAT: Partial<Record<FloorPatchStyle, MaterialId>> = {
  path: 'dirt',
  soil: 'soil',
  water: 'water',
  gravel: 'gravel',
  deck: 'deck',
  hazard: 'hazard',
  grate: 'grate',
};

/** Material lookup for any tile, inside or outside the playable grid. */
export function materialMap(w: WorldDef) {
  const R = w.scene.ext + 90; // covers the whole painted frame
  const x0 = -R;
  const y0 = -R;
  const W = w.cols + 2 * R;
  const H = w.rows + 2 * R;
  const ids: MaterialId[] = Object.keys(SHADERS) as MaterialId[];
  const index = new Map(ids.map((m, i) => [m, i]));
  const grid = new Uint8Array(W * H).fill(index.get(w.scene.outer)!);
  const fill = (x: number, y: number, ww: number, d: number, m: MaterialId) => {
    for (let j = Math.max(y, y0); j < Math.min(y + d, y0 + H); j++)
      for (let i = Math.max(x, x0); i < Math.min(x + ww, x0 + W); i++) grid[(j - y0) * W + (i - x0)] = index.get(m)!;
  };
  fill(0, 0, w.cols, w.rows, FLOOR_MAT[w.environment.floor]);
  for (const g of w.scene.ground) fill(g.x, g.y, g.w, g.d, g.mat);
  for (const p of w.environment.patches) {
    const m = PATCH_MAT[p.style];
    if (m) fill(p.x, p.y, p.w, p.d, m);
  }
  return (ix: number, iy: number): MaterialId => {
    if (ix < x0 || iy < y0 || ix >= x0 + W || iy >= y0 + H) return w.scene.outer;
    return ids[grid[(iy - y0) * W + (ix - x0)]];
  };
}

/** 0..1 extra light per tile from windows (indoor) — soft pools on the floor. */
function windowLight(w: WorldDef) {
  if (w.environment.backdrop !== 'walls') return () => 0;
  const wins = w.environment.wallProps.filter((p) => p.type === 'window' || p.type === 'starwindow' || p.type === 'door');
  return (x: number, y: number) => {
    let l = 0;
    for (const p of wins) {
      const strength = p.type === 'door' ? 0.12 : p.type === 'starwindow' ? 0.18 : 0.32;
      if (p.wall === 'ne' && x >= p.at - 0.3 && x <= p.at + p.w + 0.3 && y >= 0) l = Math.max(l, strength * Math.max(0, 1 - y / 3.2));
      if (p.wall === 'nw' && y >= p.at - 0.3 && y <= p.at + p.w + 0.3 && x >= 0) l = Math.max(l, strength * Math.max(0, 1 - x / 3.2));
    }
    return l;
  };
}

function mixPacked(c: Packed, t: Packed, a: number): Packed {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const r2 = (t >> 16) & 255;
  const g2 = (t >> 8) & 255;
  const b2 = t & 255;
  return (Math.round(r + (r2 - r) * a) << 16) | (Math.round(g + (g2 - g) * a) << 8) | Math.round(b + (b2 - b) * a);
}

const WARM = 0xfff1d0;
const SHADE = 0x1c1228;

/**
 * Paint the ground for the whole canvas. `ox, oy` map world (0,0,0) to canvas pixels.
 */
export function bakeGround(ctx: CanvasRenderingContext2D, w: WorldDef, ox: number, oy: number) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const at = materialMap(w);
  const light = windowLight(w);
  const indoor = w.environment.backdrop === 'walls';
  const sctx = { at };
  const k = tileScale(w);
  if (k >= 2) {
    const buf = bakeGroundBuffer(w, W, H, ox, oy, k);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), W, H), 0, 0);
    return;
  }
  for (let py = 0; py < H; py++) {
    const Y = py - oy;
    for (let px = 0; px < W; px++) {
      const X = px - ox;
      const x = (Y / 8 + X / 16) / 2;
      const y = (Y / 8 - X / 16) / 2;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const m = at(ix, iy);
      let c = SHADERS[m](x, y, px, py, sctx);
      if (indoor && x >= 0 && y >= 0 && x < w.cols && y < w.rows) {
        const l = light(x, y);
        if (l > 0) {
          const step = Math.floor(l * 4 + dith(px, py)) / 4;
          if (step > 0) c = mixPacked(c, WARM, step * 0.7);
        }
        const d = Math.min(x, y);
        if (d < 0.45) {
          const ao = (1 - d / 0.45) * 0.38;
          if (ao > dith(px, py) * 0.4) c = mixPacked(c, SHADE, ao * 0.6);
        }
      } else if (!indoor || x < 0 || y < 0 || x >= w.cols || y >= w.rows) {
        // soft cloud shadows drifting over open ground (dithered)
        const cl = vnoise(x * 0.12, y * 0.12, 77);
        if (cl < 0.32 && (0.32 - cl) * 2.2 > dith(px, py)) c = mixPacked(c, SHADE, 0.09);
      }
      const o = (py * W + px) * 4;
      data[o] = (c >> 16) & 255;
      data[o + 1] = (c >> 8) & 255;
      data[o + 2] = c & 255;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** HD ground (64×32 / 128×64 tiles) as a packed RGBA buffer, ready for decals and upload. */
export function bakeGroundBuffer(w: WorldDef, W: number, H: number, ox: number, oy: number, k: number, pack?: WorldPack): Uint32Array {
  const out = new Uint32Array(W * H);
  bakeGroundHDInto(out, W, H, w, ox, oy, materialMap(w), k, pack);
  return out;
}

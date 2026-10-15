// Data Center — steam and smoke plumes: rising, billowing columns pre-rendered
// once as a short loop of frames (opaque pixels, softened at the edges with an
// ordered dither instead of alpha, so overlapping puffs never show as rings),
// then blitted by the props' anim with a single draw call per plume.
import type { PropPainter } from '../../../iso';
import { bufferToCanvas, downsampleMode, parseColor, SoftCtx } from '../../../hd/soft';
import { bayer, hash } from '../../kit4';

export interface PlumeStyle {
  /** light, mid and shade tones */
  tones: [string, string, string];
  /** rise in px (at zoom 1), drift to the right in px, start and end puff radius */
  rise: number;
  drift: number;
  r0: number;
  r1: number;
  /** puffs alive at once */
  puffs: number;
}

export const STEAM: PlumeStyle = { tones: ['#ffffff', '#e0e8f1', '#a8b8cc'], rise: 230, drift: 110, r0: 12, r1: 38, puffs: 9 };
export const WOODSMOKE: PlumeStyle = { tones: ['#e8ebef', '#c4c9d1', '#8e949e'], rise: 130, drift: 60, r0: 4, r1: 16, puffs: 8 };
export const EXHAUST: PlumeStyle = { tones: ['#d8dce2', '#aab0ba', '#767e8a'], rise: 70, drift: 34, r0: 3, r1: 12, puffs: 5 };

const FRAMES = 12;
const cache = new Map<string, { cv: HTMLCanvasElement; ox: number; oy: number }[]>();

function render(st: PlumeStyle, lod: boolean) {
  const W = Math.ceil(st.drift + st.r1 * 2.6 + 8);
  const H = Math.ceil(st.rise + st.r1 * 2.2 + 8);
  const ox = Math.ceil(st.r1 * 1.1 + 4);
  const oy = H - Math.ceil(st.r0 + 4);
  const pk = st.tones.map((c) => (parseColor(c) | 0xff000000) >>> 0);
  const out: { cv: HTMLCanvasElement; ox: number; oy: number }[] = [];
  const s0 = Math.round(st.rise);
  for (let f = 0; f < FRAMES; f++) {
    const sc = new SoftCtx(W + (W & 1), H + (H & 1));
    // each puff is a cauliflower of jittered lumps; oldest (highest, largest, thinnest) first, so younger ones sit in front
    const lumps: [number, number, number, number][] = [];
    const n = st.puffs * 2;
    for (let s = 0; s < n; s++) {
      const ph = (s / n + f / FRAMES / n) % 1;
      const id = s;
      const bx = ox + ph * ph * st.drift + (hash(id, 1, s0) - 0.5) * 4;
      const by = oy - ph * st.rise;
      const r = (st.r0 + (st.r1 - st.r0) * Math.sqrt(ph)) * (0.8 + hash(id, 2, s0) * 0.35);
      const parts = 3 + Math.floor(hash(id, 3, s0) * 3);
      for (let j = 0; j < parts; j++) {
        const a = hash(id, 10 + j, s0) * Math.PI * 2;
        const d = j === 0 ? 0 : r * (0.35 + hash(id, 20 + j, s0) * 0.4);
        lumps.push([bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.75, r * (j === 0 ? 0.95 : 0.55 + hash(id, 30 + j, s0) * 0.25), ph]);
      }
    }
    lumps.sort((a, b) => b[3] - a[3]);
    for (const [cx, cy, r, ph] of lumps) {
      // density: building up just out of the stack, thinning to wisps as it rises
      const dens = (ph < 0.05 ? ph / 0.05 : 1) * (1 - ph * 0.75);
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = (x + 0.5 - cx) / r;
          const dy = (y + 0.5 - cy) / r;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          // a solid core, a dithered rim only at the edge
          const edge = (1 - d) * 3.2 + (hash(Math.floor(x / 2), Math.floor(y / 2), f + s0) - 0.5) * 0.25;
          if (edge * dens < bayer(x, y) * 0.85) continue;
          const lit = -dx * 0.6 - dy * 0.8;
          const tone = lit > 0.3 ? 0 : lit > -0.25 ? 1 : 2;
          if (x < 0 || y < 0 || x >= sc.width || y >= sc.height) continue;
          sc.data[y * sc.width + x] = pk[tone];
        }
    }
    sc.touch(0, 0, sc.width, sc.height);
    if (lod) out.push({ cv: bufferToCanvas(downsampleMode(sc.data, sc.width, sc.height), sc.width / 2, sc.height / 2), ox: ox / 2, oy: oy / 2 });
    else out.push({ cv: bufferToCanvas(sc.data, sc.width, sc.height), ox, oy });
  }
  return out;
}

/** Draw a plume rising from screen point (x, y) of a prop's anim (p.k = 4 at zoom ≥ 1, 2 below). */
export function plume(p: PropPainter, x: number, y: number, st: PlumeStyle, t: number, speed: number, seed: number, alpha = 1) {
  const lod = p.k < 4;
  const key = `${st.rise}|${st.r1}|${st.tones[0]}|${lod ? 1 : 0}`;
  let frames = cache.get(key);
  if (!frames) {
    frames = render(st, lod);
    cache.set(key, frames);
  }
  const f = frames[Math.floor(((t * speed + seed * 0.37) % 1) * FRAMES * st.puffs * 2) % FRAMES];
  const c = p.c;
  const ga = c.globalAlpha;
  c.globalAlpha = alpha;
  c.drawImage(f.cv, Math.round(x - f.ox), Math.round(y - f.oy));
  c.globalAlpha = ga;
}

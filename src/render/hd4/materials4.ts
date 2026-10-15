// 128×64 surface materials for textured faces (see texPara in hd/kit).
// u, v are face pixels from the face origin (v up for walls). Each material
// takes the face light: 0 shaded (screen right), 1 lit (screen left), 2 top.
import type { FaceTex, Light, Mat } from '../hd/kit';
import { at, bayer, hash, noise2, type Ramp } from './kit4';

const base = (light: Light, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/** Vertical boards: grain streaks, knots, nail heads, darker gaps, worn lower edge. */
export const boards4 =
  (r: Ramp, bw = 11, nails = true): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const b = Math.floor(u / bw);
    const fu = u - b * bw;
    const n = r.length;
    let i = base(light, n) + (hash(b, 0, 11) - 0.5) * 1.2;
    if (fu < 1.2) return at(r, i - 2.2);
    if (fu < 2.2 && light === 1) i += 0.8;
    if (fu > bw - 1.5) i -= 0.7;
    // grain: long thin streaks
    if (hash(b, Math.floor(fu), 12) < 0.35 && noise2(fu * 0.5 + b * 7, v * 0.06, 13) > 0.62) i -= 0.9;
    // knots
    const kx = bw * (0.3 + hash(b, 1, 14) * 0.4);
    const ky = h * hash(b, 2, 15);
    if (hash(b, 3, 16) < 0.5 && Math.hypot((fu - kx) * 1.4, v - ky) < 2.2) return at(r, i - 2);
    if (nails && (Math.abs(v - 5) < 1 || Math.abs(v - (h - 6)) < 1) && Math.abs(fu - bw / 2) < 0.8) return '#4a4448';
    if (v < 4 && bayer(x, y) > v / 4) i -= 1;
    if (v > h - 1.5) i += 1;
    return at(r, i);
  };

/** Horizontal clapboards / planks: shadow line under each board, grain, butt joints. */
export const siding4 =
  (r: Ramp, bh = 8): Mat =>
  (light, _w, h) =>
  (u, v) => {
    const row = Math.floor(v / bh);
    const fv = v - row * bh;
    const off = hash(row, 1, 14) * 40;
    const seg = Math.floor((u + off) / 44);
    const n = r.length;
    let i = base(light, n) + (hash(seg, row, 15) - 0.5) * 1.1;
    if (fv < 1.2) return at(r, i - 2);
    if (fv < 2.4) i -= 0.6;
    if (fv > bh - 1.6 && light !== 0) i += 0.8;
    const su = u + off - seg * 44;
    if (su < 1) return at(r, i - 1.6);
    if (noise2(u * 0.08 + row * 9, fv * 0.5, 17) > 0.7) i -= 0.6;
    if (light !== 2 && v < 3) i -= 1;
    void h;
    return at(r, i);
  };

/** Plaster / stucco: speckle, hairline cracks, damp staining toward the plinth. */
export const plaster4 =
  (r: Ramp): Mat =>
  (light, w) =>
  (u, v, x, y) => {
    const n = r.length;
    let i = base(light, n);
    const sp = hash(x, y, 21);
    if (sp < 0.05) i -= 1;
    else if (sp > 0.975) i += 1;
    // broad soft variation (dithered)
    if (noise2(u * 0.05, v * 0.07, 22) > 0.62 && bayer(x, y) > 0.5) i -= 1;
    // damp stain rising from the ground
    const damp = 10 + noise2(u * 0.08, 0, 23) * 14;
    if (v < damp && bayer(x, y) * damp > v) i -= 1;
    // hairline cracks: a few random-walk lines
    const cx = Math.floor(u / 38);
    const local = u - cx * 38 - 19 - Math.sin(v * 0.35 + cx) * 3;
    if (hash(cx, 4, 24) < 0.35 && Math.abs(local) < 0.5 && v > 20 && v < 20 + hash(cx, 5, 25) * 30) return at(r, i - 2);
    void w;
    return at(r, i);
  };

/** Rounded field stones (dry-stone wall): Voronoi stones, dark joints, lit tops, moss in the joints. */
export const fieldStones4 =
  (r: Ramp, size = 10, moss = 0.35, mossRamp?: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    const S = size;
    const gx = Math.floor(u / S);
    const gy = Math.floor(v / (S * 0.7));
    let d1 = 1e9;
    let d2 = 1e9;
    let fx = 0;
    let fy = 0;
    let id = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const cx = gx + i;
        const cy = gy + j;
        const px0 = (cx + 0.15 + hash(cx, cy, 31) * 0.7) * S;
        const py0 = (cy + 0.15 + hash(cx, cy, 32) * 0.7) * S * 0.7;
        const d = Math.hypot(u - px0, (v - py0) * 1.35);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          fx = px0;
          fy = py0;
          id = cx * 7349 + cy * 1913;
        } else if (d < d2) d2 = d;
      }
    const n = r.length;
    const gap = d2 - d1;
    if (gap < 1.6) {
      if (mossRamp && hash(id, 5, 33) < moss && v < 40) return at(mossRamp, light === 0 ? 1 : 2);
      return at(r, 0);
    }
    let i = base(light, n) + (hash(id, 1, 34) - 0.5) * 1.6;
    // each stone is a rounded lump: lit toward its top (v up), darker toward the joint below
    const dv = v - fy;
    const du = u - fx;
    if (dv > S * 0.12) i += 0.9;
    else if (dv < -S * 0.12) i -= 0.7;
    if (du < -S * 0.25 && light === 1) i += 0.4;
    if (gap < 2.6) i -= 0.7;
    if (hash(x, y, 35) < 0.05) i -= 1;
    if (mossRamp && v < 6 && hash(id, 6, 36) < moss) return at(mossRamp, (light === 0 ? 1 : 2) + (hash(x, y, 37) > 0.5 ? 1 : 0));
    return at(r, i);
  };

/** Cut-stone blocks in courses, with chamfered edges and chips. */
export const cutStone4 =
  (r: Ramp, rowH = 11): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = row & 1 ? 13 : 0;
    const bw = 22 + Math.floor(hash(row, 3, 41) * 6);
    const col = Math.floor((u + off) / bw);
    const fu = u + off - col * bw;
    const n = r.length;
    if (fv < 1.2 || fu < 1.2) return at(r, 0);
    let i = base(light, n) + (hash(col, row, 42) - 0.5) * 1.4;
    if (fv > rowH - 2.2) i += 0.9;
    if (fu < 2.4) i -= 0.6;
    if (fv < 2.4) i -= 0.5;
    if (hash(x, y, 43) < 0.06) i -= 1;
    if (hash(col, row, 44) < 0.15 && fu > bw - 5 && fv > rowH - 5) i -= 1.4; // chipped corner
    return at(r, i);
  };

/** Bricks in running bond, colour variance, mortar, a few chipped. */
export const bricks4 =
  (r: Ramp, mortar = '#b8a894'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const bh = 6;
    const bw = 15;
    const row = Math.floor(v / bh);
    const fv = v - row * bh;
    const off = row & 1 ? bw / 2 : 0;
    const col = Math.floor((u + off) / bw);
    const fu = u + off - col * bw;
    if (fv < 1 || fu < 1) return light === 0 ? '#8a7c6c' : mortar;
    const n = r.length;
    let i = base(light, n) + (hash(col, row, 51) - 0.5) * 1.8;
    if (fv > bh - 1.6) i += 0.6;
    if (hash(x, y, 52) < 0.07) i -= 1;
    if (hash(col, row, 53) < 0.08 && fu < 4) i -= 1.5;
    return at(r, i);
  };

/** Roof shingles: staggered rows of individually varied shingles with shadow lines and moss. */
export const shingles4 =
  (r: Ramp, rowH = 8, sw = 12, moss?: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = (row & 1 ? sw / 2 : 0) + hash(row, 9, 60) * 3;
    const col = Math.floor((u + off) / sw);
    const fu = u + off - col * sw;
    // each shingle hangs a little lower or higher
    const drop = hash(col, row, 61) * 2.2;
    let i = (light === 0 ? 1.6 : light === 2 ? 3.6 : 3) + (hash(col, row, 62) - 0.5) * 1.3;
    if (fv < 1.2 + drop * 0.4) return at(r, i - 1.9);
    if (fv < 2.6) i -= 0.7;
    if (fu < 1) i -= 1.1;
    if (fv > rowH - 1.8) i += 0.9;
    if (hash(x, y, 63) < 0.04) i -= 1;
    // moss grows in a few soft patches, on whole shingles, thickest at their lower lip
    if (moss && noise2(u * 0.035, v * 0.06, 64) > 0.76 && hash(col, row, 65) < 0.75) return at(moss, (light === 0 ? 1 : 3) + (fv > rowH - 3 ? 1 : 0) + (hash(x, y, 66) < 0.12 ? -1 : 0));
    return at(r, i);
  };

/** Glass: tinted panes, two diagonal reflections, grime in the lower corners. */
export const glass4 =
  (r: Ramp): Mat =>
  (light, w) =>
  (u, v, x, y) => {
    const d = (u * 0.85 + v) % 36;
    let i = light === 0 ? 1.4 : 2.2;
    if (d > 5 && d < 10) i += 2.2;
    else if (d > 15 && d < 17) i += 1.2;
    if (v < 4 && (u < 6 || u > w - 6)) i -= 1;
    if (hash(x, y, 70) < 0.03) i += 1;
    return at(r, i);
  };

export type { FaceTex };

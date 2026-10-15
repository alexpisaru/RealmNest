// Surface primitives for the world packs (textured faces, see hd/kit texPara).
// These are materials, not designs: every world uses them with its own ramps.
import type { Mat } from '../../hd/kit';
import { at, bayer, hash, noise2, type Ramp } from '../kit4';

const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/** Velvet / upholstery: a sheen near the top edge, a soft nap, a seam line every `seam` px. */
export const velvet =
  (r: Ramp, seam = 0): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.4;
    if (v > h - 2.5) i += 1.4;
    else if (v > h - 6) i += 0.7;
    if (v < 2) i -= 1;
    if (seam && u % seam < 1) i -= 1.2;
    if (noise2(u * 0.2, v * 0.3, 5) > 0.68 && bayer(x, y) > 0.5) i -= 0.6;
    if (hash(x, y, 6) < 0.05) i -= 0.6;
    return at(r, i);
  };

/** Woven fabric: a fine twill. */
export const twill =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if ((Math.floor(u) + Math.floor(v)) % 3 === 0) i -= 0.6;
    if (hash(x, y, 8) < 0.04) i += 0.8;
    return at(r, i);
  };

/** Brushed metal: horizontal streaks, a highlight band. */
export const brushed =
  (r: Ramp, band = 0.7): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if (Math.abs(v / Math.max(1, h) - band) < 0.12) i += 1.2;
    if (noise2(u * 0.02, v * 0.9, 9) > 0.62) i -= 0.6;
    if (hash(x, y, 10) < 0.03) i += 1;
    return at(r, i);
  };

/** Flat paint or powder coat with a lit top lip and a dark foot. */
export const paint =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length);
    if (v > h - 1.5) i += 1;
    if (v < 1.5) i -= 1;
    if (hash(x, y, 11) < 0.02) i -= 0.6;
    return at(r, i);
  };

/** Marble: a pale stone with soft grey veins. */
export const marble =
  (r: Ramp, vein = '#8a8682'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const n = noise2(u * 0.06 + noise2(u * 0.02, v * 0.02, 13) * 4, v * 0.05, 12);
    if (Math.abs(n - 0.5) < 0.02) return vein;
    let i = base(light, r.length) + (n - 0.5) * 1.2;
    if (bayer(x, y) > 0.85) i += 0.4;
    return at(r, i);
  };

/** Wood with long grain streaks running along u (tops, shelves, drawers). */
export const grain =
  (r: Ramp, along: 'u' | 'v' = 'u'): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.3;
    const a = along === 'u' ? u : v;
    const b = along === 'u' ? v : u;
    if (noise2(a * 0.04 + b * 0.7, b * 0.35, 14) > 0.64) i -= 0.9;
    if (noise2(a * 0.03, b * 0.3, 15) < 0.25) i += 0.5;
    if (hash(x, y, 16) < 0.03) i -= 0.8;
    return at(r, i);
  };

/** Cardboard: corrugation lines, tape. */
export const cardboard =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if (u % 3 < 0.8) i -= 0.4;
    if (hash(x, y, 17) < 0.05) i -= 0.7;
    void v;
    return at(r, i);
  };

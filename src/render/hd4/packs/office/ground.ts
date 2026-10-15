// Office — floors and the city plaza's paving at 128×64.
//   wood      oak herringbone parquet (the studio)
//   sidewalk  big cream slabs: the promenades round the buildings
//   cobble    the plaza: light granite slabs in running bond
//   paving    bright travertine bands (the plaza's frame, the café terrace)
//   asphalt   a smooth new road (lanes are decals)
//   grass     a vivid clipped lawn
//   water     the canal: clear turquoise with ripples and caustics
// Rugs: wool, a border, a pattern per colour, fringes on the short ends.
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import { dith, h2, vnoise } from '../../../materials';
import type { Painter } from '../../../iso';
import { type Floor4, pal } from '../types';

const OAKP = pal('#6a4224', '#7e502c', '#925f34', '#a6703e', '#b8814a', '#c99458', '#d8a868');
const JOINT = 0x4a2e1a;

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

/**
 * Herringbone: planks 1 × L (L = 4) in plank-width units. A staircase of
 * horizontal planks and one of vertical planks fill a band 2L wide; bands
 * repeat every 2L along x. Returns [along, across, id, vertical].
 */
function herringbone(u: number, v: number, L: number): [number, number, number, boolean] {
  const X = Math.floor(u);
  const Y = Math.floor(v);
  const fu = u - X;
  const fv = v - Y;
  const m = X - Y;
  const n = Math.floor(m / (2 * L));
  const q = m - 2 * L * n;
  if (q < L) return [q + fu, fv, n * 7919 + Y * 104729, false];
  const i = X - L - 2 * L * n;
  return [Y - (i - L + 1) + fv, fu, n * 7919 + i * 104729 + 31, true];
}

const wood: Floor4 = (x, y, px, py, e) => {
  const W = 0.125;
  const L = 4;
  const [along, across, id, vert] = herringbone(x / W, y / W, L);
  // joints: thin dark lines round each plank (thinner across the grain)
  if (across < 0.07 || along < 0.035 || along > L - 0.035) return JOINT;
  let i = 2.4 + (h2(id, 1, 5) - 0.5) * 2.2;
  // planks on one diagonal catch the window light a little more
  if (vert) i += 0.35;
  // grain: long streaks along the plank
  const g = vnoise(along * 2.6 + (id % 97), across * 9, 7);
  if (g > 0.66) i -= 0.9;
  else if (g < 0.22) i += 0.5;
  // a bevel: the lit long edge, the shadowed one
  if (across < 0.16) i += vert ? -0.7 : 0.8;
  else if (across > 0.86) i += vert ? 0.8 : -0.7;
  // varnish sheen in broad soft bands, wear in the walkways
  if (e.nC > 0.62 && dith(px >> 1, py >> 1) < (e.nC - 0.62) * 3) i += 1;
  if (e.nA > 0.7 && dith(px, py) > 0.6) i -= 0.6;
  if (h2(px, py, 9) < 0.02) i -= 1;
  // the floor darkens a little against the walls and the room's edge
  if (e.near === 0) i -= 0.8;
  return OAKP[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── the city plaza (the owner's retouch, 2026-10): bright granite, cream promenades, a turquoise canal ──
const GRAN = pal('#6f7379', '#7f8389', '#8f9399', '#9fa3a8', '#afb3b7', '#bfc2c6', '#cfd2d5', '#dfe1e3');
const JOINTG = 0x5d6066;
const CREAM = pal('#b4ab9c', '#c4bcae', '#d2cbbe', '#ded8cc', '#e8e3d9', '#f1ede5', '#f8f6f1');
const TRAVB = pal('#bfae90', '#cfbfa2', '#dccfb4', '#e7dcc4', '#f0e7d3', '#f7f1e3');
const ASPH2 = pal('#262930', '#2d3037', '#34373f', '#3b3f47', '#43474f');
const LAWN2 = pal('#2f6e24', '#3a8029', '#47922f', '#56a436', '#68b43f', '#7ec44c', '#96d45e');
const AQUA = pal('#0b5f7a', '#0f6f8e', '#14809e', '#1b93b0', '#22a7c2', '#36b9d1', '#52c9de', '#7ad8e8', '#a6e8f1');
const COPING = pal('#5a7f86', '#6f949a');

const sidewalk: Floor4 = (x, y, px, py, e) => {
  // promenade: big cream slabs 1 × 1/2 tile in running bond, hairline joints
  const row = Math.floor(y * 2);
  const off = row & 1 ? 0.5 : 0;
  const col = Math.floor(x + off);
  const fx = x + off - col;
  const fy = y * 2 - row;
  if (fx < 0.015 || fy < 0.03) return CREAM[1];
  let i = 4.2 + (h2(col, row, 11) - 0.5) * 1.4;
  const g = h2(px, py, 12);
  if (g < 0.06) i -= 1;
  else if (g > 0.95) i += 0.6;
  // a lit arris on the upper-left edges, a soft polish where people walk
  if (fy < 0.08 || fx < 0.04) i += 0.7;
  if (e.nB > 0.7 && dith(px, py) > 0.5) i += 0.4;
  if (e.near === 0) i -= 0.7;
  return CREAM[ci(Math.round(i), 7)];
};

const cobble: Floor4 = (x, y, px, py, e) => {
  // the plaza: granite slabs 1/2 × 1/4 tile in running bond along x, tones from mid to light grey
  const row = Math.floor(y * 4);
  const off = row & 1 ? 0.25 : 0;
  const cx = x * 2 + off;
  const col = Math.floor(cx);
  const fx = cx - col;
  const fy = y * 4 - row;
  if (fx < 0.025 || fy < 0.05) return JOINTG;
  const id = col * 7349 + row * 1913;
  const r = h2(id, 2, 24);
  // mostly light slabs, a darker one now and then, a few near-white ones
  let i = r < 0.14 ? 2 : r > 0.9 ? 6 : 3.4 + r * 2;
  // granite grain: salt and pepper
  const g = h2(px, py, 25);
  if (g < 0.1) i -= 1;
  else if (g > 0.93) i += 1;
  // lit upper-left arris, shadowed lower-right
  if (fy < 0.14 || fx < 0.06) i += 0.8;
  else if (fy > 0.9 || fx > 0.96) i -= 0.6;
  // a soft sheen in broad patches
  if (e.nC > 0.64 && dith(px >> 1, py >> 1) < (e.nC - 0.64) * 2.5) i += 0.6;
  if (e.near === 0) i -= 0.6;
  return GRAN[ci(Math.round(i), 8)];
};

const paving: Floor4 = (x, y, px, py, e) => {
  // bright travertine bands: slabs 1 × 1/2 tile, tight joints, faint veins
  const row = Math.floor(y * 2);
  const off = row & 1 ? 0.33 : 0;
  const col = Math.floor(x + off);
  const fx = x + off - col;
  const fy = y * 2 - row;
  if (fx < 0.02 || fy < 0.04) return TRAVB[0];
  let i = 3.4 + (h2(col, row, 31) - 0.5) * 1.2;
  if (vnoise(x * 3, y * 20, 32) > 0.68) i -= 0.7;
  if (h2(px >> 1, py, 33) < 0.02) i -= 1.2;
  if (fy < 0.1 || fx < 0.04) i += 0.7;
  if (e.near === 0) i -= 0.6;
  return TRAVB[ci(Math.round(i + (dith(px, py) - 0.5) * 0.4), 6)];
};

const asphalt: Floor4 = (_x, _y, px, py, e) => {
  // a smooth new road: dark, fine aggregate, a little lighter in the wheel tracks
  let i = 2 + (e.nA - 0.5) * 1.2;
  const g = h2(px, py, 41);
  if (g < 0.08) i -= 1;
  else if (g > 0.95) i += 1;
  if (e.near === 0) i -= 0.6;
  return ASPH2[ci(Math.round(i), 5)];
};

const grass: Floor4 = (x, y, px, py, e) => {
  // a vivid clipped lawn: mowing stripes, fine blades, darker at the bed's edge
  let i = 3.4 + (Math.floor((x + y) * 1.5) & 1 ? 0.7 : -0.4);
  const b = h2(px, py >> 1, 51);
  if (b < 0.18) i -= 1;
  else if (b > 0.86) i += 1;
  if ((px + (py >> 1)) % 3 === 0 && h2(px >> 1, py, 52) < 0.5) i += 0.5;
  if (e.near === 0) i -= 1.4;
  else if (e.near === 1) i -= 0.5;
  return LAWN2[ci(Math.round(i), 7)];
};

const water: Floor4 = (x, y, px, py, e) => {
  // the canal: clear turquoise, darker in the deep middle and under the coping, ripples and sun glints
  if (e.near === 0) return COPING[(px + py) & 1];
  let i = 5.2 - e.depth * 1.6 + (e.nA - 0.5) * 1.2;
  if (e.near === 1) i -= 1;
  else if (e.near === 2) i += 0.6;
  // ripples: short light dashes laid along the flow
  const r = h2(Math.floor((px + (py >> 1) * 3) / 6), py >> 1, 391);
  if (r < 0.1) i += 1.6;
  else if (r > 0.9) i -= 0.9;
  // caustics: a soft net of lighter lines
  const cn = vnoise(x * 3.1, y * 3.1, 395);
  if (Math.abs(cn - 0.5) < 0.025) i += 1.2;
  if (h2(px >> 1, py, 392) < 0.004) return 0xf2fcff;
  return AQUA[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 9)];
};

export const OFFICE_FLOORS = { wood, sidewalk, cobble, paving, asphalt, grass, water };

// ── rugs ─────────────────────────────────────────────────────
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
};

/** A wool rug (or any floor patch) painted pixel by pixel into the ground. */
export function officePatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  if (s.style !== 'rug') return;
  const k = P.k;
  const col = s.color ?? '#3e5a7a';
  const c = P.c;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - 8;
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + 8;
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 8;
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + 8;
  const navy = col.toLowerCase() === '#3e5a7a';
  const kilim = col.toLowerCase() === '#d0705a' || col.toLowerCase() === '#c0533f';
  const accent = navy ? '#e8dcc0' : kilim ? '#2e3a4a' : '#f2ead2';
  const tones = [shade(col, 0.62), shade(col, 0.78), shade(col, 0.9), col, shade(col, 1.1), shade(col, 1.22)];
  const inset = 0.08;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2 - s.x;
      const y = (Y - X) / 2 - s.y;
      const inX = x >= inset && x <= s.w - inset;
      const inY = y >= inset && y <= s.d - inset;
      // fringes beyond the two short ends
      const long = s.w >= s.d;
      if (inX && inY) {
        const du = Math.min(x - inset, s.w - inset - x);
        const dv = Math.min(y - inset, s.d - inset - y);
        const d = Math.min(du, dv);
        // pile: rows of knots, a soft sheen
        const t = 3 + (h2(px, py >> 1, 61) < 0.18 ? -1 : 0) + (h2(px >> 1, py, 62) > 0.92 ? 1 : 0);
        let colr = tones[ci(t, 6)];
        if (d < 0.05) colr = tones[0];
        else if (d < 0.2) colr = d < 0.12 ? tones[1] : accent;
        else if (d < 0.26) colr = tones[1];
        else if (navy) {
          // a soft damask: a lattice of small lozenges in two blues, a second border
          const fr = (v: number) => v - Math.floor(v);
          const a = fr((x + y) * 1.5);
          const b = fr((x - y) * 1.5);
          const lz = Math.abs(a - 0.5) + Math.abs(b - 0.5);
          if (d < 0.42 && d > 0.36) colr = shade(accent, 0.8);
          else if (lz < 0.12) colr = tones[5];
          else if (lz < 0.16) colr = tones[1];
          else if (Math.abs(a - 0.5) < 0.03 || Math.abs(b - 0.5) < 0.03) colr = tones[2];
        } else if (kilim) {
          // stepped diamonds in rows
          const cx = ((x - 0.3) % 0.9) / 0.9 - 0.5;
          const cy = ((y - 0.3) % 0.9) / 0.9 - 0.5;
          const dd = Math.abs(cx) + Math.abs(cy * 1.2);
          if (Math.abs(dd - 0.32) < 0.06) colr = accent;
          else if (dd < 0.16) colr = tones[5];
        } else {
          // a plain wool field with a darker inner border
          if (d < 0.36) colr = tones[2];
        }
        c.fillStyle = colr;
        c.fillRect(px, py, 1, 1);
        continue;
      }
      // fringe
      const fr = 0.07;
      const endX = (x < inset && x > -fr) || (x > s.w - inset && x < s.w + fr);
      const endY = (y < inset && y > -fr) || (y > s.d - inset && y < s.d + fr);
      const onFringe = long ? endX && inY : endY && inX;
      const strand = (long ? Math.floor(y * 40) : Math.floor(x * 40)) & 1;
      if (onFringe && strand === 0) {
        c.fillStyle = '#efe6d0';
        c.fillRect(px, py, 1, 1);
      } else if (!inX || !inY) {
        // the rug's thickness: a 1 px shade on its lower right edges
        const nearR = x > s.w - inset && x < s.w - inset + 0.02 && inY;
        const nearB = y > s.d - inset && y < s.d - inset + 0.02 && inX;
        if (nearR || nearB) {
          c.fillStyle = 'rgba(30,20,20,0.35)';
          c.fillRect(px, py, 1, 1);
        }
      }
    }
}

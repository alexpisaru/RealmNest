// Factory — floors and the estate's ground at 128×64.
//   concrete  the press shop's power-floated slab: saw-cut joints, oil stains, tyre
//             marks, worn walkways, hairline cracks, daylight pools under the windows
//   hazard    yellow and black striped safety zones painted on the slab, scuffed
//   asphalt   the yards: tarmac with patched trenches, cracks, oil drips, puddle-dark dips
//   sidewalk  concrete aprons and footways: slabs with weeds in the joints
//   cobble    the wharf: granite setts in courses, polished crowns, moss in the joints
//   paving    the towpath's sandstone flags
//   gravel    railway ballast and hardcore
//   dirt      rutted mud tracks
//   meadow    waste ground: scrubby dry grass, bare earth, rosette weeds
//   water     the canal: murky green, sky glints, a scum line at the coping
// Patches: the painted pedestrian lane (yellow lines, chevrons, walking-man stencils).
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import { dith, h2, vnoise } from '../../../materials';
import type { Painter } from '../../../iso';
import { type Floor4, pal } from '../types';

const CON = pal('#7a6f63', '#8d8274', '#9a8f80', '#a59a8b', '#ada191', '#b6ab9b', '#c4b8a5');
const OIL = pal('#5e5650', '#6c6359', '#7c7266');
const YEL = pal('#b88a1c', '#d8a824', '#ecbc2c', '#f6cc3c', '#fcdc60');
const BLK = pal('#2a2622', '#332e29', '#3e3830');
const ASP = pal('#393635', '#444140', '#4f4c4c', '#5a5758', '#666262', '#726e6c');
const SLAB = pal('#7a7064', '#8a7f70', '#998d7c', '#a69a88', '#b3a794', '#c2b6a2');
const SETT = pal('#2e2a28', '#55504a', '#6a645c', '#7c746a', '#918879', '#ada392', '#cbc0aa');
const FLAG = pal('#3a3632', '#5e5850', '#746c62', '#8a8174', '#9e9486', '#b2a898', '#c8bea9');
const BAL = pal('#4a4038', '#5a4e44', '#6a5d50', '#7a6c5e', '#8c7d6c', '#a0907c');
const MUD = pal('#3e3226', '#4a3c2c', '#584734', '#66533d', '#745f46', '#836c50');
const SCRUB = pal('#3c4220', '#4a5226', '#58622c', '#667232', '#76823a', '#868f44', '#999e52');
const DRY = pal('#6e6440', '#7e7248', '#8e8052', '#9e8e5e');
const WATER = pal('#132420', '#182b25', '#1d332b', '#223a31', '#2a4439', '#334e42', '#3f5b4e');
const WEED = pal('#3e4e16', '#52641e', '#687c28');
const SCUM = pal('#6a7a5a', '#8a9672');
const RUSTY = pal('#6a3c22', '#844c2a');

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : Math.round(i));

// windows and the shutter of the press shop (ne wall along y = 0, nw wall along x = 0)
const NE_WIN: [number, number][] = [[11, 14]];
const NW_WIN: [number, number][] = [[7, 10]];
const SHUTTER: [number, number] = [15, 17];
const ROOM = { w: 18, h: 14 };

/** 0..1 daylight on the slab: pools thrown in by the high windows and the open shutter. */
function daylight(x: number, y: number) {
  let l = 0;
  for (const [a, b] of NE_WIN) {
    const sx = x - y * 0.35;
    if (sx > a + 0.2 && sx < b - 0.2 && y > 1.2 && y < 4.6) l = Math.max(l, 0.55 * (1 - Math.abs(y - 2.9) / 1.8));
  }
  for (const [a, b] of NW_WIN) {
    const sy = y - x * 0.35;
    if (sy > a + 0.2 && sy < b - 0.2 && x > 1.2 && x < 4.6) l = Math.max(l, 0.55 * (1 - Math.abs(x - 2.9) / 1.8));
  }
  const [s0, s1] = SHUTTER;
  if (x > s0 + 0.1 - y * 0.2 && x < s1 - 0.1 + y * 0.25 && y < 3) l = Math.max(l, 0.85 * (1 - y / 3));
  return l;
}

/** Oil stains round the machines' bases and under the conveyor's drive. */
const STAINS: [number, number, number][] = [
  [3, 4.2, 0.9], [2.4, 3.2, 0.5], [7.2, 4.1, 0.8], [11, 4.3, 0.7], [13.6, 7.3, 0.7], [9.6, 7.6, 0.6], [2.4, 8, 0.5], [16.8, 5.4, 0.5], [6.6, 10.6, 0.6], [0.8, 8.2, 0.6],
  [12.4, 1.2, 0.5], [5.2, 6.4, 0.4], [14.6, 10.4, 0.5], [3.6, 12.6, 0.4], [10.6, 12.4, 0.5], [15.6, 3.2, 0.4], [8.4, 9.6, 0.4],
];

const concrete: Floor4 = (x, y, px, py, e) => {
  const inside = x >= 0 && y >= 0 && x < ROOM.w && y < ROOM.h;
  // saw-cut control joints on a 3-tile grid: a dark cut with a lit lip
  const fx = x / 2 - Math.floor(x / 2);
  const fy = y / 2 - Math.floor(y / 2);
  if (fx < 0.012 || fy < 0.022) return CON[0];
  let i = 3.6 + (e.nA - 0.5) * 1.4 + (h2(Math.floor(x / 2), Math.floor(y / 2), 309) - 0.5) * 0.9;
  if (fx < 0.024 || fy < 0.044) i += 1.2;
  // power-float swirls and aggregate speckle
  const sw = vnoise(x * 1.7 + y * 0.4, y * 1.7, 301);
  if (sw > 0.62 && dith(px, py) < (sw - 0.62) * 2.6) i += 0.8;
  const g = h2(px, py, 302);
  if (g < 0.07) i -= 1;
  else if (g > 0.95) i += 1;
  // hairline cracks wandering from the joints
  const cr = vnoise(x * 1.3, y * 1.3, 303);
  if (Math.abs(cr - 0.5) < 0.005 && vnoise(x * 0.4, y * 0.4, 304) > 0.68) i -= 1.6;
  // worn walkways polished lighter, quiet corners darker
  if (e.nC > 0.6 && dith(px >> 1, py >> 1) < (e.nC - 0.6) * 2.4) i += 0.6;
  if (inside) {
    // oil stains: soft dark blots with a darker heart and the odd rainbow glint
    for (const [sx, sy, r] of STAINS) {
      const dx = (x - sx) / r;
      const dy = (y - sy) / (r * 0.8);
      if (dx > 1.3 || dx < -1.3 || dy > 1.3 || dy < -1.3) continue;
      const d = dx * dx + dy * dy + (vnoise(x * 4, y * 4, 305) - 0.5) * 0.7;
      if (d < 1) {
        if (d < 0.35) return h2(px, py, 306) < 0.02 ? 0x6a5a8a : OIL[h2(px >> 1, py >> 1, 307) < 0.3 ? 0 : 1];
        if (dith(px, py) < (1 - d) * 1.4) return OIL[2];
      }
    }
    // forklift tyre marks along the aisle and in front of the shutter
    const tm = (y > 5.55 && y < 5.7) || (y > 6.3 && y < 6.45) || (x > 15.2 && x < 15.35 && y < 5.5) || (x > 16.3 && x < 16.45 && y < 5.5);
    if (tm && vnoise(x * 3, y * 3, 308) > 0.4 && dith(px, py) < 0.6) i -= 1.3;
    // daylight pools
    const l = daylight(x, y);
    if (l > 0 && dith(px, py) < l * 1.3) i += 1.4;
    // ambient occlusion against the walls and the machines' plinths
    const dw = Math.min(x, y);
    if (dw < 0.4 && dith(px, py) < (0.4 - dw) * 2.2) i -= 1;
  }
  if (e.near === 0 && e.other !== 'hazard') i -= 0.8;
  return CON[ci(i + (dith(px, py) - 0.5) * 0.5, 7)];
};

const hazard: Floor4 = (x, y, px, py, e) => {
  // a keep-clear zone: yellow-and-black tape along both long edges, yellow hatching
  // on the bare slab between, all of it scuffed where boots and wheels run
  const fy = y - Math.floor(y);
  const fx = x - Math.floor(x);
  const edge = Math.min(fy, 1 - fy);
  const wear = vnoise(x * 2.2, y * 2.2, 311) + vnoise(x * 9, y * 9, 312) * 0.4;
  const chip = h2(px >> 1, py >> 1, 313);
  if (wear > 0.98 || chip < 0.05) return concrete(x, y, px, py, e);
  let i = 2.6 + (e.nA - 0.5) * 1.2;
  if (h2(px, py, 314) < 0.06) i -= 1;
  if (edge < 0.16) {
    const s = ((x - y) / 0.22) % 1;
    return (s < 0 ? s + 1 : s) < 0.5 ? YEL[ci(i, 5)] : BLK[ci(i - 1, 3)];
  }
  if (edge < 0.19) return concrete(x, y, px, py, e);
  const h = ((x + y * 0.5) / 0.3) % 1;
  if ((h < 0 ? h + 1 : h) < 0.24 && fx >= 0) return YEL[ci(i - 0.4, 5)];
  return concrete(x, y, px, py, e);
};

const asphalt: Floor4 = (x, y, px, py, e) => {
  let i = 2.3 + (e.nA - 0.5) * 2.2;
  // coarse aggregate in little clumps: a lit stone, a dark pit
  const g = h2(px >> 1, py >> 1, 321);
  if (g < 0.1) i -= 1.2;
  else if (g > 0.9) i += 1.1;
  if (h2(px, py, 327) < 0.04) i += 1.6;
  // patched trench reinstatements: rectangles a shade lighter or darker with a dark seam
  const pc = Math.floor(x * 0.5);
  const pr = Math.floor(y * 0.33);
  const ph = h2(pc, pr, 322);
  if (ph < 0.18) {
    const fu = x * 0.5 - pc;
    const fv = y * 0.33 - pr;
    if (fu > 0.12 && fu < 0.88 && fv > 0.28 && fv < 0.64) {
      if (fu < 0.14 || fu > 0.86 || fv < 0.3 || fv > 0.62) return ASP[0];
      i += ph < 0.09 ? 1 : -0.8;
    }
  }
  // tar-sealed cracks wandering across the yard: black, two pixels wide
  const cr = vnoise(x * 0.9, y * 0.9, 328);
  if (Math.abs(cr - 0.5) < 0.012 && vnoise(x * 0.35, y * 0.35, 329) > 0.55) return BLK[0];
  // cracks: a jagged polyline across some cells
  const cx = Math.floor(x * 0.8);
  const cy = Math.floor(y * 0.8);
  const ch = h2(cx, cy, 323);
  if (ch < 0.16) {
    const fx = x * 0.8 - cx;
    const fy = y * 0.8 - cy;
    const along = ch < 0.08;
    const t = along ? fx : fy;
    const c = along ? fy : fx;
    if (t > 0.08 && t < 0.92) {
      const k = Math.min(3, Math.floor(t * 4));
      const f = t * 4 - k;
      const h0 = 0.3 + h2(cx * 4 + k, cy, 326) * 0.4;
      const h1 = 0.3 + h2(cx * 4 + k + 1, cy, 326) * 0.4;
      const d = c - (h0 + (h1 - h0) * f);
      if (d > -0.012 && d < 0.012) return ASP[0];
      if (d > 0.012 && d < 0.022) i += 1;
    }
  }
  // dips holding damp (a sky glint in them), oil drips
  if (e.nB > 0.72) {
    if (dith(px, py) < (e.nB - 0.72) * 3) i -= 1.2;
    if (e.nB > 0.8 && h2(px >> 1, py, 330) < 0.05) return 0x8a96a0;
  }
  if (h2(px >> 2, py >> 2, 324) < 0.01) return h2(px, py, 325) < 0.5 ? OIL[0] : 0x5a4a72;
  if (e.near === 0) i -= 0.8;
  return ASP[ci(i, 6)];
};

const sidewalk: Floor4 = (x, y, px, py, e) => {
  // concrete slabs a tile square, dark joints with moss and weeds, every slab its own
  // shade, some cracked across, tyre-black stains where the lorries stand
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const id = Math.floor(x) * 7349 + Math.floor(y) * 1913;
  if (fx < 0.03 || fy < 0.06) return h2(px, py, 331) < 0.35 ? WEED[h2(px, py >> 1, 332) < 0.5 ? 1 : 0] : SLAB[0];
  const hs = h2(id, 1, 333);
  let i = 2.8 + (hs - 0.5) * 2 + (e.nA - 0.5) * 1.2;
  if (fx < 0.06 || fy < 0.12) i += 1;
  if (fx > 0.96 || fy > 0.92) i -= 0.8;
  const g = h2(px >> 1, py >> 1, 334);
  if (g < 0.08) i -= 1;
  else if (g > 0.94) i += 1;
  if (h2(id, 2, 335) < 0.25 && Math.abs(fx - fy * 0.7 - 0.2) < 0.016) return SLAB[0];
  if (e.nB > 0.68 && dith(px, py) < (e.nB - 0.68) * 2.5) i -= 1.4;
  if (e.near === 0) i -= 0.7;
  return SLAB[ci(i, 6)];
};

const cobble: Floor4 = (x, y, px, py, e) => {
  // granite setts ~0.26 × 0.16 tile in courses along x: dark sand and moss joints,
  // domed crowns lit from the upper left, every sett its own shade, a few sunk dark
  const row = Math.floor(y / 0.16);
  const fv = y / 0.16 - row;
  const u = x / 0.26 + (row & 1 ? 0.5 : 0) + (h2(row, 1, 341) - 0.5) * 0.3;
  const col = Math.floor(u);
  const fu = u - col;
  const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
  if (edge < 0.11) {
    const m = e.nB > 0.55 && h2(px, py, 342) < 0.4;
    return m ? WEED[h2(px >> 1, py, 343) < 0.5 ? 1 : 2] : SETT[0];
  }
  const id = col * 7349 + row * 1913;
  const hs = h2(id, 2, 344);
  let i = 3.1 + (hs - 0.5) * 2.4 + (hs > 0.94 ? 1 : hs < 0.05 ? -1.2 : 0);
  // domed: lit toward the upper left of the screen, shadowed lower right
  i += (-(fu - 0.5) * 1.0 - (fv - 0.5) * 1.5) * 1.8;
  if (edge < 0.2) i -= 0.6;
  if (h2(px, py, 345) < 0.05) i += 1;
  if (e.nA > 0.62) i += 0.6;
  if (e.nC < 0.3 && dith(px, py) < 0.4) i -= 0.6;
  if (e.near === 0) i -= 0.6;
  return SETT[ci(i, 7)];
};

const paving: Floor4 = (x, y, px, py, e) => {
  // the towpath: big sandstone flags in courses along x, dark open joints, worn
  // lighter crowns, a few cracked or sunk, moss and weeds in the joints
  const row = Math.floor(y / 0.5);
  const fv = y / 0.5 - row;
  const u = x / 0.75 + (row & 1 ? 0.45 : 0) + h2(row, 9, 353) * 0.3;
  const col = Math.floor(u);
  const fu = u - col;
  if (fu < 0.035 || fv < 0.07) return h2(px, py, 354) < 0.3 ? WEED[h2(px, py >> 1, 355) < 0.5 ? 1 : 0] : FLAG[0];
  const id = col * 7349 + row * 1913;
  const hs = h2(id, 3, 356);
  let i = 3.2 + (hs - 0.5) * 2 + (hs < 0.06 ? -1 : 0);
  if (fu < 0.07 || fv < 0.14) i += 1;
  if (fu > 0.95 || fv > 0.9) i -= 0.8;
  const g = h2(px, py, 357);
  if (g < 0.07) i -= 1;
  else if (g > 0.95) i += 1;
  if (hs > 0.82 && Math.abs(fu - fv * 0.6 - 0.25) < 0.012) return FLAG[0];
  if (e.nB > 0.66 && dith(px, py) < (e.nB - 0.66) * 2) i -= 1;
  if (e.near === 0) i -= 0.6;
  return FLAG[ci(i, 7)];
};

const gravel: Floor4 = (x, y, px, py, e) => {
  // angular ballast: clumps of stones, lit tops, dark gaps, rust dust near the rails
  const cx = Math.floor(px / 3);
  const cy = Math.floor(py / 2);
  const h = h2(cx, cy, 361);
  let i = 1.6 + h * 3.2;
  const fx = px - cx * 3;
  const fy = py - cy * 2;
  if (fy === 0 && fx < 2) i += 1;
  if (h2(px, py, 362) < 0.12) i = 0;
  if (e.nB > 0.66 && h2(px, py, 363) < 0.18) return RUSTY[h2(px, py, 364) < 0.5 ? 0 : 1];
  if (e.near === 0 && e.other !== 'asphalt') i -= 0.6;
  void x;
  void y;
  return BAL[ci(i, 6)];
};

const dirt: Floor4 = (x, y, px, py, e) => {
  let i = 2.5 + (e.nA - 0.5) * 2;
  // ruts along the track, pebbles, wet dark hollows
  const r = (y * 3) % 1;
  if (r > 0.42 && r < 0.5) i -= 0.9;
  const g = h2(px, py, 371);
  if (g < 0.05) i += 1.4;
  else if (g < 0.12) i -= 1;
  if (e.nB > 0.7) i -= 1;
  if (e.near === 0 && e.og) return SCRUB[h2(px, py, 372) < 0.5 ? 2 : 3];
  void x;
  return MUD[ci(i, 6)];
};

const meadow: Floor4 = (x, y, px, py, e) => {
  // scrubby waste ground: olive tussocks with a dry straw mixed in, small trampled bare
  // spots, rosette weeds and brick crumbs; contrast kept low so it never turns camouflage
  const g = h2(px, py, 382);
  const d = (dith(px, py) - 0.5) * 0.12;
  if (e.nB + d < 0.17) {
    if (g < 0.04) return 0x8e4a34;
    return MUD[ci(3 + (e.nA - 0.5) * 1.2 + (g > 0.86 ? 1 : g < 0.14 ? -1 : 0), 6)];
  }
  const blade = h2(px, py >> 1, 383);
  let i = 3.2 + (e.nA - 0.5) * 1.4;
  if (blade < 0.24) i -= 1.5;
  else if (blade > 0.84) i += 1.3;
  // tussocks: little clumps, lit on top with a dark foot
  const tu = h2(px >> 2, py >> 1, 386);
  if (tu < 0.09) i += (py & 1) ? -1.2 : 1;
  if (e.nB < 0.24) i -= 0.6;
  // a rosette here and there
  const rx = Math.floor(x * 1.6);
  const ry = Math.floor(y * 1.6);
  if (h2(rx, ry, 385) < 0.08) {
    const dx = x * 1.6 - rx - 0.5;
    const dy = y * 1.6 - ry - 0.5;
    if (dx * dx + dy * dy * 3 < 0.03) return SCRUB[((px >> 1) + (py >> 1)) & 1 ? 2 : 5];
  }
  if (e.near === 0 && !e.og) i -= 1.1;
  // dry straw mixed in pixel by pixel, more of it where the ground is poorer
  if (g < 0.12 + e.nC * 0.3) return DRY[ci(i - 0.4, 4)];
  return SCRUB[ci(i, 7)];
};

const water: Floor4 = (x, y, px, py, e) => {
  // a scum line where the water meets the coping, darker in the shade of the bank
  if (e.near === 0) return SCUM[(px + py) & 1];
  let i = 3 + e.depth * -1.2 + (e.nA - 0.5) * 1.6;
  if (e.near === 1) i -= 1.2;
  // the wharf wall's shadow along the near edge, the towpath bank mirrored along the far one
  if (y < 20.55) i -= 1.2;
  else if (y > 23.35) i += ((Math.floor(x * 1.4) & 1) ? 0.4 : -0.3) + (y > 23.7 ? 0.6 : 0);
  // slow ripple dashes and pale sky glints, both laid along the canal
  const r = h2(Math.floor((px + (py >> 2) * 3) / 7), py >> 1, 391);
  if (r < 0.1) i += 1.6;
  else if (r > 0.86) i -= 1.2;
  // sky glints on the ripple crests: short bright dashes, brightest in the open water
  const gl = h2((px + (py & 2) * 2) >> 2, py, 392);
  if (gl < 0.045 && e.near !== 1) return gl < 0.012 ? 0xd8e0d0 : gl < 0.028 ? 0xa8b8a8 : 0x7a9a88;
  if (h2(px, py, 393) < 0.003) return 0x6a5a3a; // a leaf
  void x;
  void y;
  return WATER[ci(i + (dith(px, py) - 0.5) * 0.6, 7)];
};

/** The back lots behind the distant roofs: mostly hidden, so a cheap, quiet tarmac. */
const roof: Floor4 = (_x, _y, px, py, e) => {
  const g = h2(px, py, 331);
  return ASP[g < 0.12 ? 1 : g > 0.94 ? 3 : e.nA > 0.6 ? 3 : 2];
};

export const FACTORY_FLOORS = { concrete, hazard, asphalt, sidewalk, cobble, paving, gravel, dirt, meadow, grass: meadow, water, roof };

// ── floor patches ───────────────────────────────────────────
/** The painted pedestrian lane: two yellow lines, white chevrons and walking-man stencils, worn by wheels. */
export function factoryPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  if (s.style !== 'lane') return;
  const k = P.k;
  const c = P.c;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1])));
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const alongX = s.w >= s.d;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2 - s.x;
      const y = (Y - X) / 2 - s.y;
      if (x < 0 || y < 0 || x > s.w || y > s.d) continue;
      const a = alongX ? x : y;
      const b = alongX ? y / s.d : x / s.w;
      // worn paint: wheel tracks and boots take it off in places
      const worn = vnoise(a * 2.5, b * 3, 401) > 0.74 || h2(px >> 1, py >> 1, 402) < 0.06;
      let col: string | null = null;
      if ((b > 0.06 && b < 0.14) || (b > 0.86 && b < 0.94)) col = '#e2b232';
      else {
        // a chevron every 3 tiles, a stencilled figure between
        const m = a % 3;
        const cb = Math.abs(b - 0.5);
        if (m > 0.9 && m < 1.35 && Math.abs(m - 0.9 - cb * 0.8 - 0.12) < 0.07) col = '#e8e4d8';
        if (m > 2.0 && m < 2.5 && cb < 0.22) {
          const fx = (m - 2.0) / 0.5;
          const fy = (b - 0.28) / 0.44;
          // a little walking figure: head, body, legs apart
          const head = (fx - 0.5) ** 2 + (fy - 0.16) ** 2 < 0.012;
          const body = Math.abs(fx - 0.5) < 0.08 && fy > 0.26 && fy < 0.6;
          const legs = fy >= 0.6 && fy < 0.95 && Math.abs(Math.abs(fx - 0.5) - (fy - 0.6) * 0.5) < 0.07;
          const arms = fy > 0.32 && fy < 0.38 && Math.abs(fx - 0.5) < 0.3;
          if (head || body || legs || arms) col = '#e8e4d8';
        }
      }
      if (!col || worn) continue;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    }
}


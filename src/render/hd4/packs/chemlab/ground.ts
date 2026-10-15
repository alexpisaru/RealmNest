// Chemical Lab — floors and the campus ground at 128×64.
//   lab       poured epoxy: pale grey-white with broadcast flecks, saw-cut joints,
//             soft window sheen, scuffs; a teal cove band where it meets a wall
//   hazard    yellow / black diagonal striping in epoxy, worn at the edges
//   grass     the campus lawn: dense fine blades, clover, daisies, bands of mowing
//   meadow    the biodiversity strip by the pond: tall warm grass, wildflowers
//   forest    the birch grove floor: shade, moss, leaf litter
//   paving    the plaza: large-format pale concrete slabs in stack bond
//   sidewalk  footpaths: grey block pavers in basketweave
//   cobble    the cycle path: smooth red asphalt with white edge lines
//   asphalt   the car park and the access road
//   concrete  the hazmat yard slab: broom finish, joints, stains, a drain
//   gravel    pale gravel strips at the building foot and round the tanks
//   water     the reed pond: dark green-teal depths, sky reflections, a soft bank
// Patches: 'hazard' (border lines over the striping) and 'lane' (a teal walkway with chevrons).
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import { dith, h2 } from '../../../materials';
import type { Painter } from '../../../iso';
import { type Floor4, pal } from '../types';

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

const EPX = pal('#b9c2c6', '#cdd0d3', '#dfe5e7', '#e8eef0', '#eef3f5', '#f5f9fa', '#fbfdfd');
const EPX_TEAL = pal('#1a7a6e', '#1f8f80', '#24a291', '#45b1a4', '#84d1c8');
const FLECK = pal('#7c8a8c', '#5a6a6e', '#4fae9f', '#9aa6a8', '#c8a878');
const HAZ_Y = pal('#a8801a', '#c99a22', '#e2b42e', '#f2c840', '#f8da6a');
const HAZ_K = pal('#1c1c20', '#26262c', '#33333a', '#46464e');
const LAWN = pal('#2a4a14', '#365c1c', '#456e22', '#56822a', '#68942e', '#7aa63a', '#90b848');
const LAWN_W = pal('#3a5a18', '#486c1e', '#5a8024', '#6a922a', '#7ea432', '#96b640');
const MEAD = pal('#2e5016', '#3e621c', '#507624', '#62882c', '#78a036', '#92b446');
const FOR = pal('#1a4022', '#22502a', '#2e6030', '#3c7034', '#4e823a');
const LITTER = pal('#7a6a30', '#94803a', '#a89a48', '#5e6a2a');
const SLAB = pal('#b4a294', '#cbbaac', '#dacabc', '#e4d5c7', '#ebddcf', '#f2e6da');
const PAVER = pal('#a39484', '#b9aa9a', '#cbbdae', '#d8cbbd', '#e4d8ca', '#efe5d8');
const RED_ASPH = pal('#6c3634', '#7a403d', '#874d49', '#905251', '#9e5e58');
const ASPH = pal('#22252c', '#2a2e36', '#32363f', '#3a3f48', '#454a53', '#525760');
const CONC = pal('#7f7a78', '#97938f', '#a8a5a3', '#b6b2b0', '#c2c1c2', '#d0d0d2');
const GRAV = pal('#8a8780', '#a19e96', '#b6b3ab', '#cac7bf', '#dcd9d2');
const WAT = pal('#0a3440', '#0d4453', '#10505f', '#165b6a', '#1c6874', '#2a7a82', '#4a9898', '#7cc0bc');
const FLOWERS = pal('#fbfaf2', '#f2d24a', '#b07ad8', '#e86a8a', '#ffffff', '#f2a03a');

// ── the lab floor ───────────────────────────────────────────
const lab: Floor4 = (x, y, px, py, e) => {
  // the teal cove where the floor meets a wall or the façade
  if (e.near === 0 && e.other !== 'hazard') return EPX_TEAL[ci(2 + ((px + py) & 1 ? 0 : 1) - (h2(px, py, 3) < 0.1 ? 1 : 0), 5)];
  let i = 4.5 + (e.nA - 0.5) * 0.8;
  // large-format 1 m floor tiles with fine grout lines, and saw-cut joints every four metres
  const fx = x - Math.floor(x / 4) * 4;
  const fy = y - Math.floor(y / 4) * 4;
  if (fx < 0.012 || fy < 0.024) return EPX[1];
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  if (tx < 0.01 || ty < 0.02) return EPX[2];
  if (tx < 0.025 || ty < 0.045) i += 0.8;
  // broadcast flecks
  const f = h2(px, py, 5);
  if (f < 0.004) return FLECK[Math.floor(h2(px, py, 6) * 5)];
  // soft sheen streaks (the window band reflected), dithered
  const s = (x * 0.6 - y * 0.9 + e.nC * 2) % 3;
  if (s > 0 && s < 0.35 && dith(px >> 1, py >> 1) < 0.5) i += 1;
  // scuffs and trolley wheel marks
  if (e.nB > 0.72 && h2(px >> 2, py >> 1, 7) < 0.25) i -= 1.2;
  if (h2(px, py, 8) < 0.04) i -= 0.6;
  return EPX[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 7)];
};

const hazard: Floor4 = (x, y, px, py, e) => {
  // 45° stripes across the tile grid, yellow and black, chipped where the trolleys run
  const s = (x + y) * 2.5;
  const band = Math.floor(s) & 1;
  const wear = h2(px >> 1, py >> 1, 11) < 0.06 + (e.nA > 0.6 ? 0.06 : 0);
  if (band) {
    if (wear) return HAZ_K[3];
    return HAZ_K[ci(1 + (h2(px, py, 12) < 0.08 ? 1 : 0), 4)];
  }
  if (wear) return EPX[3];
  let i = 3;
  if (s - Math.floor(s) < 0.12) i += 1;
  if (h2(px, py, 13) < 0.05) i -= 1;
  return HAZ_Y[ci(i, 5)];
};

// ── the campus ──────────────────────────────────────────────
const grass: Floor4 = (x, y, px, py, e) => {
  // broad mowing bands along the tile x axis, subtle
  const band = Math.floor(y * 0.7 + x * 0.05) & 1;
  const P = e.nC > 0.62 ? LAWN_W : LAWN;
  let i = 3.2 + (band ? 0.45 : -0.35) + (e.nA - 0.5) * 1.6;
  // fine upright blades: 1×2 marks with a lit tip
  const bx = px >> 1;
  const by = py >> 1;
  const hb = h2(bx, by, 21);
  if (hb < 0.22) i -= 1.6;
  else if (hb > 0.84) i += 1.4;
  if ((py & 1) === 0 && (px & 1) === ((hb * 977) & 1) && (hb * 31.7) % 1 < 0.26) i += 1.2;
  // clover patches and a scatter of daisies
  if (e.nB > 0.7) {
    const cx = Math.floor(px / 4);
    const cy = Math.floor(py / 3);
    if (h2(cx, cy, 23) < 0.35) i += 0.8;
    if (h2(cx, cy, 24) < 0.05 && px % 4 === 1 && py % 3 === 1) return FLOWERS[h2(cx, cy, 25) < 0.8 ? 0 : 1];
  }
  // the lawn darkens at its edges (kerbs, paths, beds)
  if (e.near === 0) i -= 1.4;
  else if (e.near === 1) i -= 0.5;
  return P[ci(Math.round(i + (dith(px, py) - 0.5) * 0.7), P.length)];
};

const meadow: Floor4 = (x, y, px, py, e) => {
  let i = 2.6 + (e.nA - 0.5) * 2;
  // tall tufts: vertical strokes 1×3 with dark roots and pale seed heads
  const cx = Math.floor(px / 3);
  const cy = Math.floor(py / 5);
  const hh = h2(cx, cy, 31);
  const ox = cx * 3 + 1;
  const oy = cy * 5;
  if (hh < 0.55 && px === ox) {
    const d = py - oy;
    if (d === 0) i += 2;
    else if (d < 3) i += 1;
    else i -= 1;
  }
  // wildflowers in drifts
  if (e.nB > 0.55) {
    const fx = Math.floor(px / 5);
    const fy = Math.floor(py / 4);
    if (h2(fx, fy, 32) < 0.16 && px === fx * 5 + 2 && py === fy * 4 + 1) return FLOWERS[1 + Math.floor(h2(fx, fy, 33) * 5)];
    if (h2(fx, fy, 32) < 0.16 && Math.abs(px - fx * 5 - 2) + Math.abs(py - fy * 4 - 1) === 1) return FLOWERS[h2(fx, fy, 34) < 0.5 ? 0 : 3];
  }
  if (e.near === 0 && !e.ow) i -= 1;
  void x;
  void y;
  return MEAD[ci(Math.round(i + (dith(px, py) - 0.5) * 0.7), 6)];
};

const forest: Floor4 = (x, y, px, py, e) => {
  let i = 2 + (e.nA - 0.5) * 1.8;
  const l = h2(px >> 1, py >> 1, 41);
  if (l < 0.05) return LITTER[Math.floor(l * 80) % 4];
  if ((l * 17.3) % 1 < 0.2 && (px & 1) === 0) i -= 1;
  if (e.nB > 0.68 && (l * 5.1) % 1 < 0.4) i += 1;
  void x;
  void y;
  return FOR[ci(Math.round(i + (dith(px, py) - 0.5) * 0.7), 5)];
};

const paving: Floor4 = (x, y, px, py, e) => {
  // 1.2 × 0.6 m slabs (tiles ≈ metres), stack bond, thin dark joints
  const u = x / 1.2;
  const v = y / 0.6;
  const cu = Math.floor(u);
  const cv = Math.floor(v);
  const fu = u - cu;
  const fv = v - cv;
  if (fu < 0.014 || fv < 0.03) return SLAB[0];
  const hs = h2(cu, cv, 51);
  let i = 3.4 + (hs - 0.5) * 1.6;
  // a lit chamfer on the slabs' upper edges, a shadow on the lower ones
  if (fu < 0.04 || fv < 0.08) i += 1.2;
  else if (fu > 0.97 || fv > 0.93) i -= 1;
  // exposed fine aggregate
  const g = h2(px, py, 52);
  if (g < 0.12) i -= 1.2;
  else if (g > 0.94) i += 1;
  // a water stain now and then
  if ((hs * 13.1) % 1 < 0.08 && e.nB > 0.5) i -= 0.8;
  if (e.near === 0) i -= 0.7;
  return SLAB[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 6)];
};

const sidewalk: Floor4 = (x, y, px, py, e) => {
  // basketweave: 0.4 m squares, each two pavers 0.4 × 0.2, alternating direction
  const S = 0.4;
  const qx = Math.floor(x / S);
  const qy = Math.floor(y / S);
  const fx = x / S - qx;
  const fy = y / S - qy;
  const alt = (qx + qy) & 1;
  const f = alt ? fx : fy;
  const g = alt ? fy : fx;
  const half = f < 0.5 ? 0 : 1;
  const ff = f - half * 0.5;
  if (ff < 0.04 || g < 0.04) return PAVER[0];
  let i = 3 + (h2(qx * 2 + half, qy, 61) - 0.5) * 2;
  if (ff < 0.1 || g < 0.1) i += 1.1;
  else if (ff > 0.44 || g > 0.92) i -= 0.9;
  if (h2(px, py, 62) < 0.08) i -= 1;
  if (e.near === 0) i -= 0.7;
  return PAVER[ci(Math.round(i + (dith(px, py) - 0.5) * 0.4), 6)];
};

const cobble: Floor4 = (x, y, px, py, e) => {
  // red cycle path, white edge lines along its borders
  if (e.near === 0) return (px + (py >> 1)) % 7 === 0 ? 0xd8d4cc : 0xf0eee8;
  let i = 2.4 + (e.nA - 0.5) * 1.2;
  const g = h2(px, py, 71);
  if (g < 0.16) i -= 1.2;
  else if (g > 0.9) i += 1.3;
  // worn lanes where the wheels run, a crack now and then
  if (Math.abs(y - Math.floor(y) - 0.5) < 0.06 && (px & 3) === 0) i += 0.8;
  if (Math.abs(((x * 0.7 + Math.sin(y * 4) * 0.2) % 3.3) - 1.6) < 0.015) return RED_ASPH[0];
  if (e.near === 1 && h2(px, py, 72) < 0.3) i -= 0.6;
  void x;
  void y;
  return RED_ASPH[ci(Math.round(i), 5)];
};

const asphalt: Floor4 = (x, y, px, py, e) => {
  let i = 2.3 + (e.nA - 0.5) * 1.8;
  // coarse aggregate: light and dark stones
  const g = h2(px, py, 81);
  if (g < 0.12) i -= 1.2;
  else if (g > 0.9) i += 1.3;
  else if (g > 0.86) i += 0.7;
  // patched rectangles and darker oil-soaked bays
  const pcx = Math.floor(x * 0.45);
  const pcy = Math.floor(y * 0.45);
  if (h2(pcx, pcy, 82) < 0.12) i -= 0.8;
  if (e.nB > 0.7) i -= 0.6;
  // tyre-polished lanes, a little lighter
  if (e.nC > 0.62 && (py & 1) === 0) i += 0.5;
  // a network of sealed cracks: thin wiggly dark lines with a pale tar edge
  const c1 = Math.abs(((x * 0.9 + y * 0.35 + Math.sin(y * 2.3) * 0.25) % 5.3) - 2.6);
  const c2 = Math.abs(((y * 1.1 - x * 0.2 + Math.sin(x * 1.7) * 0.3) % 6.1) - 3.0);
  if ((c1 < 0.018 || c2 < 0.016) && h2(Math.floor(x), Math.floor(y), 83) < 0.55) return ASPH[0];
  if ((c1 < 0.03 || c2 < 0.028) && h2(Math.floor(x), Math.floor(y), 83) < 0.55) i += 1.2;
  // painted lines: the car park aisle's edges, the road's edge lines and dashed centre line
  if (x >= 23 && x < 38 && y >= 0 && y < 17 && (Math.abs(y - 5.05) < 0.04 || Math.abs(y - 10.95) < 0.04)) return 0xe8eaea;
  if (x >= 38 && x < 42 && (Math.abs(x - 38.2) < 0.03 || Math.abs(x - 41.8) < 0.03)) return 0xe4e6e6;
  if (x >= 38 && x < 42 && Math.abs(x - 40) < 0.035 && y - Math.floor(y / 2) * 2 < 1) return 0xf2f2ee;
  if (e.near === 0) i -= 1;
  return ASPH[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 6)];
};

const concrete: Floor4 = (x, y, px, py, e) => {
  // 3 m bays with tooled joints, a broom finish across, oil stains, a drain channel
  const fx = x / 3 - Math.floor(x / 3);
  const fy = y / 3 - Math.floor(y / 3);
  if (fx < 0.008 || fy < 0.008) return CONC[0];
  let i = 3 + (e.nA - 0.5) * 1.8;
  if ((py + (px >> 2)) % 3 === 0) i -= 0.6;
  const g = h2(px, py, 91);
  if (g < 0.1) i -= 1.2;
  else if (g > 0.93) i += 1.1;
  if (e.nB > 0.72 && h2(px >> 3, py >> 2, 92) < 0.5) i -= 1.4;
  // yard markings: a yellow edge line along the apron, a hatched keep-clear box by the gate
  if (Math.abs(x - 1.8) < 0.04 && y > 19 && y < 29) return 0xe8c040;
  if (x > -2.6 && x < 0.9 && y > 26.2 && y < 28.8) {
    if (Math.min(x + 2.6, 0.9 - x, y - 26.2, 28.8 - y) < 0.06) return 0xe8c040;
    if ((x + y) * 2 - Math.floor((x + y) * 2) < 0.3) return 0xdcb438;
  }
  // hairline shrinkage cracks
  const cr = Math.abs(((x * 1.3 + Math.sin(y * 3.1) * 0.2) % 2.9) - 1.45);
  if (cr < 0.012 && h2(Math.floor(x), Math.floor(y), 93) < 0.5) return CONC[0];
  if (fx < 0.02 || fy < 0.02) i += 1.2;
  if (e.near === 0) i -= 0.8;
  return CONC[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 6)];
};

const gravel: Floor4 = (x, y, px, py, e) => {
  let i = 2 + (e.nA - 0.5) * 1.2;
  const cx = Math.floor(px / 3);
  const cy = Math.floor(py / 2);
  const h = h2(cx, cy, 101);
  if (h < 0.5) {
    const top = py === cy * 2;
    i = top ? 4 : 1 + (h < 0.15 ? 1 : 0);
  }
  if (e.near === 0) i -= 1;
  void x;
  void y;
  return GRAV[ci(Math.round(i), 5)];
};

const water: Floor4 = (x, y, px, py, e) => {
  // a soft bank: shallow brown-green water, then the depths
  if (e.near === 0) return (px + py) & 1 ? 0x3a5a2c : 0x2e4c26;
  // shallow and light at the shore, deep teal inside
  let i = 5 - Math.min(1, e.depth) * 2.8 + (e.near === 1 ? 0.8 : 0);
  // a broad soft sky reflection drifting across
  if (e.nA > 0.6) i += (e.nA - 0.6) * 4.5;
  else if (e.nA < 0.3) i -= 0.5;
  // ripple dashes: short horizontal light strokes on a sparse grid
  const cx = Math.floor(px / 9);
  const cy = Math.floor(py / 6);
  const hh = h2(cx, cy, 111);
  if (hh < 0.16) {
    const ox = cx * 9 + Math.floor(h2(cx, cy, 112) * 4);
    const oy = cy * 6 + 2;
    if (py === oy && px >= ox && px < ox + 3 + (hh < 0.05 ? 2 : 0)) return WAT[7];
    if (py === oy + 1 && px >= ox + 1 && px < ox + 3) return WAT[2];
  }
  void x;
  void y;
  return WAT[ci(Math.round(i + (dith(px, py) - 0.5) * 0.8), 8)];
};

export const CHEMLAB_FLOORS = { lab, hazard, grass, meadow, forest, paving, sidewalk, cobble, asphalt, concrete, gravel, water };

// ── patches ──────────────────────────────────────────────────
/** Floor patches painted into the ground: the walkway lane and the hazard zone's border. */
export function chemlabPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  const k = P.k;
  const c = P.c;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - 4;
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + 4;
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 4;
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + 4;
  const col = s.color ?? '#4fae9f';
  const n = parseInt(col.slice(1), 16);
  const tone = (f: number) => `rgb(${Math.min(255, Math.round(((n >> 16) & 255) * f))},${Math.min(255, Math.round(((n >> 8) & 255) * f))},${Math.min(255, Math.round((n & 255) * f))})`;
  const tones = [tone(0.72), tone(0.84), tone(0.94), col, tone(1.08)];
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2 - s.x;
      const y = (Y - X) / 2 - s.y;
      if (x < 0 || y < 0 || x > s.w || y > s.d) continue;
      let out: string | null = null;
      if (s.style === 'lane') {
        // the walkway: teal epoxy, white dashed edge lines, chevrons pointing along its length
        const long = s.w >= s.d;
        const along = long ? x : y;
        const across = long ? y / s.d : x / s.w;
        if (across < 0.06 || across > 0.94) out = Math.floor(along * 3) % 3 === 2 ? null : '#f4f8f6';
        else if (across < 0.1 || across > 0.9) out = tones[1];
        else {
          const ch = (along + Math.abs(across - 0.5) * 0.9) % 2.4;
          if (ch > 1.0 && ch < 1.36) out = '#f4faf8';
          else out = tones[(h2(px, py, 7) < 0.05 ? 2 : 3) + (h2(px >> 2, py >> 1, 8) < 0.04 ? -2 : 0)];
        }
      } else if (s.style === 'hazard') {
        // a white border line round the striped zone, and "keep clear" wear
        const d = Math.min(x, y, s.w - x, s.d - y);
        if (d < 0.05) out = '#f2f4f2';
        else if (d < 0.08) out = '#2a2a2e';
      } else if (s.style === 'pad' || s.style === 'rug') {
        const d = Math.min(x, y, s.w - x, s.d - y);
        out = d < 0.06 ? tones[0] : tones[3];
      }
      if (!out) continue;
      c.fillStyle = out;
      c.fillRect(px, py, 1, 1);
    }
}

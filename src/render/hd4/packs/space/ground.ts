// Space — floors and the ground round the module at 128×64.
//   metal   the module floor: anodised slate deck panels, brushed in a checker,
//           corner screws, perforated vent panels, worn walkways
//   grate   open grating over a dark service void with pipes and lights
//   hull    the station's exterior plating: riveted plates in running bond,
//           structural seams, vents, access panels, light strips, edge lights
//   deck    a landing apron: dark anti-skid composite
//   raised  black ceramic thermal tiles (near the thrusters)
//   roof    body-mounted solar cells on the hull
//   hazard  amber/black safety stripes
//   space   the void: a deep starfield with a galactic band and nebula dust, the
//           sun's glare in the upper left and the planet's curved limb far below
// Patches: the glowing walkway lane, the grate's hazard frame, starlight pools.
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import type { Painter } from '../../../iso';
import { dith, h2, vnoise } from '../../../materials';
import { type Floor4, pal } from '../types';

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);
const fr = (v: number) => v - Math.floor(v);

// ── the module floor ─────────────────────────────────────────
const FL = pal('#18213a', '#24314f', '#33426a', '#3f4f78', '#4a5a84', '#53658e', '#6274a0', '#7c8db4');

const metal: Floor4 = (x, y, px, py, e) => {
  // deck plates one tile square in a riveted frame; four brushed panels in each
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = x - cx;
  const fy = y - cy;
  const id = h2(cx, cy, 3);
  // flush guide lights where the corners of every second plate meet
  const rx = Math.round(x);
  const ry = Math.round(y);
  const lx = Math.abs(x - rx);
  const ly = Math.abs(y - ry);
  if (lx < 0.036 && ly < 0.05 && rx > 0 && ry > 0) return lx < 0.018 && ly < 0.026 ? 0xcde1ea : ((rx | ry) & 1) === 0 ? 0x61cfda : 0x387c8d;
  let i: number;
  if (fx < 0.012 || fy < 0.018) return 0x1a2440;
  if (fx < 0.055 || fy < 0.075) {
    // the frame: gunmetal with a lit lip and bolts every quarter
    i = 2.4;
    if (fx < 0.024 || fy < 0.034) i += 1.2;
    const along = fx < 0.055 ? fy : fx;
    if (Math.abs(fr(along * 4) - 0.5) < 0.035) i += 2;
  } else {
    const sx = fx < 0.53 ? 0 : 1;
    const sy = fy < 0.54 ? 0 : 1;
    const ux = sx ? (fx - 0.53) / 0.47 : (fx - 0.055) / 0.475;
    const uy = sy ? (fy - 0.54) / 0.46 : (fy - 0.075) / 0.465;
    if (ux < 0.025 || uy < 0.035) return 0x1f2b48;
    i = 3.8 + (h2(cx * 2 + sx, cy * 2 + sy, 4) - 0.5) * 0.8;
    // brushed streaks, each panel turned the other way to its neighbours
    const turn = (sx + sy + cx + cy) & 1;
    const s = vnoise((turn ? uy : ux) * 46 + cx * 3.1, (turn ? ux : uy) * 2.4 + cy, 4);
    if (s > 0.68) i += 0.6;
    else if (s < 0.24) i -= 0.5;
    if (ux < 0.06) i += 0.7;
    else if (uy < 0.08) i += 0.4;
    else if (ux > 0.95 || uy > 0.94) i -= 0.7;
    if (id < 0.1) {
      // a perforated vent plate
      const hx = fr(ux * 7);
      const hy = fr(uy * 7);
      if (hx > 0.32 && hx < 0.68 && hy > 0.3 && hy < 0.7) return FL[0];
    } else if (id > 0.92) {
      // diamond tread
      const tx = fr((ux + uy) * 5);
      const ty = fr((ux - uy) * 5 + 0.5);
      if (Math.abs(tx - 0.5) < 0.12 && Math.abs(ty - 0.5) < 0.3) i += tx < 0.5 ? 1.2 : -0.7;
    } else if (id > 0.86 && sx === 1 && sy === 1 && ux > 0.25 && ux < 0.75 && uy > 0.4 && uy < 0.6) {
      // a recessed lift handle
      i -= uy < 0.48 ? 1.6 : 0.6;
    }
  }
  // walkway wear, scuffs, fine grit
  if (e.nA > 0.66 && dith(px, py) > 0.5) i += 0.5;
  if (e.nC < 0.3 && dith(px >> 1, py >> 1) > 0.6) i -= 0.4;
  const g = h2(px, py, 5);
  if (g < 0.016) i -= 1;
  else if (g > 0.992) i += 1;
  // ambient occlusion along the back walls
  const ao = Math.min(x, y);
  if (ao < 0.55) i -= (0.55 - ao) * 4 * (0.6 + dith(px, py) * 0.6);
  return FL[ci(Math.round(i + (dith(px, py) - 0.5) * 0.45), FL.length)];
};

// ── grating over the service void ────────────────────────────
const GR = pal('#14161e', '#1e222e', '#2a3040', '#3a4256', '#4e586e', '#66718a', '#8490a8');
const VOID = pal('#07080d', '#0b0e16', '#10141f', '#161c2a');

const grate: Floor4 = (x, y, px, py, e) => {
  const P = 0.125;
  const bx = fr(x / P);
  const by = fr(y / P);
  const bar = 0.2;
  const onX = bx < bar;
  const onY = by < bar;
  if (onX || onY) {
    // bars: lit tops, a dark lower edge; crossings brighter
    let i = 3.6;
    if (onX && onY) i += 0.8;
    if ((onX && bx > bar - 0.06) || (onY && by > bar - 0.06)) i -= 1.3;
    if (h2(px, py, 21) < 0.04) i -= 1;
    if (e.near === 0) i -= 0.6;
    return GR[ci(Math.round(i), GR.length)];
  }
  // through the holes: the service void a little below, pipes along both axes, a few lights
  const dx = x - 0.22;
  const dy = y - 0.22;
  const cell = Math.floor(x / P) * 31 + Math.floor(y / P) * 17;
  if (h2(cell, 1, 22) < 0.012) return h2(cell, 2, 23) < 0.5 ? 0x46b456 : 0xf2a83e;
  const py0 = fr(dy);
  const px0 = fr(dx * 0.5);
  if (py0 > 0.3 && py0 < 0.38) return py0 < 0.33 ? 0x8a6a34 : 0x5a4422;
  if (py0 > 0.62 && py0 < 0.68) return py0 < 0.645 ? 0x4e586e : 0x2a3040;
  if (px0 > 0.2 && px0 < 0.25) return px0 < 0.22 ? 0x3a6aa0 : 0x24406a;
  return VOID[ci(Math.floor(by * 2.6 + dith(px, py) * 0.8), 4)];
};

// ── the station's exterior plating ───────────────────────────
const HU = pal('#1a1d27', '#272c3a', '#353c4e', '#454d66', '#565f74', '#68708a', '#7f8494', '#959aaa', '#b0b4bf');
const HU_PALE = pal('#2a2e3a', '#3c4252', '#505768', '#646c80', '#787f92', '#8e94a6', '#a5aab8', '#bcc0cb', '#d4d6dd');

const hull: Floor4 = (x, y, px, py, e) => {
  // structural sections 4 × 4 tiles: a double seam with bolts, each section its own skin
  const sx = fr(x / 4);
  const sy = fr(y / 4);
  if (sx < 0.007 || sy < 0.014) return 0x141820;
  const zone = h2(Math.floor(x / 4), Math.floor(y / 4), 30);
  if (sx < 0.022 || sy < 0.044) {
    const along = sx < 0.022 ? y : x;
    // running lights: flush amber lamps every half metre along some of the seams
    const runL = h2(Math.floor(x / 4) + (sx < 0.022 ? 7 : 0), Math.floor(y / 4) + (sx < 0.022 ? 0 : 5), 33) < 0.5;
    if (runL) {
      const m = Math.abs(fr(along * 2) - 0.5);
      if (m < 0.03) return m < 0.015 ? 0xfef7d0 : 0xf1bd3c;
      if (m < 0.06) return 0xb98d3a;
    }
    return fr(along * 8) < 0.12 ? HU[7] : sx < 0.014 || sy < 0.028 ? HU[5] : HU[2];
  }
  // the lamps' glow spills a little onto the plates either side
  if (sx < 0.05 || sy < 0.1) {
    const xs = sx < 0.05;
    const along = xs ? y : x;
    if (h2(Math.floor(x / 4) + (xs ? 7 : 0), Math.floor(y / 4) + (xs ? 0 : 5), 33) < 0.5 && Math.abs(fr(along * 2) - 0.5) < 0.05 && dith(px, py) < 0.5) return 0x8d5a13;
  }
  // sections of pale shield panels are square; the rest is plating in running bond along x
  const pale = zone < 0.22;
  const P = pale ? HU_PALE : HU;
  const row = Math.floor(y * 2);
  const off = row & 1 ? 0.5 : 0;
  const col = pale ? Math.floor(x * 2) : Math.floor(x + off);
  const fx = pale ? x * 2 - col : x + off - col;
  const fy = y * 2 - row;
  const id = h2(col, row, 31);
  if (fx < (pale ? 0.03 : 0.02) || fy < 0.045) return pale ? P[1] : 0x101319;
  let i = 4.2 + (zone - 0.5) * 0.9 + (id - 0.5) * 1.1;
  if (fy < 0.11 || fx < (pale ? 0.07 : 0.04)) i += 1.4;
  else if (fy > 0.9 || fx > (pale ? 0.94 : 0.97)) i -= 1.3;
  // painted guide lines: thin amber stripes across some sections
  const gl = h2(Math.floor(x / 4), Math.floor(y / 4), 34);
  if (gl < 0.45 && Math.abs(sy - (gl < 0.22 ? 0.37 : 0.62)) < 0.009) return h2(px >> 2, py >> 1, 35) < 0.1 ? 0x8a6a34 : 0xe0a83a;
  if (gl > 0.7 && Math.abs(sx - (gl < 0.85 ? 0.3 : 0.7)) < 0.0045) return h2(px >> 2, py >> 1, 36) < 0.1 ? 0x8a6a34 : 0xd8a038;
  if (!pale) {
    // rivets along the long seams
    if (fy > 0.12 && fy < 0.19 && Math.abs(fr(fx * 10) - 0.5) < 0.09) return P[8];
    if (fy > 0.82 && fy < 0.88 && Math.abs(fr(fx * 10) - 0.5) < 0.09) return P[1];
  } else if ((fx < 0.16 || fx > 0.84) && (fy < 0.16 || fy > 0.84)) return P[3];
  // special plates (vents, access panels, light strips, stencils, grilles, lamps, greebles)
  if (id > 0.95 && !pale) {
    if (fx > 0.18 && fx < 0.82 && fy > 0.25 && fy < 0.75) return fr(fx * 22) < 0.45 ? P[0] : P[6];
  } else if (id > 0.92) {
    if (fx > 0.2 && fx < 0.8 && fy > 0.22 && fy < 0.78) {
      if (fx < 0.23 || fy < 0.28) return P[1];
      if (fx > 0.77 || fy > 0.72) return P[7];
      const bx = Math.min(Math.abs(fx - 0.27), Math.abs(fx - 0.73));
      const by = Math.min(Math.abs(fy - 0.35), Math.abs(fy - 0.65));
      if (bx < 0.025 && by < 0.06) return P[1];
      i += 0.4;
    }
  } else if (id > 0.905 && !pale) {
    if (Math.abs(fy - 0.5) < 0.07) return fr(fx * 6) < 0.34 ? 0x7adde2 : P[1];
  } else if (id > 0.89) {
    if (fy > 0.35 && fy < 0.65 && fx > 0.15 && fx < 0.6 && fr(fx * 9) < 0.6 && h2(Math.floor(fx * 9), row, col) < 0.7) return P[1];
  } else if (id > 0.85 && !pale) {
    // a floor grille over a dark well
    if (fx > 0.12 && fx < 0.88 && fy > 0.16 && fy < 0.84) {
      if (fy < 0.24 || fx < 0.15) return 0x0c0e13;
      if (fy > 0.78 || fx > 0.85) return P[7];
      return fr(fx * 14) < 0.42 ? P[6] : fr(fy * 3) < 0.5 ? 0x0c0e13 : 0x161a22;
    }
  } else if (id > 0.81) {
    // a flush amber running light in a small bolted housing, glowing on the plate
    const r = 4 * (fx - 0.5) * (fx - 0.5) + (fy - 0.5) * (fy - 0.5);
    if (r < 0.012) return 0xfef7d0;
    if (r < 0.03) return 0xfbd262;
    if (r < 0.055) return 0xe59733;
    if (r < 0.08) return 0x2a2014;
    if (r < 0.3 && dith(px, py) < (0.3 - r) * 2.4) return r < 0.16 ? 0xb98d3a : 0x8d5a13;
  } else if (id > 0.77 && !pale) {
    // hazard stripes along the plate's lower edge
    if (fy > 0.62 && fy < 0.86 && fx > 0.06 && fx < 0.94) return fr((fx * 2 + fy) * 3.2) < 0.5 ? 0xe8a33a : 0x1c1e26;
  } else if (id > 0.73) {
    // a bolted cover box standing proud: lit top, dark front lip and a shadow
    if (fx > 0.22 && fx < 0.78 && fy > 0.2 && fy < 0.8) {
      if (fy > 0.68) return fy > 0.74 ? 0x0e1016 : P[2];
      if (fy < 0.27 || fx < 0.26) return P[8];
      if (fx > 0.74) return P[3];
      if (Math.abs(fx - 0.5) < 0.12 && Math.abs(fy - 0.45) < 0.06) return h2(col, row, 37) < 0.5 ? 0xe04a3c : 0x46b456;
      i += 1.1;
    }
  } else if (id > 0.7 && !pale) {
    // a conduit across the plate in its clamps
    const cy = Math.abs(fy - 0.5);
    if (cy < 0.12) return cy < 0.04 ? (h2(col, row, 38) < 0.5 ? 0xd85a3c : 0x9aa2b0) : cy < 0.08 ? (h2(col, row, 38) < 0.5 ? 0x8e2024 : 0x535a6b) : 0x101319;
    if (cy < 0.18 && Math.abs(fr(fx * 3) - 0.5) < 0.05) return P[7];
  }
  // weathering: soft grime clouds, a sheen on big zones, micrometeoroid pits
  if (e.nA > 0.64 && dith(px >> 1, py >> 1) < (e.nA - 0.64) * 2.6) i -= 0.6;
  if (e.nC > 0.6) i += 0.4;
  const g = h2(px, py, 32);
  if (g < 0.01) return P[1];
  if (g > 0.997) return P[8];
  // the deck's edge: a bright lip, then a dark band with amber and red marker lights
  if (e.other === 'space') {
    // the rim: a bright lip carrying an amber light line
    if (e.near === 0) return dith(px, py) < 0.55 ? 0xf1bd3c : 0xe59733;
    else if (e.near === 1) {
      i -= 0.8;
      const m = fr((x + y) * 1.25);
      if (Math.abs(m - 0.5) < 0.035) return (Math.floor((x + y) * 1.25) & 1) === 0 ? 0xf2a83e : 0xe04a3c;
    }
  }
  return P[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 9)];
};

// ── the landing apron ────────────────────────────────────────
const AP = pal('#16181f', '#1c1f28', '#232732', '#2b303d', '#353a49', '#414858');
const deck: Floor4 = (x, y, px, py, e) => {
  // composite slabs 2×2 tiles, anti-skid grit, tyre and scorch smudges
  const fx = fr(x / 2);
  const fy = fr(y / 2);
  if (fx < 0.008 || fy < 0.008) return 0x101218;
  let i = 3 + (h2(Math.floor(x / 2), Math.floor(y / 2), 41) - 0.5) * 0.8;
  const g = h2(px, py, 42);
  if (g < 0.2) i -= 0.7;
  else if (g > 0.85) i += 0.7;
  if (e.nA > 0.6 && dith(px >> 1, py >> 1) < (e.nA - 0.6) * 2.5) i -= 1;
  if (e.other === 'space' && e.near === 0) return dith(px, py) < 0.55 ? 0xf1bd3c : 0xe59733;
  return AP[ci(Math.round(i), 6)];
};

// ── thermal tiles ────────────────────────────────────────────
const TT = pal('#0c0d12', '#13151c', '#1a1d26', '#232733', '#2e3340', '#3c4250', '#4e5566');
const raised: Floor4 = (x, y, px, py, e) => {
  // square tiles 1/6 tile, staggered, each its own tone, light gap lines
  const S = 1 / 6;
  const row = Math.floor(y / S);
  const xx = x / S + (row & 1) * 0.5;
  const col = Math.floor(xx);
  const fx = xx - col;
  const fy = y / S - row;
  if (fx < 0.08 || fy < 0.1) return 0x5a5e6a;
  let i = 2.6 + (h2(col, row, 51) - 0.5) * 1.8;
  if (fy < 0.25) i += 0.7;
  if (h2(px, py, 52) < 0.05) i += 1;
  if (e.other === 'space' && e.near === 0) i += 1.4;
  return TT[ci(Math.round(i + (dith(px, py) - 0.5) * 0.4), 7)];
};

// ── body-mounted solar cells ─────────────────────────────────
const SC = pal('#051348', '#051870', '#0e2272', '#162579', '#1c328a', '#2a409a', '#475fb0');
const roof: Floor4 = (x, y, px, py, e) => {
  const fx = fr(x * 4);
  const fy = fr(y * 4);
  if (fx < 0.06 || fy < 0.06) return fx < 0.06 && fy < 0.06 ? 0xf1bd3c : 0x63667e;
  let i = 2.6 + (h2(Math.floor(x * 4), Math.floor(y * 4), 61) - 0.5) * 0.7;
  // sheen band, busbar
  if (fr((px * 0.5 + py) / 90) < 0.12) i += 1.5;
  if (Math.abs(fx - 0.5) < 0.03) i += 0.8;
  if (e.near === 0) return dith(px, py) > 0.4 ? 0xf1bd3c : 0xe59733;
  return SC[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── hazard stripes ───────────────────────────────────────────
const hazard: Floor4 = (x, y, px, py) => {
  const s = fr((x + y) * 2.5);
  const worn = h2(px >> 1, py >> 1, 71) < 0.08;
  if (s < 0.5) return worn ? 0x8a6a34 : h2(px, py, 72) < 0.06 ? 0xb8862c : 0xe8a33a;
  return worn ? 0x3a3a42 : 0x1c1e26;
};

// ── the void: starfield, galactic band, nebula, sun, planet ──
const SPACE = pal('#00020b', '#02040f', '#040817', '#070b1e', '#0c1029');
// the Milky Way's dust: violet and blue clouds
const PURP = pal('#0e0826', '#170c3e', '#1f1347', '#2d1d5e', '#3f2c76', '#4e3a89', '#6c59aa', '#9a86d0');
const BLUEG = pal('#060c30', '#0a1240', '#0f1a61', '#1d2f75', '#2d3d8f', '#425bb7', '#5a7ad8', '#8aa8f0');
const STAR = pal('#3a4068', '#6a6e89', '#b4bee6', '#ffffff', '#fff0d0', '#9ab8ff', '#b8d8ff');
// the planet seen from orbit: hazy ocean, land, clouds, the night side's cities
const OCEAN = pal('#03132e', '#031e46', '#042550', '#012e5f', '#013970', '#0b437b', '#0d578f', '#1e6aa6');
const LAND = pal('#122419', '#183925', '#20452c', '#2f4730', '#365437', '#4a6844', '#5f7d4c', '#7a925a');
const DESERT = pal('#362d1d', '#5c4229', '#61573e', '#7c5d3e', '#796d51', '#977e5f', '#aa936f', '#c2a984');
const CLOUD = pal('#3a5c94', '#7088b4', '#9aaccc', '#b6c2d8', '#cdd7e7', '#dfe8f4', '#eff3f9', '#fafcfd');
const NIGHT = pal('#020a1c', '#030f26', '#081833', '#0e2040');
const CITY = pal('#f1bd3c', '#e59733', '#fef7d0');
const ATMO = pal('#04265d', '#064b96', '#0e7ad2', '#1e9aec', '#46b4f7', '#89e3fb', '#d0f6ff');
const MOON = pal('#121420', '#2a2c38', '#4a4c58', '#6e707a', '#9a9ca4', '#c4c6cc', '#e4e6ea');

// planet disc (screen px relative to the world origin), sun and moon
const PX = -700;
const PY = 6560;
const PR = 6000;
const PR2 = PR * PR;
const SUNX = -1880;
const SUNY = -1240;
const MOONX = 1780;
const MOONY = -1180;
const MOONR = 84;

function fbm(x: number, y: number, s: number, oct: number) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let o = 0; o < oct; o++) {
    v += vnoise(x * f, y * f, s + o) * a;
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return v / n;
}

/**
 * Smooth fields on coarse grids (planet every 4 px, dust every 8 px), filled
 * lazily and read back with bilinear interpolation: the noise is paid per cell,
 * not per pixel. A bake restarts at the top row, which resets the grids.
 */
const PG = 4;
const PGW = 1280;
const PGH = 1100;
const pLand = new Float32Array(PGW * PGH);
const pCloud = new Float32Array(PGW * PGH);
const pLight = new Float32Array(PGW * PGH);
const pDes = new Float32Array(PGW * PGH);
const pDet = new Float32Array(PGW * PGH);
const pDone = new Uint8Array(PGW * PGH);
const DG = 8;
const DGW = 640;
const DGH = 550;
const dDust = new Float32Array(DGW * DGH);
const dFine = new Float32Array(DGW * DGH);
const dHue = new Float32Array(DGW * DGH);
const dBase = new Float32Array(DGW * DGH);
const dDone = new Uint8Array(DGW * DGH);
let lastPy = 1e9;
let OX = 0;
let OY = 0;

function planetCell(i: number, gx: number, gy: number) {
  const X = gx * PG + PG / 2 - OX;
  const Y = gy * PG + PG / 2 - OY;
  const dx = (X - PX) / PR;
  const dy = (Y - PY) / PR;
  const r2 = dx * dx + dy * dy;
  const r = Math.sqrt(r2);
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  // azimuthal equidistant surface coordinates: features compress toward the limb
  const g = r > 1e-6 ? Math.asin(Math.min(1, r)) / r : 1;
  const sx = dx * g * 30;
  const sy = dy * g * 30;
  const wx = vnoise(sx * 0.35, sy * 0.35, 120) - 0.5;
  pLand[i] = fbm(sx * 0.7 + wx * 1.6 + 3.3, sy * 0.8 + wx + 1.7, 110, 3);
  const cw = vnoise(sx * 0.45 + 9, sy * 0.45, 140) - 0.5;
  pCloud[i] = fbm(sx * 2.6 + cw * 2.2, sy * 3.4 + cw * 1.6, 130, 4);
  // light from the upper left; the terminator crosses the lower right
  pLight[i] = dx * -0.93 + dy * -0.25 + nz * 0.25;
  pDes[i] = vnoise(sx * 0.3 + 20, sy * 0.3, 150);
  pDet[i] = fbm(sx * 5 + 7, sy * 5.5, 155, 2);
  pDone[i] = 1;
}

function dustCell(i: number, gx: number, gy: number) {
  const X = gx * DG + DG / 2 - OX;
  const Y = gy * DG + DG / 2 - OY;
  dDust[i] = vnoise(X / 560, Y / 400, 190) * 0.62 + vnoise(X / 180, Y / 140, 191) * 0.38;
  dFine[i] = vnoise(X / 70, Y / 56, 195) * 0.6 + vnoise(X / 26, Y / 22, 196) * 0.4;
  dHue[i] = vnoise(X / 340, Y / 260, 193);
  dBase[i] = vnoise(X / 320, Y / 320, 194);
  dDone[i] = 1;
}

// planet fields per 2×2 block (bilinear from the grid), cached for the block row
const CW = 4096;
const bRow = new Int32Array(CW).fill(-1);
const bLand = new Float32Array(CW);
const bCloud = new Float32Array(CW);
const bLight = new Float32Array(CW);
const bDes = new Float32Array(CW);
const bDet = new Float32Array(CW);
const bCloudUL = new Float32Array(CW);
const bF1 = new Float32Array(CW);
const bF2 = new Float32Array(CW);
/** The cloud field bilinear at grid coords (lazy cells). */
function cloudAt(fx: number, fy: number) {
  let gx = Math.floor(fx);
  let gy = Math.floor(fy);
  if (gx < 0) gx = 0;
  else if (gx > PGW - 2) gx = PGW - 2;
  if (gy < 0) gy = 0;
  else if (gy > PGH - 2) gy = PGH - 2;
  const tx = Math.min(1, Math.max(0, fx - gx));
  const ty = Math.min(1, Math.max(0, fy - gy));
  const i00 = gy * PGW + gx;
  if (!pDone[i00]) planetCell(i00, gx, gy);
  if (!pDone[i00 + 1]) planetCell(i00 + 1, gx + 1, gy);
  if (!pDone[i00 + PGW]) planetCell(i00 + PGW, gx, gy + 1);
  if (!pDone[i00 + PGW + 1]) planetCell(i00 + PGW + 1, gx + 1, gy + 1);
  return (pCloud[i00] * (1 - tx) + pCloud[i00 + 1] * tx) * (1 - ty) + (pCloud[i00 + PGW] * (1 - tx) + pCloud[i00 + PGW + 1] * tx) * ty;
}
function planetBlock(bx: number, by: number) {
  const fx = (bx * 2 + 1 - PG / 2) / PG;
  const fy = (by * 2 + 1 - PG / 2) / PG;
  let gx = Math.floor(fx);
  let gy = Math.floor(fy);
  if (gx < 0) gx = 0;
  else if (gx > PGW - 2) gx = PGW - 2;
  if (gy < 0) gy = 0;
  else if (gy > PGH - 2) gy = PGH - 2;
  const tx = fx - gx;
  const ty = fy - gy;
  const i00 = gy * PGW + gx;
  const i10 = i00 + 1;
  const i01 = i00 + PGW;
  const i11 = i01 + 1;
  if (!pDone[i00]) planetCell(i00, gx, gy);
  if (!pDone[i10]) planetCell(i10, gx + 1, gy);
  if (!pDone[i01]) planetCell(i01, gx, gy + 1);
  if (!pDone[i11]) planetCell(i11, gx + 1, gy + 1);
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  bLand[bx] = pLand[i00] * w00 + pLand[i10] * w10 + pLand[i01] * w01 + pLand[i11] * w11;
  bCloud[bx] = pCloud[i00] * w00 + pCloud[i10] * w10 + pCloud[i01] * w01 + pCloud[i11] * w11;
  bLight[bx] = pLight[i00] * w00 + pLight[i10] * w10 + pLight[i01] * w01 + pLight[i11] * w11;
  bDes[bx] = pDes[i00] * w00 + pDes[i10] * w10 + pDes[i01] * w01 + pDes[i11] * w11;
  bDet[bx] = pDet[i00] * w00 + pDet[i10] * w10 + pDet[i01] * w01 + pDet[i11] * w11;
  // fine screen-space texture (puffy cloud edges, mottled land) and the cloud a few px up-left (shading, shadows)
  bF1[bx] = vnoise(bx / 3.2, by / 2.4, 300);
  bF2[bx] = vnoise(bx / 1.4, by / 1.1, 301);
  bCloudUL[bx] = cloudAt(fx - 2.2, fy - 1.6);
  bRow[bx] = by;
}
const BAY = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));

// distant spacecraft, tiny against the stars: [world px x, y, rows]
const CRAFT_PAL = pal('#000000', '#1b285a', '#4260a6', '#a8741e', '#f2d278', '#7e5418', '#e9edf2', '#949baa', '#626a7a');
const CRAFT: [number, number, string[]][] = [
  // a navigation satellite: a gold bus, two blue wings, a dish
  [-1196, -588, ['.........666.........', '..........7..........', '1212121.34443.1212121', '212121283454382121212', '1212121.35553.1212121', '.........555.........']],
  // a far-off station: a core module, a cross of solar wings
  [980, -1020, ['.......6.......', '1111..676..1111', '222288666882222', '1111..676..1111', '.......7.......', '......777......', '.......7.......']],
  // a cargo ship climbing from the planet, its wings out
  [1460, 300, ['....66....', '1112662111', '....77....', '....55....']],
];

// the star cell under the current pixel (cells of 20 px, re-solved when the cell changes)
let stCx = -1e9;
let stCy = -1e9;
let stHas = false;
let stX = 0;
let stY = 0;
let stBig = false;
let stMid = false;
let stCol = 0;

const space: Floor4 = (x, y, px, py) => {
  const X = (x - y) * 64;
  const Y = (x + y) * 32;
  if (py < lastPy - 1) {
    // a new bake: forget the grids, learn the frame origin
    pDone.fill(0);
    dDone.fill(0);
    bRow.fill(-1);
    OX = px + 0.5 - X;
    OY = py + 0.5 - Y;
    stCx = -1e9;
  }
  lastPy = py;
  const d = BAY[((py & 3) << 2) | (px & 3)];
  const pdx = X - PX;
  const pdy = Y - PY;
  const pr2 = pdx * pdx + pdy * pdy;
  if (pr2 < PR2) {
    const pr = Math.sqrt(pr2);
    const edge = PR - pr;
    // the limb: a bright thin rim of air, then a band of blue haze over the surface
    if (edge < 2.5) return ATMO[6];
    if (edge < 6) return ATMO[5];
    if (edge < 11) return ATMO[4];
    const bx = (px >> 1) & (CW - 1);
    if (bRow[bx] !== py >> 1) planetBlock(bx, py >> 1);
    const land = bLand[bx];
    const f1 = bF1[bx] - 0.5;
    const f2 = bF2[bx] - 0.5;
    const cloud = bCloud[bx] + f1 * 0.16 + f2 * 0.07;
    const cUL = bCloudUL[bx] + f1 * 0.16;
    const light = bLight[bx];
    const day = light * 10 - 0.35 + (d - 0.5) * 0.9;
    let c: number;
    const bh = h2(px >> 1, py >> 1, 160);
    if (day < 0.25) {
      // night: dark ocean and land, cities strung along the coasts and clustered inland
      const coast = land > 0.5 && land < 0.55;
      const town = land > 0.52 && f1 > 0.12 && f2 > -0.12;
      if (coast && bh < 0.24) c = CITY[h2(px >> 1, py >> 1, 161) < 0.35 ? 2 : h2(px, py, 162) < 0.5 ? 1 : 0];
      else if (town && bh < 0.42) c = CITY[bh < 0.1 ? 2 : bh < 0.26 ? 0 : 1];
      else if (land > 0.52 && bh < 0.025) c = CITY[1];
      else if ((coast || town) && bh < 0.5 && d < 0.5) c = 0x6a4a1c;
      else c = NIGHT[ci(Math.floor(1.2 + day * 3 + (land > 0.52 ? 0.7 : 0) + (cloud > 0.62 ? 0.8 : 0) + f2), 4)];
      if (day > -0.4 && day < 0.25 && d < (day + 0.4) * 0.7 && c !== CITY[0] && c !== CITY[1] && c !== CITY[2]) c = OCEAN[1];
    } else {
      const t = Math.min(7, day);
      const det = bDet[bx];
      // clouds: puffy clumps lit on the upper left, shaded lower right
      const shade = (cloud - cUL) * 26;
      if (cloud > 0.6) c = CLOUD[ci(Math.round(t * 0.95 + (cloud - 0.6) * 12 - 1.4 - (0.55 - det) * 3 + shade + f2 * 1.6), 8)];
      else if (land > 0.52) {
        // mottled terrain: forests, grassland and dry uplands mixed by a fine field
        const P = bDes[bx] + (det - 0.5) * 0.7 + f1 * 0.25 > 0.58 ? DESERT : LAND;
        c = P[ci(Math.round(t * 0.85 + (land - 0.56) * 6 + (det - 0.5) * 5 + f1 * 3 + f2 * 2 + (bh - 0.5) * 0.6 - 1.6), 8)];
        if (land < 0.535) c = OCEAN[ci(Math.round(t + 0.4), 8)];
        // towns twinkle even on the day side, strung along the coasts
        else if (land < 0.56 && bh < 0.04) c = CITY[h2(px >> 1, py >> 1, 166) < 0.5 ? 0 : 1];
        // rivers and dark valleys
        else if (Math.abs(f1 + f2 * 0.6) < 0.02) c = OCEAN[ci(Math.round(t * 0.6), 8)];
      } else c = OCEAN[ci(Math.round(t * 0.9 - (0.52 - land) * 9 + (det - 0.5) * 1.2 + f1 * 1.4 + f2 * 0.8 - 0.6), 8)];
      if (cloud > 0.52 && cloud <= 0.6 && d < (cloud - 0.52) * 9) c = CLOUD[ci(Math.round(t - 1 + shade * 0.5), 8)];
      // the clouds' shadows on the surface below them (down and to the right)
      else if (cloud <= 0.56 && cUL > 0.62) c = land > 0.52 ? LAND[ci(Math.round(t * 0.5 - 1.2), 8)] : OCEAN[ci(Math.round(t * 0.6 - 1.6), 8)];
      // sun glint on the ocean
      if (land <= 0.52 && cloud < 0.5 && light > 0.44 && d < (light - 0.44) * 6) c = OCEAN[7];
    }
    // haze thickening toward the limb (the planet is far below)
    if (edge < 320 && d * 320 > edge + 10) c = ATMO[edge < 90 ? 3 : edge < 190 ? 2 : 1];
    return c;
  }
  // the air's glow just outside the limb
  const out = Math.sqrt(pr2) - PR;
  if (out < 40 && d * 40 > out * 1.2) return ATMO[out < 10 ? 3 : out < 22 ? 2 : 1];
  // sun glare (upper left): a white disc, a cross of rays, a dithered halo
  const sdx = X - SUNX;
  const sdy = Y - SUNY;
  if (sdx > -460 && sdx < 460 && sdy > -460 && sdy < 460) {
    const sr = Math.sqrt(sdx * sdx + sdy * sdy * 1.2);
    if (sr < 40) return sr < 26 ? 0xfef7d0 : 0xf8ca6f;
    if (sr < 460) {
      const t = 1 - sr / 460;
      if (Math.abs(sdx) < 2 && sr < 300) return t > 0.5 ? 0xfef7d0 : 0xe4a24e;
      if (Math.abs(sdy) < 1.5 && sr < 380) return t > 0.5 ? 0xfef7d0 : 0xb67a3b;
      if (d < t * t * 0.95) return t > 0.82 ? 0xf8ca6f : t > 0.68 ? 0xe4a24e : t > 0.5 ? 0xb67a3b : t > 0.32 ? 0x4a2a2a : 0x1c1020;
    }
  }
  // a distant moon, lit from the left
  const mdx = X - MOONX;
  const mdy = Y - MOONY;
  if (mdx > -MOONR && mdx < MOONR && mdy > -MOONR && mdy < MOONR) {
    const mr = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mr < MOONR) {
      const nx = mdx / MOONR;
      const ny = mdy / MOONR;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let l = (-nx * 0.7 - ny * 0.35 + nz * 0.6) * 4 + (d - 0.5);
      const cr = vnoise(mdx * 0.08, mdy * 0.08, 170);
      if (cr > 0.66) l -= 1.4;
      else if (cr > 0.6) l += 0.6;
      return MOON[ci(Math.round(l + 1), 7)];
    }
  }
  // distant spacecraft
  for (let i = 0; i < CRAFT.length; i++) {
    const [cx0, cy0, rows] = CRAFT[i];
    const ix = Math.floor(X - cx0);
    const iy = Math.floor(Y - cy0);
    if (iy < 0 || iy >= rows.length || ix < 0 || ix >= rows[0].length) continue;
    const ch = rows[iy].charCodeAt(ix) - 48;
    if (ch > 0 && ch < 9) return CRAFT_PAL[ch];
  }
  // the Milky Way: a band rising to the right across the upper sky, violet and blue dust
  // clouds cut by dark lanes, crowded with stars
  const bv = (Y + X * 0.42 + 1160) / 520;
  const dense = bv > -1 && bv < 1 ? 1 - bv * bv : 0;
  // stars in cells: 2×2 blocks survive the half-resolution copy; crosses on the brightest
  const cx = Math.floor(px / 16);
  const cy = Math.floor(py / 16);
  if (cx !== stCx || cy !== stCy) {
    stCx = cx;
    stCy = cy;
    const hs = h2(cx, cy, 182);
    stHas = hs < 0.4 + dense * 0.45;
    if (stHas) {
      stX = cx * 16 + 2 + (Math.floor(h2(cx, cy, 183) * 6) << 1);
      stY = cy * 16 + 2 + (Math.floor(h2(cx, cy, 184) * 6) << 1);
      stBig = hs < 0.038 + dense * 0.03;
      stMid = hs < 0.17 + dense * 0.14;
      stCol = STAR[3 + Math.floor(h2(cx, cy, 185) * 4)];
    }
  }
  if (stHas) {
    const ddx = px - stX;
    const ddy = py - stY;
    if (ddx >= 0 && ddx < 2 && ddy >= 0 && ddy < 2) return stBig ? 0xffffff : stMid ? stCol : STAR[2];
    const ax = Math.abs(ddx - 0.5);
    const ay = Math.abs(ddy - 0.5);
    if (stBig) {
      if ((ddy >= 0 && ddy < 2 && ax < 8) || (ddx >= 0 && ddx < 2 && ay < 7)) return ax + ay < 4.5 ? stCol : STAR[5];
      // a soft blue glow round the bright ones
      const r2 = ax * ax + ay * ay;
      if (r2 < 42 && d < (r2 < 14 ? 0.7 : 0.35)) return r2 < 14 ? STAR[2] : STAR[5];
    } else if (stMid) {
      // a small cross of light round the mid stars
      if ((ddy >= 0 && ddy < 2 && ax < 2.6) || (ddx >= 0 && ddx < 2 && ay < 2.6)) return STAR[1];
      if (ax * ax + ay * ay < 8 && d < 0.3) return STAR[0];
    }
  }
  const h = h2(px, py, 181);
  if (h < 0.0065 + dense * 0.035) return STAR[h < 0.002 + dense * 0.01 ? 2 : h < 0.004 + dense * 0.02 ? 1 : 0];
  // dust in 2×2 clusters (the 8 px grid, nearest cell)
  // bilinear between the four grid cells round the pixel (no blocky 8 px squares)
  const gx = Math.max(0, (px - 4) / 8);
  const gy = Math.max(0, (py - 4) / 8);
  const ix = Math.min(DGW - 2, Math.floor(gx));
  const iy = Math.min(DGH - 2, Math.floor(gy));
  const tx = gx - ix;
  const ty = gy - iy;
  const i00 = iy * DGW + ix;
  if (!dDone[i00]) dustCell(i00, ix, iy);
  if (!dDone[i00 + 1]) dustCell(i00 + 1, ix + 1, iy);
  if (!dDone[i00 + DGW]) dustCell(i00 + DGW, ix, iy + 1);
  if (!dDone[i00 + DGW + 1]) dustCell(i00 + DGW + 1, ix + 1, iy + 1);
  const bil = (A: Float32Array) => (A[i00] * (1 - tx) + A[i00 + 1] * tx) * (1 - ty) + (A[i00 + DGW] * (1 - tx) + A[i00 + DGW + 1] * tx) * ty;
  const vDust = bil(dDust);
  const vFine = bil(dFine);
  const vHue = bil(dHue);
  const vBase = bil(dBase);
  const dd = BAY[(((py >> 1) & 3) << 2) | ((px >> 1) & 3)];
  if (dense > 0) {
    // the clouds: brightest along the band's spine, broken up by the noise; dark lanes through it
    let m = dense * dense * (vDust * 0.6 + vFine * 1.0) - 0.68;
    if (vBase > 0.6 && Math.abs(bv + 0.15) < 0.3) m -= (vBase - 0.6) * 1.6;
    if (m > 0) {
      const purple = vHue + (vFine - 0.5) * 0.4 > 0.5;
      const ii = Math.floor(m * 11 + dd * 1.8 - 0.2);
      if (ii >= 0) return purple ? PURP[ci(ii + 1, 7)] : BLUEG[ci(ii, 7)];
    }
    // the deep blue glow the band sits in
    const g = dense * (0.35 + vDust * 0.7);
    if (g > 0.4 && dd < (g - 0.4) * 2.4) return g > 0.72 && dd < (g - 0.72) * 2.4 ? BLUEG[3] : BLUEG[g > 0.6 ? 2 : 1];
  }
  const dust = vDust * 0.4;
  if (dust > 0.3 && dd < (dust - 0.3) * 2) return vHue > 0.5 ? PURP[0] : BLUEG[0];
  return SPACE[ci(Math.floor(dense * 1.4 + vBase * 1.3 + dd * 0.9), 5)];
};

export const SPACE_FLOORS = { metal, grate, hull, deck, raised, roof, hazard, space };

// ── patches ──────────────────────────────────────────────────
const parse = (hex: string) => parseInt(hex.slice(1), 16);
const rgb = (n: number) => `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
const scale = (n: number, f: number) => {
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return (r << 16) | (g << 8) | b;
};

/** Iterate the frame pixels over a tile rectangle (with a margin), giving tile coords. */
function eachPx(P: Painter, x0: number, y0: number, w: number, d: number, m: number, f: (px: number, py: number, x: number, y: number) => void) {
  const k = P.k;
  const cs = [P.P(x0, y0), P.P(x0 + w, y0), P.P(x0 + w, y0 + d), P.P(x0, y0 + d)];
  const X0 = Math.floor(Math.min(...cs.map((q) => q[0]))) - m;
  const X1 = Math.ceil(Math.max(...cs.map((q) => q[0]))) + m;
  const Y0 = Math.floor(Math.min(...cs.map((q) => q[1]))) - m;
  const Y1 = Math.ceil(Math.max(...cs.map((q) => q[1]))) + m;
  for (let py = Y0; py < Y1; py++)
    for (let px = X0; px < X1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      f(px, py, (Y + X) / 2, (Y - X) / 2);
    }
}

/** The glowing walkway lane: anti-skid strip, light lines in its colour, chevrons toward the airlock. */
function lane(P: Painter, s: FloorPatch) {
  const c = P.c;
  const col = parse(s.color ?? '#5ee0e6');
  const glow = rgb(col);
  const pale = rgb(scale(col, 1.25));
  const dim = rgb(scale(col, 0.45));
  const long = s.w >= s.d;
  eachPx(P, s.x, s.y, s.w, s.d, 2, (px, py, x, y) => {
    const u = long ? x - s.x : y - s.y; // along
    const v = long ? y - s.y : x - s.x; // across (0 … width)
    const W = long ? s.d : s.w;
    const L = long ? s.w : s.d;
    if (u < 0 || u > L || v < 0 || v > W) return;
    let fill: string | null = null;
    const vv = v / W;
    if (vv < 0.07 || vv > 0.93) {
      // the light lines: a lit tube with a bright core every so often
      fill = fr(u * 3) < 0.5 ? glow : (vv < 0.035 || vv > 0.965) ? dim : pale;
    } else if (vv < 0.1 || vv > 0.9) {
      fill = '#121522';
    } else {
      // anti-skid rubber with grit
      const g = h2(px, py, 201);
      fill = g < 0.25 ? '#1f2333' : g > 0.92 ? '#3a4058' : '#272c3e';
      // chevrons pointing along +u (toward the airlock), every metre
      const cu = fr(u * 1 + 0.25);
      const t = cu - Math.abs(vv - 0.5) * 0.6;
      if (t > 0.3 && t < 0.42) fill = cu > 0.6 ? dim : glow;
      // floor lights at the centre line
      if (Math.abs(vv - 0.5) < 0.04 && Math.abs(fr(u * 2) - 0.5) < 0.03) fill = '#f2fbfc';
    }
    c.fillStyle = fill;
    c.fillRect(px, py, 1, 1);
  });
}

/** A hazard frame round a grate (the docking well). */
function grateFrame(P: Painter, s: FloorPatch) {
  const c = P.c;
  const m = 0.09;
  eachPx(P, s.x - m, s.y - m, s.w + 2 * m, s.d + 2 * m, 1, (px, py, x, y) => {
    const ix = x - s.x;
    const iy = y - s.y;
    const inside = ix > m && iy > m && ix < s.w - m && iy < s.d - m;
    const outside = ix < -m || iy < -m || ix > s.w + m || iy > s.d + m;
    if (inside || outside) return;
    const stripe = fr((x + y) * 3) < 0.5;
    const rim = Math.min(Math.abs(ix + m), Math.abs(iy + m), Math.abs(ix - s.w - m), Math.abs(iy - s.d - m)) < 0.018;
    c.fillStyle = rim ? '#0e1018' : stripe ? (h2(px, py, 211) < 0.05 ? '#b8862c' : '#e8a33a') : '#1c1e26';
    c.fillRect(px, py, 1, 1);
  });
}

/** Cool starlight pools on the floor in front of the observation windows (dithered). */
function starlight(P: Painter, w: WorldDef) {
  const c = P.c;
  for (const wp of w.environment.wallProps) {
    if (wp.type !== 'starwindow') continue;
    const planet = wp.variant === 'planet';
    const col = planet ? '#8ec8f0' : '#a8b4f0';
    const ne = wp.wall === 'ne';
    const [x0, y0, ww, dd] = ne ? [wp.at, 0, wp.w, 3] : [0, wp.at, 3, wp.w];
    eachPx(P, x0, y0, ww, dd, 0, (px, py, x, y) => {
      const along = ne ? x - wp.at : y - wp.at;
      const out = ne ? y : x;
      if (along < 0 || along > wp.w || out < 0.05 || out > 3) return;
      // the pool: a trapezoid of light that fades into the room, panes split by mullions
      const t = 1 - out / 3;
      const n = Math.max(1, Math.round(wp.w / 2.2));
      const pane = fr((along / wp.w) * n);
      if (pane < 0.06 || pane > 0.94) return;
      if (dith(px, py) > t * t * (planet ? 0.62 : 0.48)) return;
      c.globalAlpha = 0.14 + t * 0.08;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    });
  }
  c.globalAlpha = 1;
}

/** A padded lounge mat in a warm colour: a rolled rim, diamond quilting, a soft sheen. */
function loungeMat(P: Painter, s: FloorPatch) {
  const c = P.c;
  const col = parse(s.color ?? '#b0643a');
  const T = [scale(col, 0.42), scale(col, 0.6), scale(col, 0.78), scale(col, 0.92), col, scale(col, 1.12), scale(col, 1.26)].map(rgb);
  eachPx(P, s.x, s.y, s.w, s.d, 2, (px, py, x, y) => {
    const u = x - s.x;
    const v = y - s.y;
    const m = 0.06;
    if (u < -0.02 || v < -0.02 || u > s.w + 0.03 || v > s.d + 0.04) return;
    // its thickness: a dark lip on the lower-right edges
    if (u > s.w - 0.01 || v > s.d - 0.01) {
      if (u < s.w + 0.03 && v < s.d + 0.04) {
        c.fillStyle = 'rgba(20,12,24,0.45)';
        c.fillRect(px, py, 1, 1);
      }
      return;
    }
    if (u < 0 || v < 0) return;
    const edge = Math.min(u, v, s.w - u, s.d - v);
    let i = 4;
    if (edge < m) i = edge < m * 0.4 ? 2 : u < m || v < m ? 6 : 3;
    else {
      // quilted diamonds, each puffed and lit on its upper left
      const a = (u + v) * 2.2;
      const b = (u - v) * 2.2;
      const fa = fr(a);
      const fb = fr(b);
      i = 4 + (0.5 - fa) * 1.2 + (fb - 0.5) * 0.8;
      if (fa < 0.07 || fb < 0.07) i = 2;
      else if (Math.abs(fa - 0.5) < 0.06 && Math.abs(fb - 0.5) < 0.06) i = 2.5;
      if (h2(px, py, 221) < 0.04) i -= 0.6;
      if (edge < m * 2.2) i -= 0.6;
    }
    c.fillStyle = T[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 7)];
    c.fillRect(px, py, 1, 1);
  });
}

export function spacePatch(P: Painter, s: FloorPatch, w: WorldDef) {
  if (s === w.environment.patches[0]) starlight(P, w);
  if (s.style === 'lane') lane(P, s);
  else if (s.style === 'grate') grateFrame(P, s);
  else if (s.style === 'pad') loungeMat(P, s);
}

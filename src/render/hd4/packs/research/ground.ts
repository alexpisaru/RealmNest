// Research Hub — floors and the summit's ground at 128×64.
//   planks    wide old larch floorboards, nail rows, worn walkways, sun patches
//             from the west windows with the cross of the frames in them
//   gravel    indoors a bed of pale river pebbles; outside the gravel road
//   meadow    alpine turf: short blades, tufts, stones, drifts of gentian,
//             alpenrose, buttercup, edelweiss, bellflower and arnica
//   sand      scree: angular grey stones with lichen
//   concrete  glacier-polished granite slabs with cracks and lichen
//   paving    the lodge's terraces: big gneiss flags, moss in the joints
//   dirt      trodden footpaths with stones and roots
//   forest    larch-wood floor: needles, moss, bilberry
//   lab       old snow (névé) in the hollows
//   water     a dark alpine tarn
//   roof      beyond the summit: the far peaks against the sky at the top of
//             the frame, the cliffs, the forested slopes and the valley with
//             its lake far below at the bottom
// Rugs: a celestial rug (stars round a compass rose) and a braided rag rug.
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import { dith, h2, vnoise } from '../../../materials';
import type { Painter } from '../../../iso';
import { type Floor4, pal, rgb } from '../types';

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

// ── the summit's outline (keep in sync with src/data/worlds/research.ts) ──
/** The far brink (v = x + y) for a screen column u = x − y: beyond it, the far peaks. */
export const vFar = (u: number) => -19.5 - 0.04 * Math.abs(u - 2) + 1.6 * Math.sin(u * 0.19 + 1.3) + 0.8 * Math.sin(u * 0.53 + 0.4);
/** The front brink: beyond it, the cliffs and the valley far below. */
export const vFront = (u: number) => 43 + 0.6 * Math.max(0, u - 18) + 1.2 * Math.sin(u * 0.23 + 1) + 0.6 * Math.sin(u * 0.61 + 0.3);

// ── the larch floor ─────────────────────────────────────────
// the reference's honey larch: #7c471f #90592b #a0632e #b37a46
const LARCH = pal('#5c2e0e', '#784018', '#925022', '#a8602a', '#ba7234', '#cc8644', '#e0a05c');
const JOINT = 0x341c0c;
const SUN = pal('#c4823e', '#d6964e', '#e6ac64', '#f0c07c', '#f8d496');

/** The library's west windows (NW wall), for the sun patches on the floor: centre, half width. */
const WEST_WINDOWS: [number, number][] = [[1.75, 0.42], [3.25, 0.42], [9.75, 0.42], [11.25, 0.42]];
const NORTH_WINDOWS: [number, number][] = [[1.75, 0.42], [3.25, 0.42], [11.75, 0.42], [13.25, 0.42]];

const planks: Floor4 = (x, y, px, py, e) => {
  const bw = 0.2;
  const row = Math.floor(y / bw);
  const fy = y / bw - row;
  if (fy < 0.078) return JOINT;
  const off = h2(row, 3, 11) * 3;
  const segL = 2.1 + h2(row, 4, 12) * 1.3;
  const sx = (x + off) / segL;
  const seg = Math.floor(sx);
  const fx = (sx - seg) * segL;
  if (fx < 0.016) return JOINT;
  const id = seg * 131 + row * 7919;
  let i = 3.2 + (h2(id, 1, 13) - 0.5) * 1.8;
  // long grain streaks and the odd knot
  const g = vnoise(fx * 2.4 + (id % 53), fy * 5 + row * 0.7, 14);
  if (g > 0.68) i -= 0.9;
  else if (g < 0.2) i += 0.55;
  const kx = h2(id, 2, 15) * segL;
  if (h2(id, 5, 16) < 0.35 && Math.abs(fx - kx) < 0.035 && Math.abs(fy - 0.5) < 0.24) i -= 1.6;
  // a worn, softly lit upper edge and a shadowed lower edge on each board
  if (fy < 0.17) i += 0.6;
  else if (fy > 0.88) i -= 0.6;
  // hand-cut nails in pairs on the joists
  const jx = x % 0.8;
  if (jx < 0.012 && (Math.abs(fy - 0.32) < 0.07 || Math.abs(fy - 0.7) < 0.07)) return 0x2a1a10;
  // wax sheen in broad patches, wear in the walkways, darker against the walls
  if (e.nC > 0.6 && dith(px >> 1, py >> 1) < (e.nC - 0.6) * 3) i += 0.8;
  if (e.nA > 0.68 && dith(px, py) > 0.55) i += 0.5;
  if (h2(px, py, 17) < 0.02) i -= 1;
  if (e.near === 0) i -= 0.9;
  else if (e.near === 1 && dith(px, py) > 0.5) i -= 0.4;
  // the north windows pour a soft cool light onto the boards
  if (y < 2.6) for (const [c, hw] of NORTH_WINDOWS) if (Math.abs(x - c) < hw + 0.25) i += (1 - y / 2.6) * 0.9 * (dith(px, py) > 0.35 ? 1 : 0.5);
  // the low sun through the west windows: a bright patch with the frame's cross in it
  if (x > 0.3 && x < 1.15) {
    const yw = y + 1.476 * x;
    const zw = 25.1 * x;
    for (const [c, hw] of WEST_WINDOWS) {
      if (Math.abs(yw - c) < hw && zw > 9.8 && zw < 26.8) {
        const bar = Math.abs(yw - c) < 0.035 || Math.abs(zw - 21.8) < 0.5 || Math.abs(Math.abs(yw - c) - hw) < 0.03;
        if (bar) break;
        return SUN[ci(Math.round(i - 1 + (dith(px, py) - 0.5) * 0.6), 5)];
      }
    }
  }
  return LARCH[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── gravel: the pebble bed indoors, the road outside ───────
const PEB = pal('#6e6a66', '#8a847c', '#a49c92', '#bcb4a8', '#d2cabe', '#e6e0d6');
// the reference's cobbles: #877a65 #9b9081 #a4998b #b0a594
const COB = pal('#585044', '#6c6456', '#82786a', '#978d7e', '#a59b8c', '#b3a998', '#c8bfae');
const inRoom = (x: number, y: number) => x >= 0 && y >= 0 && x < 18 && y < 14;

const gravel: Floor4 = (x, y, px, py, e) => {
  if (inRoom(x, y)) {
    // rounded river pebbles: a Voronoi of small cells, each lit on its upper left
    const S = 13;
    const X = x * S;
    const Y = y * S;
    const ix = Math.floor(X);
    const iy = Math.floor(Y);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    let dx = 0;
    let dy = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = ix + i;
        const gy = iy + j;
        const fx = gx + 0.2 + h2(gx, gy, 21) * 0.6;
        const fy = gy + 0.2 + h2(gx, gy, 22) * 0.6;
        const d = (X - fx) * (X - fx) + (Y - fy) * (Y - fy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = gx * 7349 + gy * 1913;
          dx = X - fx;
          dy = Y - fy;
        } else if (d < f2) f2 = d;
      }
    const gap = Math.sqrt(f2) - Math.sqrt(f1);
    if (gap < 0.12) return 0x4a443e;
    let i = 2.6 + (h2(id, 3, 23) - 0.5) * 2;
    i += (-dx - dy * 1.2) * 1.6;
    if (gap < 0.22) i -= 0.7;
    if (e.near === 0) i -= 0.8;
    return PEB[ci(Math.round(i + (dith(px, py) - 0.5) * 0.4), 6)];
  }
  // outside: the forecourt and the road, grey cobbles lit on their upper left, gritty joints, moss
  const [gap, id, dx, dy] = voronoi(x * 4.4, y * 4.4, 31);
  if (gap < 0.075) return e.nB > 0.55 && h2(id, 7, 38) < 0.45 ? MEAD[2 + ((px + py) & 1)] : (px + py) & 3 ? 0x463e34 : 0x5a5246;
  let i = 3.1 + (h2(id, 2, 32) - 0.5) * 2.2;
  if (gap < 0.17) i += dx + dy < 0 ? 1 : -1;
  if (h2(px, py, 35) < 0.05) i -= 1;
  if (h2(id, 4, 36) < 0.05) i -= 1.2;
  if (e.nA > 0.68 && dith(px, py) > 0.5) i += 0.5;
  if (e.near === 0 && e.og) {
    i -= 0.8;
    if (h2(px, py >> 1, 39) < 0.2) return MEAD[3];
  }
  return COB[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── the alpine meadow ───────────────────────────────────────
const MEAD = pal('#1e2a0e', '#323f18', '#4a5a24', '#64742e', '#7c8c3a', '#98a64e', '#b8c26c');
const MEAD_W = pal('#242c10', '#384418', '#4e5c22', '#66742c', '#7e8a38', '#98a24a', '#b4ba66');
const MEAD_C = pal('#162810', '#263c18', '#3a5622', '#50702c', '#668838', '#80a04a', '#a0b866');
const SOILC = pal('#4a3624', '#5e452e', '#725638', '#866844');
const DRY = pal('#46501e', '#586424', '#6c782c', '#828c34', '#9aa03e', '#b2b44c', '#c8c660');
const STONE = pal('#4c4a48', '#62605c', '#7c7974', '#97938c', '#b0aca4', '#c8c4ba');
/** Drift species: petal colour, centre colour. */
const SPECIES: [number, number][] = [
  [rgb('#3050c8'), rgb('#1e2e8a')], // gentian
  [rgb('#d0406a'), rgb('#f07a9a')], // alpenrose
  [rgb('#f0c830'), rgb('#fff0a0')], // buttercup
  [rgb('#f2eee2'), rgb('#e8c860')], // edelweiss
  [rgb('#8a6ad0'), rgb('#b8a0f0')], // bellflower
  [rgb('#f09a28'), rgb('#ffd060')], // arnica
];

/** Where the blooms of a little cluster sit. */
const FLX = [0, 3, 1, 5, 3];
const FLY = [1, 0, 3, 2, 4];

/** A grass clump's rows: first and last pixel, tone offset (tips, crown, body, root, shadow). */
const CLUMP0 = [0, -1, -2, -3, -1];
const CLUMP1 = [1, 2, 3, 3, 4];
const CLUMPT = [3, 2, 0.8, -1.4, -3.2];

/** Single flowers scattered through the turf. */
const SCATTER = [0xf6f4ec, 0xf6f4ec, 0xfdfdf6, 0xe27aa2, 0xf08ab8, 0xb27ada, 0xc89af0, 0xf2d240, 0xffe066, 0xd84a5c, 0x7c90ea];

/** Fraction bits of a hash, as independent-looking sub-values (one hash per mark cell). */
const sub = (h: number, k: number) => (h * k) % 1;

function meadowCore(x: number, y: number, px: number, py: number, nA: number, nB: number, nC: number, near: number, og: boolean): number {
  const P = nC > 0.7 ? MEAD_W : nC < 0.34 ? MEAD_C : MEAD;
  const dz = dith(px, py) - 0.5;
  let i = 3.2 + (nA - 0.5) * 1.2 + dz * 0.9;
  // lush dark hollows and sunny yellow-green swells
  if (nB < 0.3) i -= (0.3 - nB) * 4;
  if (nA > 0.7) i += (nA - 0.7) * 4;
  // hummocks: the turf heaves in little mounds, lit on their upper-left slopes (facing −x), shaded behind
  // (the sun of the pack: +y faces lit, +x faces in shade)
  const hm = (qx: number, qy: number) => fn(qx * 1.25, qy * 1.25, 701) * 0.62 + fn(qx * 3.1, qy * 3.1, 702) * 0.38;
  const grad = (hm(x + 0.07, y) - hm(x - 0.07, y)) * 0.42 - (hm(x, y + 0.07) - hm(x, y - 0.07)) * 0.62;
  const sh = grad * 22;
  i += sh < -1.7 ? -1.7 : sh > 1.9 ? 1.9 : sh;
  const dry = nB < 0.07;
  // stones poking through the thin turf
  const sx = (px / 17) | 0;
  const sy = (py / 11) | 0;
  const hs = h2(sx, sy, 41);
  if (hs < (dry ? 0.3 : 0.06)) {
    const cx = sx * 17 + 3 + ((sub(hs, 97.3) * 9) | 0);
    const cy = sy * 11 + 3 + ((sub(hs, 131.7) * 5) | 0);
    const rx = 2 + sub(hs, 57.1) * 3.5;
    const ry = 1.4 + sub(hs, 71.9) * 1.4;
    const ddx = (px - cx) / rx;
    const ddy = (py - cy) / ry;
    if (ddx * ddx + ddy * ddy < 1) return STONE[ci(Math.round(3.4 - ddx * 0.6 - ddy * 1.6 + (((px * 7 + py * 13) & 15) < 2 ? -1 : 0)), 6)];
    const ex = (px - cx - 1.5) / rx;
    const ey = (py - cy - 1) / ry;
    if (ex * ex + ey * ey < 1) i -= 2;
  }
  // flowers in drifts of one kind: 2×2 blooms
  if (nB > 0.5 && vnoise(x * 0.45, y * 0.45, 59) > 0.4) {
    const fx = (px / 6) | 0;
    const fy = (py / 5) | 0;
    const hf = h2(fx, fy, 51);
    if (hf < (nB - 0.52) * 2.2) {
      const kind = ((vnoise(x * 0.28, y * 0.28, 52) * SPECIES.length * 1.7) | 0) % SPECIES.length;
      const [pc, cc] = SPECIES[sub(hf, 73.3) < 0.12 ? (kind + 2) % SPECIES.length : kind];
      const ox = fx * 6 + 1 + ((sub(hf, 41.9) * 3) | 0);
      const oy = fy * 5 + 1 + ((sub(hf, 29.3) * 2) | 0);
      const ddx = px - ox;
      const ddy = py - oy;
      if (ddx >= 0 && ddx <= 1 && ddy >= 0 && ddy <= 1) return ddx + ddy === 0 ? cc : pc;
      if ((ddx === 2 && ddy >= 1 && ddy <= 2) || (ddy === 2 && ddx === 1)) return P[1];
    }
  }
  // little clusters of flowers dotted all over the turf: daisies, clover, bellflowers, buttercups
  const sx2 = (px / 14) | 0;
  const sy2 = (py / 9) | 0;
  const hs2 = h2(sx2, sy2, 57);
  if (hs2 < 0.34 + nB * 0.4) {
    const ox = sx2 * 14 + 1 + ((sub(hs2, 23.1) * 6) | 0);
    const oy = sy2 * 9 + 1 + ((sub(hs2, 41.3) * 3) | 0);
    const ddx = px - ox;
    const ddy = py - oy;
    if (ddx >= 0 && ddx < 8 && ddy >= 0 && ddy < 6) {
      const c = SCATTER[(sub(hs2, 13.7) * SCATTER.length) | 0];
      for (let q = 0; q < 5; q++) {
        const fx = FLX[q] + ((sub(hs2, 3.1 + q) * 2) | 0);
        const fy = FLY[q];
        const ex = ddx - fx;
        const ey = ddy - fy;
        if (ex >= 0 && ex <= 1 && ey >= 0 && ey <= 1) return ex + ey === 2 ? mixc(c, 0x203010, 0.3) : c;
        if (ex === 2 && ey === 1) return P[0];
      }
    }
  }
  // clumps of grass: a lit crown over a dark root and its shadow, in a loose grid
  const cx = (px / 10) | 0;
  const cy = (py / 8) | 0;
  const hc = h2(cx, cy, 47);
  if (hc < 0.64 + nA * 0.3) {
    const ox = cx * 10 + 3 + ((sub(hc, 89.3) * 4) | 0);
    const oy = cy * 8 + 2 + ((sub(hc, 61.7) * 3) | 0);
    const ddx = px - ox;
    const ddy = py - oy;
    if (ddy >= -2 && ddy <= 2) {
      const w0 = CLUMP0[ddy + 2];
      const w1 = CLUMP1[ddy + 2];
      if (ddx >= w0 && ddx <= w1) return (dry ? DRY : P)[ci(Math.round(i + CLUMPT[ddy + 2] - (ddx === w1 && ddy < 1 ? 0.9 : 0) + (ddx === w0 && ddy < 1 ? 0.5 : 0)), 7)];
    }
  }
  // short blades everywhere: a lit blade, its shadow to the right
  const bx = px >> 2;
  const by = (py / 5) | 0;
  const r0 = h2(bx, by, 55);
  if (r0 < 0.7) {
    const rx0 = bx * 4 + (((r0 * 4.9) | 0) & 3);
    const ry0 = by * 5 + 4;
    const hgt = 2 + ((sub(r0, 53.7) * 3) | 0);
    const dy = ry0 - py;
    if (dy >= 0 && dy < hgt) {
      const lean = dy === hgt - 1 && hgt > 2 ? (r0 < 0.4 ? -1 : 1) : 0;
      if (px === rx0 + lean) i += dy === hgt - 1 ? 2 : 1;
      else if (px === rx0 + 1 && dy === 0) i -= 1.2;
    }
  }
  const g = sub(r0, 7.31 + (px & 3) * 3.17 + (py % 5) * 1.91);
  if (dry) {
    if (g < 0.05) return SOILC[ci(Math.round(i - 1), 4)];
    return DRY[ci(Math.round(i), 7)];
  }
  if (near === 0 && !og) i -= 1;
  if (g < 0.04) i -= 1.2;
  else if (g > 0.985) i += 1;
  return P[ci(Math.round(i), 7)];
}

const meadow: Floor4 = (x, y, px, py, e) => meadowCore(x, y, px, py, e.nA, e.nB, e.nC, e.other === 'roof' ? 2 : e.near, e.og);

// ── scree ───────────────────────────────────────────────────
const SCREE = pal('#3a3c40', '#50525a', '#686a70', '#828284', '#9c9a98', '#b6b2ac', '#cec8be');

function voronoi(X: number, Y: number, s: number): [number, number, number, number, number] {
  const ix = Math.floor(X);
  const iy = Math.floor(Y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  let dx = 0;
  let dy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = ix + i;
      const gy = iy + j;
      const fx = gx + 0.15 + h2(gx, gy, s) * 0.7;
      const fy = gy + 0.15 + h2(gx, gy, s + 1) * 0.7;
      const d = (X - fx) * (X - fx) + (Y - fy) * (Y - fy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = gx * 7349 + gy * 1913;
        dx = X - fx;
        dy = Y - fy;
      } else if (d < f2) f2 = d;
    }
  return [Math.sqrt(f2) - Math.sqrt(f1), id, dx, dy, f1];
}

const sand: Floor4 = (x, y, px, py, e) => {
  // angular blocks: Voronoi cells, each a flat stone with a lit facet and a dark one
  const [gap, id, dx, dy] = voronoi(x * 5.2, y * 5.2, 61);
  if (gap < 0.07) return SCREE[0];
  let i = 3 + (h2(id, 2, 62) - 0.5) * 2.2;
  // facets: a crease through each stone splits a lit and a shaded face
  const crease = dx * (h2(id, 3, 63) - 0.5) * 2 + dy;
  i += crease < 0 ? 0.9 : -0.6;
  if (gap < 0.14) i -= 0.8;
  if (h2(id, 4, 64) < 0.16 && h2(px >> 1, py >> 1, 65) < 0.3) return [0xb4a83c, 0xc8843a, 0x8e9c6a][(h2(id, 5, 66) * 3) | 0];
  if (h2(px, py, 67) < 0.05) i -= 1;
  if (e.near === 0 && e.og && dith(px, py) > 0.5) return MEAD[2 + ((px + py) & 1)];
  return SCREE[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── polished granite slabs ──────────────────────────────────
const GRAN = pal('#4a4a4c', '#5e5e60', '#747472', '#8a8986', '#a09e98', '#b6b2aa', '#cbc6bc');
const concrete: Floor4 = (x, y, px, py, e) => {
  let i = 3.2 + (vnoise(x * 0.9, y * 0.9, 71) - 0.5) * 2 + (e.nA - 0.5) * 1.2;
  // long cracks in two directions, darker, with grass in the widest
  const c1 = vnoise(x * 1.6 + y * 0.4, y * 0.9, 72);
  const c2 = vnoise(x * 0.5, y * 1.8 - x * 0.3, 73);
  if (Math.abs(c1 - 0.5) < 0.018 || Math.abs(c2 - 0.5) < 0.014) return Math.abs(c1 - 0.5) < 0.008 && e.nB > 0.5 ? MEAD[3] : GRAN[0];
  if (Math.abs(c1 - 0.5) < 0.035) i -= 0.8;
  // glacial striations and lichen blots
  if (((px + py * 2) % 9 === 0) && dith(px, py) > 0.6) i += 0.6;
  const lich = vnoise(x * 4, y * 4, 74);
  if (lich > 0.78) return [0xb4a83c, 0x9aa070, 0xc8843a][(h2((x * 4) | 0, (y * 4) | 0, 75) * 3) | 0];
  if (h2(px, py, 76) < 0.06) i -= 1;
  else if (h2(px, py, 77) > 0.96) i += 1;
  if (e.near === 0 && e.og) {
    if (dith(px, py) > 0.45) return MEAD[(px + py) & 1 ? 2 : 3];
    i -= 1;
  }
  return GRAN[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 7)];
};

// ── the terrace flags ───────────────────────────────────────
const FLAG = pal('#625c52', '#787264', '#8e887a', '#a29c8e', '#b4aea2', '#c8c2b6');
const FLAGW = pal('#665c4e', '#7c7060', '#928472', '#a69886', '#b8aa98', '#cabcaa');
const paving: Floor4 = (x, y, px, py, e) => {
  const [gap, id, dx, dy] = voronoi(x * 2.2, y * 2.2, 81);
  if (gap < 0.05) {
    if (e.nB > 0.55 || h2(id, 9, 82) < 0.35) {
      const hf = h2(px >> 1, py >> 1, 88);
      if (hf < 0.05) return [0xf2eee2, 0xe27aa2, 0xf2d240][(hf * 60) | 0];
      return MEAD[((px + py) & 1) + 2 + (hf > 0.8 ? 1 : 0)];
    }
    return 0x2e2620;
  }
  const R = h2(id, 2, 83) < 0.35 ? FLAGW : FLAG;
  let i = 2.4 + (h2(id, 3, 84) - 0.5) * 2;
  if (gap < 0.11) i += -dx - dy < 0 ? -1.1 : 1.1;
  if (h2(id, 5, 89) < 0.08 && vnoise(x * 9, y * 9, 90) > 0.6) i -= 1.2;
  if (h2(px >> 1, py >> 1, 85) < 0.05) i -= 1;
  if (e.nA > 0.7 && dith(px, py) > 0.5) i += 0.6;
  if (h2(id, 4, 86) < 0.15 && vnoise(x * 6, y * 6, 87) > 0.7) return 0xa8a050;
  if (e.near === 0) i -= 0.7;
  return R[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 6)];
};

// ── footpaths: grey stepping flags with turf in the joints ──
const dirt: Floor4 = (x, y, px, py, e) => {
  const [gap, id, dx, dy] = voronoi(x * 3, y * 3, 91);
  if (gap < 0.11) return gap < 0.05 ? MEAD[1] : MEAD[2 + ((px >> 1) & 1) + (h2(px, py, 96) < 0.2 ? 1 : 0)];
  let i = 2.8 + (h2(id, 2, 92) - 0.5) * 1.8;
  if (gap < 0.2) i += dx + dy < 0 ? 1 : -1;
  if (h2(px, py, 95) < 0.05) i -= 1;
  if (h2(id, 4, 93) < 0.12 && vnoise(x * 6, y * 6, 94) > 0.68) return 0xa8a050;
  if (e.near === 0 && e.og) i -= 0.6;
  return FLAG[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 6)];
};

// ── the spruce wood's floor: shaded turf, needle litter, bilberry ──
const NEEDLE = pal('#463e22', '#584c28', '#6a5c30', '#7e6c38', '#927e44', '#a69050');
const forest: Floor4 = (x, y, px, py, e) => {
  const cx = (px / 9) | 0;
  const cy = (py / 7) | 0;
  if (h2(cx, cy, 102) < 0.14) {
    const ddx = (px - cx * 9 - 4) / 4.2;
    const ddy = (py - cy * 7 - 3) / 2.6;
    if (ddx * ddx + ddy * ddy < 1) return h2(px, py, 103) < 0.1 ? 0x3a4a8a : ddy < -0.3 ? 0x3a6030 : 0x24401e;
  }
  if (h2(px, py, 105) < 0.035) return NEEDLE[2 + ((px & 1) as number)];
  return meadowCore(x, y, px, py, e.nA * 0.75, e.nB * 0.85, 0.2, e.near, e.og);
};

// ── old snow ────────────────────────────────────────────────
const SNOWP = pal('#7a88a4', '#98a6be', '#b4c2d6', '#ccd8e6', '#e2eaf2', '#f4f8fc');
const lab: Floor4 = (x, y, px, py, e) => {
  let i = 3.6 + (vnoise(x * 2.2, y * 2.2, 111) - 0.5) * 1.8;
  // sun cups: little shaded dimples in a loose grid
  const cx = (px / 7) | 0;
  const cy = (py / 5) | 0;
  const ox = cx * 7 + 3;
  const oy = cy * 5 + 2;
  if (h2(cx, cy, 112) < 0.6) {
    if (py === oy + 1 && Math.abs(px - ox) <= 1) i -= 1.2;
    else if (py === oy - 1 && Math.abs(px - ox) <= 1) i += 0.6;
  }
  if (e.near === 0) {
    // grimy, thin edge where it melts back, grass showing through
    if (dith(px, py) > 0.55) return e.og ? MEAD[2] : 0x6a6458;
    i -= 1.4;
  } else if (e.near === 1) i -= 0.6;
  if (h2(px, py, 113) < 0.02) return 0x8a8070;
  return SNOWP[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 6)];
};

// ── the tarn ────────────────────────────────────────────────
const TARN = pal('#16405e', '#1e4e6e', '#285e80', '#347093', '#4482a2', '#6aa2bc', '#a6cede');
const water: Floor4 = (x, y, px, py, e) => {
  if (e.near === 0) {
    // the shallows: wet stones and white water foaming round them
    const [gap, id] = voronoi(x * 7, y * 7, 121);
    if (gap < 0.1) return h2(px, py, 122) < 0.5 ? 0xf2f8fc : 0xcfe4ee;
    if (h2(id, 1, 123) < 0.4) return gap > 0.3 ? 0x9a9894 : gap > 0.2 ? 0x7a7874 : 0x4a4846;
    return (px + py) & 1 ? 0x8ac0d4 : 0xe6f2f8;
  }
  let i = 2 - e.depth * 1.6 + (e.nA - 0.5) * 0.8;
  if (e.near === 1) i += 1.2;
  // sky in the ripples: short pale dashes
  if (e.nB > 0.72 && ((px >> 2) + (py >> 1)) % 5 === 0) i = 5;
  else if (e.nB > 0.62) i += 1;
  return TARN[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 7)];
};

// ── beyond the summit ───────────────────────────────────────
// Everything past the brinks is painted in screen space (X = u·64, Y = v·32
// from the frame's origin). Above the far brink: a deep blue sky full of
// little cumulus, three ranges of jagged peaks (each split down its spurs into
// a sunlit and a shaded face, snow broken by rock ribs, blue in the shade),
// banks of fog lying in the valleys between them. Below the front brink: a
// band of grey crags capped with snow, then the frozen lake: open water with
// ice floes and pancake ice, snow fields round it with holes onto thin ice.
// fast samplers for the hot loop: a precomputed value-noise lattice (no hashing) and a sine table
const NL = 256;
const LAT = new Float32Array(NL * NL);
for (let j = 0; j < NL; j++) for (let i = 0; i < NL; i++) LAT[j * NL + i] = h2(i, j, 7777);
function fn(x: number, y: number, s: number) {
  x += s * 37.17;
  y += s * 91.31;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const i0 = xi & 255;
  const j0 = (yi & 255) * NL;
  const i1 = (i0 + 1) & 255;
  const j1 = ((yi + 1) & 255) * NL;
  const A = LAT[j0 + i0];
  const B = LAT[j0 + i1];
  const Cc = LAT[j1 + i0];
  const D = LAT[j1 + i1];
  return A + (B - A) * u + (Cc - A) * v + (A - B - Cc + D) * u * v;
}
const ST = new Float32Array(1024);
for (let i = 0; i < 1024; i++) ST[i] = Math.sin((i / 1024) * Math.PI * 2);
const sn = (x: number) => ST[((x * 162.974661) | 0) & 1023];

// the reference's sky: #3778c9 overhead to #7db5ea over the peaks
const SKY = pal('#2f70c4', '#3778c9', '#3f80cd', '#4889d2', '#5293d8', '#5d9ddd', '#69a7e2', '#75afe7', '#7db5ea');
// the peaks: blue-grey gneiss, snow white in the sun and sky-blue in the shade
const ROCK_MID = pal('#262c38', '#343b49', '#444c5c', '#565f70', '#6c7586', '#868e9e', '#a4abb8');
const ROCK_FAR = pal('#2e3848', '#3a4558', '#4a5568', '#5c677c', '#727d92', '#8c96aa', '#aab2c2');
const SNOW_L = pal('#cfdeee', '#e0ebf6', '#eef4fa', '#fafcfe');
const SNOW_S = pal('#7c99c2', '#8faad0', '#a3bcdc', '#b9cee8');
const HAZE = 0xa6c4e6;
const FOG = pal('#98aecb', '#b0c3dc', '#c6d5e8', '#d9e4f1', '#e9f0f8', '#f5f9fc', '#ffffff');

function mixc(c: number, t: number, a: number) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return (Math.round(r + (((t >> 16) & 255) - r) * a) << 16) | (Math.round(g + (((t >> 8) & 255) - g) * a) << 8) | Math.round(b + ((t & 255) - b) * a);
}

interface Peak {
  x: number;
  h: number;
  sl: number;
  sr: number;
  slant: number;
}
interface Range {
  base: number;
  peaks: Peak[];
  snow: number;
  ramp: number[];
  haze: number;
}
function makeRange(seed: number, base: number, spacing: number, hMin: number, hMax: number, s0: number, s1: number, snow: number, ramp: number[], haze: number): Range {
  const peaks: Peak[] = [];
  let x = -2900 + h2(seed, 0, 170) * spacing;
  let i = 0;
  while (x < 3200) {
    const r = h2(seed, i, 171);
    const pk = { x, h: hMin + (hMax - hMin) * Math.pow(r, 1.15), sl: s0 + (s1 - s0) * h2(seed, i, 172), sr: s0 + (s1 - s0) * h2(seed, i, 173), slant: (h2(seed, i, 174) - 0.5) * 0.7 };
    peaks.push(pk);
    // shoulders: lesser pinnacles on either ridge, so every crest is jagged
    for (const side of [-1, 1]) {
      const n = 1 + Math.floor(h2(seed, i * 7 + side, 178) * 2.2);
      for (let j = 1; j <= n; j++) {
        const f = 0.5 + 0.2 * j + h2(seed, i * 13 + j * side, 179) * 0.12;
        const hh = pk.h * (1 - 0.2 * j - h2(seed, i * 17 + j * side, 180) * 0.12);
        const dx = ((pk.h - hh) / (side < 0 ? pk.sl : pk.sr)) * (0.75 + f * 0.6);
        peaks.push({ x: x + side * dx, h: hh, sl: pk.sl * 1.25, sr: pk.sr * 1.25, slant: pk.slant * 0.5 + side * 0.15 });
      }
    }
    x += spacing * (0.55 + h2(seed, i, 175) * 0.9);
    i++;
  }
  return { base, peaks, snow, ramp, haze };
}
// front to back: the grey middle range rising out of the fog, the great snowy range, a hazy one behind
const RANGES = [
  makeRange(5, -600, 190, 160, 390, 0.85, 1.4, 330, ROCK_MID, 0.05),
  makeRange(7, -650, 270, 300, 690, 0.72, 1.2, 160, ROCK_FAR, 0.02),
  makeRange(13, -700, 250, 250, 520, 0.72, 1.1, 110, ROCK_FAR, 0.28),
];

/** Silhouette height of a range at screen X, and the peak that owns that column. */
function silhouette(r: Range, X: number): [number, number] {
  let best = -1e9;
  let bi = 0;
  for (let i = 0; i < r.peaks.length; i++) {
    const p = r.peaks[i];
    const d = X - p.x;
    const s = p.h - Math.abs(d) * (d < 0 ? p.sl : p.sr);
    if (s > best) {
      best = s;
      bi = i;
    }
  }
  return [best, bi];
}

/** The tops of the two fog banks: lumpy, with round puffs and notches between them. */
const fogTopA = (X: number) => -742 - 80 * fn(X * 0.0032, 3.1, 610) - 30 * fn(X * 0.011, 5.7, 611) - 26 * Math.abs(sn(X * 0.016 + fn(X * 0.005, 1, 612) * 5));
const fogTopB = (X: number) => -668 - 40 * fn(X * 0.004, 8.3, 613) - 22 * Math.abs(sn(X * 0.021 + 2 + fn(X * 0.006, 4, 615) * 4));

/** A ridged profile: sharp crests where the noise crosses its middle. */
const rid = (n: number) => 1 - Math.abs(2 * n - 1);

// per-column caches (indexed by the frame column; every value depends only on u = x − y):
// the brinks, each range's silhouette, owning peak and snow line, the fog tops and their slopes, the crags' height
const NC = 20;
const colU = new Float64Array(8192).fill(NaN);
const colD = new Float32Array(8192 * NC);
function column(px: number, u: number) {
  const o = (px & 8191) * NC;
  if (Math.abs(colU[px & 8191] - u) < 1e-6) return o;
  colU[px & 8191] = u;
  const X = u * 64;
  colD[o] = vFar(u) * 32;
  colD[o + 1] = vFront(u) * 32;
  for (let r = 0; r < 3; r++) {
    const [sh, bi] = silhouette(RANGES[r], X);
    // jagged crests: towers and notches along the ridgelines
    colD[o + 2 + r * 2] = sh + (rid(fn(X * 0.011, r * 5.3, 176)) - 0.55) * (64 - r * 14) + (rid(fn(X * 0.042, r * 2.9, 177)) - 0.55) * (28 - r * 6) + (fn(X * 0.16, r, 178) - 0.5) * 8;
    colD[o + 3 + r * 2] = bi;
    colD[o + 11 + r] = RANGES[r].snow + (fn(X * 0.012, r * 3.1, 188) - 0.5) * 90;
  }
  // the crags under the front brink: taller on the east, where the brink sweeps down
  colD[o + 8] = 170 + fn(X * 0.0032, 1.7, 182) * 100 + fn(X * 0.02, 2.3, 181) * 20;
  colD[o + 14] = fogTopA(X);
  colD[o + 15] = fogTopB(X);
  colD[o + 16] = fogTopA(X + 3) - fogTopA(X - 3);
  colD[o + 17] = fogTopB(X + 3) - fogTopB(X - 3);
  return o;
}

// ── the sky's cumulus: flat bases, round puffs, white in the sun, blue-grey underneath ──
interface Puff {
  x: number;
  y: number;
  r: number;
}
interface Cloud {
  x0: number;
  x1: number;
  y0: number;
  base: number;
  puffs: Puff[];
}
const CLOUDS: Cloud[] = [];
for (let i = 0; i < 120; i++) {
  const cx = -2450 + h2(i, 1, 501) * 5050;
  const base = -1500 + Math.pow(h2(i, 2, 501), 0.8) * 640;
  const s = h2(i, 3, 501);
  // half widths: many little clouds, some middling, a few big banks
  const w = s < 0.62 ? 24 + s * 120 : s < 0.9 ? 98 + (s - 0.62) * 460 : 228 + (s - 0.9) * 1500;
  const n = Math.min(10, 2 + Math.floor(w / 38));
  const puffs: Puff[] = [];
  for (let j = 0; j < n; j++) {
    const t = (j / (n - 1)) * 2 - 1;
    const off = t * w * 0.74 + (h2(i, 10 + j, 502) - 0.5) * w * 0.22;
    const r = w * (0.26 + h2(i, 30 + j, 503) * 0.24) * (1 - 0.5 * Math.abs(t));
    puffs.push({ x: cx + off, y: base - r * 0.3, r: Math.max(6, r) });
  }
  CLOUDS.push({ x0: cx - w * 1.15, x1: cx + w * 1.15, y0: base - w * 0.5 - 6, base, puffs });
}
// clouds by 128 px column bucket
const CB = new Map<number, Cloud[]>();
for (const c of CLOUDS)
  for (let b = Math.floor(c.x0 / 128); b <= Math.floor(c.x1 / 128); b++) {
    const l = CB.get(b);
    if (l) l.push(c);
    else CB.set(b, [c]);
  }

function cloudAt(X: number, Y: number, dz: number): number {
  const list = CB.get(Math.floor(X / 128));
  if (!list) return -1;
  for (const c of list) {
    if (X < c.x0 || X > c.x1 || Y > c.base || Y < c.y0) continue;
    let best = 0;
    let bp: Puff | null = null;
    for (const p of c.puffs) {
      const dx = X - p.x;
      const dy = (Y - p.y) * 2;
      const q = 1 - (dx * dx + dy * dy) / (p.r * p.r);
      if (q > best) {
        best = q;
        bp = p;
      }
    }
    if (!bp) continue;
    const nx = (X - bp.x) / bp.r;
    const ny = ((Y - bp.y) * 2) / bp.r;
    const nz = Math.sqrt(best);
    const fromBase = c.base - Y;
    if (fromBase < 2.5) return 0xa9c2e3;
    let l = -0.42 * nx - 0.72 * ny + 0.45 * nz + dz * 0.3;
    if (fromBase < 9) l -= 0.45;
    // a thin blue-grey rim along the shaded lower right
    if (best < 0.07 && nx + ny > 0.2) return 0xb6cbe8;
    return l > 0.62 ? 0xffffff : l > 0.32 ? 0xf2f7fc : l > 0.04 ? 0xdde8f5 : l > -0.26 ? 0xc6d8ee : 0xb2c8e6;
  }
  return -1;
}

/** A bank of fog seen from above: lit puffs on its top, shaded seams, greyer deeper down. */
function fogShade(X: number, Y: number, dd: number, slope: number, dz: number, deep: number) {
  let i = 5.6 - dd * deep * 1.4 - slope * 0.22 + dz * 0.8;
  if (dd < 2) i += 0.8;
  // the round sub-puffs inside the bank: lit on their upper left, a shaded seam under each
  const n = fn(X * 0.016, Y * 0.042, 614);
  const n2 = fn((X + 6) * 0.016, (Y + 6) * 0.042, 614);
  i += (n - n2) * 14;
  if (n > 0.64) i -= (n - 0.64) * 11;
  else if (n < 0.3) i += 0.5;
  return FOG[ci(Math.round(i), 7)];
}

/** The far peaks against the sky at screen (X, Y). */
function backdrop(px: number, py: number, X: number, Y: number, o: number) {
  const dz = dith(px, py) - 0.5;
  // the low fog just behind the summit, over the middle range's foot
  const fB = colD[o + 15];
  if (Y > fB) return fogShade(X, Y, Y - fB, colD[o + 17], dz, 0.035);
  for (let r = 0; r < 3; r++) {
    if (r === 1) {
      // the fog lying in the valleys between the middle range and the great range
      const fA = colD[o + 14];
      if (Y > fA) return fogShade(X, Y, Y - fA, colD[o + 16], dz, 0.022);
    }
    const R = RANGES[r];
    const h = R.base - Y;
    const S = colD[o + 2 + r * 2];
    if (h >= S) continue;
    const p = R.peaks[colD[o + 3 + r * 2] | 0];
    const top = S - h;
    const dh = Math.max(14, p.h - h);
    // the spur from the peak splits a sunlit face (left) from a shaded one
    const xd = p.x + (p.h - h) * p.slant + (sn(h * 0.11 + p.x) + sn(h * 0.047 + p.x * 0.3)) * 5;
    const mainLit = X < xd;
    // ribs fan down from the summit: each a crest with a lit flank on its left and a shaded one on its right,
    // a gully between them (q integer: a crest; q + 0.5: a gully)
    const q = ((X - p.x) / dh) * (1.5 + ((Math.abs(p.x) * 0.1055 + 0.31) % 1) * 1.5) + fn(X * 0.006, h * 0.005, 691) * 1.6 + fn(X * 0.03, h * 0.02, 697) * 0.6 + r * 1.3 + p.x * 0.01;
    const fq = q - Math.floor(q);
    const lit = mainLit ? fq > 0.26 : fq > 0.8;
    const crestD = fq < 0.5 ? fq : 1 - fq;
    const sl = colD[o + 11 + r];
    const gully = crestD > 0.38;
    const nz = fn(X * 0.008, h * 0.012, 692) * 0.72 + fn(X * 0.035, h * 0.05, 698) * 0.28;
    const hs = (h - sl) / 260;
    const sv = (hs > 0.4 ? 0.4 : hs) + (gully ? 0.3 : 0) - (crestD < 0.1 ? 0.8 : crestD < 0.2 ? 0.25 : 0) + (nz - 0.5) * 2.3 + (lit ? -0.1 : -0.42) - (top < 30 && !lit ? 0.3 : 0);
    if (top < 2 && !lit) return mixc(R.ramp[1], HAZE, R.haze);
    if (sv > 0) {
      let t = (lit ? 2.2 : 1.8) + dz * 0.9;
      if (lit && crestD < 0.16) t += 1.2;
      if (!lit && crestD < 0.12) t -= 0.9;
      if (top < 3 && lit) t += 1.5;
      if (sv < 0.08) t -= 1;
      const col = lit ? SNOW_L[ci(Math.round(t), 4)] : SNOW_S[ci(Math.round(t), 4)];
      return mixc(col, HAZE, R.haze * 0.6);
    }
    let i = (lit ? 3.6 : 1.4) + dz * 0.9;
    if (lit && crestD < 0.07) i += 1.8;
    else if (!lit && crestD < 0.06) i -= 0.8;
    // cracks down the fall line, ledges across, the rim of the ridge
    const ck = fn(q * 7.3, h * 0.045, 694);
    if (ck > 0.74) i -= 1.3;
    else if (ck < 0.2) i += 0.6;
    if (fn(X * 0.06, h * 0.12, 695) > 0.86) i -= 1;
    if (top < 3 && lit) i += 1.8;
    // snow lingering on the ledges of the rock
    if (h > sl - 200 && fn(X * 0.08, h * 0.16, 696) > 0.84) return mixc(lit ? SNOW_L[1] : SNOW_S[1], HAZE, R.haze * 0.6);
    const col = R.ramp[ci(Math.round(i), 7)];
    return mixc(col, HAZE, R.haze + Math.max(0, 1 - h / 120) * 0.2);
  }
  // the sky: deeper toward the top of the frame, full of little cumulus
  const cl = cloudAt(X, Y, dz);
  if (cl >= 0) return cl;
  const sh = Math.max(0, Math.min(1, (-Y - 760) / 720));
  return SKY[ci(Math.round(8 - sh * 8 + dz * 0.9), 9)];
}

// ── under the front brink: crags, then the frozen lake ──────
const CRAG = pal('#2a2c30', '#424448', '#5c5d60', '#767778', '#908f8e', '#a9a7a4', '#c2c0bc', '#dcdad6');
const SNOWF = pal('#7d97b2', '#93acc2', '#b2c7da', '#d1e0ef', '#e3edf8', '#f0f6fc', '#fbfdff');
const ICE = pal('#6d8eae', '#8aa7c3', '#a6bfd7', '#c3d6ea', '#d9e6f4', '#eaf2fa', '#fbfdff');
const LAKE = pal('#1c5670', '#24647c', '#2c7088', '#347c92', '#3c879b', '#4893a4', '#5ca2b0', '#80bac4', '#b8dce0');
const FIELD = pal('#4e6c64', '#5f7f76', '#6f8f84', '#7d9a92', '#8ca7a6', '#a0b4b4', '#c4d4d8');
const SHRUB = pal('#16260e', '#223814', '#304c1a', '#406222', '#52782a', '#689034');
const LICH = [0xb4a83c, 0xc8843a, 0x9aa070, 0xd0c860];

/** The last floe-top row seen in each frame column (the bake goes top to bottom), for the floes' thickness. */
const floeY = new Float32Array(8192).fill(-1e9);

/** The crags under the front brink: tall granite blocks, a lit top (often snowed) over a lit and a
 * shaded face with vertical joints, dark clefts between them. -1: not a block (the shore's snow). */
function crags(px: number, py: number, X: number, Y: number, d: number, Hc: number, dz: number): number {
  // the turf of the summit hangs over the top of the crags in tufts
  const lip = 7 + fn(X * 0.05, 1, 620) * 9;
  if (d < lip) {
    const t = d / lip;
    if (t > 0.55 && h2(px, py >> 1, 621) < (t - 0.55) * 1.6) return CRAG[1];
    return MEAD[ci(Math.round(3.4 - t * 2.6 + dz + (h2(px >> 1, py, 622) < 0.25 ? 1 : 0)), 7)];
  }
  const KX = 0.0078;
  const KY = 0.0094;
  // a little warp makes the blocks' outlines rough
  const Xw = X + (fn(X * 0.07, Y * 0.11, 642) - 0.5) * 16;
  const Yw = Y + (fn(X * 0.09, Y * 0.13, 643) - 0.5) * 12;
  const [gap, id, dx, dy] = voronoi(Xw * KX, Yw * KY, 630);
  // the bottom row of blocks stands out on the snow of the shore: ragged, block by block
  // (judged at the block's own centre, so a block is never cut by a column)
  const Xs = Xw - dx / KX;
  const siteD = Yw - dy / KY - vFront(Xs / 64) * 32;
  const HcS = 170 + fn(Xs * 0.0032, 1.7, 182) * 100;
  if (siteD > HcS - 5 + h2(id, 6, 637) * 50) return d < Hc - 30 ? CRAG[((px >> 1) + (py >> 1)) & 3 ? 1 : 2] : -1;
  const lower = Math.min(1, d / Hc);
  if (gap < 0.04) return CRAG[0];
  const kind = h2(id, 3, 633);
  // the top: a slanted cap, snowed on most blocks, dwarf pine on a few
  const topB = -0.16 + h2(id, 2, 632) * 0.12 + dx * (h2(id, 5, 639) - 0.5) * 0.5;
  if (dy < topB) {
    const edge = topB - dy < 0.05;
    if (kind < 0.38 + lower * 0.22) return edge ? SNOWF[2] : SNOWF[ci(Math.round((dx < 0 ? 5.4 : 4.4) + dz * 0.9 - (dy > topB - 0.05 ? 1 : 0)), 7)];
    if (kind > 0.86) return SHRUB[ci(Math.round((dx < 0 ? 3.8 : 2.2) + (h2((X / 4) | 0, (Y / 3) | 0, 636) - 0.5) * 2.2 + dz), 6)];
    return CRAG[ci(Math.round((edge ? 6.4 : 5.4) + dz * 0.8 + (h2(px >> 1, py >> 1, 640) < 0.2 ? -1 : 0)), 8)];
  }
  // the faces: lit on the left of the block's edge, in shade on the right, darker toward the foot
  // a rounded boulder face: lit on its upper left, falling into shade to the lower right
  const crease = (h2(id, 1, 631) - 0.5) * 0.36 + (dy - topB) * 0.2;
  let t = 4.4 - (dx - crease) * 5.5 - Math.max(0, dy - topB) * 2.2;
  if (Math.abs(dx - crease) < 0.02 && dx < crease) t += 1;
  // old snow lodged on the ledges and in the hollows of the lower blocks
  if (lower > 0.45 && fn(X * 0.03, Y * 0.06, 644) > 0.8 - lower * 0.1) return SNOWF[ci(Math.round(4.6 - (dx - crease) * 3 + dz), 7)];
  // vertical joints and a ledge across the face
  if (Math.abs(sn(dx * 15 + id * 0.71)) < 0.07) t -= 1.4;
  const ledge = Math.abs(dy - (topB + 0.18 + h2(id, 7, 641) * 0.12));
  if (ledge < 0.015) return kind < 0.5 ? SNOWF[4] : MEAD[3];
  if (ledge < 0.03) t -= 1.2;
  // clefts: deep shadow to the lower right of each block, a lit rim on its upper left
  if (gap < 0.085) t += dx + dy > 0 ? -2 : -0.6;
  const g = h2(px >> 1, py >> 1, 635);
  if (g < 0.02) return LICH[(g * 200) | 0];
  if (g > 0.86) t -= 0.9;
  else if (g > 0.78) t += 0.7;
  // tufts of grass and moss in the clefts of the upper blocks
  if (lower < 0.5 && gap < 0.11 && h2(px, py >> 1, 638) < 0.5) return MEAD[ci(Math.round(2.5 + dz * 2 + (dy < 0 ? 1 : 0)), 7)];
  return CRAG[ci(Math.round(t + dz * 0.8), 8)];
}

/** Is (X, Y) the top of an ice floe? (open-water zone only) */
function floeTop(X: number, Y: number, pf: number): [boolean, number, number, number, number] {
  const [g, id, dx, dy, f1] = voronoi(X * 0.0088, Y * 0.0178, 650);
  if (h2(id, 1, 651) < pf) {
    // rounded slabs, bigger and closer packed toward the snow
    const r = 0.32 + pf * 0.3 + h2(id, 2, 652) * 0.14 + (fn(X * 0.03, Y * 0.06, 655) - 0.5) * 0.16;
    const e = Math.min(g - 0.045, r - Math.sqrt(f1));
    if (e > 0) return [true, e, id, dx, dy];
  }
  // pancake ice: little round floes adrift in the open water
  const cx = Math.floor(X / 52);
  const cy = Math.floor(Y / 26);
  const hp = h2(cx, cy, 653);
  if (hp < 0.03 + pf * 0.12) {
    const r = 7 + sub(hp, 71.3) * 12;
    const ox = cx * 52 + 26 + (sub(hp, 37.7) - 0.5) * 16;
    const oy = cy * 26 + 13 + (sub(hp, 53.1) - 0.5) * 8;
    const ex = (X - ox) / r;
    const ey = ((Y - oy) * 2) / r;
    const q = ex * ex + ey * ey;
    if (q < 1) return [true, (1 - q) * 0.3, cx * 977 + cy, ex * 0.4, ey * 0.4];
  }
  return [false, 0, 0, 0, 0];
}

function lake(px: number, py: number, X: number, Y: number, dl: number, dz: number) {
  // the broad plan: open water in the middle, snow round it, the shore snowed in under the crags
  const wx = (X - 230) / 1300;
  const wy = (Y - 2190) / 500;
  // a pool of open water where the fall lands
  const near = Math.max(0, 1 - Math.hypot((X - STREAM_X - dl * 0.15) / 190, (dl - 40) / 150));
  const Wf0 = wx * wx + wy * wy + (fn(X * 0.0026, Y * 0.0072, 640) - 0.5) * 0.95 + (dl < 70 ? ((70 - dl) / 70) * 0.7 : 0);
  const Wf = near > 0 ? Math.min(Wf0, 1.6 - near * 1.9) : Wf0;
  // the plunge pool under the fall: open green-blue water, rings of ripples spreading from the spray
  if (near > 0.34) {
    const rr = Math.hypot((X - STREAM_X) * 0.5, dl + 6);
    let i = 3.2 + (near - 0.34) * 3 + dz * 0.5;
    if (rr % 10 < 1.6) i += 1.8;
    else if (rr % 10 < 3) i -= 0.6;
    return LAKE[ci(Math.round(i), 9)];
  }
  if (near > 0.28) return near > 0.31 ? ICE[2] : SNOWF[3];
  if (Wf < 1) {
    const pf = 0.12 + 0.88 * Math.max(0, Math.min(1, (Wf - 0.4) / 0.55));
    const [on, g, id, dx, dy] = floeTop(X, Y, pf);
    if (on) {
      floeY[px & 8191] = Y;
      // a slab of snow-covered ice: lit rim on its upper left, bluer toward its lower right, cracks
      let i = 4.4 + dz * 0.6;
      if (g < 0.06) i += dx + dy * 1.4 < 0 ? 1.2 : -1.3;
      if (dx * 0.6 + dy > 0.22) i -= 0.7;
      if (Math.abs(sn(dx * 7 - dy * 5 + id * 0.13)) < 0.035 || Math.abs(sn(dx * 4 + dy * 9 + id * 0.29)) < 0.025) i -= 1.6;
      // little sastrugi on the floes' snow
      if ((((X * 0.5 + Y) | 0) % 7) === 0 && h2(px >> 2, py, 656) < 0.4) i -= 0.8;
      if (h2(px, py, 654) < 0.03) i -= 1;
      return ICE[ci(Math.round(i), 7)];
    }
    // the floes' edges: a band of blue ice under each, then a dark waterline
    const below = Y - floeY[px & 8191];
    if (below > 0 && below <= 12) return below <= 3 ? ICE[3] : below <= 7 ? ICE[2] : below <= 10 ? ICE[1] : LAKE[0];
    // open water: ripples, sunken stones, the sky's glints
    let i = 3.4 + (fn(X * 0.009, Y * 0.026, 660) - 0.5) * 2.4 + dz * 0.6 - Math.max(0, 0.5 - Wf) * 2;
    const sv = fn(X * 0.011, Y * 0.024, 661);
    if (sv > 0.7) i -= sv > 0.76 ? 2.2 : 1.1;
    else if (sv < 0.22) i += 0.9;
    const rx = Math.floor(X / 11);
    const ry = Math.floor(Y / 5);
    const hr = h2(rx, ry, 662);
    if (hr < 0.55) {
      const sx = rx * 11 + ((sub(hr, 31.7) * 6) | 0);
      const len = 3 + ((sub(hr, 17.3) * 6) | 0);
      const yy = ry * 5 + ((sub(hr, 47.1) * 4) | 0);
      if (Math.floor(Y) === yy && X >= sx && X < sx + len) i += hr < 0.1 ? 3.6 : 1.8;
      else if (Math.floor(Y) === yy + 1 && X >= sx + 1 && X < sx + len + 1) i -= 1.2;
    }
    if (below > 12 && below < 18) i += 1;
    return LAKE[ci(Math.round(i), 9)];
  }
  // snow over the frozen shallows: wind-sculpted drifts lit from the upper left
  const hn = fn(X * 0.0055, Y * 0.013, 670) * 0.75 + fn(X * 0.019, Y * 0.046, 671) * 0.35;
  const holeT = 0.47 + Math.min(0.09, Math.max(0, Wf - 1.6) * 0.05) - Math.max(0, 1.3 - Wf) * 0.5 - (dl < 120 ? (120 - dl) / 120 : 0) * 0.3;
  if (hn < holeT) {
    // holes onto thin ice over the shallows: a patchwork of pale green-grey under the ice
    const up = fn(X * 0.0055, (Y - 5) * 0.013, 670) * 0.75 + fn(X * 0.019, (Y - 5) * 0.046, 671) * 0.35;
    // the snow's lip: a blue shadow under the upper edge, a bright rim along the lower one
    if (up >= holeT) return SNOWF[1];
    const up2 = fn(X * 0.0055, (Y - 9) * 0.013, 670) * 0.75 + fn(X * 0.019, (Y - 9) * 0.046, 671) * 0.35;
    const fx = Math.floor((X + Y * 2) / 40);
    const fy = Math.floor((Y * 2 - X) / 40);
    const ux = ((X + Y * 2) / 40) - fx;
    const uy = ((Y * 2 - X) / 40) - fy;
    if (up2 >= holeT) return SNOWF[2];
    if (ux < 0.08 || uy < 0.08) return FIELD[6];
    if (hn > holeT - 0.02) return SNOWF[5];
    let i = 0.8 + h2(fx, fy, 673) * 4 + dz * 0.8;
    if (up2 >= holeT) i -= 1.4;
    if (ux > 0.9 || uy > 0.9) i -= 1;
    return FIELD[ci(Math.round(i), 7)];
  }
  const s1 = fn(X * 0.007, Y * 0.018, 672) + fn(X * 0.024, Y * 0.06, 674) * 0.25;
  const s0 = fn(X * 0.007, (Y - 4) * 0.018, 672) + fn(X * 0.024, (Y - 4) * 0.06, 674) * 0.25;
  let i = 4.9 + (s0 - s1) * 24 + dz * 0.6;
  // the drifts' crests: thin contour steps, shaded on the lee
  const c = (s1 * 11) % 1;
  if (c < 0.06 && s0 > s1) i -= 1.4;
  else if (c < 0.12 && s0 > s1) i += 0.7;
  // sun cups: little shaded dimples with a lit lip
  const scx = Math.floor(X / 9);
  const scy = Math.floor(Y / 5);
  if (h2(scx, scy, 677) < 0.3) {
    const ox = scx * 9 + 4;
    const oy = scy * 5 + 2;
    if (Math.floor(Y) === oy + 1 && Math.abs(X - ox) < 2) i -= 1.3;
    else if (Math.floor(Y) === oy && Math.abs(X - ox) < 2) i += 0.8;
  }
  // the snow banked against the edge of the holes, the wind's little ripples
  if (hn < holeT + 0.04) i -= 1.2;
  if (h2(px >> 1, py, 675) < 0.025) i -= 1;
  // wind ripples: short lit-and-shaded dashes across the drifts
  const wr = h2((X / 9) | 0, (Y / 4) | 0, 676);
  if (wr < 0.35 && (Y | 0) % 4 === 0 && ((X | 0) % 9) < 5) i -= 0.9;
  else if (wr < 0.35 && (Y | 0) % 4 === 1 && ((X | 0) % 9) < 5) i += 0.6;
  return SNOWF[ci(Math.round(i), 7)];
}

/** Where the stream from the pond reaches the front brink (screen X = u · 64; keep in sync with STREAM in the world file). */
const STREAM_X = -16.3 * 64;
/** The stream's line over the last turf before the brink, from its last tile (12.5, 26.5): u for a v. */
/** The fall's top (the brink) and height (the crags) at its column, in screen Y units. */
const FALL_TOP = vFront(STREAM_X / 64) * 32;
const FALL_H = 170 + fn(STREAM_X * 0.0032, 1.7, 182) * 100 + fn(STREAM_X * 0.02, 2.3, 181) * 20;
/** The spray's puffs: centre (in half widths of the sheet, px below the crags' foot) and radius. */
const FALL_PUFFS: [number, number, number][] = [[-1.05, 2, 0.75], [1.05, 4, 0.7], [0, 6, 1.05], [-0.5, -4, 0.6], [0.6, -3, 0.55]];
const streamU = (v: number) => -14 - (v - 39) * 0.66;

const roof: Floor4 = (x, y, px, py, e) => {
  const u = x - y;
  const v = x + y;
  const o = column(px, u);
  const far = colD[o];
  const front = colD[o + 1];
  const X = u * 64;
  const Y = v * 32;
  if (Y < far) return backdrop(px, py, X, Y, o);
  if (Y > front) {
    const d = Y - front;
    const dz = dith(px, py) - 0.5;
    const Hc = colD[o + 8];
    // the stream falling over the crags: a smooth lip, ribbons of water with long light streaks, clean dark
    // edges against the rock, a cloud of spray at the foot over the plunge pool
    const fx = X - STREAM_X;
    // measured from the brink and the crags' foot at the fall's own column, so the sheet hangs plumb
    const dS = Y - FALL_TOP;
    const fw = 24 + Math.min(dS, FALL_H) * 0.035;
    const ax = fx < 0 ? -fx : fx;
    // the spray: a cluster of round puffs over the foot, lit on their upper left, blue-grey underneath
    {
      let best = 0;
      let nx = 0;
      let ny = 0;
      for (const [cx, cy, r] of FALL_PUFFS) {
        const ex = (fx - cx * fw) / (r * fw);
        const ey = (dS - FALL_H - cy) / (r * fw * 0.62);
        const q = 1 - ex * ex - ey * ey;
        if (q > best) {
          best = q;
          nx = ex;
          ny = ey;
        }
      }
      if (best > 0) return nx + ny > 0.75 ? 0xb8d2e4 : nx + ny > 0.1 ? 0xdcebf5 : 0xffffff;
    }
    if (ax < fw && dS < FALL_H + 2) {
      const e = fw - ax;
      if (e < 1.6) return 0x2e6a8c;
      if (d < 6) return d < 2 ? 0x6aaecc : e < 4 ? 0xa8d6ea : 0xffffff;
      if (d < 8) return 0x8cc4dc;
      if (e < 3.5) return 0x6aa8c8;
      const col = Math.floor((fx + 96) / 6);
      const ph = h2(col, 3, 692);
      const fc = (fx + 96) / 6 - col;
      // a long light streak down the middle of some ribbons, a darker seam between ribbons
      if (fc < 0.17) return 0x9ccbe0;
      const along = (dS * 0.6 + ph * 97) % 40;
      if (fc > 0.4 && fc < 0.75 && along < 22) return 0xffffff;
      return ph < 0.35 ? 0xc6e4f1 : ph < 0.7 ? 0xe4f2f9 : 0xb2d8ea;
    }
    if (d < Hc + 130) {
      const c = crags(px, py, X, Y, d, Hc, dz);
      if (c >= 0) return c;
    }
    return lake(px, py, X, Y, d - Hc, dz);
  }
  // the stream running on over the last turf to the brink
  if (v > 38.6 && v < 45) {
    const du = Math.abs(u - streamU(v)) * 64;
    if (du < 42) {
      if (du > 32) return h2(px >> 1, py >> 1, 125) < 0.45 ? (dith(px, py) > 0.5 ? 0x9a9894 : 0x6a6866) : 0xe6f2f8;
      const n = fn(X * 0.05, Y * 0.12 - v * 3, 126);
      return n > 0.7 ? 0xf2f8fc : n > 0.55 ? TARN[5] : TARN[ci(Math.round(3 + (dith(px, py) - 0.5)), 7)];
    }
  }
  // the summit's turf right up to the far skyline
  if (Y < far + 3) return MEAD[(px + py) & 1 ? 1 : 2];
  return meadowCore(x, y, px, py, e.nA, e.nB, e.nC, 2, false);
};

export const RESEARCH_FLOORS = { planks, gravel, meadow, sand, concrete, paving, dirt, forest, lab, water, roof };

// ── rugs and the gravel bed's edging ────────────────────────
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
};

function eachPixel(P: Painter, s: FloorPatch, pad: number, f: (x: number, y: number, px: number, py: number) => string | null) {
  const k = P.k;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - pad;
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + pad;
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - pad;
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + pad;
  const c = P.c;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const col = f((Y + X) / 2 - s.x, (Y - X) / 2 - s.y, px, py);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    }
}

/** The celestial rug: indigo wool, a border of stars, a compass rose and scattered stars. */
function celestialRug(P: Painter, s: FloorPatch) {
  const col = s.color ?? '#9b7bea';
  const base = shade(col, 0.42);
  const tones = [shade(col, 0.28), shade(col, 0.34), base, shade(col, 0.5), shade(col, 0.62), shade(col, 0.8)];
  const gold = ['#a8843a', '#c8a050', '#e2c070', '#f2dc98'];
  const inset = 0.08;
  eachPixel(P, s, 8, (x, y, px, py) => {
    const inX = x >= inset && x <= s.w - inset;
    const inY = y >= inset && y <= s.d - inset;
    if (!inX || !inY) {
      // fringes on the short ends, a 1 px thickness on the lower right edges
      const long = s.w >= s.d;
      const endX = (x < inset && x > -0.07) || (x > s.w - inset && x < s.w + 0.07);
      const endY = (y < inset && y > -0.07) || (y > s.d - inset && y < s.d + 0.07);
      if ((long ? endX && inY : endY && inX) && ((long ? Math.floor(y * 40) : Math.floor(x * 40)) & 1) === 0) return '#e8dcc4';
      if ((x > s.w - inset && x < s.w - inset + 0.02 && inY) || (y > s.d - inset && y < s.d - inset + 0.02 && inX)) return 'rgba(30,20,20,0.35)';
      return null;
    }
    const d = Math.min(x - inset, s.w - inset - x, y - inset, s.d - inset - y);
    const knot = h2(px, py >> 1, 61) < 0.16 ? -1 : h2(px >> 1, py, 62) > 0.93 ? 1 : 0;
    if (d < 0.05) return tones[0];
    if (d < 0.08) return gold[1];
    if (d < 0.3) {
      // the star border: little gold stars on a darker band
      const along = d < 0.3 ? (Math.min(x - inset, s.w - inset - x) < Math.min(y - inset, s.d - inset - y) ? y : x) : 0;
      const sp = ((along * 3.2) % 1) - 0.5;
      const sd = d - 0.19;
      if (Math.abs(sp) * 2.2 + Math.abs(sd) * 9 < 0.24 || (Math.abs(sp) < 0.03 && Math.abs(sd) < 0.07) || (Math.abs(sd) < 0.012 && Math.abs(sp) < 0.12)) return gold[2];
      return tones[1 + (knot > 0 ? 1 : 0)];
    }
    if (d < 0.33) return gold[0];
    // a small compass rose at the centre (under the table), a gold ring round it, stars in the corners
    const cx = x - s.w / 2;
    const cy = y - s.d / 2;
    const r = Math.hypot(cx, cy);
    const ang = Math.atan2(cy, cx);
    const ringR = Math.min(s.w, s.d) * 0.38;
    if (Math.abs(r - ringR) < 0.022 || Math.abs(r - ringR - 0.07) < 0.011) return gold[1];
    // little gold dots on the ring like the hours of a dial
    if (Math.abs(r - ringR - 0.035) < 0.02 && Math.abs(((ang / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.44) return gold[3];
    for (const [qx, qy] of [[0.62, 0.62], [s.w - 0.62, 0.62], [0.62, s.d - 0.62], [s.w - 0.62, s.d - 0.62]]) {
      const ddx = x - qx;
      const ddy = y - qy;
      const rr = Math.hypot(ddx, ddy);
      const aa = Math.atan2(ddy, ddx);
      if (rr < 0.16 * (0.3 + 0.7 * Math.pow(Math.abs(Math.cos(aa * 2)), 8))) return gold[2];
    }
    // scattered stars over the night field
    const hx = Math.floor(px / 7);
    const hy = Math.floor(py / 5);
    if (h2(hx, hy, 63) < 0.12 && px % 7 === 3 && py % 5 === 2) return '#f6ecc8';
    return tones[2 + knot];
  });
}

/** The braided rag rug: an oval of concentric braids in terracotta, cream and brown. */
function braidedRug(P: Painter, s: FloorPatch) {
  const col = s.color ?? '#c98a5a';
  const bands = [[0.62, col], [1, col], [1, '#e8d8b8'], [0.8, col], [1, '#6a4a34'], [1.12, col], [1, '#e8d8b8'], [0.7, col]] as const;
  const tone = bands.map(([f, c]) => [shade(c, f * 0.6), shade(c, f * 0.86), shade(c, f)]);
  eachPixel(P, s, 6, (x, y) => {
    const cx = (x - s.w / 2) / (s.w / 2);
    const cy = (y - s.d / 2) / (s.d / 2);
    // a stadium-shaped oval
    const ax = Math.max(0, Math.abs(cx) - (1 - s.d / s.w));
    const r = Math.hypot(ax / (s.d / s.w), cy);
    if (r > 0.97) {
      if (r < 1.0 && (x > s.w / 2 || y > s.d / 2)) return 'rgba(30,20,20,0.35)';
      return null;
    }
    const ring = r * 11;
    const bi = Math.floor(ring);
    const fr = ring - bi;
    const t = tone[bi % tone.length];
    // the braid: a chevron of strands along each ring
    const along = Math.atan2(cy, cx) * 30 + bi * 1.7;
    const chev = ((along + Math.abs(fr - 0.5) * 6) % 2 + 2) % 2;
    if (fr < 0.1) return t[0];
    return chev < 1 ? t[2] : t[1];
  });
}

/** The gravel bed under the glass cases: a larch edging and two stepping slates. */
function bedEdging(P: Painter, s: FloorPatch) {
  eachPixel(P, s, 2, (x, y, px, py) => {
    const d = Math.min(x, s.w - x, y, s.d - y);
    if (d < 0 || d > 0.12) {
      if (d >= 0) {
        // slate stepping stones along the front of the bed
        for (const [sx, sy] of [[1.2, s.d - 0.45], [4.2, s.d - 0.45]] as const) {
          const dx = (x - sx) / 0.32;
          const dy = (y - sy) / 0.24;
          if (dx * dx + dy * dy < 1) return dy < -0.5 ? '#6a6e74' : h2(px, py, 7) < 0.08 ? '#3a3e44' : '#52565c';
        }
      }
      return null;
    }
    if (d < 0.02) return '#3a2412';
    const g = h2(Math.floor((x + y) * 8), 3, 9) < 0.1 ? 1 : 0;
    return d > 0.09 ? '#c8945a' : g ? '#7a4e28' : '#a87442';
  });
}

export function researchPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  if (s.style === 'rug') {
    if ((s.color ?? '').toLowerCase() === '#c98a5a') braidedRug(P, s);
    else celestialRug(P, s);
  } else if (s.style === 'gravel') bedEdging(P, s);
}

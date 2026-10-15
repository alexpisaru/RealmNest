// Logistics Port — the quay wall, painted per pixel from tile coordinates
// only, so the water shader (ground) and the wall tiles that sit over the
// playable water (props) produce exactly the same pixels.
//   old harbour: granite ashlar courses under a granite coping, a green-black
//                tide zone with barnacles and weed, tyre fenders on chains,
//                recessed steel ladders, drain outlets with stains, rings.
//   terminal (x > 18.5 on the main quay): a cast concrete wall with tie-hole
//                rows and black arch fenders for the ship's berth.
import { dith } from '../../../materials';
import { fn, hh as h2 } from './fast';
import { rgb } from '../types';
import { fenderAt, LADDERS, QD, TWALL, wallAt } from './layout';
import { CONC, GRAN, RUBBER, RUST } from './palette';

const pk = (r: readonly string[]) => r.map(rgb);
const G = pk(GRAN);
const CC = pk(CONC);
const RU = pk(RUST);
const RB = pk(RUBBER);
const WET = pk(['#0e1a22', '#13222c', '#192c36', '#203642', '#2a4350', '#36525e', '#44606c']);
const YEL = pk(['#5a3e10', '#86601a', '#b08424', '#cfa232', '#e2bc4a']);
const BARN = pk(['#6a6e66', '#868a80', '#a4a79c', '#c0c2b6']);
const WEED = pk(['#1c2a14', '#26381a', '#334a20', '#425c28']);
const GLINT = rgb('#9fd0f2');
const CHAIN = pk(['#2a2a30', '#4a4a52', '#7a7a82']);

const at = (P: number[], i: number) => P[i < 0 ? 0 : i >= P.length ? P.length - 1 : Math.round(i)];
const frac = (v: number) => v - Math.floor(v);

/**
 * Colour of the quay wall at a point of its face: u along the wall (tiles),
 * z depth below the deck (0 … QD), face 1 = front (lit) / 0 = side (shaded),
 * edge = the wall's line (y of a front wall, x of a side wall), (rx, ry) pixel ids.
 */
export function wallPx(u: number, z: number, face: 0 | 1, edge: number, rx: number, ry: number): number {
  const lit = face === 1;
  const d = dith(rx, ry);
  const terminal = lit && edge === 13 && u > 18.5;
  // ── the tide zone (computed first: it tints whatever is below it)
  const zt = 6.6 + (fn(u * 2.6, 0.5, 21) - 0.5) * 1.8 + (fn(u * 9, 1.5, 22) - 0.5) * 0.6;
  const wet = z > zt;
  // ── fittings in front of the wall
  // ladders: a recess with two stiles and rungs (painted yellow, rusting in the wet)
  if (lit) {
    for (const [lx, ly] of LADDERS) {
      if (ly !== edge) continue;
      const du = u - lx;
      const ad = Math.abs(du);
      if (ad > 0.13) continue;
      if (z < 1.2) break; // the coping runs over the ladder head
      const stile = ad > 0.072 && ad < 0.1;
      const rung = ad <= 0.072 && frac((z - 1.2) / 1.5) < 0.2;
      if (stile || rung) {
        const P = wet ? RU : YEL;
        let i = wet ? 2.6 : 3.2;
        if (stile && du < 0) i += 0.8;
        if (rung) i += 0.4;
        if (wet && h2(rx, ry, 9) < 0.25) i -= 1;
        return at(P, i);
      }
      // the recess behind: deep shadow, darker on its left (lit from the left, the recess wall shades)
      const base = wet ? WET : G;
      return at(base, (wet ? 1 : 1.2) + (du > 0.05 ? 0.6 : 0) - (ad > 0.1 ? 0.6 : 0));
    }
  }
  if (terminal) {
    // arch fenders every 2.5 tiles: black rubber, a lit left flank, bolted top and foot plates
    const fu = u - 18.5;
    const k = Math.round((fu - 1.25) / 2.5);
    const du = fu - (1.25 + k * 2.5);
    if (Math.abs(du) < 0.1 && z > 1.0 && z < 10.6) {
      if (z < 1.8 || z > 9.8) {
        // steel plates with bolts
        const bolt = (Math.abs(du) > 0.05 && Math.abs(du) < 0.075 && (Math.abs(z - 1.4) < 0.4 || Math.abs(z - 10.2) < 0.4));
        return bolt ? CHAIN[2] : at(pk(['#22242a', '#30333a', '#40434b', '#545860']), 2 + (du < 0 ? 1 : 0));
      }
      let i = 2.2 + (du < -0.05 ? 1.4 : du < -0.02 ? 0.7 : du > 0.06 ? -1 : 0);
      if (h2(rx, ry, 31) < 0.04) i += 1;
      return at(RB, i);
    }
    // the fender's shadow on the wall (cast to the lower right)
    if (du > 0.1 && du < 0.16 && z > 1.6 && z < 11.4) return at(wet ? WET : CC, wet ? 1 : 1.5);
  } else {
    // tyre fenders on chains (berths only: not on the breakwater and the mole's sea wall)
    const du = edge === 30 ? NaN : fenderAt(u, edge);
    if (du === du && Math.abs(du) < 0.26) {
      const cz = 6.4;
      const nx = du / 0.155;
      const nz = (z - cz) / 3.3;
      const r = Math.sqrt(nx * nx + nz * nz);
      if (r < 1) {
        if (r > 0.5) {
          // the tyre: rounded tread, lit on its upper left, a worn grey shoulder
          let i = 2 - nx * 1.1 - nz * 1.3;
          if (r > 0.92 || r < 0.56) i -= 0.9;
          if (Math.abs(r - 0.74) < 0.05) i -= 0.6;
          if (h2(rx, ry, 32) < 0.06) i += 1;
          return at(RB, i);
        }
        // the hole: the wall seen through, in the tyre's shadow
        const base = wet ? WET : G;
        return at(base, wet ? 0.6 : 1.4);
      }
      // the tyre's shadow on the wall, lower right
      const sx = (du - 0.07) / 0.155;
      const sz = (z - cz - 1.1) / 3.3;
      if (sx * sx + sz * sz < 1) {
        const base = wet ? WET : G;
        return at(base, (wet ? 1 : 2) - (lit ? 0 : 0.6));
      }
      // the chain from the coping
      if (Math.abs(du) < 0.012 && z > 1 && z < cz - 3.2) return CHAIN[Math.floor(z * 2) & 1 ? 1 : 2];
    }
  }
  // ── the coping: a granite kerb on top, its face lit, a dark line under its lip
  if (z < 1.45) {
    let i = (lit ? 4.4 : 2.6) + (h2(Math.floor((u + 0.13) * 2), 1, 401) - 0.5) * 0.8;
    if (z < 0.3) i += lit ? 1.2 : 0.6;
    if (frac((u + 0.13) * 2) < 0.03) i = 1;
    const g = h2(rx, ry, 402);
    if (g < 0.1) i -= 1;
    else if (g > 0.93) i += 1;
    return at(G, i);
  }
  if (z < 1.75) return at(G, 0.4);
  // ── the wall body
  let base: number[] = G;
  let i: number;
  if (terminal) {
    // cast concrete: panel joints every 1.5 tiles, rows of tie holes, formwork grain
    base = CC;
    i = 3 + (h2(Math.floor(u / 1.5), 2, 411) - 0.5) * 0.6;
    if (frac(u / 1.5) < 0.012) i = 0.5;
    else if (frac(u / 1.5) < 0.03) i += 0.7;
    const th = frac((u + 0.2) / 0.5);
    if ((Math.abs(z - 4.2) < 0.32 || Math.abs(z - 8.4) < 0.32) && th < 0.05) i -= 1.8;
    if (frac(z / 2.1) < 0.1) i -= 0.4;
    if (h2(rx, ry, 412) < 0.06) i -= 0.8;
  } else {
    // granite ashlar: staggered courses of long blocks, each with a lit top lip
    const zz = z - 1.75;
    const CH = 2.55;
    const row = Math.floor(zz / CH);
    const fz = zz - row * CH;
    const len = 0.5 + h2(row, 3, 403) * 0.28;
    const off = h2(row, 4, 404) * len;
    const cu = (u + off) / len;
    const col = Math.floor(cu);
    const fu = (cu - col) * len;
    if (fz < 0.3 || fu < 0.016) return at(wet ? WET : G, wet ? 0.3 : 0.6);
    i = 3.1 + (h2(col, row, 405) - 0.5) * 1.5;
    if (fz < 0.75) i += 0.8;
    if (fz > CH - 0.5) i -= 0.5;
    if (fu < 0.035) i -= 0.6;
    const g = h2(rx, ry, 406);
    if (g < 0.09) i -= 0.9;
    else if (g > 0.95) i += 0.9;
    // a few blocks weathered darker, one in a while patched with brick-red mortar
    if (h2(col, row, 407) < 0.12) i -= 0.8;
  }
  if (!lit) i -= 1.5;
  // rust streaks running down from iron fittings in the coping, fading out below
  const sc = Math.floor(u * 21);
  if (h2(sc, 9, 413) < 0.05) {
    const len = 2.5 + h2(sc, 10, 414) * 5;
    const fade = (z - 1.75) / len;
    if (fade < 1 && d > fade * 0.95) return at(RU, 3.4 - fade * 1.6 + (lit ? 0.3 : -0.8));
  }
  // drain outlets every 6.3 tiles, with a dark stain trickling down
  const dk = Math.round((u - 1.1) / 6.3);
  const ddu = u - (1.1 + dk * 6.3);
  if (Math.abs(ddu) < 0.06) {
    const er = (ddu / 0.055) ** 2 + ((z - 3.2) / 0.9) ** 2;
    if (er < 1) return er < 0.45 ? WET[0] : at(G, 0.8);
    if (z > 3.6 && Math.abs(ddu) < 0.025 + (z - 3.6) * 0.004) return at(RU, 1.5 + (h2(rx, ry, 415) < 0.3 ? 1 : 0));
  }
  // mooring rings
  const mk = Math.round((u - 2.2) / 3.7);
  const mdu = u - (2.2 + mk * 3.7);
  if (!terminal && Math.abs(mdu) < 0.05) {
    const rr = Math.sqrt((mdu / 0.04) ** 2 + ((z - 3.1) / 0.85) ** 2);
    if (rr < 1 && rr > 0.55) return CHAIN[rr < 0.75 && mdu < 0 ? 2 : 1];
  }
  // the tide zone: algae, wet sheen streaks, barnacles, weed fringe at the water
  if (wet) {
    let w = 2.4 + (i - 3) * 0.35;
    if (z < zt + 0.6) w += 0.8;
    if (h2(Math.floor(rx / 2), 11, 416) < 0.22) w += 0.7; // wet streaks
    const bz = 9.4 + (fn(u * 5, 2.5, 23) - 0.5) * 1.4;
    if (z > bz) {
      const b = h2(rx, ry, 418);
      if (b < 0.2) return at(BARN, 1 + (b < 0.08 ? 1.5 : 0) + (lit ? 0.5 : -0.5));
    }
    if (z > QD - 1.1 && ((rx + (ry >> 1)) % 3 === 0 || h2(rx, 12, 419) < 0.3)) return at(WEED, 1.5 + (z > QD - 0.5 ? 1 : 0));
    if (h2(rx, ry, 420) < 0.012 && lit) return GLINT;
    if (!lit) w -= 1;
    return at(WET, w + (d - 0.5) * 0.8);
  }
  // drips above the tide line
  if (z > zt - 1.6 && h2(Math.floor(rx / 2), 13, 423) < 0.18) i -= 0.9;
  return at(base, i + (d - 0.5) * 0.6);
}

/** The wall's colour for a water point at tile (x, y), or −1 where no wall shows. */
export function wallColor(x: number, y: number): number {
  const w = wallAt(x, y, TWALL);
  if (!w) return -1;
  const z = w.t * 16;
  if (z >= QD) return -1;
  const rx = Math.round((x - y) * 64 - 0.5);
  const ry = Math.round((x + y) * 32 - 0.5);
  return wallPx(w.u, z, w.face, w.edge, rx, ry);
}

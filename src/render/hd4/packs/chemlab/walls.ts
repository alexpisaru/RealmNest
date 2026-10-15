// Chemical Lab — the back walls: hygienic wall panels in pale mint-white with
// fine seams, a teal epoxy cove at the floor, a stainless bumper rail, dado
// trunking with sockets, a teal wayfinding band, and the building services
// (cable tray and coloured pipes) running along under the cut ceiling line.
// Wall props: a high window band onto the campus, stainless chemical shelving,
// ISO safety signs, the lab door with its access reader — and the decor kinds
// lab_periodic, lab_clock, lab_beacon, lab_ppe, lab_fire, lab_drying,
// lab_exit, lab_pressure (passed to decorateWalls by the world file).
import { lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, ell, fillPoly, hash, layer, ln, noise2, px, type Ramp, rng } from '../../kit4';
import { beam, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { ANTH, BLU, bottle, coat, erlen, ghs, glassMat, GRN, LIQS, planeText, RED, sign, type SignKind, STEEL, TEAL, YEL } from './lk';

const H = 40;
const T = 0.3;

/** wall panel tones (pale mint white) */
const PANEL: Ramp = ['#98aaa5', '#b4c6c1', '#cddbd5', '#dfeae6', '#eaf3ef', '#f1f8f3', '#fafdfb'];

type Pl3 = Plane & { at: (u: number, z: number) => [number, number, number] };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl3 => (side === 'ne' ? front3(p, 0) : side3(p, 0));

/** Hygienic wall cladding: smooth sheets 1.25 tiles wide, a seam with a lit edge, faint sheen bands. */
const panelMat: Mat = (light) => (u, v, x, y) => {
  let i = light ? 4.2 : 2.9;
  const su = u % 90;
  if (su < 1) return at(PANEL, i - 1.8);
  if (su < 2) i += 0.8;
  if (noise2(u * 0.012, v * 0.02, 41) > 0.62 && bayer(x, y) > 0.6) i += 0.6;
  if (v < 26 && bayer(x, y) * 26 > v + 8) i -= 0.5;
  if (hash(x, y, 42) < 0.006) i -= 1;
  return at(PANEL, i);
};

/** The teal epoxy cove at the foot of the wall (continues the floor). */
const coveMat: Mat = (light, _w, h) => (_u, v, x, y) => {
  let i = light ? 3.4 : 2.4;
  if (v > h - 1.2) i += 1.4;
  if (v < 1.5) i -= 0.8;
  if (hash(x, y, 43) < 0.03) i += 1;
  return at(TEAL, i);
};

/** The cut top of the wall: lining, studs and mineral wool, the outer concrete leaf. */
const cutTop: FaceTex = (u, v, x, y) => {
  if (v < 1.6) return '#f4f8f6';
  if (v < 5.5) return u % 24 < 2 ? '#a8aeb2' : (Math.floor(x / 2) + y) % 3 === 0 ? '#c4a43a' : '#ddbf52';
  if (v < 12.5) return hash(x, y, 44) < 0.16 ? '#8e8a84' : '#b4b0aa';
  return '#e8e6e0';
};

function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  pt(p, pl, 0, len, 0, H, panelMat, light);
  pt(p, pl, 0, len, 0, 1.7, coveMat, light);
  // the stainless bumper rail on little brackets
  for (let u = 0.4; u < len; u += 1.25) pq(p, pl, u - 0.03, u + 0.03, 7.4, 8.8, STEEL[light ? 1 : 0]);
  pq(p, pl, 0, len, 7.6, 8.7, STEEL[light ? 3 : 2]);
  pq(p, pl, 0, len, 8.3, 8.7, STEEL[light ? 5 : 4]);
  pq(p, pl, 0, len, 7.5, 7.6, mix(PANEL[0], '#3b2a26', 0.3));
  // dado trunking with double sockets and data ports
  pq(p, pl, 0, len, 10.2, 11.8, PANEL[light ? 5 : 4]);
  pq(p, pl, 0, len, 11.5, 11.8, '#ffffff');
  pq(p, pl, 0, len, 10.1, 10.25, PANEL[1]);
  for (let u = 0.7; u < len - 0.3; u += 1.5) {
    pq(p, pl, u - 0.12, u + 0.12, 10.45, 11.55, '#fbfdfc');
    pq(p, pl, u - 0.08, u - 0.03, 10.8, 11.2, '#5a6068');
    pq(p, pl, u + 0.03, u + 0.08, 10.8, 11.2, '#5a6068');
    pq(p, pl, u + 0.2, u + 0.3, 10.55, 11.4, '#fbfdfc');
    pq(p, pl, u + 0.22, u + 0.28, 10.8, 11.2, '#3a6ab8');
  }
  // the teal wayfinding band
  pq(p, pl, 0, len, 24.4, 25.2, TEAL[light ? 4 : 3]);
  pq(p, pl, 0, len, 25.1, 25.2, TEAL[light ? 6 : 5]);
  // services under the ceiling line: a perforated cable tray, a yellow gas main, a blue water pipe, a green vacuum line
  pq(p, pl, 0, len, 38.4, 39.4, '#9aa0a4');
  pt(p, pl, 0, len, 38.5, 39.3, (u: number) => (u % 6 < 2 ? '#5a6064' : '#b8bec2'), light);
  pq(p, pl, 0, len, 39.3, 39.6, '#d0d6da');
  for (const [z, r] of [[37.2, YEL], [36.2, BLU], [35.3, GRN]] as const) {
    pq(p, pl, 0, len, z - 0.4, z + 0.4, r[light ? 3 : 2]);
    pq(p, pl, 0, len, z + 0.15, z + 0.35, r[light ? 5 : 4]);
    pq(p, pl, 0, len, z - 0.45, z - 0.35, r[0]);
  }
  for (let u = 0.9; u < len; u += 2) pq(p, pl, u - 0.04, u + 0.04, 34.6, 38.4, '#7a8084');
  // the cut top and the open end of the wall
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], cutTop, 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], cutTop, 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The wall's open end: the white façade skin, the concrete leaf, a dark plinth. */
const endCap: Mat = (light, w) => (u, v, x, y) => {
  if (v < 5) return at(['#3e3d3c', '#52504e', '#666461', '#7b7875'], light ? 2.6 : 1.6);
  if (u < 1.6) return light ? '#eef2f0' : '#cfd6d4';
  if (u > w - 2.4) return light ? '#ece8e0' : '#cdc8be';
  return hash(x, y, 45) < 0.16 ? (light ? '#9a968e' : '#7e7a74') : light ? '#bcb8b0' : '#9e9a92';
};

// ── wall props ──────────────────────────────────────────────

/** The campus seen through the high window band: sky, clouds, birch crowns, a finned building. */
const view =
  (seed: number, h: number): FaceTex =>
  (u, v, x, y) => {
    const sky = ['#7ab4dc', '#8cc0e2', '#a2cce6', '#b8d8ea', '#cfe4ee'];
    let col = sky[Math.max(0, Math.min(4, Math.floor(4.4 - (v / h) * 4.4 + (bayer(x, y) - 0.5) * 0.9)))];
    // a soft cloud
    const cl = noise2((u + seed * 40) * 0.035, v * 0.09, seed);
    if (cl > 0.7 && v > h * 0.45) col = cl > 0.8 ? '#ffffff' : '#eef4f6';
    // a white research building with vertical fins across the green
    const bx = (u + seed * 57) % 260;
    if (bx > 40 && bx < 190 && v < h * 0.42) {
      const f = (bx - 40) % 9;
      col = v > h * 0.4 ? '#c8ccc8' : f < 2 ? '#f2f2ee' : (Math.floor(v / 6) % 2 ? '#4a6a7a' : '#5a7e8e');
    }
    // birch crowns in front, white stems
    const tc = noise2((u + seed * 23) * 0.06, v * 0.08, seed + 9) + (1 - v / h) * 0.6;
    if (tc > 0.98) col = tc > 1.14 ? '#5a8a3a' : bayer(x, y) > 0.5 ? '#7aa84a' : '#6a9a42';
    if (v < h * 0.3 && (u + seed * 31) % 70 < 2.5 && tc > 0.75) col = '#e8eae4';
    return col;
  };

const windowBand: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.05;
    const u1 = k.wp.at + k.wp.w - 0.05;
    const z0 = 25.6;
    const z1 = 35.6;
    const h = (z1 - z0) * p.k;
    // reveal and frame (anthracite aluminium)
    pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 0.5, z1 + 0.4, ANTH[light ? 2 : 1]);
    pt(p, pl, u0, u1, z0, z1, view(k.seed, h), light);
    // blinds: each pane's white roller blind at its own height
    const n = Math.max(1, Math.round(k.wp.w));
    const pane = (u1 - u0) / n;
    const Rn = rng(k.seed * 13 + 7);
    for (let i = 0; i < n; i++) {
      const a = u0 + i * pane;
      const drop = Rn() < 0.35 ? 0 : 1.5 + Rn() * 5.5;
      if (drop > 0) {
        pt(p, pl, a + 0.02, a + pane - 0.02, z1 - drop, z1, (uu: number, vv: number) => at(['#c8ccc8', '#dadedb', '#e8ebe8', '#f2f4f2', '#fbfcfb'], (light ? 3 : 2) + (vv % 6 < 1 ? -1 : 0) + (uu % 23 < 1 ? -0.5 : 0)), light);
        pq(p, pl, a + 0.02, a + pane - 0.02, z1 - drop - 0.35, z1 - drop, '#9aa0a2');
        // a pull cord
        pq(p, pl, a + pane * 0.8, a + pane * 0.8 + 0.008, z1 - drop - 2, z1 - drop, '#d8dcdc');
      }
    }
    // reflections on the glass
    p.c.globalAlpha = 0.3;
    pt(p, pl, u0, u1, z0, z1, (uu: number, vv: number) => ((uu * 0.7 + vv) % 70 < 7 ? '#ffffff' : null), light);
    p.c.globalAlpha = 1;
    // mullions, the blind cassette, the sill
    for (let i = 0; i <= n; i++) beam(p, pl, u0 + i * pane, z0, u0 + i * pane, z1, 0.55, ANTH);
    pq(p, pl, u0 - 0.06, u1 + 0.06, z1, z1 + 0.6, '#eef2f0');
    pq(p, pl, u0 - 0.06, u1 + 0.06, z1 + 0.5, z1 + 0.6, '#ffffff');
    pq(p, pl, u0 - 0.1, u1 + 0.1, z0 - 0.7, z0 - 0.1, PANEL[light ? 6 : 5]);
    pq(p, pl, u0 - 0.1, u1 + 0.1, z0 - 0.9, z0 - 0.7, mix(PANEL[0], '#3b2a26', 0.35));
    // an opening vent, tilted, on the first pane
    pq(p, pl, u0 + 0.04, u0 + pane - 0.04, z1 - 2.2, z1 - 0.2, ANTH[light ? 3 : 2]);
    pt(p, pl, u0 + 0.06, u0 + pane - 0.06, z1 - 2.0, z1 - 0.4, glassMat(), light);
  },
};

/** Stainless wall shelving with lip rails, loaded with reagents. */
const chemshelf: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + k.wp.w - 0.08;
    const P3 = (u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));
    // wall standards (slotted uprights)
    for (const u of [u0 + 0.12, (u0 + u1) / 2, u1 - 0.12]) {
      pq(p, pl, u - 0.04, u + 0.04, 11.4, 27.8, STEEL[light ? 2 : 1]);
      for (let z = 12; z < 27.4; z += 1.1) pq(p, pl, u - 0.012, u + 0.012, z, z + 0.5, '#2a2e34');
    }
    const shelfZ = [12.6, 18.2, 23.8];
    shelfZ.forEach((z, si) => {
      // the shelf seen a little from above: its top band, its front lip
      const D = 0.26;
      const a = P3(u0, 0, z);
      const b = P3(u1, 0, z);
      const c = P3(u1, D, z);
      const d = P3(u0, D, z);
      fillPoly(p.c, [a, b, c, d], STEEL[light ? 5 : 4]);
      const e = P3(u0, D, z - 0.5);
      const f = P3(u1, D, z - 0.5);
      fillPoly(p.c, [d, c, f, e], STEEL[light ? 3 : 2]);
      ln(p.c, e[0], e[1], f[0], f[1], STEEL[0]);
      // brackets under it
      for (const u of [u0 + 0.12, (u0 + u1) / 2, u1 - 0.12]) {
        const q0 = P3(u, 0, z - 2);
        const q1 = P3(u, D * 0.9, z - 0.4);
        ln(p.c, q0[0], q0[1], q1[0], q1[1], STEEL[1], 2);
      }
      // bottles and boxes, then the anti-tip rail in front of them
      layer(p.c, (l) => {
        const Rn = rng(k.seed * 31 + si * 7);
        let u = u0 + 0.06;
        while (u < u1 - 0.1) {
          const [x, y] = P3(u, D * 0.6, z);
          const r = Rn();
          if (r < 0.12) {
            // a cardboard box of filters
            fillPoly(l, [[x - 2, y], [x + 12, y - 7], [x + 12, y - 17], [x - 2, y - 10]], side === 'ne' ? '#c8a878' : '#b09062');
            fillPoly(l, [[x - 2, y - 10], [x + 12, y - 17], [x + 8, y - 19], [x - 6, y - 12]], '#dcc092');
            px(l, x + 2, y - 10, '#f6f2e8', 6, 3);
            u += 0.24;
          } else if (r < 0.22) {
            erlen(l, x + 3, y, 12, LIQS[Math.floor(Rn() * LIQS.length)], 0.5);
            u += 0.12;
          } else {
            const amber = Rn() < 0.5;
            const hh = 10 + Math.floor(Rn() * 7);
            const w = hh > 14 ? 4 : 3;
            bottle(l, x + w, y, w, hh, amber ? ['#6e3810', '#86460f'][Math.floor(Rn() * 2)] : Rn() < 0.5 ? '#eef2f0' : mix(LIQS[Math.floor(Rn() * LIQS.length)], '#e8f4f6', 0.35), ['#2a2a30', RED[3], BLU[3], YEL[4], '#f2f2ec'][Math.floor(Rn() * 5)], '#f6f3e8', Rn() < 0.5 ? [RED[3], YEL[4], BLU[3], GRN[3]][Math.floor(Rn() * 4)] : undefined);
            u += w * 0.026 + 0.05 + Rn() * 0.03;
          }
        }
      }, { outline: 0.5 });
      const r0 = P3(u0, D, z + 1.4);
      const r1 = P3(u1, D, z + 1.4);
      ln(p.c, r0[0], r0[1], r1[0], r1[1], STEEL[4]);
      ln(p.c, r0[0], r0[1] + 1, r1[0], r1[1] + 1, STEEL[1]);
    });
    // label tape on the shelf lips and an inventory sheet pinned beside
    planeText(p, pl, u0 + 0.1, u0 + 0.8, 11.0, 12.4, 'ORGANICS', TEAL[2]);
    pq(p, pl, u1 - 0.42, u1 - 0.12, 8.8, 12.0, '#fbfaf2');
    for (let i = 0; i < 5; i++) pq(p, pl, u1 - 0.38, u1 - 0.2 + (i % 2) * 0.04, 9.2 + i * 0.5, 9.4 + i * 0.5, '#8a90a0');
  },
};

/** ISO safety signs on an aluminium plate: mandatory PPE, a warning. */
const signArt: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    // the plate
    pq(p, pl, u0 + 0.03, u1 + 0.03, 12.2, 26.4, 'rgba(40,40,50,0.18)');
    pq(p, pl, u0, u1, 12.6, 26.8, light ? '#f2f4f2' : '#d4d8d6');
    pq(p, pl, u0, u1, 26.4, 26.8, light ? '#ffffff' : '#e6eae8');
    const sets: SignKind[][] = [
      ['goggles', 'coat', 'gloves'],
      ['corrosive', 'goggles', 'flame'],
    ];
    const set = sets[k.seed % 2];
    const w = u1 - u0;
    // one big sign at the top, two smaller below
    sign(p, pl, u0 + w * 0.2, u1 - w * 0.2, 20.8, 25.9, set[0]);
    sign(p, pl, u0 + 0.04, u0 + w / 2 - 0.02, 15.8, 20.0, set[1]);
    sign(p, pl, u0 + w / 2 + 0.02, u1 - 0.04, 15.8, 20.0, set[2]);
    planeText(p, pl, u0, u1, 13.0, 14.6, k.seed % 2 ? 'DANGER' : 'PPE ONLY', '#2a2a30');
  },
};

/** The lab door: steel frame, white leaf with a vision panel, kick plate, closer, card reader, door signs. */
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + k.wp.w - 0.08;
    pq(p, pl, u0 - 0.08, u1 + 0.08, 0, 22.8, ANTH[light ? 3 : 2]);
    pq(p, pl, u0 - 0.08, u1 + 0.08, 22.4, 22.8, ANTH[light ? 5 : 4]);
    pt(p, pl, u0, u1, 0.1, 22.2, coat(['#9aa4a4', '#b6c0be', '#cfd8d6', '#e2e8e6', '#eff4f2', '#fbfdfc']), light);
    // the vision panel with wired glass
    pq(p, pl, u0 + 0.18, u0 + 0.36, 11.2, 19.4, ANTH[2]);
    pt(p, pl, u0 + 0.2, u0 + 0.34, 11.4, 19.2, (uu: number, vv: number, x: number, y: number) => ((Math.floor(uu) + Math.floor(vv)) % 5 === 0 ? '#8aa8b0' : glassMat()(light, 10, 30)(uu, vv, x, y)), light);
    // the lever handle, the kick plate, the closer arm
    pq(p, pl, u1 - 0.2, u1 - 0.06, 10.2, 10.6, STEEL[light ? 4 : 3]);
    pq(p, pl, u1 - 0.12, u1 - 0.06, 9.6, 10.6, STEEL[light ? 5 : 4]);
    pt(p, pl, u0 + 0.02, u1 - 0.02, 0.2, 2.6, (uu: number, vv: number) => at(STEEL, (light ? 4 : 3) + (Math.abs(vv - 8) < 2 ? 1 : 0) + (uu % 31 < 1 ? -1 : 0)), light);
    pq(p, pl, u0 + 0.06, u0 + 0.5, 21.2, 21.9, ANTH[2]);
    pq(p, pl, u0 + 0.06, u0 + 0.5, 21.6, 21.9, ANTH[4]);
    // the access reader with a green lamp beside the frame
    pq(p, pl, u1 + 0.12, u1 + 0.24, 11.4, 13.6, '#2a2e34');
    pq(p, pl, u1 + 0.14, u1 + 0.22, 12.8, 13.3, '#4af07a');
    // door sign: the room number, the hazard panel with pictograms
    pq(p, pl, u0 + 0.06, u1 - 0.06, 24, 25.8, '#f4f6f4');
    planeText(p, pl, u0 + 0.06, u1 - 0.06, 24, 25.8, 'LAB 2.14', TEAL[2]);
    pq(p, pl, u0 + 0.14, u1 - 0.14, 26.4, 31.4, '#fbfaf4');
    pq(p, pl, u0 + 0.14, u1 - 0.14, 30.6, 31.4, YEL[4]);
    const [gx, gy] = pl.F(u0 + 0.3, 28.4);
    const [hx, hy] = pl.F(u1 - 0.3, 28.4);
    ghs(p.c, gx, gy, 5, 0);
    ghs(p.c, hx, hy, 5, 2);
    void k;
  },
};

// ── decor kinds for decorateWalls ───────────────────────────
/** A periodic table poster: coloured element blocks in the classic shape. */
const lab_periodic: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const z0 = 13.6;
    const z1 = 23.6;
    pq(p, pl, u0 + 0.04, u1 + 0.04, z0 - 0.5, z1 - 0.5, 'rgba(40,40,50,0.18)');
    pq(p, pl, u0 - 0.02, u1 + 0.02, z0 - 0.15, z1 + 0.15, ANTH[light ? 3 : 2]);
    const cols = ['#f2a65a', '#f6d25a', '#9ad86a', '#6ac8d8', '#7a9ae8', '#c48ae0', '#f28aa0', '#e8e4d8'];
    // 18 groups × 7 periods (+ two rows apart), drawn as a texture
    const w = (u1 - u0) * 71.6;
    const h = (z1 - z0) * p.k;
    const rtl = side === 'nw';
    pt(p, pl, u0, u1, z0, z1, (u0f: number, v: number) => {
      const u = rtl ? w - u0f : u0f;
      const gx = Math.floor((u / w) * 19.4) - 0.6;
      const gy = Math.floor(((h - v) / h) * 11.2) - 1;
      if (gy === -1) return u > w * 0.2 && u < w * 0.8 && Math.floor(u) % 3 !== 0 ? '#2a2a30' : '#fbfaf6';
      const g = Math.floor(gx);
      const row = gy;
      const inMain =
        row >= 0 &&
        row < 7 &&
        g >= 0 &&
        g < 18 &&
        (row === 0 ? g === 0 || g === 17 : row < 3 ? g < 2 || g > 11 : true);
      const inF = (row === 8 || row === 9) && g >= 2 && g < 16;
      if (!inMain && !inF) return '#fbfaf6';
      const cu = (u / w) * 19.4 - 0.6 - g;
      const cv = ((h - v) / h) * 11.2 - 1 - row;
      if (cu < 0.14 || cv < 0.14) return '#fbfaf6';
      const ci = inF ? 6 : g < 2 ? (g === 0 ? 0 : 1) : g < 12 ? 3 + (g % 2) : g < 16 ? 2 : g === 16 ? 5 : 4;
      return cols[(ci + (row === 0 && g === 17 ? 3 : 0)) % cols.length];
    }, light);
  },
};

/** A big digital clock with red LED digits (the time ticks live). */
const lab_clock: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    pq(p, pl, u0 + 0.04, u1 + 0.04, 27.6, 32.2, 'rgba(40,40,50,0.2)');
    pq(p, pl, u0, u1, 28, 32.6, ANTH[light ? 2 : 1]);
    pq(p, pl, u0 + 0.05, u1 - 0.05, 28.5, 32.1, '#120a0c');
    pq(p, pl, u0, u1, 32.3, 32.6, ANTH[light ? 4 : 3]);
    void k;
  },
  anim(p, side, k) {
    const pl0 = planeOf(p, side);
    const u0 = k.wp.at + 0.2;
    const u1 = k.wp.at + k.wp.w - 0.2;
    // on the NW wall u runs right to left on screen: mirror every u inside the face
    const flip = side === 'nw';
    const mu = (u: number) => (flip ? u0 + u1 - u : u);
    const pl = { ...pl0, F: (u: number, z: number) => pl0.F(mu(u), z) };
    const t = 9 * 3600 + 41 * 60 + k.t * 30;
    const hh = Math.floor(t / 3600) % 24;
    const mm = Math.floor(t / 60) % 60;
    const s = `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`;
    // seven-segment-ish digits as tiny blocks along the plane
    const seg: Record<string, number[]> = { '0': [1, 1, 1, 0, 1, 1, 1], '1': [0, 0, 1, 0, 0, 1, 0], '2': [1, 0, 1, 1, 1, 0, 1], '3': [1, 0, 1, 1, 0, 1, 1], '4': [0, 1, 1, 1, 0, 1, 0], '5': [1, 1, 0, 1, 0, 1, 1], '6': [1, 1, 0, 1, 1, 1, 1], '7': [1, 0, 1, 0, 0, 1, 0], '8': [1, 1, 1, 1, 1, 1, 1], '9': [1, 1, 1, 1, 0, 1, 1] };
    const dw = (u1 - u0) / 4.6;
    for (let i = 0; i < 4; i++) {
      const a = u0 + i * dw + (i > 1 ? dw * 0.6 : 0);
      const sg = seg[s[i]];
      const bars: [number, number, number, number][] = [
        [a + dw * 0.15, a + dw * 0.75, 31.3, 31.6],
        [a + dw * 0.08, a + dw * 0.2, 30.2, 31.4],
        [a + dw * 0.7, a + dw * 0.82, 30.2, 31.4],
        [a + dw * 0.15, a + dw * 0.75, 30.0, 30.3],
        [a + dw * 0.08, a + dw * 0.2, 28.9, 30.1],
        [a + dw * 0.7, a + dw * 0.82, 28.9, 30.1],
        [a + dw * 0.15, a + dw * 0.75, 28.8, 29.1],
      ];
      bars.forEach((b, j) => {
        if (sg[j]) pq(p, pl, b[0], b[1], b[2], b[3], '#ff4a3a');
      });
    }
    if (Math.floor(k.t * 2) % 2) {
      pq(p, pl, u0 + dw * 2, u0 + dw * 2.2, 30.6, 30.9, '#ff4a3a');
      pq(p, pl, u0 + dw * 2, u0 + dw * 2.2, 29.4, 29.7, '#ff4a3a');
    }
  },
};

/** A fire alarm sounder with a flashing beacon, high on the wall. */
const lab_beacon: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 31);
    layer(p.c, (l) => {
      ell(l, x + 2, y + 2, 9, 9, 'rgba(40,30,40,0.22)');
      ell(l, x, y, 9, 9, '#a82424');
      ell(l, x - 1, y - 1, 7, 7, '#cc3a32');
      for (let i = -4; i <= 4; i += 2) px(l, x - 4, y + i, '#8a1c1c', 8, 1);
      // the beacon dome on top
      ell(l, x, y - 11, 5, 4, '#e86a40');
      ell(l, x - 1, y - 12, 2.5, 2, '#ffc8a0');
    });
    // a smoke detector nearby, round and white
    const [sx, sy] = pl.F(k.wp.at + 0.3, 36.4);
    ell(p.c, sx, sy, 6, 3, '#e4e8e6');
    ell(p.c, sx, sy - 1, 5, 2, '#f6f8f8');
    px(p.c, sx - 1, sy - 1, '#4af07a');
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u = p.k / 4;
    const [x, y] = pl.F(k.wp.at + 0.5, 31);
    if (Math.sin(k.t * 0.7 + k.seed) > 0.985) {
      p.c.globalAlpha = 0.5;
      ell(p.c, x, y - 11 * u, 10 * u, 8 * u, '#ff9a60');
      p.c.globalAlpha = 1;
    }
  },
};

/** PPE station: lab coats on hooks, a goggles rack, glove dispensers. */
const lab_ppe: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + k.wp.w - 0.08;
    // hook rail with three coats hanging, folds in the cloth
    pq(p, pl, u0, u1, 19.6, 20.2, STEEL[light ? 3 : 2]);
    for (let i = 0; i < 2; i++) {
      const a = u0 + 0.12 + i * 0.4;
      const coatCol: Ramp = ['#6e7c80', '#8e9ca0', '#aebcc0', '#cad6d8', '#e2eaec', '#f6fafa'];
      pt(p, pl, a - 0.12, a + 0.14, 9.6, 19.8, (uu: number, vv: number) => {
        const w = 0.26 * 71.6;
        const hh = 10.2 * p.k;
        const t = vv / hh;
        const half = (w / 2) * (0.62 + (1 - t) * 0.38);
        const dx = uu - w / 2;
        if (Math.abs(dx) > half) return null;
        if (t > 0.86 && Math.abs(dx) > half * 0.5) return null;
        let tone = light ? 3.8 : 2.8;
        if (Math.abs(Math.abs(dx) - half) < 1.2) return at(coatCol, 0.6);
        if (Math.abs(dx) < 0.8) tone -= 1.6;
        if ((uu + vv * 0.15) % 7 < 1.2) tone -= 1;
        if (dx > half - 3) tone -= 1;
        if (t > 0.72 && t < 0.78 && Math.abs(dx) < half * 0.9) tone -= 0.5;
        return at(coatCol, tone);
      }, light);
      // a name badge and a pen in the breast pocket
      const [bx, by] = pl.F(a - 0.06, 16.8);
      px(p.c, bx, by, i ? '#2a5aa8' : '#c8382a', 1, 3);
      px(p.c, bx + 4, by + 3, TEAL[4], 3, 2);
    }
    // the goggles rack and glove boxes (S, M, L) on the right
    const gu = u1 - 0.24;
    pq(p, pl, gu, u1, 15.2, 18.6, '#e6eaea');
    pq(p, pl, gu, u1, 18.2, 18.6, '#ffffff');
    for (let j = 0; j < 2; j++) {
      const [gx, gy] = pl.F(gu + 0.12, 16 + j * 1.3);
      px(p.c, gx - 5, gy - 2, '#3a3e44', 4, 2);
      px(p.c, gx + 1, gy - 2, '#3a3e44', 4, 2);
      px(p.c, gx - 5, gy - 2, '#a8d8f0', 3, 1);
      px(p.c, gx + 1, gy - 2, '#a8d8f0', 3, 1);
    }
    for (let j = 0; j < 3; j++) {
      const z = 11 + j * 1.3;
      const col = ['#e8b0d8', '#7ab0f0', '#9ad88a'][j];
      pq(p, pl, gu - 0.02, u1, z, z + 1.1, col);
      pq(p, pl, gu + 0.06, u1 - 0.08, z + 0.6, z + 0.9, lighten(col, 0.4));
    }
    sign(p, pl, gu, u1, 19.4, 22.6, 'coat');
  },
};

/** Fire point: a CO₂ extinguisher on a bracket, a fire blanket, a call point, the sign. */
const lab_fire: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.42, 4);
    layer(p.c, (l) => {
      // bracket plate
      px(l, x - 3, y - 28, '#5a6068', 6, 8);
      // the CO₂ extinguisher: red body with a black band, a horn on its hose
      for (let j = 0; j < 30; j++) {
        const w = j > 26 ? 6 - (j - 26) * 1.5 : 6;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, RED[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.85 ? 3 : 2]);
        }
      }
      px(l, x - 6, y - 24, '#1e1e22', 12, 3);
      px(l, x - 2, y - 34, '#2a2a30', 4, 4);
      px(l, x - 4, y - 36, '#3a3a40', 9, 2);
      ln(l, x + 3, y - 33, x + 9, y - 22, '#1e1e22', 2);
      fillPoly(l, [[x + 7, y - 22], [x + 12, y - 22], [x + 13, y - 12], [x + 6, y - 12]], '#1e1e22');
      px(l, x - 4, y - 18, '#f4f2ea', 7, 6);
      px(l, x - 3, y - 17, '#2a2a30', 5, 1);
    }, { outline: 0.6 });
    // fire blanket pouch and the manual call point
    const u0 = k.wp.at + 0.6;
    pq(p, pl, u0, u0 + 0.3, 13.6, 18.4, RED[pl.light ? 3 : 2]);
    pq(p, pl, u0 + 0.06, u0 + 0.24, 17.4, 18.0, '#f4f2ea');
    pq(p, pl, u0 + 0.08, u0 + 0.22, 14.0, 14.4, '#f4f2ea');
    pq(p, pl, u0 + 0.02, u0 + 0.28, 11.2, 12.8, RED[3]);
    pq(p, pl, u0 + 0.08, u0 + 0.22, 11.5, 12.5, '#f4f2ea');
    sign(p, pl, k.wp.at + 0.22, k.wp.at + 0.62, 20, 23.6, 'fire');
  },
};

/** Glassware drying rack: a white pegboard with flasks upside down, a drip tray. */
const lab_drying: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    pq(p, pl, u0 + 0.03, u1 + 0.03, 12.6, 23.4, 'rgba(40,40,50,0.16)');
    pt(p, pl, u0, u1, 13, 23.8, (uu: number, vv: number) => ((Math.floor(uu) % 9 === 4 && Math.floor(vv) % 8 === 4) ? TEAL[1] : at(TEAL, light ? 3.4 : 2.6)), light);
    pq(p, pl, u0, u1, 23.4, 23.8, TEAL[light ? 5 : 4]);
    pq(p, pl, u0 - 0.02, u1 + 0.02, 12.2, 13.0, STEEL[light ? 3 : 2]);
    pq(p, pl, u0 - 0.02, u1 + 0.02, 12.8, 13.0, STEEL[5]);
    const Rn = rng(k.seed * 5 + 1);
    layer(p.c, (l) => {
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 3; i++) {
          const [x, y] = pl.F(u0 + 0.14 + i * 0.26 + (r % 2) * 0.1, 15.6 + r * 2.9);
          // a peg and a flask hanging mouth-down on it
          px(l, x, y - 6, '#c8ccd0', 1, 6);
          if (Rn() < 0.82) {
            const kind = Rn();
            if (kind < 0.5) {
              // erlenmeyer upside down
              fillPoly(l, [[x - 1, y - 7], [x + 2, y - 7], [x + 6, y + 4], [x - 5, y + 4]], '#7aa0aa');
              fillPoly(l, [[x, y - 6], [x + 1, y - 6], [x + 5, y + 3], [x - 4, y + 3]], '#dff2f6');
              px(l, x - 3, y + 1, '#ffffff', 1, 2);
              px(l, x + 3, y, '#a8c8d0', 1, 3);
            } else {
              // a beaker or a measuring cylinder
              px(l, x - 3, y - 7, '#7aa0aa', 7, 10);
              px(l, x - 2, y - 6, '#dff2f6', 5, 8);
              px(l, x - 2, y - 5, '#ffffff', 1, 5);
              px(l, x + 2, y - 4, '#a8c8d0', 1, 5);
            }
            if (Rn() < 0.4) px(l, x, y + 5, '#d8f0f8', 1, 1);
          }
        }
    }, { outline: 0.45 });
  },
};

/** The illuminated exit sign with an emergency light under it. */
const lab_exit: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.16;
    const u1 = k.wp.at + k.wp.w - 0.16;
    pq(p, pl, u0 - 0.03, u1 + 0.03, 28.6, 32.2, light ? '#e8ecea' : '#c8cecc');
    sign(p, pl, u0, u1, 28.9, 31.9, 'exit');
    // the emergency light: a white box with a lens
    pq(p, pl, u0 + 0.12, u1 - 0.12, 26.2, 27.4, '#f4f6f4');
    pq(p, pl, u0 + 0.16, u1 - 0.16, 26.4, 26.9, '#fffbe0');
    void k;
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 30.4);
    const u = p.k / 4;
    p.c.globalAlpha = 0.1 + Math.sin(k.t * 1.1 + k.seed) * 0.02;
    ell(p.c, x, y, 26 * u, 16 * u, '#9affb8');
    p.c.globalAlpha = 1;
  },
};

/** Room pressure monitor (negative pressure, green), and a thermo-hygrometer. */
const lab_pressure: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.14;
    // high on the wall, clear of anything standing in front (the safety shower's sign)
    pq(p, pl, u0 + 0.03, u0 + 0.47, 29.6, 34.2, 'rgba(40,40,50,0.18)');
    pq(p, pl, u0, u0 + 0.44, 30, 34.6, light ? '#eef2f0' : '#cfd6d4');
    pq(p, pl, u0 + 0.05, u0 + 0.39, 32, 34.1, '#10221a');
    pq(p, pl, u0 + 0.07, u0 + 0.2, 30.4, 31.4, '#3ab060');
    pq(p, pl, u0 + 0.22, u0 + 0.37, 30.4, 31.4, '#5a2020');
    // the round thermo-hygrometer
    const [x, y] = pl.F(k.wp.at + 0.76, 32.2);
    ell(p.c, x, y, 7, 7, ANTH[2]);
    ell(p.c, x, y, 5.5, 5.5, '#f6f4ec');
    ln(p.c, x, y, x + 3, y - 3, '#c8382a');
    ln(p.c, x, y, x - 3, y + 1, '#2a2a30');
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.14;
    const v = -12 + Math.round(Math.sin(k.t * 0.4 + k.seed) * 2);
    const n = Math.min(6, Math.max(1, Math.round(-v / 2.5)));
    for (let i = 0; i < n; i++) pq(p, pl, u0 + 0.08 + i * 0.05, u0 + 0.11 + i * 0.05, 32.6, 33.6, '#5ae08a');
  },
};

export const CHEMLAB_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: { window: windowBand, chemshelf, sign: signArt, door, lab_periodic, lab_clock, lab_beacon, lab_ppe, lab_fire, lab_drying, lab_exit, lab_pressure },
};


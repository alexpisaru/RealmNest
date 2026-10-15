// Data Center — the back walls of the data hall: insulated steel sandwich panels
// in cool light grey, a dark vinyl cove skirting, the hall's teal colour band, a
// galvanised conduit run, and the cut top showing the panel in section (steel
// skins round a yellow PIR core, the ribbed outer cladding).
// Wall props: the NOC status wall, wire-basket cable trays with colour-coded
// bundles and wall-mounted network gear, the secure door with its card reader,
// and the decor kinds: distribution board, fire extinguisher point, return-air
// grille, notice board with the evacuation plan, and an environment sensor with
// a CCTV dome.
import { lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { bayer, ell, fillPoly, hash, layer, ln, OUTL, px, type Ramp } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { at, charred, label, ribbed } from './kit';
import { CABLES, CLAD, GALV, LED, PANEL, RACK, RED, STEEL, YEL } from './palette';

// a 4.2 m hall, the wall 30 cm thick
const H = 42;
const T = 0.3;
/** one tile along a wall in face pixels (hypot(64, 32)) */
const TILE_U = 71.55;

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl => (side === 'ne' ? front3(p, 0) : side3(p, 0));

/** Insulated steel panels 0.5 tile wide: a dark joint and a lit lip, faint micro-ribs, brighter up toward the lights. */
const panelMat: Mat = (light, _w, h) => (u, v, x, y) => {
  const pw = TILE_U / 2;
  const pu = u % pw;
  let i = (light ? 4.0 : 2.8) + (v / h) * 0.7;
  if (pu < 1) return at(PANEL, i - 2.4);
  if (pu < 2.2) i += light ? 0.9 : 0.6;
  else if (pu > pw - 1.6) i -= 0.6;
  if (v % 5 < 1) i -= 0.35;
  if (hash(x, y, 7) < 0.02) i -= 0.6;
  // scuffs and grime low on the wall where trolleys and boots touch it
  if (v < 22 && bayer(x, y) * 22 > v + 8 && hash(Math.floor(u / 9), 1, 8) < 0.4) i -= 0.7;
  return at(PANEL, i);
};

/** Vinyl cove skirting: dark, a lit roll at its top. */
const skirt: Mat = (light, _w, h) => (_u, v, x, y) => {
  if (v > h - 1.5) return light ? '#4a525e' : '#3a414c';
  return hash(x, y, 9) < 0.04 ? '#1a1e24' : light ? '#2a3038' : '#222830';
};

/** Galvanised steel: a lit top line, a dark lower one, a sheen band. */
const galv =
  (r: Ramp = GALV): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = light ? 3.6 : 2.4;
    if (v > h - 1.2) i += 1.4;
    else if (v < 1.2) i -= 1.4;
    else if (Math.abs(v - h * 0.65) < 0.8) i += 0.8;
    if (hash(x, y, 11) < 0.03) i -= 0.7;
    return at(r, i);
  };

/**
 * The bare wall: panels, skirting, the teal band, a conduit run, a cap flashing;
 * the cut top in section. Each wall runs on through the thickness of the hall's
 * outer wall (len + T), where its end becomes part of the facade outside: the
 * hall's ribbed cladding on the north-east, the wing's charred timber on the
 * north-west.
 */
function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  const L = len + T;
  pt(p, pl, 0, L, 0, H, panelMat, light);
  // vinyl cove skirting
  pt(p, pl, 0, L, 0, 1.5, skirt, light);
  pq(p, pl, 0, L, 1.5, 1.7, mix(PANEL[0], OUTL, 0.4));
  // the hall's colour band: a teal stripe at hip height with the hall code stencilled at intervals
  pq(p, pl, 0, L, 9.2, 10.2, light ? '#2e9a86' : '#247a6c');
  pq(p, pl, 0, L, 10.2, 10.4, light ? '#5cc8b0' : '#48a894');
  for (let a = 1.6; a < len - 0.5; a += 4) {
    pq(p, pl, a, a + 0.62, 11.2, 13.4, light ? '#24303c' : '#1e2832');
    for (let i = 0; i < 4; i++) pq(p, pl, a + 0.08 + i * 0.13, a + 0.16 + i * 0.13, 11.7, 12.9, i === 0 ? '#5cc8b0' : '#d8dee6');
  }
  // a galvanised conduit run with couplers and saddles, high on the wall
  pt(p, pl, 0, L, 35.2, 36, galv(), light);
  for (let a = 0.7; a < len; a += 1.5) {
    pq(p, pl, a, a + 0.06, 34.9, 36.3, at(GALV, light ? 5 : 3));
    pq(p, pl, a + 0.06, a + 0.09, 34.9, 36.3, at(GALV, 1));
  }
  // the cap flashing along the top
  // (the reference's yellow trim along the wall head)
  pt(p, pl, 0, L, H - 1.1, H, galv(YEL), light);
  pq(p, pl, 0, L, H - 1.3, H - 1.1, mix(PANEL[1], OUTL, 0.4));
  // the cut top: the sandwich panel in section
  const section: FaceTex = (u, v) => {
    if (v < 1.6) return PANEL[5];
    if (v > 18) return at(CLAD, 3 + (u % 12 < 6 ? 0.8 : 0));
    if (v > 15.5 && u % 12 < 6) return at(CLAD, 4);
    return hash(Math.floor(u), Math.floor(v), 13) < 0.14 ? '#b4a684' : '#cbbf9c';
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [L, -T, H], [L, 0, H], [-T, 0, H]], section, 2, [[-T, 0, H], [L, 0, H], [-T, -T, H]]);
    poly3(p, [[L, 0, 0], [L, -T, 0], [L, -T, H], [L, 0, H]], facadeEnd(ribbed(CLAD, 16)), 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, L, H], [-T, L, H]], section, 2, [[0, 0, H], [0, L, H], [-T, 0, H]]);
    poly3(p, [[0, L, 0], [-T, L, 0], [-T, L, H], [0, L, H]], facadeEnd(charred), 1);
  }
}

/** The end of a wall where it meets the outside: the facade's own material over a concrete plinth. */
const facadeEnd =
  (m: Mat): Mat =>
  (light, w, h) => {
    const f = m(light, w, h);
    return (u, v, x, y) => (v < 6.4 ? at(['#5a6068', '#6a7078', '#7a8088', '#8a9098', '#9aa0a8', '#aab0b8'], light ? 3 : 1.6) : f(u, v, x, y));
  };

// ── wall props ──────────────────────────────────────────────
const ink = (p: PropPainter, pl: Plane, ua: number, za: number, ub: number, zb: number, col: string, w = 1) => {
  const [x0, y0] = pl.F(ua, za);
  const [x1, y1] = pl.F(ub, zb);
  ln(p.c, x0, y0, x1, y1, col, w);
};

/** A drop shadow behind a wall-mounted box (down and to the right of it on the wall). */
const wallShadow = (p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number) => pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(20,24,40,0.22)');

// the NOC status wall: a 3×2 grid of thin-bezel screens on a black frame
const SZ0 = 21;
const SZ1 = 34;
const statusboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    wallShadow(p, pl, u0, u1, SZ0, SZ1);
    pq(p, pl, u0 - 0.04, u1 + 0.04, SZ0 - 0.4, SZ1 + 0.4, RACK[1]);
    const cols = 3;
    const rows = 2;
    const cw = (u1 - u0) / cols;
    const rh = (SZ1 - SZ0) / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = u0 + c * cw;
        const z = SZ0 + r * rh;
        pq(p, pl, a + 0.02, a + cw - 0.02, z + 0.25, z + rh - 0.25, '#0a1018');
      }
    // a slim black shelf under the wall with a speaker bar, and the hall sign over it
    pq(p, pl, u0 + 0.2, u1 - 0.2, SZ0 - 1.5, SZ0 - 0.6, RACK[3]);
    pq(p, pl, u0 + 0.2, u1 - 0.2, SZ0 - 0.75, SZ0 - 0.6, RACK[5]);
    const sm = (u0 + u1) / 2;
    pq(p, pl, sm - 0.62, sm + 0.62, SZ1 + 1.2, SZ1 + 3.4, '#1c2630');
    pq(p, pl, sm - 0.6, sm + 0.6, SZ1 + 3.2, SZ1 + 3.4, '#3a4a58');
    // the sign: NOC in teal, the hall in white
    if (side === 'ne') {
      label(p, pl, sm - 0.5, SZ1 + 2.9, 'NOC', '#5cd8c0');
      label(p, pl, sm - 0.05, SZ1 + 2.9, 'HALL A', '#d8e0e8');
    } else {
      label(p, pl, sm + 0.55, SZ1 + 2.9, 'NOC', '#5cd8c0', -1);
      label(p, pl, sm + 0.1, SZ1 + 2.9, 'HALL A', '#d8e0e8', -1);
    }
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const cw = (u1 - u0) / 3;
    const rh = (SZ1 - SZ0) / 2;
    const t = k.t;
    const s = k.seed;
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) {
        const a0 = u0 + c * cw + 0.07;
        const a1 = u0 + (c + 1) * cw - 0.07;
        const z0 = SZ0 + r * rh + 0.6;
        const z1 = SZ0 + (r + 1) * rh - 0.6;
        const kind = (r * 3 + c + s) % 6;
        if (kind === 0) {
          // a world map: continents in dim teal, connection arcs pulsing between sites
          pq(p, pl, a0, a1, z0, z1, '#0e2230');
          const w = a1 - a0;
          for (const [cu, cz, wu, wz] of [[0.18, 0.62, 0.22, 0.24], [0.3, 0.3, 0.12, 0.28], [0.55, 0.62, 0.3, 0.2], [0.6, 0.32, 0.14, 0.22], [0.82, 0.3, 0.1, 0.14]] as const)
            pq(p, pl, a0 + w * (cu - wu / 2), a0 + w * (cu + wu / 2), z0 + (z1 - z0) * (cz - wz / 2), z0 + (z1 - z0) * (cz + wz / 2), '#1e4a56');
          const hub: [number, number] = [a0 + w * 0.56, z0 + (z1 - z0) * 0.66];
          for (const [cu, cz] of [[0.2, 0.6], [0.32, 0.3], [0.62, 0.3], [0.84, 0.28]] as const) {
            const ph = (t * 0.8 + cu * 3) % 1;
            const tu = a0 + w * cu;
            const tz = z0 + (z1 - z0) * cz;
            const mu = hub[0] + (tu - hub[0]) * ph;
            const mz = hub[1] + (tz - hub[1]) * ph + Math.sin(ph * Math.PI) * 1.2;
            ink(p, pl, hub[0], hub[1], tu, tz, '#2a6a78');
            const [qx, qy] = pl.F(mu, mz);
            px(p.c, qx - 1, qy - 1, '#8af0ff', Math.max(1, Math.round(p.k / 2)), Math.max(1, Math.round(p.k / 2)));
            const [sx, sy] = pl.F(tu, tz);
            px(p.c, sx - 1, sy - 1, '#5cf08a', Math.max(1, Math.round(p.k / 2)), Math.max(1, Math.round(p.k / 2)));
          }
        } else if (kind === 1 || kind === 4) {
          // a load graph scrolling left, a threshold line
          pq(p, pl, a0, a1, z0, z1, '#0c1820');
          let prev: [number, number] | null = null;
          for (let i = 0; i <= 14; i++) {
            const uu = a0 + ((a1 - a0) * i) / 14;
            const v = 0.45 + 0.28 * Math.sin(i * 0.9 + t * 1.6 + s) + 0.12 * Math.sin(i * 2.3 - t * 2.4);
            const q = pl.F(uu, z0 + 0.4 + v * (z1 - z0 - 0.8));
            if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], kind === 1 ? '#5cf08a' : '#4aa8ff');
            prev = q;
          }
          ink(p, pl, a0, z1 - 1.2, a1, z1 - 1.2, '#7a5a20');
        } else if (kind === 2) {
          // the rack heat map: a grid of cells, mostly cool, one warming up
          for (let i = 0; i < 8; i++)
            for (let j = 0; j < 3; j++) {
              const hot = i === (Math.floor(t * 0.3 + s) % 8) && j === 1;
              const v = Math.sin(i * 1.7 + j * 2.1 + t * 0.4) * 0.5 + 0.5;
              const col = hot ? (Math.sin(t * 6) > 0 ? '#ff5a3a' : '#c8402a') : v > 0.75 ? '#3ac0a0' : v > 0.4 ? '#2a8a9a' : '#1e5a8a';
              const ua = a0 + ((a1 - a0) * i) / 8;
              const za = z0 + ((z1 - z0) * j) / 3;
              pq(p, pl, ua + 0.01, ua + (a1 - a0) / 8 - 0.01, za + 0.15, za + (z1 - z0) / 3 - 0.15, col);
            }
        } else if (kind === 3) {
          // bars of bandwidth per uplink
          pq(p, pl, a0, a1, z0, z1, '#0c1820');
          for (let i = 0; i < 7; i++) {
            const hgt = (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.1 + i * 1.3 + s))) * (z1 - z0 - 0.6);
            const ua = a0 + 0.05 + ((a1 - a0 - 0.1) * i) / 7;
            pq(p, pl, ua, ua + (a1 - a0) / 7 - 0.04, z0 + 0.3, z0 + 0.3 + hgt, i === 5 ? '#ffb43a' : '#4aa8ff');
          }
        } else {
          // the alert list: rows of text, the top one blinking amber
          pq(p, pl, a0, a1, z0, z1, '#101418');
          for (let i = 0; i < 5; i++) {
            const z = z1 - 0.8 - i * ((z1 - z0 - 0.8) / 5);
            const blink = i === 0 && Math.sin(t * 5) > 0;
            pq(p, pl, a0 + 0.04, a0 + 0.1, z - 0.5, z, i === 0 ? (blink ? '#ffb43a' : '#6a4a1a') : '#3ac08a');
            pq(p, pl, a0 + 0.14, a1 - 0.08 - ((i * 37 + s) % 5) * 0.06, z - 0.35, z - 0.1, '#8a9aa8');
          }
        }
      }
  },
};

// wire-basket cable trays: a tray on brackets high on the wall, bundles in it,
// drops down to wall-mounted network gear spaced along the span
const TZ = 32.2;
const cabletray: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.05;
    const u1 = k.wp.at + k.wp.w - 0.05;
    const light = pl.light;
    // the things under the tray, one per tile, cables dropping into each
    for (let i = 0; i < Math.floor(k.wp.w); i++) {
      const c = k.wp.at + i + 0.5;
      const kind = (i + k.seed) % 3;
      if (kind === 0) {
        // a wall-mount network cabinet: black, glass door, a switch with a row of ports
        wallShadow(p, pl, c - 0.32, c + 0.32, 21, 27);
        pq(p, pl, c - 0.32, c + 0.32, 21, 27, RACK[light ? 3 : 2]);
        pq(p, pl, c - 0.28, c + 0.28, 21.4, 26.6, '#121c26');
        pq(p, pl, c - 0.26, c + 0.26, 24.4, 25.6, RACK[4]);
        for (let j = 0; j < 8; j++) pq(p, pl, c - 0.24 + j * 0.06, c - 0.2 + j * 0.06, 24.7, 25.2, '#0a0c10');
        pq(p, pl, c - 0.26, c + 0.26, 22.6, 23.6, '#2a3440');
        // a few patch cords looping out of the switch
        for (let j = 0; j < 4; j++) ink(p, pl, c - 0.2 + j * 0.12, 24.7, c - 0.16 + j * 0.1, 23.4, CABLES[j % 4]);
        // reflections on the glass
        ink(p, pl, c - 0.22, 22, c - 0.08, 26.2, 'rgba(200,230,255,0.25)');
        pq(p, pl, c + 0.2, c + 0.24, 23.5, 24.4, '#8a96a2');
      } else if (kind === 1) {
        // a fibre distribution box: grey, a yellow fibre loop through its gland
        wallShadow(p, pl, c - 0.28, c + 0.28, 20, 25.4);
        pq(p, pl, c - 0.28, c + 0.28, 20, 25.4, at(STEEL, light ? 4 : 3));
        pq(p, pl, c - 0.26, c + 0.26, 20.3, 25.1, at(STEEL, light ? 5 : 3.5));
        pq(p, pl, c - 0.16, c + 0.16, 24.2, 24.8, '#f2c230');
        pq(p, pl, c - 0.14, c + 0.14, 24.35, 24.65, '#2a2a30');
        // the fibre: a yellow duct dropping from the tray, a loop of slack
        pq(p, pl, c - 0.04, c + 0.04, 25.4, TZ - 0.3, '#e8b628');
        pq(p, pl, c - 0.04, c - 0.01, 25.4, TZ - 0.3, '#f8d860');
        const [lx, ly] = pl.F(c + 0.15, 22.2);
        layer(p.c, (l) => {
          for (let r = 0; r < 2; r++)
            for (let a = 0; a < 26; a++) {
              const ang = (a / 26) * Math.PI * 2;
              px(l, lx + Math.cos(ang) * (6 - r), ly + Math.sin(ang) * (4 - r * 0.6), r ? '#a8821c' : Math.sin(ang) < 0 ? '#f8d860' : '#e8b628', 2, 1);
            }
        }, { outline: 0.5, rect: [lx - 10, ly - 7, lx + 10, ly + 7] });
      } else {
        // an electrical isolator for the row, conduits up to the tray
        wallShadow(p, pl, c - 0.18, c + 0.18, 17, 22);
        pq(p, pl, c - 0.18, c + 0.18, 17, 22, light ? '#c8ccd0' : '#a6abb0');
        pq(p, pl, c - 0.16, c + 0.16, 17.3, 21.7, light ? '#dde0e3' : '#b8bcc0');
        pq(p, pl, c - 0.06, c + 0.06, 18.6, 20.8, '#c83a2a');
        pq(p, pl, c - 0.06, c + 0.06, 20.5, 20.8, '#f2c230');
        for (const du of [-0.1, 0.1]) pt(p, pl, c + du - 0.03, c + du + 0.03, 22, TZ - 0.4, galv(), light);
      }
      // cable drops from the tray into the gear: blue and red patch bundles
      if (kind !== 1)
        for (let j = 0; j < 3; j++) {
          const du = -0.12 + j * 0.06;
          pq(p, pl, c + du, c + du + 0.03, kind === 0 ? 27 : 22, TZ - 0.3, CABLES[(j * 2 + i) % 3 === 0 ? 1 : (j * 2 + i) % 3 === 1 ? 2 : 3]);
        }
    }
    // the tray: a wire basket on brackets standing 0.32 tile out from the wall, cables lying in it
    const out = 0.32;
    const Q = (u: number, d: number, z: number): [number, number] => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));
    // brackets: an arm out from the wall under the basket, a diagonal strut back to the wall
    for (let a = u0 + 0.3; a < u1; a += 1.2) {
      const [w0x, w0y] = Q(a, 0, TZ - 2.4);
      const [w1x, w1y] = Q(a, 0, TZ);
      const [e1x, e1y] = Q(a, out + 0.02, TZ);
      ln(p.c, w1x, w1y, e1x, e1y, GALV[2], 2);
      ln(p.c, w0x, w0y, e1x, e1y, GALV[1]);
    }
    // the basket's floor seen from above (the mesh over the bundle's shadow)
    const fl = [Q(u0, 0.02, TZ), Q(u1, 0.02, TZ), Q(u1, out, TZ), Q(u0, out, TZ)];
    fillPoly(p.c, fl, '#1c2430');
    // the bundle lying in it: colour-coded runs along the tray, a little proud of its rim, lit from above
    const lanes = [1, 1, 3, 1, 2, 1, 0, 1, 5, 1];
    for (let i = 0; i < lanes.length; i++) {
      const d0 = 0.04 + (i * (out - 0.07)) / lanes.length;
      const d1 = 0.04 + ((i + 1) * (out - 0.07)) / lanes.length;
      const zt = TZ + 1.1 + Math.sin(i * 1.3) * 0.15;
      const col = CABLES[lanes[i]];
      fillPoly(p.c, [Q(u0, d0, zt), Q(u1, d0, zt), Q(u1, d1, zt), Q(u0, d1, zt)], i % 2 ? col : lighten(col, 0.18));
    }
    // the near wall of the basket: galvanised wire mesh with the cables showing through, a lit top rail
    const near = (u: number, z: number) => Q(u, out, z);
    for (let a = u0; a <= u1 + 0.001; a += 0.07) {
      const [x0, y0] = near(a, TZ);
      const [x1, y1] = near(a, TZ + 1.5);
      ln(p.c, x0, y0, x1, y1, at(GALV, light ? 3 : 2));
    }
    for (const [z, tone] of [[TZ, light ? 3 : 2], [TZ + 0.75, light ? 4 : 3], [TZ + 1.5, light ? 6 : 5]] as const) {
      const [x0, y0] = near(u0, z);
      const [x1, y1] = near(u1, z);
      ln(p.c, x0, y0, x1, y1, at(GALV, tone));
    }
    // the ends of the basket: the cables carry on through the wall at either end of the run
    for (const a of [u0, u1]) {
      const [x0, y0] = Q(a, 0.02, TZ + 1.5);
      const [x1, y1] = Q(a, out, TZ + 1.5);
      ln(p.c, x0, y0, x1, y1, at(GALV, light ? 5 : 4));
    }
    // a yellow fibre duct on the wall above it, on its own clips
    pt(p, pl, u0, u1, TZ + 3.2, TZ + 4.2, (_u: number, v: number) => (v > 5 ? '#f8d860' : v < 1.5 ? '#a8821c' : '#e8b628'), light);
    for (let a = u0 + 0.6; a < u1; a += 1.2) pq(p, pl, a, a + 0.05, TZ + 3, TZ + 4.4, at(GALV, light ? 4 : 2));
    // tray labels
    for (let a = u0 + 1; a < u1 - 0.5; a += 3) {
      const tag = [near(a, TZ + 0.3), near(a + 0.32, TZ + 0.3), near(a + 0.32, TZ + 1.2), near(a, TZ + 1.2)];
      fillPoly(p.c, tag, '#f4f6f8');
      const [lx0, ly0] = near(a + 0.05, TZ + 0.75);
      const [lx1, ly1] = near(a + 0.27, TZ + 0.75);
      ln(p.c, lx0, ly0, lx1, ly1, '#2a3038');
    }
  },
  anim(p, side, k) {
    // switch port LEDs flickering with traffic
    const pl = planeOf(p, side);
    const s = Math.max(1, Math.round(p.k / 4));
    for (let i = 0; i < Math.floor(k.wp.w); i++) {
      if ((i + k.seed) % 3 !== 0) continue;
      const c = k.wp.at + i + 0.5;
      for (let j = 0; j < 8; j++) {
        const on = Math.sin(k.t * (7 + j * 1.3) + j * 2.1 + i) > -0.2;
        const [x, y] = pl.F(c - 0.22 + j * 0.06, 25.35);
        px(p.c, x, y, on ? (j % 3 === 2 ? LED.amber : LED.green) : '#123018', s, s);
      }
    }
  },
};

// the secure door: painted steel in a steel frame, a wired-glass vision panel,
// card reader and intercom, door closer, kick plate, exit sign and warning sign
const DOOR_BLUE: Ramp = ['#1a2836', '#22344a', '#2c425c', '#38526e', '#486482', '#5a7896'];
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const Z = 21.6;
    // frame and leaf
    pq(p, pl, u0 - 0.08, u1 + 0.08, 0, Z + 1, at(STEEL, light ? 3 : 2));
    pq(p, pl, u0 - 0.08, u1 + 0.08, Z + 0.7, Z + 1, at(STEEL, light ? 5 : 4));
    pt(p, pl, u0, u1, 0, Z, (u, v, x, y) => {
      let i = light ? 3.2 : 2;
      if (v < 6) i -= 0.3;
      if (hash(x, y, 21) < 0.03) i -= 0.7;
      if (u < 1.4) i += 0.8;
      return at(DOOR_BLUE, i);
    }, light);
    // the kick plate
    pt(p, pl, u0 + 0.03, u1 - 0.03, 0.4, 3.2, galv(STEEL), light);
    // a narrow wired-glass vision panel
    pq(p, pl, u0 + 0.46, u1 - 0.12, 12, 18.4, '#141c26');
    pt(p, pl, u0 + 0.48, u1 - 0.14, 12.3, 18.1, (u: number, v: number) => ((u + v) % 14 < 2 ? '#9ab8c8' : u % 6 < 0.8 || v % 6 < 0.8 ? '#8a96a0' : '#3a5a6e'), light);
    // the lever handle and lock, the closer at the top
    const [hx, hy] = pl.F(u0 + 0.12, 10.4);
    px(p.c, hx - 1, hy - 2, STEEL[1], 5, 6);
    px(p.c, hx, hy - 1, STEEL[5], 10, 2);
    px(p.c, hx, hy, STEEL[2], 10, 1);
    pq(p, pl, u0 + 0.1, u0 + 0.5, Z - 1.6, Z - 0.6, at(STEEL, light ? 3 : 2));
    pq(p, pl, u0 + 0.1, u0 + 0.5, Z - 0.8, Z - 0.6, at(STEEL, 5));
    // the card reader and intercom on the wall beside the door
    const rc = u1 + 0.24;
    wallShadow(p, pl, rc - 0.07, rc + 0.07, 11.4, 14.4);
    pq(p, pl, rc - 0.07, rc + 0.07, 11.4, 14.4, '#1e2228');
    pq(p, pl, rc - 0.05, rc + 0.05, 12.6, 13.9, '#3a4048');
    pq(p, pl, rc - 0.07, rc + 0.07, 8.2, 10.4, '#c8ccd0');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pq(p, pl, rc - 0.05 + i * 0.035, rc - 0.03 + i * 0.035, 8.5 + j * 0.55, 8.85 + j * 0.55, '#5a6068');
    // the exit sign over the door: a green box with the running figure
    const sm = (u0 + u1) / 2;
    pq(p, pl, sm - 0.32, sm + 0.32, Z + 2, Z + 4.4, '#1a6a3a');
    pq(p, pl, sm - 0.3, sm + 0.3, Z + 2.2, Z + 4.2, '#3ad07a');
    const [fx, fy] = pl.F(sm - 0.12, Z + 3.3);
    layer(p.c, (l) => {
      px(l, fx, fy - 4, '#ffffff', 2, 2);
      ln(l, fx, fy - 2, fx - 1, fy + 1, '#ffffff');
      ln(l, fx - 1, fy + 1, fx - 3, fy + 3, '#ffffff');
      ln(l, fx - 1, fy + 1, fx + 2, fy + 3, '#ffffff');
      ln(l, fx - 2, fy - 1, fx + 2, fy - 2, '#ffffff');
      px(l, fx + 5, fy - 1, '#ffffff', 5, 1);
      px(l, fx + 8, fy - 2, '#ffffff', 1, 3);
    }, { outline: false, rect: [fx - 6, fy - 6, fx + 12, fy + 6] });
    // a yellow warning sign on the leaf: restricted area
    pq(p, pl, u0 + 0.14, u0 + 0.42, 14.4, 17.2, '#1e1e22');
    pq(p, pl, u0 + 0.15, u0 + 0.41, 14.6, 17, YEL[4]);
    const [wx, wy] = pl.F(u0 + 0.28, 16.3);
    fillPoly(p.c, [[wx, wy - 3], [wx - 4, wy + 4], [wx + 4, wy + 4]], '#1e1e22');
    px(p.c, wx, wy - 1, YEL[4], 1, 3);
    for (let i = 0; i < 3; i++) pq(p, pl, u0 + 0.17, u0 + 0.39 - i * 0.04, 14.9 + i * 0.35, 15.1 + i * 0.35, '#1e1e22');
  },
  anim(p, side, k) {
    // the card reader's LED: red, a green blink now and then as someone badges in
    const pl = planeOf(p, side);
    const u1 = k.wp.at + k.wp.w - 0.1;
    const [x, y] = pl.F(u1 + 0.24, 14);
    const s = Math.max(1, Math.round(p.k / 2));
    const green = (k.t % 9) < 0.8;
    px(p.c, x - s / 2, y, green ? LED.green : Math.sin(k.t * 2) > 0 ? LED.red : LED.redDim, s, s);
  },
};

// ── decor kinds for the free wall spans ─────────────────────
const dc_panel: WallArt4 = {
  draw(p, side, k) {
    // a distribution board: a tall grey cabinet, a breaker window, the red isolator, conduits to the ceiling
    const pl = planeOf(p, side);
    const light = pl.light;
    const c = k.wp.at + 0.5;
    for (const du of [-0.2, -0.06, 0.08, 0.2]) pt(p, pl, c + du - 0.03, c + du + 0.03, 25, 35.2, galv(), light);
    wallShadow(p, pl, c - 0.3, c + 0.3, 6, 25);
    pq(p, pl, c - 0.3, c + 0.3, 6, 25.4, light ? '#8a929c' : '#6e767f');
    pt(p, pl, c - 0.28, c + 0.28, 6.3, 25.1, (u, v, x, y) => {
      let i = light ? 4.4 : 3.2;
      if (u < 1.5) i += 0.6;
      if (v > 70) i += 0.4;
      if (hash(x, y, 31) < 0.02) i -= 0.6;
      return at(PANEL, i);
    }, light);
    pq(p, pl, c - 0.2, c + 0.2, 15, 22, '#22282e');
    for (let r = 0; r < 3; r++) for (let j = 0; j < 6; j++) pq(p, pl, c - 0.18 + j * 0.06, c - 0.14 + j * 0.06, 15.6 + r * 2.1, 16.9 + r * 2.1, j === 3 && r === 1 ? '#c83a2a' : '#e8eaee');
    pq(p, pl, c + 0.12, c + 0.24, 10.2, 12.8, '#c83a2a');
    pq(p, pl, c + 0.12, c + 0.24, 12.4, 12.8, '#f26a52');
    // a lightning-bolt warning label and the board's name
    pq(p, pl, c - 0.22, c - 0.04, 23, 24.4, YEL[4]);
    ink(p, pl, c - 0.15, 24.2, c - 0.12, 23.5, '#1e1e22');
    ink(p, pl, c - 0.12, 23.5, c - 0.1, 23.2, '#1e1e22');
    pq(p, pl, c + 0.02, c + 0.24, 23.2, 24.2, '#f4f6f8');
    pq(p, pl, c + 0.05, c + 0.2, 23.5, 23.8, '#2a3038');
  },
};

const dc_extinguisher: WallArt4 = {
  draw(p, side, k) {
    // a CO2 extinguisher on its bracket, the red call point, the sign over them
    const pl = planeOf(p, side);
    const c = k.wp.at + 0.5;
    const [x, y] = pl.F(c, 1.6);
    layer(p.c, (l) => {
      // the cylinder: red, lit on the left, a black horn on its hose
      for (let j = 0; j < 30; j++) {
        const w = j > 26 ? 5 - (j - 26) : 5;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, RED[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.8 ? 3 : 2]);
        }
      }
      px(l, x - 4, y - 18, '#f4f2ee', 8, 5);
      px(l, x - 3, y - 17, '#3a3a40', 6, 1);
      px(l, x - 2, y - 34, RACK[3], 4, 4);
      px(l, x + 1, y - 36, RACK[4], 6, 2);
      ln(l, x + 5, y - 34, x + 9, y - 22, RACK[2], 2);
      fillPoly(l, [[x + 7, y - 22], [x + 12, y - 22], [x + 11, y - 12], [x + 8, y - 12]], RACK[3]);
    }, { rect: [x - 8, y - 40, x + 14, y + 2] });
    pq(p, pl, c - 0.12, c + 0.12, 13, 15, '#8a1c18');
    pq(p, pl, c - 0.1, c + 0.1, 13.2, 14.8, '#d83a2e');
    pq(p, pl, c - 0.05, c + 0.05, 13.7, 14.3, '#f4f2ee');
    // the sign: a red square with the white extinguisher pictogram
    pq(p, pl, c - 0.16, c + 0.16, 18, 21.4, '#c8302a');
    pq(p, pl, c - 0.04, c + 0.04, 18.6, 20.4, '#f4f2ee');
    pq(p, pl, c - 0.02, c + 0.08, 20.4, 20.8, '#f4f2ee');
  },
};

const dc_grille: WallArt4 = {
  draw(p, side, k) {
    // a return-air grille high on the wall: louvres, a frame, dust drawn in around it
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + 0.88;
    pq(p, pl, u0 - 0.06, u1 + 0.06, 23.4, 31.6, 'rgba(60,64,80,0.18)');
    pq(p, pl, u0, u1, 24, 31, at(STEEL, light ? 4 : 3));
    pt(p, pl, u0 + 0.05, u1 - 0.05, 24.5, 30.5, (_u: number, v: number) => {
      const f = v % 4;
      return f < 1.2 ? '#1a2028' : f < 2 ? at(STEEL, light ? 2 : 1) : at(STEEL, light ? 5 : 4);
    }, light);
    // a temperature probe on a cable beside it
    const [tx, ty] = pl.F(u1 + 0.06, 22);
    px(p.c, tx - 1, ty - 4, '#e8eaee', 3, 5);
    px(p.c, tx, ty - 10, '#3a3a40', 1, 6);
  },
};

const dc_notice: WallArt4 = {
  draw(p, side, k) {
    // a framed evacuation plan, an ESD warning and the aisle rules on a laminated sheet
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + 0.88;
    wallShadow(p, pl, u0, u1, 14, 25);
    pq(p, pl, u0, u1, 14, 25, '#d8dce0');
    pq(p, pl, u0 + 0.03, u1 - 0.03, 14.4, 24.6, '#f6f7f8');
    pq(p, pl, u0 + 0.03, u1 - 0.03, 23.4, 24.6, '#2e9a5a');
    for (let i = 0; i < 5; i++) pq(p, pl, u0 + 0.08 + i * 0.07, u0 + 0.12 + i * 0.07, 23.8, 24.2, '#f6f7f8');
    // the plan: walls in dark lines, rack rows, the route in green arrows, a red you-are-here dot
    const L = (a: number, z: number, b: number, z2: number, col = '#3a4048') => ink(p, pl, u0 + a, z, u0 + b, z2, col);
    L(0.08, 15.2, 0.68, 15.2); L(0.08, 15.2, 0.08, 22.6); L(0.08, 22.6, 0.68, 22.6); L(0.68, 15.2, 0.68, 22.6);
    for (let r = 0; r < 4; r++) pq(p, pl, u0 + 0.16, u0 + 0.42, 16.4 + r * 1.5, 17 + r * 1.5, '#8a96a2');
    L(0.5, 16, 0.5, 21.8, '#2eaa5a');
    L(0.5, 21.8, 0.62, 21.8, '#2eaa5a');
    const [rx, ry] = pl.F(u0 + 0.56, 18.4);
    px(p.c, rx - 1, ry - 1, '#d83a2e', 3, 3);
    // the ESD triangle on its own small sign below
    pq(p, pl, u0 + 0.2, u0 + 0.5, 10.2, 12.8, '#1e1e22');
    pq(p, pl, u0 + 0.21, u0 + 0.49, 10.4, 12.6, YEL[4]);
    const [ex, ey] = pl.F(u0 + 0.35, 11.6);
    fillPoly(p.c, [[ex, ey - 4], [ex - 5, ey + 4], [ex + 5, ey + 4]], '#1e1e22');
    fillPoly(p.c, [[ex, ey - 2], [ex - 3, ey + 3], [ex + 3, ey + 3]], YEL[4]);
    px(p.c, ex - 1, ey, '#1e1e22', 2, 2);
  },
};

const dc_thermo: WallArt4 = {
  draw(p, side, k) {
    // an environment sensor with its LCD, and a CCTV dome high in the corner of the span
    const pl = planeOf(p, side);
    const c = k.wp.at + 0.5;
    wallShadow(p, pl, c - 0.14, c + 0.14, 13, 16.4);
    pq(p, pl, c - 0.14, c + 0.14, 13, 16.4, '#d0d4d8');
    pq(p, pl, c - 0.12, c + 0.12, 13.2, 16.2, '#eef0f2');
    pq(p, pl, c - 0.09, c + 0.09, 14.4, 15.8, '#6a8a6a');
    pq(p, pl, c - 0.08, c + 0.08, 14.5, 15.7, '#9ac09a');
    for (let i = 0; i < 4; i++) pq(p, pl, c - 0.06 + i * 0.035, c - 0.04 + i * 0.035, 14.8, 15.4, '#1e2a1e');
    // the camera: a bracket, a smoked dome
    const [x, y] = pl.F(c + 0.2, 33);
    layer(p.c, (l) => {
      px(l, x - 3, y - 2, '#d8dce0', 7, 3);
      px(l, x - 1, y + 1, '#c8ccd0', 3, 3);
      ell(l, x, y + 6, 6, 4, '#e8eaee');
      ell(l, x, y + 8, 5, 3, '#1e2430');
      px(l, x - 2, y + 7, '#4a5a6a', 2, 1);
    }, { rect: [x - 8, y - 4, x + 8, y + 12] });
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.7, 33);
    const s = Math.max(1, Math.round(p.k / 4));
    if (Math.sin(k.t * 3 + k.seed) > 0.2) px(p.c, x + 3 * s, y + 7 * s, LED.red, s, s);
  },
};

export const DC_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: { statusboard, cabletray, door, dc_panel, dc_extinguisher, dc_grille, dc_notice, dc_thermo },
};

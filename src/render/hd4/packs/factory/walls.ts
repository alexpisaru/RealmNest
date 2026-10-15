// Factory — the back walls of the press shop (1 z ≈ 10 cm; the hall is 4.4 m to
// the eaves). Whitewashed brick over a dark green gloss dado on a concrete kick,
// soot washing down from the top; blue-grey I-section stanchions with forklift
// guards, a riveted lattice eaves girder carried on knee braces, enamel lamps on
// the columns, and the cut top showing the brick in section.
// Wall props: steel-framed windows with segmental brick arches (a hopper pane
// propped open, a broken pane, the alley and the shed across seen through grimy
// glass), a roller shutter onto the alley, pipe runs with valves and gauges, PPE
// and danger boards, and the works' own decor: an electrical distribution board,
// the notice board with the days-without-accident counter, a fire point, an
// extract fan, a tool shadow board and a first-aid station.
import type { WallPropPlacement, WorldDef } from '../../../../domain/world';
import { lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { bayer, ell, fillPoly, hash, layer, ln, noise2, OUTL, px, type Ramp } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { lbox } from '../util';
import { planeText } from './font';
import { at, BLUE, BRICK, brick, brickCut, CONC, DADO, enamel, hazard, HAZ_BLACK, IRON, LIME, MGREEN, RED, riveted, SHEET, STEEL, TIMBER, YELLOW } from './palette';

const H = 44;
const T = 0.3;
/** face pixels per tile along a wall (k = 4) */
const FPT = Math.hypot(64, 32);
const COL: Ramp = ['#1d222b', '#29303b', '#37404d', '#465264', '#5a687b', '#738396'];

type Side = 'ne' | 'nw';
type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };

/** The wall face (d = 0) or a plane d tiles into the room (negative: behind the face). */
const planeAt = (p: PropPainter, side: Side, d = 0): Pl => (side === 'ne' ? front3(p, d) : side3(p, d));
/** Screen point at u along the wall, d into the room, height z. */
const P3 = (p: PropPainter, side: Side, u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));

/** A box standing on the wall: `face` toward the room, `end` its visible end. */
function wbox(p: PropPainter, side: Side, u0: number, u1: number, d0: number, d1: number, z0: number, z1: number, m: { face?: Mat; end?: Mat; top?: Mat; edge?: string }) {
  if (side === 'ne') lbox(p, u0, d0, u1 - u0, d1 - d0, z0, z1 - z0, { front: m.face, side: m.end, top: m.top, edge: m.edge });
  else lbox(p, d0, u0, d1 - d0, u1 - u0, z0, z1 - z0, { front: m.end, side: m.face, top: m.top, edge: m.edge });
}

/** A line between two (u, z) points on a plane. */
function pline(p: PropPainter, pl: Plane, u0: number, z0: number, u1: number, z1: number, col: string, w = 1) {
  const [x0, y0] = pl.F(u0, z0);
  const [x1, y1] = pl.F(u1, z1);
  ln(p.c, x0, y0, x1, y1, col, w);
}

/**
 * Stanchions: at the edges of every window and shutter (they stand between the
 * bays), then evenly in long blank stretches. Whole tiles only, so 1-tile wall
 * props always sit between two columns.
 */
export function columnsFor(wps: WallPropPlacement[], side: Side, len: number): number[] {
  const edges: number[] = [];
  for (const wp of wps) if (wp.wall === side && (wp.type === 'window' || wp.type === 'shutter')) edges.push(wp.at, wp.at + wp.w);
  const cs: number[] = [];
  for (const e of [...new Set(edges)].sort((a, b) => a - b)) if (e > 0.5 && e < len - 0.5 && (!cs.length || e - cs[cs.length - 1] >= 2)) cs.push(e);
  const out: number[] = [];
  const stops = [0, ...cs, len];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (i > 0) out.push(a);
    const n = Math.round((b - a) / 3.6);
    for (let j = 1; j < n; j++) {
      const c = Math.round(a + ((b - a) * j) / n);
      if (c > a + 1.5 && c < b - 1.5) out.push(c);
    }
  }
  return out;
}

// ── the bare wall ───────────────────────────────────────────
/** Plinth, gloss dado, whitewashed brick with flaking paint, soot, and the warm pools of the column lamps. */
const wallTex =
  (cols: number[], seed: number): Mat =>
  (light, _w, h) => {
    const brk = brick(BRICK, { course: 5 })(light, _w, h);
    return (u, v, x, y) => {
      const z = v / 4;
      if (z < 1.3) {
        // concrete kick: scuffed, oil-dark at the foot
        let i = light ? 3 : 2;
        if (hash(x >> 1, y >> 1, seed + 3) < 0.1) i -= 1;
        if (z < 0.5) i -= 1;
        return at(CONC, i);
      }
      // the brick bond under the paint
      const row = Math.floor(v / 5);
      const fv = v - row * 5;
      const header = row & 1;
      const bw = header ? 7 : 14;
      const off = header ? (row & 2 ? 3.5 : 0) : row & 2 ? 7 : 0;
      const fu = (u + off) % bw;
      const joint = fv < 1 || fu < 1;
      if (z < 12) {
        let i = light ? 3 : 1.8;
        if (joint && bayer(x, y) < 0.7) i -= 0.8;
        if (z > 11.2) i += 0.8; // the gloss lip at the top
        // chipped paint showing brick near the floor, trolley scuffs
        const chip = noise2(u * 0.08, v * 0.1, seed + 5);
        if (z < 5 && chip > 0.74) return brk(u, v, x, y);
        if (z > 2 && z < 6 && hash(Math.floor(u / 3), Math.floor(v / 2), seed + 6) < 0.05) return at(DADO, 0);
        if (hash(x, y, seed + 7) < 0.03) i += 1;
        return at(DADO, i);
      }
      if (z < 12.5) return at(DADO, 0);
      // whitewash, flaking in patches
      const n = noise2(u * 0.022, v * 0.034, seed + 8);
      if (n > 0.84 && noise2(u * 0.2, v * 0.22, seed + 9) > 0.45) return brk(u, v, x, y);
      let i = light ? 4 : 2.8;
      if (joint && bayer(x, y) < 0.55) i -= 0.9;
      if (n > 0.64) i -= 0.6;
      // soot washing down from the eaves
      const s = noise2(u * 0.05, 1, seed + 10);
      const top = h - v;
      if (top < 30 + s * 40 && bayer(x, y) * (30 + s * 40) > top * 1.4) i -= 0.8;
      // lamp pools under each column lamp
      for (const c of cols) {
        const du = (u - c * FPT) / 64;
        const dz = (z - 25) / 9;
        const d2 = du * du + dz * dz;
        if (d2 < 1 && bayer(x, y) < (1 - d2) * 1.2) {
          i += 0.8;
          break;
        }
      }
      if (hash(x, y, seed + 11) < 0.03) i -= 1;
      return at(LIME, i);
    };
  };

function column(p: PropPainter, side: Side, c: number) {
  const hw = 0.1;
  const d1 = 0.17;
  const face: Mat = enamel(COL, 0.15);
  wbox(p, side, c - hw, c + hw, 0, d1, 0, 37, { face, end: (light) => (u, _v, x, y) => {
    // the end shows the flanges' edges and the recessed web between them
    const fu = u / (d1 * FPT);
    if (fu < 0.18 || fu > 0.86) return at(COL, light ? 4 : 3);
    return at(COL, (light ? 2 : 1) - (hash(x, y, 2) < 0.04 ? 1 : 0));
  }, top: () => () => COL[4], edge: COL[0] });
  const F = planeAt(p, side, d1);
  // flange edges, bolted base plate, a stencilled bay number
  pq(p, F, c - hw, c - hw + 0.02, 0, 37, at(COL, F.light ? 5 : 3));
  pq(p, F, c + hw - 0.02, c + hw, 0, 37, COL[1]);
  wbox(p, side, c - 0.16, c + 0.16, 0, 0.24, 0, 0.6, { face: () => () => COL[3], end: () => () => COL[1], top: () => () => COL[4], edge: COL[0] });
  for (const u of [c - 0.11, c + 0.11]) {
    const [bx, by] = P3(p, side, u, 0.22, 0.6);
    px(p.c, bx - 1, by - 2, STEEL[5], 2, 2);
  }
  // the forklift guard: a hazard-striped sleeve
  const G = planeAt(p, side, d1 + 0.01);
  pt(p, G, c - hw - 0.01, c + hw + 0.01, 0.6, 6.5, hazard(7, 0.25), G.light);
  // cap plate and knee braces up to the girder
  wbox(p, side, c - 0.14, c + 0.14, 0, 0.2, 36.4, 37.2, { face: () => () => COL[4], end: () => () => COL[2], top: () => () => COL[5], edge: COL[0] });
  const B = planeAt(p, side, 0.1);
  for (const s of [-1, 1]) {
    pline(p, B, c + s * 0.1, 31.5, c + s * 0.7, 36.6, COL[1], 3);
    pline(p, B, c + s * 0.1, 31.8, c + s * 0.68, 36.6, COL[4], 1);
  }
  // a stencilled bay number on the column
  planeText(p.c, F, c, 18, String(Math.round(c)), '#d8d2c0', 1);
}

/** An enamel reflector lamp on a bracket off the column, its bulb lit. */
function columnLamp(p: PropPainter, side: Side, c: number) {
  const [ax, ay] = P3(p, side, c, 0.17, 31);
  const [bx, by] = P3(p, side, c, 0.62, 31.5);
  layer(p.c, (l) => {
    ln(l, ax, ay, bx, by, COL[1], 2);
    ln(l, ax, ay - 1, bx, by - 1, COL[4]);
    ln(l, bx, by, bx, by + 6, IRON[2], 1);
    const x = bx;
    const y = by + 6;
    // the shade: green enamel outside, white inside, a warm bulb
    fillPoly(l, [[x - 4, y], [x + 4, y], [x + 11, y + 8], [x - 11, y + 8]], MGREEN[3]);
    fillPoly(l, [[x - 4, y], [x - 1, y], [x - 6, y + 8], [x - 11, y + 8]], MGREEN[5]);
    ell(l, x, y + 8, 11, 3, '#e8e2d0');
    ell(l, x, y + 9, 4, 2, '#fff2b8');
    px(l, x - 1, y + 9, '#ffffff', 2, 1);
  }, { outline: 0.6, rect: [Math.min(ax, bx) - 14, Math.min(ay, by) - 4, Math.max(ax, bx) + 14, by + 20] });
}

/** The riveted lattice girder along the top of the wall (Warren lacing between two angle chords). */
function girder(p: PropPainter, side: Side, len: number) {
  const W = planeAt(p, side, 0);
  const G = planeAt(p, side, 0.12);
  // its shadow on the whitewash
  p.c.globalAlpha = 0.22;
  pq(p, W, 0, len, 35.2, 36.2, '#2a1a2a');
  p.c.globalAlpha = 1;
  const L = G.light;
  // chords
  pq(p, G, 0, len, 42.2, 43.8, at(COL, L ? 3 : 2));
  pq(p, G, 0, len, 43.2, 43.8, at(COL, L ? 5 : 4));
  pq(p, G, 0, len, 42.2, 42.5, COL[0]);
  pq(p, G, 0, len, 36.2, 37.6, at(COL, L ? 3 : 2));
  pq(p, G, 0, len, 37.1, 37.6, at(COL, L ? 5 : 4));
  pq(p, G, 0, len, 36.2, 36.5, COL[0]);
  // lacing: diagonals every half tile, gussets with rivets at the nodes
  const step = 0.5;
  for (let u = 0, i = 0; u < len - 0.01; u += step, i++) {
    const a = u;
    const b = Math.min(len, u + step);
    const up = i % 2 === 0;
    pline(p, G, a, up ? 37.6 : 42.2, b, up ? 42.2 : 37.6, COL[1], 2);
    pline(p, G, a, up ? 37.8 : 42.4, b, up ? 42.4 : 37.8, COL[4], 1);
    for (const z of [37, 42.8]) {
      const [x, y] = G.F(a, z);
      px(p.c, x - 2, y - 1, at(COL, L ? 4 : 3), 4, 3);
      px(p.c, x - 1, y - 1, STEEL[5], 1, 1);
    }
  }
}

function drawWall(p: PropPainter, side: Side, w: WorldDef) {
  const len = side === 'ne' ? w.cols : w.rows;
  const pl = planeAt(p, side);
  const cols = columnsFor(w.environment.wallProps, side, len);
  pt(p, pl, 0, len, 0, H, wallTex(cols, side === 'ne' ? 11 : 23), pl.light);
  // stencils and storytelling on the whitewash: a painted bay line, old fixings, a faded slogan
  const Rn = (i: number, s: number) => hash(i, s, side === 'ne' ? 5 : 9);
  for (let i = 0; i < len * 2; i++) {
    if (Rn(i, 1) > 0.3) continue;
    const u = 0.3 + Rn(i, 2) * (len - 0.6);
    const z = 15 + Rn(i, 3) * 16;
    const [x, y] = pl.F(u, z);
    px(p.c, x, y, '#5a5048', 2, 2);
  }
  girder(p, side, len);
  for (const c of cols) column(p, side, c);
  for (const c of cols) columnLamp(p, side, c);
  // the corner stanchion (drawn once, with the ne wall which is painted last)
  if (side === 'ne') {
    lbox(p, 0, 0, 0.2, 0.2, 0, 37, { front: enamel(COL, 0.15), side: enamel(COL, 0.15), top: () => () => COL[4], edge: COL[0] });
    const G = front3(p, 0.21);
    pt(p, G, 0, 0.21, 0.6, 6.5, hazard(7, 0.25), 1);
    const S = side3(p, 0.21);
    pt(p, S, 0, 0.21, 0.6, 6.5, hazard(7, 0.25), 0);
  }
  // the cut top: the brick in section
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], brickCut(BRICK), 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], brickCut(BRICK), 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The open end of a cut wall: brick in English bond seen end-on, the plaster skin inside. */
const endCap: Mat = (light, w) => {
  const b = brick(BRICK, { course: 5 })(light, w, 176);
  return (u, v, x, y) => {
    if (u > w - 2) return at(LIME, light ? 4 : 2);
    if (v < 5) return at(CONC, light ? 3 : 2);
    return b(u, v, x, y);
  };
};

// ── wall props ──────────────────────────────────────────────
/** What the windows look out on: the alley, the brick shed across it, a strip of hazy sky. */
const view =
  (seed: number, hgt: number): FaceTex =>
  (u, v, x, y) => {
    const t = v / hgt;
    const eave = 0.62 + hash(Math.floor((u + seed * 31) / 90), 1, seed) * 0.12;
    if (t > eave) {
      const sky = ['#93a5b0', '#a5b5be', '#b8c6cc', '#cad4d6'];
      let col = sky[Math.max(0, Math.min(3, Math.floor((t - eave) * 9 + (bayer(x, y) - 0.5) * 1.4)))];
      // the chimney and a sawtooth roof beyond, in haze
      const cu = (u + seed * 17) % 160;
      if (cu > 70 && cu < 79 && t < 0.98) col = '#7e7572';
      const tooth = (u + seed * 9) % 40;
      if (t < eave + 0.06 + (tooth / 40) * 0.1) col = '#6e6670';
      return col;
    }
    // the shed's brick wall across the alley, its tall windows, a downpipe
    const row = Math.floor(v / 4);
    let col = (v % 4 < 1 || (u + (row & 1) * 5) % 10 < 1) ? '#8a6656' : hash(Math.floor((u + (row & 1) * 5) / 10), row, seed) < 0.3 ? '#9a6a58' : '#a87866';
    const wu = (u + seed * 13) % 60;
    if (t > 0.22 && t < eave - 0.08 && wu > 14 && wu < 40) col = (wu - 14) % 6.5 < 1 || Math.floor(v) % 9 === 0 ? '#5a5658' : '#3c4248';
    if (Math.abs(((u + seed * 7) % 120) - 100) < 1.5) col = '#4a4448';
    if (t < 0.08) col = bayer(x, y) > 0.5 ? '#7a7470' : '#8a847e';
    return col;
  };

/** A segmental brick arch over an opening on a plane (voussoirs alternating, mortar between). */
function archHead(p: PropPainter, pl: Pl, u0: number, u1: number, z: number, rise: number, depth = 2.4) {
  const n = Math.max(7, Math.round((u1 - u0) * 9));
  const um = (u0 + u1) / 2;
  const half = (u1 - u0) / 2;
  const zAt = (u: number, r: number) => z + rise * (1 - ((u - um) / half) ** 2) + r;
  for (let i = 0; i < n; i++) {
    const a = u0 - 0.08 + ((u1 - u0 + 0.16) * i) / n;
    const b = u0 - 0.08 + ((u1 - u0 + 0.16) * (i + 1)) / n;
    const q = [pl.F(a, zAt(a, 0)), pl.F(b, zAt(b, 0)), pl.F(b, zAt(b, depth)), pl.F(a, zAt(a, depth))];
    fillPoly(p.c, q, i % 2 ? at(BRICK, pl.light ? 3 : 2) : at(BRICK, pl.light ? 4 : 2.6));
    const [mx, my] = pl.F(b, zAt(b, 0));
    const [nx, ny] = pl.F(b, zAt(b, depth));
    ln(p.c, mx, my, nx, ny, pl.light ? '#a39280' : '#6e6052');
  }
}

/** A steel-framed window between two stanchions. */
function steelWindow(p: PropPainter, side: Side, u0: number, u1: number, z0: number, z1: number, seed: number) {
  const pl = planeAt(p, side);
  const back = planeAt(p, side, -0.12);
  const L = pl.light;
  // the opening: the reveal in shadow, with the sill's top showing
  pq(p, pl, u0, u1, z0, z1, L ? '#4e4a48' : '#3a3638');
  pq(p, pl, u0, u1, z0, z0 + 0.6, L ? '#8a8378' : '#6a645c');
  // the glazing set back in the reveal: the view, then the bars
  const gu1 = u1 - 0.12;
  const gz1 = z1 - 1;
  pt(p, back, u0, gu1, z0, gz1, view(seed, (gz1 - z0) * 4), L);
  // grime: some panes frosted, a soft diagonal reflection
  const nu = Math.max(4, Math.round((gu1 - u0) / 0.2));
  const nz = Math.max(5, Math.round((gz1 - z0) / 2.4));
  const du = (gu1 - u0) / nu;
  const dz = (gz1 - z0) / nz;
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nz; j++) {
      const h = hash(i, j, seed * 7 + 3);
      if (h < 0.18) {
        p.c.globalAlpha = 0.45;
        pq(p, back, u0 + i * du, u0 + (i + 1) * du, z0 + j * dz, z0 + (j + 1) * dz, '#c8ccc4');
        p.c.globalAlpha = 1;
      } else if (h > 0.97) pq(p, back, u0 + i * du, u0 + (i + 1) * du, z0 + j * dz, z0 + (j + 1) * dz, '#18181c');
      else if ((i + j * 2 + seed) % 7 === 0) {
        p.c.globalAlpha = 0.25;
        pq(p, back, u0 + i * du, u0 + (i + 1) * du, z0 + j * dz, z0 + (j + 1) * dz, '#ffffff');
        p.c.globalAlpha = 1;
      }
    }
  const bar = L ? '#2e3036' : '#24262a';
  for (let i = 0; i <= nu; i++) pline(p, back, u0 + i * du, z0, u0 + i * du, gz1, bar, i === 0 || i === nu || i === nu >> 1 ? 2 : 1);
  for (let j = 0; j <= nz; j++) pline(p, back, u0, z0 + j * dz, gu1, z0 + j * dz, bar, j === 0 || j === nz ? 2 : 1);
  // a hopper pane propped open at the top, tilting into the room
  const hi = Math.floor(nu * 0.25);
  const ha = u0 + hi * du;
  const hb = ha + du * 2;
  const hz = gz1 - dz;
  const q = [P3(p, side, ha, -0.12, hz), P3(p, side, hb, -0.12, hz), P3(p, side, hb, 0.18, hz + dz * 0.75), P3(p, side, ha, 0.18, hz + dz * 0.75)];
  fillPoly(p.c, q, '#5e7276');
  ln(p.c, q[0][0], q[0][1], q[1][0], q[1][1], bar, 2);
  ln(p.c, q[3][0], q[3][1], q[2][0], q[2][1], '#4a4e56', 2);
  ln(p.c, q[0][0], q[0][1], q[3][0], q[3][1], bar);
  ln(p.c, q[1][0], q[1][1], q[2][0], q[2][1], bar);
  // its stay
  ln(p.c, q[1][0] - 2, q[1][1] + 2, q[2][0] - 2, q[2][1] + 6, '#8a8e96');
  // segmental arch of brick and a concrete sill
  archHead(p, pl, u0, u1, z1, 0.9);
  pq(p, pl, u0 - 0.1, u1 + 0.1, z0 - 1.1, z0, at(CONC, L ? 4 : 2.5));
  pq(p, pl, u0 - 0.1, u1 + 0.1, z0 - 1.4, z0 - 1.1, mix(CONC[0], OUTL, 0.4));
  wbox(p, side, u0 - 0.1, u1 + 0.1, 0, 0.07, z0 - 1.1, z0, { face: () => () => at(CONC, L ? 4 : 2.5), end: () => () => CONC[2], top: () => () => CONC[5], edge: CONC[0] });
  // left on the sill: a mug and a rag, or a dead spider plant
  const [sx, sy] = P3(p, side, u0 + 0.3 + hash(seed, 9) * (u1 - u0 - 0.7), 0.04, z0);
  if (seed % 2) {
    px(p.c, sx - 3, sy - 7, '#e8e0cc', 6, 7);
    px(p.c, sx - 3, sy - 7, '#ffffff', 1, 7);
    px(p.c, sx + 3, sy - 6, '#c8c0ac', 2, 4);
    px(p.c, sx - 2, sy - 7, '#4a2e20', 4, 1);
    px(p.c, sx + 8, sy - 3, '#7a6a8a', 9, 3);
  } else {
    fillPoly(p.c, [[sx - 5, sy - 8], [sx + 5, sy - 8], [sx + 4, sy], [sx - 4, sy]], '#b8693e');
    for (let i = 0; i < 6; i++) ln(p.c, sx, sy - 8, sx - 8 + i * 3, sy - 14 + Math.abs(i - 2.5) * 2, i % 2 ? '#8a8a4a' : '#a89a5a');
  }
}

const window: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    steelWindow(p, side, a0 + 0.16, a0 + w - 0.16, 13.5, 33, k.seed);
  },
};

/** A roller shutter half up onto the alley: hazard-striped guides, the coil box, a push-button station. */
const shutter: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    const u0 = a0 + 0.16;
    const u1 = a0 + w - 0.16;
    const pl = planeAt(p, side);
    const out = planeAt(p, side, -T);
    const L = pl.light;
    const zt = 26;
    const open = 21;
    // the opening onto the alley: the far wall in daylight, cobbles, a pallet against the wall
    pq(p, pl, u0, u1, 0, zt, '#2a2628');
    pt(p, out, u0, u1, 0, zt, (u: number, v: number, x: number, y: number) => {
      const t = v / (zt * 4);
      if (t < 0.18) {
        // the alley's setts in the light
        const r = Math.floor(v / 3);
        return (v % 3 < 1 || (u + (r & 1) * 4) % 8 < 1) ? '#6e6a66' : hash(Math.floor((u + (r & 1) * 4) / 8), r, 5) < 0.4 ? '#9a958c' : '#aaa59a';
      }
      if (t < 0.24) return '#4a4446';
      const row = Math.floor(v / 4);
      let col = v % 4 < 1 || (u + (row & 1) * 6) % 12 < 1 ? '#8e705e' : hash(Math.floor((u + (row & 1) * 6) / 12), row, 6) < 0.3 ? '#a87a64' : '#b88a72';
      if (u > 30 && u < 62 && t > 0.3 && t < 0.62) col = (u - 30) % 8 < 1 || v % 10 < 1 ? '#5a5a5e' : '#3e4650';
      if (u > 92 && u < 120 && t < 0.42) col = (Math.floor(v / 5) & 1) ? '#9a7a4e' : '#b8945e';
      if (bayer(x, y) > 0.82) col = lighten(col, 0.06);
      return col;
    }, L);
    // light spilling in across the threshold
    p.c.globalAlpha = 0.18;
    pq(p, pl, u0, u1, 0, 3, '#fff0c8');
    p.c.globalAlpha = 1;
    // the curtain: horizontal slats from the box down to the bottom rail
    pt(p, pl, u0, u1, open, zt, (_u: number, v: number, x: number, y: number) => {
      const f = v % 5;
      let i = L ? 3 : 2;
      if (f < 1) i -= 1.5;
      else if (f < 2.2) i += 1;
      if (hash(x >> 1, y >> 1, 8) < 0.05) i -= 0.6;
      return at(SHEET, i);
    }, L);
    wbox(p, side, u0, u1, 0, 0.1, open - 0.8, open, { face: () => () => at(STEEL, L ? 3 : 2), end: () => () => STEEL[1], top: () => () => STEEL[4], edge: STEEL[0] });
    pq(p, planeAt(p, side, 0.1), u0, u1, open - 1.2, open - 0.8, '#1a1a1e');
    const [hx, hy] = P3(p, side, (u0 + u1) / 2, 0.1, open - 0.4);
    px(p.c, hx - 6, hy - 1, STEEL[5], 12, 2);
    // guide channels: hazard stripes to head height
    for (const u of [u0 - 0.1, u1]) {
      wbox(p, side, u, u + 0.1, 0, 0.12, 0, zt, { face: enamel(SHEET, 0.1), end: () => () => SHEET[1], top: () => () => SHEET[4], edge: SHEET[0] });
      const G = planeAt(p, side, 0.125);
      pt(p, G, u, u + 0.1, 0, 9, hazard(6, 0.3), G.light);
    }
    // the coil box with the drive motor at one end
    wbox(p, side, u0 - 0.14, u1 + 0.14, 0, 0.3, zt, zt + 4, { face: riveted(SHEET, 40, 16, 0.3), end: riveted(SHEET, 40, 16, 0.3), top: () => () => SHEET[4], edge: SHEET[0] });
    wbox(p, side, u1 + 0.14, u1 + 0.4, 0.04, 0.26, zt + 0.6, zt + 3.4, { face: enamel(BLUE, 0.1), end: enamel(BLUE, 0.1), top: () => () => BLUE[4], edge: BLUE[0] });
    planeText(p.c, planeAt(p, side, 0.31), (u0 + u1) / 2, zt + 2, 'KEEP CLEAR', HAZ_BLACK, 1);
    // push-button station on the right guide
    wbox(p, side, u1 + 0.14, u1 + 0.36, 0, 0.1, 10, 14.2, { face: enamel(YELLOW, 0.1), end: () => () => YELLOW[2], top: () => () => YELLOW[4], edge: YELLOW[0] });
    const B = planeAt(p, side, 0.101);
    for (const [z, c] of [[13.2, '#3fae5a'], [12, '#d8402e'], [10.8, '#2a2a2e']] as const) {
      const [bx, by] = B.F(u1 + 0.25, z);
      px(p.c, bx - 2, by - 2, c, 4, 3);
      px(p.c, bx - 2, by - 2, lighten(c, 0.3), 1, 1);
    }
    // conduit from the station up to the motor
    pline(p, planeAt(p, side, 0.05), u1 + 0.25, 14.2, u1 + 0.25, zt + 0.6, STEEL[2], 2);
  },
};

// ── pipe runs ───────────────────────────────────────────────
interface Run {
  z: number;
  r: number;
  d: number;
  ramp: Ramp;
  band?: string;
}
const PGREY: Ramp = ['#2e3036', '#43474e', '#5c6168', '#777c82', '#959a9e', '#b6bab8'];
const PYEL: Ramp = ['#5e4410', '#8a6618', '#b88c22', '#d8aa30', '#ecc650', '#f6de86'];
const PAIR: Ramp = ['#1e3a52', '#2a5270', '#3a6c8e', '#4e88aa', '#6aa4c4', '#8ec2da'];
const PALU: Ramp = ['#5e6264', '#7c8082', '#9a9e9e', '#b6b9b8', '#cfd2d0', '#e8eae6'];
const RUNS: Run[] = [
  { z: 35, r: 1.6, d: 0.24, ramp: PALU },
  { z: 31.6, r: 1.15, d: 0.17, ramp: PGREY, band: '#3c8a4c' },
  { z: 28.8, r: 0.75, d: 0.12, ramp: PYEL },
  { z: 26.8, r: 0.6, d: 0.1, ramp: PAIR },
];

/** A horizontal pipe along the wall: cylinder bands, its shadow on the wall, brackets, flanges, colour bands. */
function hpipe(p: PropPainter, side: Side, r: Run, u0: number, u1: number, seed: number, lagged: boolean) {
  const W = planeAt(p, side, 0);
  const A = planeAt(p, side, r.d);
  const { z, ramp } = r;
  const rr = r.r;
  const L = A.light;
  p.c.globalAlpha = 0.28;
  pq(p, W, u0 + 0.05, u1 + 0.05, z - rr - 1.6, z - rr * 0.3, '#2a1a2a');
  p.c.globalAlpha = 1;
  const b = L ? 0 : -1;
  pq(p, A, u0, u1, z - rr, z + rr, at(ramp, 2 + b));
  pq(p, A, u0, u1, z - rr * 0.35, z + rr * 0.55, at(ramp, 3 + b));
  pq(p, A, u0, u1, z + rr * 0.3, z + rr * 0.6, at(ramp, 4 + b));
  pq(p, A, u0, u1, z + rr * 0.6, z + rr, at(ramp, 3 + b));
  pq(p, A, u0, u1, z - rr, z - rr * 0.7, at(ramp, 1 + b));
  if (lagged) {
    // aluminium cladding: straps every 0.4 tile, overlapped joints
    for (let u = u0 + 0.2; u < u1; u += 0.4) {
      pq(p, A, u, u + 0.025, z - rr, z + rr, at(ramp, 1 + b));
      pq(p, A, u + 0.025, u + 0.04, z - rr, z + rr, at(ramp, 5 + b));
    }
  }
  // brackets: an angle from the wall and a U-bolt round the pipe
  for (let u = u0 + 0.35; u < u1 - 0.1; u += 1.15) {
    const [x0, y0] = P3(p, side, u, 0, z - rr - 0.6);
    const [x1, y1] = P3(p, side, u, r.d, z - rr - 0.6);
    ln(p.c, x0, y0, x1, y1, IRON[3], 2);
    pq(p, A, u - 0.02, u + 0.02, z - rr - 0.2, z + rr + 0.2, IRON[2]);
  }
  // flanges and colour bands with a flow arrow
  for (let u = u0 + 1.1 + hash(seed, 3) * 0.6; u < u1 - 0.3; u += 2.3) {
    if (!lagged) {
      pq(p, A, u - 0.035, u + 0.035, z - rr - 0.35, z + rr + 0.35, at(ramp, 1 + b));
      pq(p, A, u - 0.035, u - 0.01, z - rr - 0.35, z + rr + 0.35, at(ramp, 4 + b));
    }
    if (r.band) {
      pq(p, A, u + 0.25, u + 0.4, z - rr, z + rr, r.band);
      pq(p, A, u + 0.25, u + 0.4, z + rr * 0.3, z + rr * 0.6, lighten(r.band, 0.25));
      const [ax, ay] = A.F(u + 0.5, z);
      px(p.c, ax, ay - 1, '#f2eee0', 6, 2);
      px(p.c, ax + 6, ay - 2, '#f2eee0', 1, 4);
    }
  }
}

/** A vertical drop from a run down to a fitting. */
function vpipe(p: PropPainter, side: Side, u: number, d: number, z0: number, z1: number, rr: number, ramp: Ramp) {
  const A = planeAt(p, side, d);
  const L = A.light;
  const w = rr / 16;
  const b = L ? 0 : -1;
  p.c.globalAlpha = 0.25;
  pq(p, planeAt(p, side, 0), u + w, u + w * 2.4, z0, z1 - 0.5, '#2a1a2a');
  p.c.globalAlpha = 1;
  pq(p, A, u - w, u + w, z0, z1, at(ramp, 2 + b));
  pq(p, A, u - w, u - w * 0.2, z0, z1, at(ramp, 4 + b));
  pq(p, A, u - w * 0.65, u - w * 0.35, z0, z1, at(ramp, 5 + b));
  pq(p, A, u + w * 0.5, u + w, z0, z1, at(ramp, 1 + b));
}

/** A handwheel valve (red wheel with spokes) at a screen point. */
function handwheel(c: CanvasRenderingContext2D, x: number, y: number, r = 7) {
  layer(c, (l) => {
    ell(l, x, y, r, r * 0.9, RED[2]);
    ell(l, x, y, r - 2, (r - 2) * 0.9, 'rgba(0,0,0,0)');
    ell(l, x - 1, y - 1, r - 1, (r - 1) * 0.9, RED[4]);
    ell(l, x, y, r - 2.5, (r - 2.5) * 0.85, IRON[2]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ln(l, x, y, x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2) * 0.9, RED[3]);
    }
    px(l, x - 1, y - 1, STEEL[5], 2, 2);
  }, { outline: 0.6, rect: [x - r - 2, y - r - 2, x + r + 2, y + r + 2] });
}

/** A pressure gauge: black bezel, white dial, red needle. */
function gauge(c: CanvasRenderingContext2D, x: number, y: number, r = 5, a = -0.6) {
  layer(c, (l) => {
    ell(l, x, y, r, r, IRON[2]);
    ell(l, x, y, r - 1, r - 1, '#f2eee2');
    ell(l, x - 1, y - 1, r - 3, r - 3, '#ffffff');
    for (let i = 0; i < 5; i++) {
      const t = -2.4 + i * 1.2;
      px(l, x + Math.cos(t) * (r - 1.6), y + Math.sin(t) * (r - 1.6), '#2a2a2e');
    }
    ln(l, x, y, x + Math.cos(a) * (r - 1.5), y + Math.sin(a) * (r - 1.5), '#d02a20');
    px(l, x, y, '#2a2a2e');
  }, { outline: 0.55, rect: [x - r - 2, y - r - 2, x + r + 2, y + r + 2] });
}

const pipes: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    const u0 = a0;
    const u1 = a0 + w;
    // the runs pass round the corner (u = 0) and stop with a cap where the span ends
    for (const [i, r] of RUNS.entries()) hpipe(p, side, r, u0 === 0 ? -0.2 : u0 + 0.1, u1 - 0.05, k.seed * 5 + i, i === 0);
    // end caps
    for (const r of RUNS) {
      const A = planeAt(p, side, r.d);
      pq(p, A, u1 - 0.08, u1 - 0.02, r.z - r.r - 0.25, r.z + r.r + 0.25, at(r.ramp, 1));
    }
    // the compressed-air drop: a ball valve, a filter-regulator and a coiled hose on a hook
    const ua = u0 + 0.75 + (side === 'nw' ? 0.4 : 0);
    vpipe(p, side, ua, 0.1, 13, RUNS[3].z, 0.55, PAIR);
    const [fx, fy] = P3(p, side, ua, 0.12, 14);
    layer(p.c, (l) => {
      // FRL unit: grey body, clear bowl with a bit of oil, a little gauge
      px(l, fx - 5, fy - 6, '#5a5e66', 10, 6);
      px(l, fx - 5, fy - 6, '#8a8e96', 10, 1);
      px(l, fx - 3, fy, '#c8d8dc', 6, 7);
      px(l, fx - 3, fy + 5, '#c8a040', 6, 2);
      px(l, fx - 3, fy, '#e8f4f6', 1, 7);
      px(l, fx + 1, fy - 13, YELLOW[4], 7, 2);
    }, { outline: 0.6, rect: [fx - 8, fy - 16, fx + 10, fy + 9] });
    gauge(p.c, fx + 8, fy - 3, 3.5, -0.3);
    // the hose: yellow coils hanging off a hook
    const [hx, hy] = P3(p, side, ua + 0.32, 0.14, 13);
    layer(p.c, (l) => {
      px(l, hx - 1, hy - 3, IRON[3], 3, 3);
      for (let i = 0; i < 4; i++) {
        ell(l, hx + 1 + i * 0.5, hy + 8 + i * 1.5, 7, 8, YELLOW[2 + (i % 2)]);
        ell(l, hx + 1 + i * 0.5, hy + 8 + i * 1.5, 5, 6, 'rgba(0,0,0,0)');
      }
      for (let i = 0; i < 4; i++) {
        const cx = hx + 1 + i * 0.5;
        const cy = hy + 8 + i * 1.5;
        for (let a = 0; a < 26; a++) {
          const t = (a / 26) * Math.PI * 2;
          px(l, cx + Math.cos(t) * 6.5, cy + Math.sin(t) * 7.5, t > 2.6 && t < 5.2 ? YELLOW[4] : YELLOW[2]);
        }
      }
      ln(l, hx + 6, hy + 14, hx + 9, hy + 28, YELLOW[3], 2);
      px(l, hx + 8, hy + 28, STEEL[4], 3, 4);
    }, { outline: 0.6, rect: [hx - 10, hy - 6, hx + 14, hy + 34] });
    // the water main drops to a gate valve with a handwheel and a gauge
    const ub = u1 - 0.9;
    vpipe(p, side, ub, 0.17, 7, RUNS[1].z, 1.15, PGREY);
    const [vx, vy] = P3(p, side, ub, 0.18, 12);
    layer(p.c, (l) => {
      px(l, vx - 6, vy - 4, PGREY[3], 12, 8);
      px(l, vx - 6, vy - 4, PGREY[4], 12, 2);
      px(l, vx - 7, vy - 6, PGREY[2], 14, 2);
      px(l, vx - 7, vy + 4, PGREY[2], 14, 2);
      px(l, vx - 1, vy - 12, STEEL[4], 2, 8);
    }, { outline: 0.6, rect: [vx - 9, vy - 14, vx + 9, vy + 8] });
    handwheel(p.c, vx, vy - 14, 7);
    gauge(p.c, vx + 2, vy - 30, 5, -0.9 + hash(k.seed, 4) * 0.8);
    // a tag on the valve
    px(p.c, vx + 6, vy - 6, '#f2eee0', 4, 5);
    px(p.c, vx + 6, vy - 6, RED[3], 4, 1);
    // the gas line steps down to an isolating cock with a yellow lever
    const uc = u0 + w * 0.5;
    vpipe(p, side, uc, 0.12, 20, RUNS[2].z, 0.75, PYEL);
    const [gx, gy] = P3(p, side, uc, 0.13, 21);
    layer(p.c, (l) => {
      px(l, gx - 3, gy - 2, PYEL[3], 6, 5);
      px(l, gx - 3, gy - 6, YELLOW[4], 12, 2);
      px(l, gx + 7, gy - 6, YELLOW[2], 2, 2);
    }, { outline: 0.55, rect: [gx - 6, gy - 9, gx + 12, gy + 5] });
    planeText(p.c, planeAt(p, side, 0.12), uc, 18.2, 'GAS', '#2a2a2e', 1);
  },
};

// ── signs ───────────────────────────────────────────────────
/** A blue mandatory-PPE pictogram in a circle (helmet, ear defenders, goggles, gloves, boots). */
function ppeIcon(c: CanvasRenderingContext2D, x: number, y: number, kind: number) {
  ell(c, x, y, 6, 6, '#f2f0ea');
  ell(c, x, y, 5, 5, '#1e5aa8');
  const w = '#f6f6f2';
  if (kind === 0) {
    ell(c, x, y - 1, 3.5, 2.6, w);
    px(c, x - 4, y + 1, w, 8, 1);
  } else if (kind === 1) {
    px(c, x - 3, y - 2, w, 2, 4);
    px(c, x + 1, y - 2, w, 2, 4);
    px(c, x - 2, y - 3, w, 4, 1);
  } else if (kind === 2) {
    px(c, x - 4, y - 1, w, 3, 2);
    px(c, x + 1, y - 1, w, 3, 2);
    px(c, x - 1, y - 1, w, 2, 1);
  } else if (kind === 3) {
    px(c, x - 2, y - 3, w, 4, 5);
    px(c, x - 3, y - 2, w, 1, 3);
  } else {
    px(c, x - 2, y - 3, w, 3, 4);
    px(c, x - 2, y + 1, w, 5, 2);
  }
}

const sign: WallArt4 = {
  draw(p, side, k) {
    const pl = planeAt(p, side, 0.02);
    const u0 = k.wp.at + 0.15;
    const u1 = k.wp.at + k.wp.w - 0.15;
    const L = pl.light;
    if (side === 'ne') {
      // a white board of mandatory PPE: five blue pictograms over a caption
      const z0 = 18;
      const z1 = 27;
      p.c.globalAlpha = 0.25;
      pq(p, planeAt(p, side), u0 + 0.05, u1 + 0.05, z0 - 0.8, z1 - 0.8, '#2a1a2a');
      p.c.globalAlpha = 1;
      pq(p, pl, u0, u1, z0, z1, L ? '#f4f2ec' : '#d8d6d0');
      pq(p, pl, u0, u1, z1 - 2.2, z1, '#1e5aa8');
      planeText(p.c, pl, (u0 + u1) / 2, z1 - 1.1, 'PPE', '#f6f6f2', 1);
      for (let i = 0; i < 4; i++) {
        const [x, y] = pl.F(u0 + 0.16 + i * ((u1 - u0 - 0.32) / 3), z0 + 4.2 - (i % 2) * 0.2);
        ppeIcon(p.c, x, y, i);
      }
      planeText(p.c, pl, (u0 + u1) / 2, z0 + 1.2, 'MUST BE WORN', '#1e3a6a', 1);
      for (const u of [u0 + 0.04, u1 - 0.04])
        for (const z of [z0 + 0.4, z1 - 0.4]) {
          const [x, y] = pl.F(u, z);
          px(p.c, x, y, '#8a8e96');
        }
    } else {
      // a yellow danger triangle over a caption, high above the racking
      const z0 = 26;
      const um = (u0 + u1) / 2;
      p.c.globalAlpha = 0.25;
      pq(p, planeAt(p, side), u0 + 0.05, u1 + 0.05, z0 - 0.8, z0 + 8.2, '#2a1a2a');
      p.c.globalAlpha = 1;
      pq(p, pl, u0, u1, z0, z0 + 9, L ? '#f4f2ec' : '#d8d6d0');
      const a = pl.F(um, z0 + 8.4);
      const b = pl.F(u0 + 0.1, z0 + 3);
      const c2 = pl.F(u1 - 0.1, z0 + 3);
      fillPoly(p.c, [a, c2, b], HAZ_BLACK);
      const a2 = pl.F(um, z0 + 7.5);
      const b2 = pl.F(u0 + 0.17, z0 + 3.5);
      const c3 = pl.F(u1 - 0.17, z0 + 3.5);
      fillPoly(p.c, [a2, c3, b2], YELLOW[4]);
      // a forklift pictogram
      const [fx, fy] = pl.F(um, z0 + 5);
      px(p.c, fx - 4, fy - 2, HAZ_BLACK, 6, 3);
      px(p.c, fx - 2, fy - 5, HAZ_BLACK, 1, 3);
      px(p.c, fx + 2, fy - 4, HAZ_BLACK, 1, 5);
      px(p.c, fx + 2, fy, HAZ_BLACK, 3, 1);
      px(p.c, fx - 4, fy + 1, HAZ_BLACK, 2, 2);
      px(p.c, fx, fy + 1, HAZ_BLACK, 2, 2);
      planeText(p.c, pl, um, z0 + 1.6, 'FORKLIFTS', '#2a2a2e', 1);
    }
  },
};

// ── the works' own decor ────────────────────────────────────
/** Electrical distribution board: a main isolator, a door panel, conduits up to the girder. */
const fac_fusebox: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.14;
    const u1 = k.wp.at + k.wp.w - 0.14;
    const um = (u0 + u1) / 2;
    const grey: Ramp = ['#3a3e44', '#50555c', '#686e76', '#828890', '#9ca2a8', '#b8bdc0'];
    // conduits first (behind the cabinets): up to the girder and away along the wall
    const C = planeAt(p, side, 0.06);
    for (const [i, u] of [u0 + 0.12, um, u1 - 0.12].entries()) {
      pline(p, C, u, 22, u, 36.2, STEEL[1], 3);
      pline(p, C, u - 0.01, 22, u - 0.01, 36.2, STEEL[4], 1);
      if (i === 2) {
        pline(p, C, u, 34.2, u + 0.9, 34.2, STEEL[1], 3);
        pline(p, C, u, 34.6, u + 0.9, 34.6, STEEL[4], 1);
      }
    }
    // the main board (a tall cabinet) and the isolator beside it
    wbox(p, side, u0, um + 0.12, 0, 0.18, 8, 22, { face: enamel(grey, 0.15), end: enamel(grey, 0.15), top: () => () => grey[4], edge: grey[0] });
    wbox(p, side, um + 0.16, u1, 0, 0.16, 12, 18.5, { face: enamel(grey, 0.15), end: enamel(grey, 0.15), top: () => () => grey[4], edge: grey[0] });
    const F = planeAt(p, side, 0.181);
    const L = F.light;
    // door seam, hinges, the lock, a yellow lightning triangle and a red label
    pq(p, F, u0 + 0.03, um + 0.09, 8.4, 21.6, at(grey, L ? 3 : 2));
    pq(p, F, u0 + 0.05, um + 0.07, 8.6, 21.4, at(grey, L ? 4 : 3));
    const [lx, ly] = F.F(um + 0.04, 15);
    px(p.c, lx - 1, ly - 2, '#1a1a1e', 2, 4);
    const t0 = F.F((u0 + um) / 2, 19.6);
    fillPoly(p.c, [[t0[0], t0[1] - 6], [t0[0] + 6, t0[1] + 4], [t0[0] - 6, t0[1] + 4]], HAZ_BLACK);
    fillPoly(p.c, [[t0[0], t0[1] - 4], [t0[0] + 4, t0[1] + 3], [t0[0] - 4, t0[1] + 3]], YELLOW[4]);
    ln(p.c, t0[0] + 1, t0[1] - 2, t0[0] - 1, t0[1] + 1, HAZ_BLACK);
    ln(p.c, t0[0] - 1, t0[1] + 1, t0[0] + 1, t0[1] + 2, HAZ_BLACK);
    pq(p, F, u0 + 0.08, um, 10, 11.4, '#f2eee2');
    planeText(p.c, F, (u0 + um + 0.08) / 2, 10.7, '415V', RED[2], 1);
    // the isolator: a red rotary handle on a yellow plate
    const G = planeAt(p, side, 0.161);
    pq(p, G, um + 0.22, u1 - 0.06, 13.6, 17.4, YELLOW[G.light ? 4 : 3]);
    const [ix, iy] = G.F((um + 0.22 + u1 - 0.06) / 2, 15.5);
    layer(p.c, (l) => {
      ell(l, ix, iy, 4, 4, RED[2]);
      ln(l, ix - 5, iy + 3, ix + 5, iy - 3, RED[3], 2);
      px(l, ix - 1, iy - 1, RED[5], 2, 1);
    }, { outline: 0.6, rect: [ix - 8, iy - 6, ix + 8, iy + 6] });
    // a cable tray along the wall at the top of the dado
    const tz = 22.2;
    wbox(p, side, k.wp.at - 0.02, k.wp.at + k.wp.w + 0.02, 0, 0.14, tz, tz + 0.7, { face: () => () => at(STEEL, 3), end: () => () => STEEL[2], top: () => () => STEEL[4], edge: STEEL[0] });
  },
};

/** A digit board: "DAYS WITHOUT AN ACCIDENT", the shift rota, a bar chart and a few posters on green felt. */
const fac_notice: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const um = (u0 + u1) / 2;
    const W = planeAt(p, side);
    const B = planeAt(p, side, 0.03);
    const L = B.light;
    p.c.globalAlpha = 0.25;
    pq(p, W, u0 + 0.05, u1 + 0.05, 12.8, 27.4, '#2a1a2a');
    p.c.globalAlpha = 1;
    // an aluminium frame round green felt
    pq(p, B, u0, u1, 13.5, 28, L ? '#b8bcc0' : '#8e9296');
    pt(p, B, u0 + 0.03, u1 - 0.03, 14, 27.5, (_u: number, _v: number, x: number, y: number) => at(['#22402e', '#2a4c36', '#32583e', '#3c6446'], (L ? 2 : 1) + (hash(x, y, 4) < 0.25 ? -1 : 0)), L);
    // the counter at the top: black panel, yellow caption, white flip digits
    pq(p, B, u0 + 0.05, u1 - 0.05, 23.4, 27.2, '#1e1e22');
    planeText(p.c, B, um, 26.2, 'DAYS SAFE', YELLOW[4], 1);
    const days = String(180 + Math.floor(hash(k.seed, 7) * 120));
    pq(p, B, um - 0.24, um + 0.24, 23.7, 25.2, '#f2eee2');
    planeText(p.c, B, um, 24.4, days, '#1e1e22', 1);
    // rota sheet: a printed grid
    pq(p, B, u0 + 0.06, u0 + 0.38, 15, 22.6, '#f4f2ea');
    for (let i = 0; i < 6; i++) pline(p, B, u0 + 0.08, 16 + i * 1.1, u0 + 0.36, 16 + i * 1.1, '#9a9a9e');
    pline(p, B, u0 + 0.2, 15.2, u0 + 0.2, 22.4, '#9a9a9e');
    pq(p, B, u0 + 0.06, u0 + 0.38, 21.6, 22.6, '#c8382a');
    // throughput chart: bars climbing
    pq(p, B, u0 + 0.44, u1 - 0.06, 17.4, 22.6, '#fbfaf4');
    for (let i = 0; i < 5; i++) {
      const hgt = 1 + hash(i, k.seed, 9) * 2.6 + i * 0.3;
      pq(p, B, u0 + 0.5 + i * 0.07, u0 + 0.54 + i * 0.07, 18, 18 + hgt, i === 4 ? '#d8402e' : '#3a7ac8');
    }
    pline(p, B, u0 + 0.48, 21.6, u1 - 0.1, 21.6, '#3fae5a');
    // a small safety poster and pins
    pq(p, B, u0 + 0.46, u1 - 0.08, 14.4, 16.9, YELLOW[4]);
    planeText(p.c, B, (u0 + 0.46 + u1 - 0.08) / 2, 15.65, 'THINK', '#2a2a2e', 1);
    for (const [u, z] of [[u0 + 0.22, 22.4], [u0 + 0.6, 22.4], [u0 + 0.6, 16.7]] as const) {
      const [x, y] = B.F(u, z);
      px(p.c, x - 1, y - 1, '#d8402e', 2, 2);
    }
  },
};

/** Fire point: a red sign, a break-glass call point, extinguishers on a bracket (water and CO2). */
const fac_firepoint: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    const B = planeAt(p, side, 0.02);
    const L = B.light;
    p.c.globalAlpha = 0.25;
    pq(p, planeAt(p, side), um - 0.3 + 0.05, um + 0.3 + 0.05, 22.2, 26.2, '#2a1a2a');
    p.c.globalAlpha = 1;
    pq(p, B, um - 0.33, um + 0.33, 23, 27, L ? RED[3] : RED[2]);
    planeText(p.c, B, um, 25.9, 'FIRE', '#fbf6ee', 1);
    planeText(p.c, B, um, 24, 'POINT', '#fbf6ee', 1);
    // the call point: a red box with a white glass
    wbox(p, side, um - 0.11, um + 0.11, 0, 0.08, 17.4, 20.4, { face: () => () => RED[L ? 3 : 2], end: () => () => RED[1], top: () => () => RED[4], edge: RED[0] });
    pq(p, planeAt(p, side, 0.081), um - 0.07, um + 0.07, 18.1, 19.8, '#f4f0e8');
    // bracket and two extinguishers standing on the floor stand
    const ext = (u: number, co2: boolean) => {
      const [x, y] = P3(p, side, u, 0.2, 3);
      const body = co2 ? ['#2a1414', '#4a1c1c', '#7a2420', '#a8322a', '#c84a3a'] : ['#4a1012', '#7a1a1a', '#a8261f', '#cc3a2c', '#e25a44'];
      layer(p.c, (l) => {
        for (let j = 0; j < 36; j++) {
          const wdt = j > 32 ? 4 - (j - 32) : 5;
          for (let i = -wdt; i < wdt; i++) {
            const t = (i + wdt) / (2 * wdt);
            px(l, x + i, y - j, body[t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1]);
          }
        }
        // the label band (cream for water, black for CO2) and the valve head
        px(l, x - 5, y - 22, co2 ? '#1e1e22' : '#f2ead6', 10, 5);
        px(l, x - 2, y - 40, STEEL[4], 4, 4);
        px(l, x - 3, y - 42, IRON[2], 8, 2);
        ln(l, x + 2, y - 38, x + 7, y - 26, IRON[1], 2);
        if (co2) {
          px(l, x + 5, y - 28, IRON[2], 4, 6);
        }
      }, { outline: 0.6, rect: [x - 8, y - 46, x + 12, y + 2] });
    };
    // the floor stand
    wbox(p, side, um - 0.34, um + 0.34, 0, 0.32, 0, 2.6, { face: () => () => RED[L ? 2 : 1], end: () => () => RED[1], top: () => () => RED[3], edge: RED[0] });
    ext(um - 0.16, false);
    ext(um + 0.16, true);
  },
};

/** A square extract fan high on the wall: a steel housing, louvres outside, blades turning. */
const fac_fan: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    wbox(p, side, um - 0.34, um + 0.34, 0, 0.22, 28.5, 39.5, { face: riveted(SHEET, 50, 46, 0.4), end: riveted(SHEET, 50, 46, 0.4), top: () => () => SHEET[4], edge: SHEET[0] });
    const F = planeAt(p, side, 0.221);
    const [cx, cy] = F.F(um, 34);
    // the round throat, dark, with a guard grille
    layer(p.c, (l) => {
      ell(l, cx, cy, 17, 18, SHEET[1]);
      ell(l, cx, cy, 15, 16, '#141418');
      for (let i = -14; i <= 14; i += 4) ln(l, cx + i, cy - 15, cx + i, cy + 15, IRON[3]);
      ell(l, cx, cy, 3, 3, IRON[3]);
    }, { outline: false, rect: [cx - 20, cy - 20, cx + 20, cy + 20] });
    // grime streaks below
    p.c.globalAlpha = 0.35;
    pq(p, planeAt(p, side), um - 0.28, um + 0.28, 24.5, 28.5, '#4a4048');
    p.c.globalAlpha = 1;
    void k;
  },
  anim(p, side, k) {
    const pl = planeAt(p, side, 0.222);
    const [cx, cy] = pl.F(k.wp.at + k.wp.w / 2, 34);
    const u = p.k / 4;
    const a0 = k.t * 6 + k.seed;
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i / 3) * Math.PI * 2;
      ln(p.c, cx, cy, cx + Math.cos(a) * 13 * u, cy + Math.sin(a) * 14 * u, '#5a5e66', Math.max(1, Math.round(2 * u)));
    }
    p.c.fillStyle = '#8a8e96';
    p.c.fillRect(Math.round(cx - u), Math.round(cy - u), Math.max(1, Math.round(2 * u)), Math.max(1, Math.round(2 * u)));
  },
};

/** A pegboard shadow board: painted silhouettes, the tools on their hooks (one gone missing). */
const fac_toolboard: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const W = planeAt(p, side);
    const B = planeAt(p, side, 0.04);
    const L = B.light;
    p.c.globalAlpha = 0.25;
    pq(p, W, u0 + 0.05, u1 + 0.05, 12.4, 25.4, '#2a1a2a');
    p.c.globalAlpha = 1;
    pt(p, B, u0, u1, 13, 26, (u: number, v: number) => {
      if (u < 2 || v < 2 || u > (u1 - u0) * FPT - 2 || v > 50) return at(TIMBER, L ? 2 : 1);
      if (u % 6 < 1.5 && v % 6 < 1.5) return '#4a3a28';
      return at(['#8a6a44', '#9e7c52', '#b28e60', '#c4a070'], L ? 2 : 1);
    }, L);
    const sil = '#3e3830';
    const tool = (u: number, z: number, fn: (x: number, y: number, col: string, hi: string) => void, missing = false) => {
      const [x, y] = B.F(u, z);
      fn(x + 1, y + 1, sil, sil);
      if (!missing) fn(x, y, '#5a6068', '#a8b0b8');
      px(p.c, x - 1, y - 1, '#c8ccd0', 2, 1);
    };
    // spanners in a graduated row
    for (let i = 0; i < 5; i++)
      tool(u0 + 0.1 + i * 0.07, 24.6, (x, y, col, hi) => {
        px(p.c, x - 1, y, col, 2, 11 + i * 2);
        px(p.c, x - 2, y, col, 4, 2);
        px(p.c, x - 2, y + 10 + i * 2, col, 4, 2);
        px(p.c, x - 1, y + 2, hi, 1, 6);
      });
    // a hammer, screwdrivers, pliers; the hacksaw's place is empty
    tool(u0 + 0.5, 24.6, (x, y, col, hi) => {
      px(p.c, x - 4, y, col, 9, 3);
      px(p.c, x - 1, y + 3, '#8a5a30', 2, 14);
      px(p.c, x - 4, y, hi, 9, 1);
    });
    for (let i = 0; i < 3; i++)
      tool(u0 + 0.62 + i * 0.05, 24.2, (x, y, col) => {
        px(p.c, x - 1, y, ['#d8402e', '#e8b830', '#3a7ac8'][i], 3, 6);
        px(p.c, x, y + 6, col === sil ? sil : '#c8ccd0', 1, 8);
      });
    tool(u0 + 0.36, 18.6, (x, y, col) => {
      ln(p.c, x - 4, y, x + 6, y + 2, col, 2);
      px(p.c, x - 6, y - 4, col, 3, 8);
    }, true);
    tool(u0 + 0.14, 18.2, (x, y, col, hi) => {
      ln(p.c, x, y, x - 3, y + 9, col === sil ? sil : '#d8402e', 2);
      ln(p.c, x + 1, y, x + 4, y + 9, col === sil ? sil : '#d8402e', 2);
      px(p.c, x - 1, y - 3, col, 3, 4);
      px(p.c, x, y - 3, hi, 1, 2);
    });
    tool(u0 + 0.66, 18.4, (x, y, col) => {
      ell(p.c, x, y + 3, 4, 4, col === sil ? sil : '#e8b830');
      px(p.c, x - 1, y + 2, col === sil ? sil : '#2a2a2e', 3, 2);
    });
    // a marker scrawl: "WHO HAS THE SAW?"
    planeText(p.c, B, (u0 + u1) / 2, 14.6, 'SAW?', '#c8382a', 1);
  },
};

/** First aid: a green cabinet with a white cross, an eyewash station, a sign. */
const fac_firstaid: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    const green: Ramp = ['#123a24', '#18502f', '#20663b', '#2c7e4a', '#3e9a5e', '#5cb478'];
    wbox(p, side, um - 0.3, um + 0.18, 0, 0.16, 14, 21.5, { face: enamel(green, 0.05), end: enamel(green, 0.05), top: () => () => green[4], edge: green[0] });
    const F = planeAt(p, side, 0.161);
    const [cx, cy] = F.F(um - 0.06, 18.4);
    px(p.c, cx - 2, cy - 6, '#f6f6f2', 4, 11);
    px(p.c, cx - 6, cy - 2, '#f6f6f2', 12, 4);
    pq(p, F, um - 0.28, um + 0.16, 14.3, 14.9, green[1]);
    // the eyewash: two green bottles on a wall plate with a mirror
    const E = planeAt(p, side, 0.03);
    pq(p, E, um + 0.22, um + 0.44, 13.5, 20.5, '#f2f0ea');
    for (const u of [um + 0.27, um + 0.38]) {
      const [x, y] = E.F(u, 14.5);
      layer(p.c, (l) => {
        px(l, x - 2, y - 14, green[3], 5, 14);
        px(l, x - 2, y - 14, green[5], 1, 14);
        px(l, x - 1, y - 17, '#f2f0ea', 3, 3);
      }, { outline: 0.6, rect: [x - 5, y - 20, x + 6, y + 2] });
    }
    // the sign above
    pq(p, E, um - 0.32, um + 0.42, 22.4, 25, green[2]);
    planeText(p.c, E, um + 0.05, 23.7, 'FIRST AID', '#f6f6f2', 1);
    void k;
  },
};

export const FACTORY_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, w);
  },
  art: { window, shutter, pipes, sign, fac_fusebox, fac_notice, fac_firepoint, fac_fan, fac_toolboard, fac_firstaid },
};


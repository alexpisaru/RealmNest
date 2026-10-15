// Robotics — the back walls of the hangar workshop. A cast kerb, painted
// slate blockwork to door-handle height, a safety-yellow band, then the pale
// corrugated liner of the hangar with its steel girts; I-beam portal columns
// wrapped in hazard tape at the foot; conduit, industrial sockets, floodlights.
// The cut top shows the cladding as built: liner, insulation, outer sheet,
// and the H of each column.
// Wall props: steel-framed windows onto the airfield, tool shadow boards,
// a blueprint on a whiteboard, a steel door, an airshow poster; and this
// pack's own decor: distribution board, hose reel, parts shelf, safety point,
// a wooden propeller, an aeronautical chart, a wall fan.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, ell, fillPoly, hash, layer, ln, px, type Ramp } from '../../kit4';
import { beam, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { lbox } from '../util';
import { ALU, BIRCH, blockwork, castConcrete, CONC, corrugated, enamel, GALV, GLASS, glassMat, HAZK, LED, ORANGE, pegboardMat, plyFace, RED, SHELL, SLATE, STEEL, TEAL, YEL } from './rkit';

const H = 44;
const T = 0.3;

const LINER: Ramp = ['#6c706e', '#838784', '#9a9e9a', '#afb2ad', '#c1c3be', '#d0d2cc', '#dee0da'];
const INSUL: Ramp = ['#a88a3e', '#c4a452', '#d8bc6a', '#e6d08a'];

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl => (side === 'ne' ? front3(p, 0) : side3(p, 0));
/** a point d tiles out from the wall into the room */
const P3 = (p: PropPainter, side: 'ne' | 'nw', u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));

/** A box standing proud of the wall: `face` toward the room, `end` the visible end. */
function proud(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, d0: number, d1: number, z0: number, z1: number, m: { face?: Mat; end?: Mat; top?: Mat; edge?: string }) {
  if (side === 'ne') lbox(p, u0, d0, u1 - u0, d1 - d0, z0, z1 - z0, { front: m.face, side: m.end, top: m.top, edge: m.edge });
  else lbox(p, d0, u0, d1 - d0, u1 - u0, z0, z1 - z0, { front: m.end, side: m.face, top: m.top, edge: m.edge });
}

const yellowBand: Mat = (light) => (u, v, x, y) => {
  let i = light ? 4 : 3;
  if (v < 0.8) i -= 1.5;
  if (hash(x, y, 3) < 0.05) i -= 1;
  if (hash(Math.floor(u / 7), 1, 4) < 0.08 && v > 1) i -= 1;
  return at(YEL, i);
};

/** I-beam portal column standing out of the wall, hazard-wrapped at the foot. */
function column(p: PropPainter, side: 'ne' | 'nw', u: number) {
  const w = 0.26;
  const d = 0.2;
  const flange: Mat = (light, _w, h) => (uu, v, x, y) => {
    let i = light ? 3.2 : 1.6;
    if (uu < 1.4) i += 1;
    if (v > h - 1.5) i += 0.6;
    if (hash(x, y, 7) < 0.03) i -= 0.7;
    // the hazard wrap: diagonal yellow and black stripes up to ~0.9 m
    if (v < 36 && v > 2) return Math.floor((uu + v) / 6) & 1 ? (light ? YEL[4] : YEL[3]) : HAZK;
    // bolted splice plate
    if (Math.abs(v - 120) < 6 && (Math.abs(uu - 4) < 1 || Math.abs(uu - 13) < 1) && Math.abs(v - 120) % 4 < 1) return SLATE[0];
    return at(SLATE, i);
  };
  const web: Mat = (light, ww, h) => (uu, v) => {
    let i = light ? 2.6 : 1.2;
    // the web, recessed between the two flanges
    if (uu > 2 && uu < ww - 2) i -= 1.1;
    if (v > h - 1.5) i += 0.5;
    if (v < 36 && v > 2) return Math.floor((uu + v) / 6) & 1 ? YEL[2] : HAZK;
    return at(SLATE, i);
  };
  proud(p, side, u - w / 2, u + w / 2, 0, d, 0, H, { face: flange, end: web, top: (_l) => () => SLATE[1], edge: SLATE[0] });
  // base plate and anchor bolts
  proud(p, side, u - w / 2 - 0.05, u + w / 2 + 0.05, 0, d + 0.06, 0, 0.5, { face: enamel(STEEL), end: enamel(STEEL), top: enamel(STEEL), edge: STEEL[0] });
  for (const du of [-0.11, 0.11]) {
    const [bx, by] = P3(p, side, u + du, d + 0.03, 0.6);
    px(p.c, bx - 1, by - 1, GALV[5], 2, 2);
  }
  // a little LED floodlight on the column, aimed down
  const [fx, fy] = P3(p, side, u, d + 0.05, 37);
  layer(
    p.c,
    (l) => {
      px(l, fx - 1, fy - 2, STEEL[3], 2, 5);
      fillPoly(l, [[fx - 7, fy + 2], [fx + 7, fy + 2], [fx + 6, fy + 8], [fx - 6, fy + 8]], STEEL[2]);
      fillPoly(l, [[fx - 6, fy + 7], [fx + 6, fy + 7], [fx + 5, fy + 9], [fx - 5, fy + 9]], '#fff6d6');
    },
    { rect: [fx - 9, fy - 4, fx + 9, fy + 11] },
  );
}

/** Conduit along the wall at height z, and drops to socket boxes. */
function conduit(p: PropPainter, side: 'ne' | 'nw', len: number, z: number, drops: [number, string][]) {
  const pl = planeOf(p, side);
  pq(p, pl, 0.1, len - 0.1, z - 0.55, z + 0.35, GALV[pl.light ? 3 : 2]);
  pq(p, pl, 0.1, len - 0.1, z + 0.15, z + 0.35, GALV[pl.light ? 5 : 3]);
  pq(p, pl, 0.1, len - 0.1, z - 0.75, z - 0.55, 'rgba(30,22,34,0.35)');
  // saddle clips every metre
  for (let u = 0.5; u < len; u += 1.2) pq(p, pl, u, u + 0.05, z - 0.7, z + 0.5, GALV[pl.light ? 2 : 1]);
  for (const [u, kind] of drops) {
    pq(p, pl, u - 0.03, u + 0.03, 10.4, z, GALV[pl.light ? 4 : 2]);
    // an industrial socket box: blue 230 V, yellow 110 V, red 400 V, or a grey switch
    const col = kind === 'blue' ? ['#1e3c78', '#2c58a8', '#4a7ad0'] : kind === 'yellow' ? [YEL[2], YEL[3], YEL[5]] : kind === 'red' ? [RED[2], RED[3], RED[5]] : [GALV[2], GALV[4], GALV[5]];
    proud(p, side, u - 0.13, u + 0.13, 0, 0.09, 7.6, 10.6, { face: enamel(['#2a2a30', col[0], col[0], col[1], col[1], col[2]]), end: enamel(['#2a2a30', col[0], col[0], col[0], col[1], col[1]]), top: (_l) => () => col[2], edge: '#1e1e24' });
    const [sx, sy] = P3(p, side, u, 0.09, 9.1);
    ell(p.c, sx, sy, 3, 2.4, col[2]);
    px(p.c, sx - 1, sy - 1, '#1a1a20', 2, 2);
  }
}

/** The bare wall. */
function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  pt(p, pl, 0, len, 0, 1.4, castConcrete(CONC, 60), light);
  pt(p, pl, 0, len, 1.4, 13, blockwork(SLATE), light);
  pq(p, pl, 0, len, 1.3, 1.6, at(CONC, light ? 1 : 0));
  pt(p, pl, 0, len, 13, 13.9, yellowBand, light);
  pt(p, pl, 0, len, 13.9, H - 1.4, corrugated(LINER, { pitch: 6, lap: 74, rust: 0.12, seed: side === 'ne' ? 3 : 4, grime: 0, tint: 0.6 }), light);
  pq(p, pl, 0, len, 13.9, 14.3, 'rgba(30,22,34,0.3)');
  // steel girts: a lit top lip, a shadow below
  for (const z of [26.5, 36]) {
    pq(p, pl, 0, len, z - 0.5, z, at(SLATE, light ? 3 : 2));
    pq(p, pl, 0, len, z, z + 0.3, at(SLATE, light ? 5 : 3));
    pq(p, pl, 0, len, z - 0.9, z - 0.5, 'rgba(30,22,34,0.28)');
  }
  // top flashing
  pt(p, pl, 0, len, H - 1.4, H, enamel(SLATE), light);
  pq(p, pl, 0, len, H - 1.6, H - 1.4, 'rgba(30,22,34,0.35)');
  // the cut top: liner | insulation | outer sheet, and each column's H
  const cols = [4, 8, 12];
  const off = side === 'ne' ? T : 0;
  const top: FaceTex = (u, v) => {
    // v runs from the room (0) outward (~21 px); u from the wall's start (−T on the NE wall)
    const uu = u / 71.55 - off;
    for (const c of cols)
      if (Math.abs(uu - c) < 0.13) {
        if (v < 2.5 || v > 15.5) return SLATE[2];
        return Math.abs(uu - c) < 0.025 ? SLATE[2] : SLATE[0];
      }
    if (v < 1.6) return LINER[5];
    if (v < 2.6) return LINER[3];
    if (v > 18.5) return Math.floor(u / 3) & 1 ? SLATE[3] : SLATE[2];
    if (v > 17.5) return SLATE[1];
    return INSUL[(Math.floor(u * 0.7 + v * 1.3) * 7) % 11 < 2 ? 0 : Math.floor(u + v) % 5 === 0 ? 3 : 2];
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], top, 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], top, 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The open end of a back wall, cut through: block section below, sandwich panel above. */
const endCap: Mat = (light, w) => (u, v, x, y) => {
  if (v < 5.6) return at(CONC, light ? 4 : 2);
  if (v < 52) {
    // hollow blocks in section
    const row = Math.floor((v - 5.6) / 8);
    const fv = v - 5.6 - row * 8;
    if (fv < 1) return at(CONC, light ? 2 : 1);
    if (u > w * 0.28 && u < w * 0.72 && fv > 2 && fv < 6.5) return at(CONC, 0);
    return at(SLATE, light ? 4 : 2);
  }
  if (v < 55.6) return YEL[light ? 4 : 3];
  if (u < 2) return LINER[light ? 5 : 3];
  if (u > w - 3) return at(SLATE, light ? 3 : 2);
  return INSUL[(Math.floor(v * 1.3 + u) % 5 === 0 ? 1 : 2) + (hash(x, y, 9) < 0.1 ? 1 : 0)];
};

// ── wall props ──────────────────────────────────────────────
/** The view out of a hangar window: sky, the airfield's grass, a hangar and a tree line, hazy. */
const view =
  (seed: number, side: 'ne' | 'nw'): FaceTex =>
  (u, v, x, y) => {
    const sky = ['#7aa8cc', '#8cb6d6', '#a0c4de', '#b8d4e6', '#d2e2ea'];
    const hz = 26 + Math.sin(u * 0.05 + seed) * 2;
    let col = sky[Math.max(0, Math.min(4, Math.floor(4.4 - (v - hz) / 14 + (bayer(x, y) - 0.5) * 0.8)))];
    // a far tree line, then the grass of the airfield
    if (v < hz + 4 + Math.floor(hash(Math.floor((u + seed * 7) / 5), 1, seed) * 3) && v > hz - 1) col = bayer(x, y) > 0.5 ? '#5d6e4a' : '#6a7a54';
    if (v < hz) col = v < hz - 6 ? (bayer(x, y) > 0.4 ? '#a59a62' : '#b2a66c') : '#8e925a';
    // a neighbouring hangar's arched roof (NE windows) or the control tower (NW)
    const hu = u - 30 - seed * 9;
    if (side === 'ne') {
      if (hu > 0 && hu < 70 && v < hz + 18 - ((hu - 35) * (hu - 35)) / 90 && v > hz - 6) col = v > hz + 2 ? (Math.floor(hu / 3) & 1 ? '#8c96a0' : '#7e8892') : '#6a7480';
    } else if (hu > 10 && hu < 18 && v < hz + 34 && v > hz - 4) col = v > hz + 28 ? '#3e5866' : '#c8c2b4';
    // a windsock on its pole
    const wu = u - 12 - seed * 4;
    if (wu > 0 && wu < 1.2 && v > hz - 6 && v < hz + 12) col = '#7a7a7a';
    if (wu > 0 && wu < 9 && v > hz + 9 && v < hz + 12 - wu * 0.15) col = Math.floor(wu / 2.4) & 1 ? '#f2f0e6' : '#f07a2a';
    return col;
  };

function hangarWindow(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, z0: number, z1: number, seed: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  // reveal: the wall's thickness in shadow round the frame
  pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 0.6, z1 + 0.8, at(SLATE, light ? 1 : 0));
  pt(p, pl, u0, u1, z0, z1, view(seed, side), light);
  // wired glass and reflections over the view
  pt(
    p,
    pl,
    u0,
    u1,
    z0,
    z1,
    (u: number, v: number, x: number, y: number) => {
      if ((u * 0.8 + v) % 46 < 5) return 'rgba(255,255,255,0.22)';
      if ((Math.floor(u) % 7 === 0 || Math.floor(v) % 7 === 0) && (x + y) % 2 === 0) return 'rgba(220,230,235,0.12)';
      if (v < 6 && hash(x, y, 5) < 0.4) return 'rgba(90,96,90,0.18)';
      return null;
    },
    light,
  );
  // glazing bars: 4 columns × 4 rows, a heavier outer frame
  const nc = Math.max(3, Math.round((u1 - u0) / 0.62));
  const bar: Ramp = [STEEL[1], STEEL[1], STEEL[2], STEEL[3], STEEL[4], STEEL[5]];
  for (let i = 1; i < nc; i++) beam(p, pl, u0 + ((u1 - u0) * i) / nc, z0, u0 + ((u1 - u0) * i) / nc, z1, 0.32, bar);
  for (let j = 1; j < 4; j++) beam(p, pl, u0, z0 + ((z1 - z0) * j) / 4, u1, z0 + ((z1 - z0) * j) / 4, 0.32, bar);
  beam(p, pl, u0, z0, u1, z0, 0.55, bar);
  beam(p, pl, u0, z1, u1, z1, 0.55, bar);
  beam(p, pl, u0, z0, u0, z1, 0.55, bar);
  beam(p, pl, u1, z0, u1, z1, 0.55, bar);
  // an opened hopper pane (darker, its lower edge tipped in) and a boarded-up pane
  const pw = (u1 - u0) / nc;
  const ph = (z1 - z0) / 4;
  const oc = (seed % nc) as number;
  pq(p, pl, u0 + pw * oc + 0.04, u0 + pw * (oc + 1) - 0.04, z0 + ph * 2 + 0.3, z0 + ph * 3 - 0.3, 'rgba(30,40,48,0.45)');
  pq(p, pl, u0 + pw * oc + 0.04, u0 + pw * (oc + 1) - 0.04, z0 + ph * 2 + 0.3, z0 + ph * 2 + 0.7, STEEL[3]);
  const bc = (oc + 2) % nc;
  pt(p, pl, u0 + pw * bc + 0.05, u0 + pw * (bc + 1) - 0.05, z0 + 0.35, z0 + ph - 0.35, plyFace(BIRCH), light);
  // a crack across one pane
  const [cx0, cy0] = pl.F(u0 + pw * ((oc + 1) % nc) + 0.1, z0 + ph * 3.2);
  ln(p.c, cx0, cy0, cx0 + 14, cy0 + 6, 'rgba(255,255,255,0.6)');
  ln(p.c, cx0 + 7, cy0 + 3, cx0 + 9, cy0 + 10, 'rgba(255,255,255,0.5)');
  // a deep concrete sill and what lives on it
  proud(p, side, u0 - 0.1, u1 + 0.1, 0, 0.16, z0 - 1.2, z0 - 0.1, { face: castConcrete(CONC), end: castConcrete(CONC), top: (_l) => (_u, _v, x, y) => at(CONC, hash(x, y, 8) < 0.1 ? 4 : 5), edge: CONC[1] });
  const [sx, sy] = P3(p, side, u0 + 0.4, 0.08, z0 - 0.1);
  const [mx, my] = P3(p, side, u1 - 0.45, 0.08, z0 - 0.1);
  layer(
    p.c,
    (l) => {
      if (seed % 2 === 0) {
        // a balsa model of a high-wing trainer
        fillPoly(l, [[sx - 14, sy - 10], [sx + 14, sy - 14], [sx + 16, sy - 12], [sx - 12, sy - 8]], '#f2d36a');
        fillPoly(l, [[sx - 4, sy - 6], [sx + 8, sy - 9], [sx + 9, sy - 5], [sx - 3, sy - 2]], '#e8c050');
        px(l, sx - 8, sy - 8, '#c83a2a', 4, 2);
        ln(l, sx + 9, sy - 7, sx + 11, sy - 2, '#3a2a20');
        ln(l, sx - 6, sy - 4, sx - 8, sy, '#8a6a40');
        ln(l, sx + 2, sy - 4, sx + 4, sy, '#8a6a40');
      } else {
        // a stack of maintenance manuals
        for (let i = 0; i < 4; i++) {
          const c = ['#2e4a6a', '#c8382a', '#e8dcc6', '#3a5a3a'][i];
          fillPoly(l, [[sx - 12, sy - 2 - i * 3], [sx, sy - 7 - i * 3], [sx + 12, sy - 3 - i * 3], [sx, sy + 2 - i * 3]], c);
        }
      }
      // a mug and a tiny cactus
      px(l, mx - 3, my - 8, '#f2ead8', 6, 7);
      px(l, mx - 3, my - 8, '#ffffff', 2, 7);
      px(l, mx + 3, my - 6, '#e2dac8', 2, 3);
      ell(l, mx, my - 8, 3, 1.2, '#4a2e1e');
      fillPoly(l, [[mx + 9, my - 5], [mx + 15, my - 5], [mx + 14, my], [mx + 10, my]], '#c0703c');
      ell(l, mx + 12, my - 9, 2.5, 4, '#5a8a3a');
      px(l, mx + 11, my - 12, '#7aaa4a', 1, 4);
    },
    { rect: [Math.min(sx, mx) - 20, Math.min(sy, my) - 20, Math.max(sx, mx) + 20, Math.max(sy, my) + 4] },
  );
}

const window: WallArt4 = {
  draw(p, side, k) {
    hangarWindow(p, side, k.wp.at + 0.2, k.wp.at + k.wp.w - 0.2, 16, 35, k.seed);
  },
};

// ── tool shadow boards ──────────────────────────────────────
const pegboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.2;
    const u1 = k.wp.at + k.wp.w - 0.15;
    const z0 = 15;
    const z1 = 29;
    // a birch frame screwed to the liner, the board inside
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(30,22,34,0.3)');
    pt(p, pl, u0, u1, z0, z1, plyFace(BIRCH), light);
    pt(p, pl, u0 + 0.06, u1 - 0.06, z0 + 0.5, z1 - 0.5, pegboardMat, light);
    const F = (u: number, z: number) => pl.F(u, z);
    const electronics = side === 'nw';
    const c = p.c;
    // painted shadow outlines first, then the tools hanging on their hooks
    const hook = (u: number, z: number) => {
      const [hx, hy] = F(u, z);
      px(c, hx, hy - 1, GALV[5], 1, 2);
      px(c, hx, hy + 1, GALV[3], 2, 1);
    };
    const W = u1 - u0;
    if (!electronics) {
      // screwdrivers in a row
      for (let i = 0; i < 6; i++) {
        const u = u0 + 0.22 + i * 0.13;
        const [x, y] = F(u, z1 - 1.4);
        const hc = ['#d8402e', '#f2c43a', '#2c62c8', '#1e1e24', '#d8402e', '#3aa058'][i];
        px(c, x - 1, y, '#e8e0cc', 3, 26);
        px(c, x, y + 10, GALV[5], 1, 14 + (i % 3) * 3);
        px(c, x - 1, y, hc, 3, 10);
        px(c, x - 1, y, '#ffffff', 1, 4);
        hook(u, z1 - 1.2);
      }
      // graded spanners
      for (let i = 0; i < 7; i++) {
        const u = u0 + 1.15 + i * 0.12;
        if (u > u1 - 0.3) break;
        const [x, y] = F(u, z1 - 1.6);
        const L = 14 + i * 3;
        px(c, x - 1, y, '#e8e0cc', 3, L + 2);
        px(c, x, y + 2, GALV[4], 1, L - 4);
        ell(c, x, y + 1, 2.2, 2.2, GALV[4]);
        ell(c, x, y + L - 1, 2, 2.6, GALV[3]);
        px(c, x, y + L - 2, '#5a5e64', 1, 2);
        hook(u, z1 - 1.3);
      }
      // a claw hammer, pliers and side cutters, a hacksaw, ear defenders, a tape
      const [hx, hy] = F(u0 + 0.35, z0 + 7);
      fillPoly(c, [[hx - 2, hy], [hx + 2, hy], [hx + 2, hy + 26], [hx - 2, hy + 26]], '#b8844a');
      px(c, hx - 2, hy, '#d8a868', 1, 26);
      fillPoly(c, [[hx - 9, hy - 3], [hx + 7, hy - 3], [hx + 9, hy + 2], [hx - 9, hy + 2]], STEEL[4]);
      px(c, hx - 9, hy - 3, STEEL[5], 16, 1);
      for (let i = 0; i < 2; i++) {
        const [px0, py0] = F(u0 + 0.75 + i * 0.22, z0 + 7.4);
        const hcol = i ? '#2c62c8' : '#d8402e';
        ln(c, px0, py0, px0 - 3, py0 + 8, GALV[4], 2);
        ln(c, px0 + 2, py0, px0 + 5, py0 + 8, GALV[4], 2);
        ln(c, px0 - 3, py0 + 8, px0 - 5, py0 + 22, hcol, 3);
        ln(c, px0 + 5, py0 + 8, px0 + 7, py0 + 22, hcol, 3);
        hook(u0 + 0.75 + i * 0.22, z0 + 7.8);
      }
      if (W > 2) {
        const [sx0, sy0] = F(u0 + 1.25, z0 + 5.5);
        const [sx1, sy1] = F(u1 - 0.25, z0 + 5.5);
        ln(c, sx0, sy0, sx1, sy1, '#2c62c8', 2);
        ln(c, sx0, sy0, sx0, sy0 + 10, '#2c62c8', 2);
        ln(c, sx1, sy1, sx1, sy1 + 10, '#2c62c8', 2);
        ln(c, sx0, sy0 + 9, sx1, sy1 + 9, GALV[5], 1);
        for (let t = 0.05; t < 1; t += 0.06) px(c, sx0 + (sx1 - sx0) * t, sy0 + (sy1 - sy0) * t + 10, GALV[2]);
        hook(u0 + 1.3, z0 + 6);
        hook(u1 - 0.3, z0 + 6);
      }
      const [ex, ey] = F(u1 - 0.32, z1 - 5.5);
      layer(
        c,
        (l) => {
          // ear defenders on a hook
          ln(l, ex - 7, ey + 2, ex - 5, ey - 6, '#2a2a30', 2);
          ln(l, ex - 5, ey - 6, ex + 5, ey - 6, '#2a2a30', 2);
          ln(l, ex + 5, ey - 6, ex + 7, ey + 2, '#2a2a30', 2);
          ell(l, ex - 7, ey + 5, 4, 5, '#d8402e');
          ell(l, ex + 7, ey + 5, 4, 5, '#b8302a');
          px(l, ex - 9, ey + 2, '#ec6a52', 2, 3);
          // a tape measure below
          ell(l, ex, ey + 18, 5, 5, YEL[4]);
          ell(l, ex - 1, ey + 17, 2.5, 2.5, YEL[6]);
          px(l, ex + 3, ey + 21, '#2a2a30', 3, 2);
        },
        { rect: [ex - 14, ey - 10, ex + 14, ey + 26] },
      );
    } else {
      // wire spools on a dowel, crimpers, a multimeter, heat-shrink and tape
      const [dx0, dy0] = F(u0 + 0.12, z1 - 3);
      const [dx1, dy1] = F(u1 - 0.12, z1 - 3);
      ln(c, dx0, dy0, dx1, dy1, BIRCH[2], 2);
      const nsp = Math.floor((u1 - u0 - 0.2) / 0.26);
      for (let i = 0; i < nsp; i++) {
        const [x, y] = F(u0 + 0.25 + i * 0.26, z1 - 3);
        const col = ['#d8402e', '#1e1e24', '#2c62c8', '#f2c43a', '#3aa058', '#f2f0ea', '#c86ab8'][i % 7];
        layer(
          c,
          (l) => {
            ell(l, x, y, 7, 8, '#3a3a40');
            ell(l, x, y, 6, 7, col);
            for (let j = -5; j <= 5; j += 2) px(l, x - 6, y + j, col === '#1e1e24' ? '#3a3a44' : '#ffffff', 12, 1);
            ell(l, x, y, 2, 2.4, '#3a3a40');
          },
          { outline: 0.5, rect: [x - 10, y - 10, x + 10, y + 10] },
        );
        // a loose end dangling
        if (i % 2 === 0) ln(c, x + 4, y + 6, x + 6, y + 18, col);
      }
      const [mx, my] = F(u0 + 0.4, z0 + 7.2);
      layer(
        c,
        (l) => {
          fillPoly(l, [[mx - 8, my - 12], [mx + 8, my - 12], [mx + 8, my + 12], [mx - 8, my + 12]], YEL[3]);
          px(l, mx - 6, my - 10, '#1e2620', 12, 7);
          px(l, mx - 5, my - 9, '#9ac88a', 10, 5);
          px(l, mx - 4, my - 8, '#2a3a2a', 2, 3);
          px(l, mx - 1, my - 8, '#2a3a2a', 2, 3);
          px(l, mx + 2, my - 8, '#2a3a2a', 2, 3);
          ell(l, mx, my + 3, 4, 4, '#2a2a30');
          px(l, mx, my + 1, '#f2f0ea', 1, 3);
          px(l, mx - 5, my + 9, '#d8402e', 2, 2);
          px(l, mx + 3, my + 9, '#1e1e24', 2, 2);
          ln(l, mx - 4, my + 12, mx - 10, my + 26, '#d8402e');
          ln(l, mx + 4, my + 12, mx + 9, my + 26, '#1e1e24');
        },
        { rect: [mx - 14, my - 16, mx + 14, my + 30] },
      );
      // heat-shrink bundles and tape rolls on pegs
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = F(u0 + 0.85 + i * 0.2, z0 + 6);
        const col = ['#d8402e', '#2c62c8', '#1e1e24', YEL[4]][i];
        ell(c, tx, ty, 4, 4, col);
        ell(c, tx, ty, 1.6, 1.6, '#8a6a44');
        px(c, tx - 3, ty - 3, '#ffffff', 2, 1);
        hook(u0 + 0.85 + i * 0.2, z0 + 7.2);
      }
      for (let i = 0; i < 5; i++) {
        const [hx, hy] = F(u0 + 0.85 + i * 0.12, z0 + 3.6);
        px(c, hx, hy - 12, ['#d8402e', '#1e1e24', '#3aa058', '#2c62c8', YEL[4]][i], 2, 12);
      }
    }
    // a little shelf of spray cans along the bottom
    proud(p, side, u0 + 0.1, u1 - 0.1, 0, 0.14, z0 - 0.4, z0, { face: plyFace(BIRCH), end: plyFace(BIRCH), top: plyFace(BIRCH), edge: BIRCH[1] });
    const ncan = Math.floor((u1 - u0) / 0.32);
    for (let i = 0; i < ncan; i++) {
      const [cx, cy] = P3(p, side, u0 + 0.3 + i * 0.3, 0.07, z0);
      const col = [YEL[4], '#2c62c8', '#d8402e', '#3aa058', '#e8e4dc'][(i + k.seed) % 5];
      px(c, cx - 2, cy - 10, col, 5, 10);
      px(c, cx - 2, cy - 10, '#ffffff', 1, 10);
      px(c, cx - 2, cy - 6, i % 2 ? '#1e1e24' : '#f2f0ea', 5, 2);
      px(c, cx - 1, cy - 12, GALV[4], 3, 2);
    }
  },
};

// ── the blueprint on a whiteboard ───────────────────────────
const whiteboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.2;
    const u1 = k.wp.at + k.wp.w - 0.18;
    const z0 = 14.5;
    const z1 = 29;
    pq(p, pl, u0 + 0.06, u1 + 0.06, z0 - 0.6, z1 - 0.6, 'rgba(30,22,34,0.3)');
    pq(p, pl, u0, u1, z0, z1, ALU[light ? 4 : 2]);
    pq(p, pl, u0, u1, z1 - 0.4, z1, ALU[light ? 6 : 4]);
    pt(p, pl, u0 + 0.05, u1 - 0.05, z0 + 0.4, z1 - 0.4, (u: number, v: number, x: number, y: number) => ((u * 0.7 + v) % 50 < 4 ? '#ffffff' : hash(x, y, 41) < 0.02 ? '#dfe6e8' : '#eef3f2'), light);
    const blue = k.wp.variant === 'blueprint';
    const bu0 = u0 + 0.15;
    const bu1 = blue ? u1 - 0.75 : u0 + 0.15;
    if (blue) {
      // the sheet: Prussian blue, a faint grid, white linework of a robot arm
      pt(
        p,
        pl,
        bu0,
        bu1,
        z0 + 1,
        z1 - 1.2,
        (u: number, v: number, x: number, y: number) => {
          if (u % 9 < 0.8 || v % 9 < 0.8) return '#3466a8';
          return hash(x, y, 43) < 0.04 ? '#2a5c9e' : '#21528f';
        },
        light,
      );
      const L = (ua: number, za: number, ub: number, zb: number, col = '#e8f2fa') => {
        const [x0, y0] = pl.F(ua, za);
        const [x1, y1] = pl.F(ub, zb);
        ln(p.c, x0, y0, x1, y1, col);
      };
      const W = bu1 - bu0;
      const U = (f: number) => bu0 + W * f;
      // base, turntable, two links, wrist and gripper in elevation
      L(U(0.08), z0 + 3, U(0.36), z0 + 3);
      L(U(0.08), z0 + 3, U(0.1), z0 + 4.5);
      L(U(0.34), z0 + 3, U(0.32), z0 + 4.5);
      L(U(0.1), z0 + 4.5, U(0.32), z0 + 4.5);
      L(U(0.2), z0 + 4.5, U(0.24), z0 + 9.5);
      L(U(0.24), z0 + 4.5, U(0.28), z0 + 9.5);
      L(U(0.26), z0 + 9.5, U(0.56), z0 + 12.5);
      L(U(0.26), z0 + 8.6, U(0.56), z0 + 11.6);
      L(U(0.56), z0 + 12, U(0.72), z0 + 8.4);
      L(U(0.58), z0 + 11, U(0.7), z0 + 8);
      L(U(0.72), z0 + 8.4, U(0.8), z0 + 7.6);
      L(U(0.72), z0 + 8.4, U(0.8), z0 + 9.2);
      for (const [f, z] of [[0.26, 9.1], [0.56, 12], [0.71, 8.2]] as const) {
        const [cx, cy] = pl.F(U(f), z0 + z);
        ell(p.c, cx, cy, 3, 3, '#e8f2fa');
        ell(p.c, cx, cy, 2, 2, '#21528f');
      }
      // dimension lines, a detail circle, a title block
      L(U(0.08), z0 + 1.8, U(0.36), z0 + 1.8, '#9cc4e8');
      L(U(0.42), z0 + 4.5, U(0.42), z0 + 12.5, '#9cc4e8');
      const [dcx, dcy] = pl.F(U(0.86), z0 + 11);
      for (let a = 0; a < 24; a++) px(p.c, dcx + Math.cos((a / 24) * Math.PI * 2) * 9, dcy + Math.sin((a / 24) * Math.PI * 2) * 9, '#e8f2fa');
      L(U(0.82), z0 + 10, U(0.9), z0 + 12, '#e8f2fa');
      pq(p, pl, U(0.62), U(0.97), z0 + 1.4, z0 + 4.2, '#e8f2fa');
      pq(p, pl, U(0.64), U(0.95), z0 + 1.7, z0 + 3.9, '#21528f');
      for (let i = 0; i < 3; i++) L(U(0.66), z0 + 2.2 + i * 0.6, U(0.66 + 0.1 + i * 0.05), z0 + 2.2 + i * 0.6, '#c8dcf0');
      // a red revision cloud
      const [rcx, rcy] = pl.F(U(0.5), z0 + 6.5);
      for (let a = 0; a < 18; a++) px(p.c, rcx + Math.cos((a / 18) * Math.PI * 2) * 11, rcy + Math.sin((a / 18) * Math.PI * 2) * 6, '#ff6a5a', 2, 1);
      // magnets at the corners
      for (const [u, z] of [[bu0 + 0.05, z1 - 1.5], [bu1 - 0.05, z1 - 1.5], [bu0 + 0.05, z0 + 1.3], [bu1 - 0.05, z0 + 1.3]] as const) {
        const [x, y] = pl.F(u, z);
        ell(p.c, x, y, 2.4, 2.4, ['#d8402e', '#2c62c8', YEL[4], '#3aa058'][Math.floor(u * 10) % 4]);
        px(p.c, x - 1, y - 1, '#ffffff');
      }
    }
    // sticky notes and a marker sketch of a gripper in the margin
    const mu = blue ? bu1 + 0.08 : u0 + 0.3;
    const notes = ['#f6d860', '#f2a0c0', '#9fe3b8', '#f6d860', '#9fc8f2'];
    for (let i = 0; i < 4; i++) {
      const u = mu + (i % 2) * 0.32;
      const z = z1 - 4 - Math.floor(i / 2) * 3.6;
      pq(p, pl, u, u + 0.26, z, z + 2.9, notes[(i + k.seed) % notes.length]);
      pq(p, pl, u, u + 0.26, z + 2.5, z + 2.9, '#fff6c0');
      const [a0, b0] = pl.F(u + 0.04, z + 1.6);
      const [a1, b1] = pl.F(u + 0.2, z + 1.6);
      ln(p.c, a0, b0, a1, b1, '#5a5040');
      const [a2, b2] = pl.F(u + 0.04, z + 0.9);
      const [a3, b3] = pl.F(u + 0.15, z + 0.9);
      ln(p.c, a2, b2, a3, b3, '#5a5040');
    }
    const [gx, gy] = pl.F(mu + 0.3, z0 + 3.4);
    ln(p.c, gx - 6, gy + 4, gx, gy - 2, '#c8382a');
    ln(p.c, gx, gy - 2, gx + 8, gy - 2, '#c8382a');
    ln(p.c, gx - 6, gy + 4, gx, gy + 8, '#c8382a');
    ln(p.c, gx, gy + 8, gx + 8, gy + 8, '#c8382a');
    // the marker tray
    pq(p, pl, u0 + 0.2, u1 - 0.2, z0 - 0.3, z0 + 0.3, ALU[light ? 3 : 2]);
    for (let i = 0; i < 4; i++) pq(p, pl, u0 + 0.4 + i * 0.25, u0 + 0.6 + i * 0.25, z0 + 0.3, z0 + 0.9, ['#2a5aa8', '#c8382a', '#1e1e24', '#3aa058'][i]);
  },
};

// ── the personnel door ──────────────────────────────────────
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.14;
    const u1 = k.wp.at + k.wp.w - 0.14;
    // steel frame, the leaf in teal enamel, a wired-glass vision panel
    pq(p, pl, u0 - 0.08, u1 + 0.08, 0, 22.6, STEEL[light ? 2 : 1]);
    pq(p, pl, u0 - 0.08, u1 + 0.08, 22.2, 22.6, STEEL[light ? 4 : 3]);
    pt(p, pl, u0, u1, 0, 21.8, enamel(TEAL, 0.004), light);
    pq(p, pl, u0, u0 + 0.04, 0, 21.8, TEAL[light ? 5 : 4]);
    const vu0 = u0 + (u1 - u0) * 0.58;
    const vu1 = u0 + (u1 - u0) * 0.82;
    pq(p, pl, vu0 - 0.03, vu1 + 0.03, 11.6, 19.4, TEAL[1]);
    pt(p, pl, vu0, vu1, 12, 19, glassMat(GLASS), light);
    pt(p, pl, vu0, vu1, 12, 19, (u: number, v: number) => (Math.floor(u) % 5 === 0 || Math.floor(v) % 5 === 0 ? 'rgba(230,240,240,0.25)' : null), light);
    // lever handle, lock, kick plate, a closer arm
    const [hx, hy] = pl.F(u0 + 0.12, 10.4);
    px(p.c, hx - 1, hy - 3, GALV[3], 3, 6);
    px(p.c, hx, hy - 1, GALV[5], 9, 2);
    px(p.c, hx, hy + 2, GALV[2], 2, 2);
    pt(p, pl, u0 + 0.03, u1 - 0.03, 0.2, 2.6, (u: number, v: number) => (Math.floor(u / 4 + v / 3) % 2 ? GALV[light ? 4 : 3] : GALV[light ? 5 : 4]), light);
    const [cx, cy] = pl.F(u1 - 0.3, 21.2);
    px(p.c, cx - 8, cy - 2, GALV[2], 16, 3);
    px(p.c, cx - 8, cy - 2, GALV[4], 16, 1);
    // signs: safety glasses (blue), authorised personnel (yellow), and EXIT above
    const [bx, by] = pl.F(u0 + 0.3, 16.5);
    ell(p.c, bx, by, 6, 6, '#f2f0ea');
    ell(p.c, bx, by, 5, 5, '#2c62c8');
    px(p.c, bx - 3, by - 1, '#f2f0ea', 2, 2);
    px(p.c, bx + 1, by - 1, '#f2f0ea', 2, 2);
    px(p.c, bx - 1, by - 1, '#f2f0ea', 2, 1);
    pq(p, pl, u0 + 0.12, u0 + 0.48, 6.6, 9, YEL[4]);
    pq(p, pl, u0 + 0.12, u0 + 0.48, 8.6, 9, '#1e1e24');
    for (let i = 0; i < 2; i++) {
      const [a0, b0] = pl.F(u0 + 0.16, 7.4 + i * 0.6);
      const [a1, b1] = pl.F(u0 + 0.42, 7.4 + i * 0.6);
      ln(p.c, a0, b0, a1, b1, '#3a3020');
    }
    pq(p, pl, u0 + 0.1, u1 - 0.1, 23.6, 26, '#1e5a32');
    pq(p, pl, u0 + 0.13, u1 - 0.13, 23.9, 25.7, '#2fa058');
    const [ex, ey] = pl.F(u0 + 0.3, 25.4);
    px(p.c, ex, ey, '#f2f0ea', 2, 2);
    ln(p.c, ex + 1, ey + 2, ex - 1, ey + 5, '#f2f0ea');
    ln(p.c, ex + 1, ey + 3, ex + 3, ey + 6, '#f2f0ea');
    const [ax, ay] = pl.F(u0 + 0.62, 24.8);
    px(p.c, ax - 4, ay, '#f2f0ea', 8, 1);
    px(p.c, ax + 2, ay - 1, '#f2f0ea', 1, 3);
    // a card reader beside the frame
    const [rx, ry] = pl.F(u1 + 0.2, 10.5);
    px(p.c, rx - 3, ry - 5, '#2a2a30', 6, 9);
    px(p.c, rx - 2, ry - 4, '#3e4048', 4, 5);
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [rx, ry] = pl.F(k.wp.at + k.wp.w - 0.14 + 0.2, 10.5);
    const u = p.k / 4;
    px(p.c, rx - u, ry + 2 * u, Math.sin(k.t * 1.3) > 0.85 ? LED.green : LED.red, Math.max(1, 2 * u), Math.max(1, u));
  },
};

// ── an airshow poster ───────────────────────────────────────
const poster: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const col = k.wp.color ?? '#2fb5c8';
    const u0 = k.wp.at + 0.2;
    const u1 = k.wp.at + 0.86;
    const z0 = 15.5;
    const z1 = 30;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(30,22,34,0.3)');
    pq(p, pl, u0, u1, z0, z1, '#1e1e24');
    pq(p, pl, u0 + 0.04, u1 - 0.04, z0 + 0.5, z1 - 0.5, col);
    // a cream sun, a red biplane looping on a smoke trail, the title band
    const [sx, sy] = pl.F((u0 + u1) / 2 + 0.06, z0 + 9.5);
    ell(p.c, sx, sy, 10, 10, '#f6e6b0');
    ell(p.c, sx - 2, sy - 2, 6, 6, '#fbf2d0');
    const [lx, ly] = pl.F((u0 + u1) / 2 - 0.04, z0 + 8.5);
    for (let a = 0; a < 30; a++) {
      const t = (a / 30) * Math.PI * 1.7 + 0.4;
      px(p.c, lx + Math.cos(t) * 12, ly + Math.sin(t) * 13, '#ffffff', 2, 1);
    }
    const [bx, by] = pl.F(u0 + 0.16, z0 + 11.8);
    fillPoly(p.c, [[bx - 6, by], [bx + 7, by - 2], [bx + 8, by], [bx - 5, by + 2]], '#c8302a');
    fillPoly(p.c, [[bx - 2, by - 4], [bx + 3, by - 5], [bx + 4, by + 4], [bx - 1, by + 5]], '#e8483a');
    pq(p, pl, u0 + 0.04, u1 - 0.04, z0 + 0.5, z0 + 4.4, '#1e2a3a');
    for (let i = 0; i < 2; i++) {
      const [a0, b0] = pl.F(u0 + 0.1, z0 + 2 + i * 1.2);
      const [a1, b1] = pl.F(u1 - 0.12 - i * 0.12, z0 + 2 + i * 1.2);
      ln(p.c, a0, b0, a1, b1, i ? '#f6e6b0' : '#ffffff');
    }
  },
};

// ── the pack's own wall decor ───────────────────────────────
/** Distribution board: a grey steel cabinet, an isolator, conduits up to the roof. */
const rob_panel: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.24;
    const u1 = k.wp.at + 0.86;
    // conduits rising to the roof
    for (const u of [u0 + 0.12, u0 + 0.3, u0 + 0.46]) {
      pq(p, pl, u - 0.035, u + 0.035, 26, H - 1.4, GALV[light ? 4 : 2]);
      pq(p, pl, u - 0.035, u - 0.01, 26, H - 1.4, GALV[light ? 6 : 4]);
    }
    proud(p, side, u0, u1, 0, 0.18, 15, 26, { face: enamel(GALV), end: enamel(GALV), top: enamel(GALV), edge: GALV[0] });
    const F = (u: number, z: number) => P3(p, side, u, 0.18, z);
    // a hinge line, the lock, a yellow danger sign with a bolt
    const [ax, ay] = F(u1 - 0.08, 20.5);
    px(p.c, ax - 1, ay - 2, '#2a2a30', 3, 4);
    const [tx, ty] = F((u0 + u1) / 2, 23);
    fillPoly(p.c, [[tx, ty - 6], [tx + 6, ty + 4], [tx - 6, ty + 4]], '#1e1e24');
    fillPoly(p.c, [[tx, ty - 4], [tx + 4, ty + 3], [tx - 4, ty + 3]], YEL[4]);
    ln(p.c, tx + 1, ty - 2, tx - 1, ty + 1, '#1e1e24');
    ln(p.c, tx - 1, ty + 1, tx + 1, ty + 2, '#1e1e24');
    // circuit labels
    for (let i = 0; i < 3; i++) {
      const [lx, ly] = F(u0 + 0.12, 17.5 + i * 1.1);
      px(p.c, lx, ly, '#f2f0ea', 14, 2);
    }
    // the isolator: a yellow box with a red rotary handle
    proud(p, side, u0 + 0.12, u0 + 0.42, 0, 0.14, 9.6, 13.4, { face: enamel(YEL), end: enamel(YEL), top: enamel(YEL), edge: YEL[1] });
    const [ix, iy] = F(u0 + 0.27, 11.6);
    ell(p.c, ix - 1, iy, 4, 4, RED[3]);
    px(p.c, ix - 5, iy - 1, RED[5], 8, 2);
    pq(p, pl, u0 + 0.24, u0 + 0.3, 13.4, 15, GALV[light ? 3 : 2]);
  },
  anim(p, side, k) {
    const [x, y] = P3(p, side, k.wp.at + 0.4, 0.18, 25);
    const u = p.k / 4;
    px(p.c, x, y, Math.sin(k.t * 2 + k.seed) > -0.6 ? LED.green : '#2a5a3a', Math.max(1, 2 * u), Math.max(1, 2 * u));
  },
};

/** A yellow air-hose reel with its blow gun, and an orange extension reel on a hook. */
const rob_reel: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const uc = k.wp.at + 0.55;
    const [x, y] = P3(p, side, uc, 0.2, 24);
    layer(
      p.c,
      (l) => {
        // bracket
        fillPoly(l, [[x - 3, y - 14], [x + 3, y - 14], [x + 3, y + 12], [x - 3, y + 12]], STEEL[2]);
        // the drum
        ell(l, x, y, 13, 14, YEL[2]);
        ell(l, x - 1, y - 1, 12, 13, YEL[4]);
        for (let r = 4; r <= 10; r += 2) {
          for (let a = 0; a < 26; a++) {
            const t = (a / 26) * Math.PI * 2;
            px(l, x + Math.cos(t) * r * 0.9, y + Math.sin(t) * r, '#2a2a30');
          }
        }
        ell(l, x, y, 3, 3, GALV[4]);
        px(l, x - 7, y - 10, YEL[6], 4, 2);
        // the hose looping down to a blow gun
        let hx = x + 6;
        let hy = y + 10;
        for (let i = 0; i < 26; i++) {
          const nx = x + 10 + Math.sin(i * 0.22) * 6;
          const ny = y + 10 + i * 2;
          ln(l, hx, hy, nx, ny, '#d8402e', 2);
          hx = nx;
          hy = ny;
        }
        fillPoly(l, [[hx - 3, hy], [hx + 4, hy], [hx + 3, hy + 9], [hx - 1, hy + 9]], '#2a2a30');
        px(l, hx + 3, hy + 2, GALV[4], 5, 2);
      },
      { rect: [x - 18, y - 18, x + 26, y + 72] },
    );
    const [ex, ey] = P3(p, side, uc - 0.12, 0.16, 12);
    layer(
      p.c,
      (l) => {
        px(l, ex - 1, ey - 18, GALV[3], 2, 5);
        ell(l, ex, ey, 10, 11, ORANGE[2]);
        ell(l, ex - 1, ey - 1, 9, 10, ORANGE[4]);
        for (let j = -7; j <= 7; j += 2) px(l, ex - 8, ey + j, ORANGE[3], 16, 1);
        ell(l, ex, ey, 3.5, 4, '#2a2a30');
        px(l, ex + 6, ey + 7, '#2a2a30', 6, 4);
      },
      { rect: [ex - 14, ey - 22, ex + 14, ey + 14] },
    );
    void pl;
  },
};

/** A steel-bracketed birch shelf with parts bins, a robot head and a trophy. */
const rob_shelf: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + 0.92;
    for (const [z, d] of [[19, 0.34], [26, 0.3]] as const) {
      proud(p, side, u0, u1, 0, d, z - 0.5, z, { face: plyFace(BIRCH), end: plyFace(BIRCH), top: plyFace(BIRCH), edge: BIRCH[1] });
      for (const u of [u0 + 0.1, u1 - 0.12]) {
        const [bx, by] = P3(p, side, u, 0.02, z - 0.5);
        const [cx, cy] = P3(p, side, u, d - 0.06, z - 0.5);
        ln(p.c, bx, by, cx, cy, STEEL[3]);
        ln(p.c, bx, by, bx, by + 12, STEEL[3]);
      }
    }
    // lower shelf: three louvred parts bins with label cards
    for (let i = 0; i < 3; i++) {
      const ua = u0 + 0.04 + i * 0.22;
      const col: Ramp = [['#1e3c78', '#264a90', '#2c58a8', '#3a6ac0', '#4a7ad0', '#6a96e0'], [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]], [YEL[1], YEL[2], YEL[3], YEL[4], YEL[5], YEL[6]]][(i + k.seed) % 3];
      proud(p, side, ua, ua + 0.19, 0.04, 0.3, 19, 21.2, { face: enamel(col), end: enamel(col), top: (_l) => () => col[1], edge: col[0] });
      const [lx, ly] = P3(p, side, ua + 0.05, 0.3, 20.4);
      px(p.c, lx, ly, '#f2f0ea', 6, 3);
      px(p.c, lx + 1, ly + 1, '#3a3a40', 4, 1);
    }
    // upper shelf: a prototype robot head and a little trophy
    const [hx, hy] = P3(p, side, u0 + 0.22, 0.16, 26);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[hx - 9, hy - 2], [hx + 9, hy - 2], [hx + 8, hy - 18], [hx - 8, hy - 18]], SHELL[4]);
        fillPoly(l, [[hx - 9, hy - 2], [hx - 5, hy - 2], [hx - 5, hy - 18], [hx - 8, hy - 18]], SHELL[5]);
        px(l, hx - 6, hy - 14, '#1a2028', 12, 7);
        px(l, hx - 4, hy - 12, LED.cyan, 2, 2);
        px(l, hx + 2, hy - 12, LED.cyan, 2, 2);
        px(l, hx - 1, hy - 22, STEEL[3], 2, 4);
        px(l, hx - 2, hy - 24, RED[4], 3, 2);
      },
      { rect: [hx - 12, hy - 28, hx + 12, hy + 2] },
    );
    const [tx, ty] = P3(p, side, u1 - 0.2, 0.15, 26);
    layer(
      p.c,
      (l) => {
        px(l, tx - 5, ty - 4, '#2a2a30', 10, 4);
        px(l, tx - 1, ty - 9, '#c89a3a', 3, 5);
        fillPoly(l, [[tx - 6, ty - 18], [tx + 6, ty - 18], [tx + 3, ty - 9], [tx - 3, ty - 9]], '#e2b84a');
        px(l, tx - 5, ty - 17, '#f6dc7a', 3, 5);
        px(l, tx - 9, ty - 17, '#c89a3a', 3, 4);
        px(l, tx + 6, ty - 17, '#c89a3a', 3, 4);
      },
      { rect: [tx - 12, ty - 22, tx + 12, ty + 2] },
    );
  },
};

/** A fire point: extinguisher on its bracket, its sign, and a first-aid box. */
const rob_safety: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const uc = k.wp.at + 0.55;
    pq(p, pl, uc - 0.22, uc + 0.22, 14.6, 18.2, '#f2f0ea');
    pq(p, pl, uc - 0.2, uc + 0.2, 14.8, 18, RED[3]);
    // the extinguisher pictogram: a white bottle, its nozzle and hose, a little flame
    const [sx, sy] = pl.F(uc - 0.05, 16.2);
    px(p.c, sx - 2, sy - 3, '#f2f0ea', 4, 7);
    px(p.c, sx - 1, sy - 5, '#f2f0ea', 2, 2);
    px(p.c, sx + 1, sy - 5, '#f2f0ea', 3, 1);
    px(p.c, sx + 3, sy - 4, '#f2f0ea', 1, 3);
    px(p.c, sx + 5, sy - 1, '#f2f0ea', 2, 3);
    px(p.c, sx + 6, sy - 3, '#f2f0ea', 1, 2);
    const [x, y] = P3(p, side, uc, 0.16, 3);
    layer(
      p.c,
      (l) => {
        // bracket, cylinder, valve, hose and horn
        px(l, x - 4, y - 36, STEEL[3], 8, 3);
        for (let j = 0; j < 30; j++) {
          const w = j > 26 ? 6 - (j - 26) : 6;
          for (let i = -w; i < w; i++) {
            const t = (i + w) / (2 * w);
            px(l, x + i, y - j, RED[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.85 ? 3 : 2]);
          }
        }
        px(l, x - 6, y - 20, '#f2f0ea', 12, 5);
        px(l, x - 5, y - 19, '#2a2a30', 10, 1);
        px(l, x - 2, y - 36, '#2a2a30', 4, 6);
        px(l, x - 6, y - 35, '#2a2a30', 6, 2);
        ln(l, x + 3, y - 33, x + 9, y - 26, '#1e1e24', 2);
        ln(l, x + 9, y - 26, x + 8, y - 8, '#1e1e24', 2);
        fillPoly(l, [[x + 6, y - 8], [x + 11, y - 8], [x + 12, y - 2], [x + 5, y - 2]], '#2a2a30');
      },
      { rect: [x - 10, y - 42, x + 16, y + 2] },
    );
    // a first-aid box higher up
    proud(p, side, uc - 0.2, uc + 0.2, 0, 0.12, 21, 25.6, { face: enamel(['#0e3a22', '#124a2a', '#165a32', '#1c6e3e', '#24844a', '#329a58']), end: enamel(['#0e3a22', '#124a2a', '#165a32', '#1a6438', '#1e7240', '#24844a']), top: (_l) => () => '#24844a', edge: '#0e3a22' });
    const [fx, fy] = P3(p, side, uc, 0.12, 23.3);
    px(p.c, fx - 1, fy - 4, '#f2f0ea', 3, 9);
    px(p.c, fx - 4, fy - 1, '#f2f0ea', 9, 3);
  },
};

/** A laminated wooden propeller mounted high on the wall, with a brass plaque. */
const rob_prop: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const uc = k.wp.at + k.wp.w / 2;
    const half = Math.min(1.35, k.wp.w / 2 - 0.15);
    const zc = 31.5;
    // the brackets
    for (const du of [-0.5, 0.5]) pq(p, pl, uc + du * half - 0.05, uc + du * half + 0.05, zc - 2.2, zc + 0.6, STEEL[pl.light ? 3 : 2]);
    // blades: a slim twisted planform, laminations as stripes, brass tipping
    const LAM = ['#5a3418', '#7a4a24', '#9a6234', '#b87c44', '#d09858', '#e2b070'];
    for (const s of [-1, 1]) {
      const pts: [number, number][] = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const chord = 1.2 + Math.sin(Math.min(1, t * 1.3) * Math.PI) * 1.5 - t * 0.6;
        pts.push([uc + s * half * t, zc + chord]);
      }
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        const chord = 0.9 + Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.9 - t * 0.4;
        pts.push([uc + s * half * t, zc - chord]);
      }
      poly3(
        p,
        pts.map(([u, z]) => pl.at(u, z)),
        (u: number, v: number) => {
          const tip = s > 0 ? u > half * 71.6 * 0.86 : u < half * 71.6 * 0.14;
          if (tip) return v > 6 ? '#e8c060' : '#b88a30';
          return LAM[Math.max(0, Math.min(5, (Math.floor(v / 2) % 2 ? 3 : 4) + (pl.light ? 0 : -1) + (v > 9 ? 1 : 0)))];
        },
        pl.light,
      );
    }
    // the hub with its bolts
    const [hx, hy] = pl.F(uc, zc);
    ell(p.c, hx, hy, 7, 8, '#4a2a16');
    ell(p.c, hx - 1, hy - 1, 5, 6, '#8a5a30');
    for (let a = 0; a < 6; a++) px(p.c, hx + Math.cos(a) * 4, hy + Math.sin(a) * 4.5, '#c8c8c8');
    // a brass plaque below
    pq(p, pl, uc - 0.32, uc + 0.32, zc - 6.2, zc - 4.4, '#8a6a2a');
    pq(p, pl, uc - 0.29, uc + 0.29, zc - 6, zc - 4.6, '#d8b058');
    const [a0, b0] = pl.F(uc - 0.22, zc - 5.3);
    const [a1, b1] = pl.F(uc + 0.22, zc - 5.3);
    ln(p.c, a0, b0, a1, b1, '#6a4a1a');
  },
};

/** An aeronautical chart pinned to the liner. */
const rob_chart: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + 0.9;
    const z0 = 15.6;
    const z1 = 27.6;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.5, z1 - 0.5, 'rgba(30,22,34,0.25)');
    pt(
      p,
      pl,
      u0,
      u1,
      z0,
      z1,
      (u: number, v: number, x: number, y: number) => {
        // land in pale greens, a lake, a river, magenta airspace rings, a red route
        const n = Math.sin(u * 0.13 + v * 0.07) + Math.sin(v * 0.11 - u * 0.05);
        let c = n > 0.6 ? '#cfe0b4' : n > -0.2 ? '#e2ead0' : '#ecebdc';
        const dl = Math.hypot(u - 30, (v - 14) * 1.2);
        if (dl < 6) c = '#a8cce4';
        if (Math.abs(Math.sin(u * 0.2) * 4 + 30 - v) < 0.7) c = '#7aa8d8';
        const r1 = Math.hypot(u - 16, v - 30);
        if (Math.abs(r1 - 11) < 0.7 || Math.abs(r1 - 6) < 0.5) c = '#c03a9a';
        if (Math.abs(v - (14 + u * 0.4)) < 0.7 && u > 6 && u < 40) c = '#d82a2a';
        if (hash(x, y, 51) < 0.01) c = '#8a8a7a';
        return c;
      },
      pl.light,
    );
    for (const [u, z] of [[u0 + 0.05, z1 - 0.5], [u1 - 0.05, z1 - 0.5], [u0 + 0.05, z0 + 0.5], [u1 - 0.05, z0 + 0.5]] as const) {
      const [x, y] = pl.F(u, z);
      px(p.c, x - 1, y - 1, '#d8402e', 3, 3);
      px(p.c, x - 1, y - 1, '#ff8a7a');
    }
  },
};

/** A big caged wall fan. */
const rob_fan: WallArt4 = {
  draw(p, side, k) {
    const [x, y] = P3(p, side, k.wp.at + 0.55, 0.24, 30);
    const [bx, by] = P3(p, side, k.wp.at + 0.55, 0.02, 30);
    layer(
      p.c,
      (l) => {
        ln(l, bx, by, x, y, STEEL[3], 3);
        ell(l, x, y, 19, 20, STEEL[1]);
        ell(l, x, y, 17, 18, '#2a2e36');
        ell(l, x, y, 4, 4, STEEL[3]);
      },
      { rect: [x - 24, y - 24, x + 24, y + 24] },
    );
  },
  anim(p, side, k) {
    const [x, y] = P3(p, side, k.wp.at + 0.55, 0.24, 30);
    const u = p.k / 4;
    const a0 = k.t * 9;
    for (let b = 0; b < 3; b++) {
      const a = a0 + (b / 3) * Math.PI * 2;
      for (let r = 4; r < 16; r += 1) {
        const w = 1 + Math.floor((16 - Math.abs(r - 10)) / 8);
        px(p.c, x + Math.cos(a) * r * u, y + Math.sin(a) * r * 1.05 * u, GALV[3], Math.max(1, w * u), Math.max(1, w * u));
      }
    }
    // the guard's rings over the blades
    p.c.globalAlpha = 0.85;
    for (const r of [8, 13, 18]) for (let i = 0; i < 28; i++) px(p.c, x + Math.cos((i / 28) * Math.PI * 2) * r * u, y + Math.sin((i / 28) * Math.PI * 2) * r * 1.05 * u, STEEL[4], Math.max(1, u), Math.max(1, u));
    p.c.globalAlpha = 1;
    ell(p.c, x, y, 3 * u, 3 * u, STEEL[4]);
  },
};

/** The team's kanban board: three columns of sticky notes, a burndown chart in marker. */
const rob_kanban: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const z0 = 15;
    const z1 = 28;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(30,22,34,0.3)');
    pq(p, pl, u0, u1, z0, z1, ALU[light ? 4 : 2]);
    pq(p, pl, u0 + 0.04, u1 - 0.04, z0 + 0.4, z1 - 0.4, '#eef2f0');
    const W = u1 - u0;
    const heads = [TEAL[4], YEL[4], '#3aa058'];
    for (let c = 0; c < 3; c++) {
      const a = u0 + 0.06 + (c * (W - 0.12)) / 3;
      const b = a + (W - 0.12) / 3 - 0.03;
      pq(p, pl, a, b, z1 - 2, z1 - 0.8, heads[c]);
      if (c) pq(p, pl, a - 0.02, a - 0.005, z0 + 1, z1 - 0.8, '#b8c0c4');
      const n = [4, 2, 5][c];
      for (let i = 0; i < n; i++) {
        const u = a + 0.03 + (i % 2) * ((b - a) / 2);
        const z = z1 - 4.4 - Math.floor(i / 2) * 2.9;
        const col = ['#f6d860', '#f2a0c0', '#9fe3b8', '#9fc8f2'][(i + c + k.seed) % 4];
        pq(p, pl, u, u + (b - a) / 2 - 0.05, z, z + 2.3, col);
        const [l0x, l0y] = pl.F(u + 0.03, z + 1.3);
        const [l1x, l1y] = pl.F(u + (b - a) / 2 - 0.1, z + 1.3);
        ln(p.c, l0x, l0y, l1x, l1y, '#5a5040');
      }
    }
    // a little burndown chart at the foot of the DONE column
    const [g0x, g0y] = pl.F(u1 - 0.3, z0 + 3.4);
    const [g1x, g1y] = pl.F(u1 - 0.08, z0 + 1.4);
    ln(p.c, g0x, g0y, g1x, g1y, '#c8382a');
    ln(p.c, g0x, g0y + 8, g1x, g1y + 2, '#2a5aa8');
  },
};

/** An industrial unit heater mounted high, louvres angled down, a warm glow when running. */
const rob_heater: WallArt4 = {
  draw(p, side, k) {
    const uc = k.wp.at + 0.55;
    // the bracket and the cabinet
    proud(p, side, uc - 0.3, uc + 0.3, 0, 0.42, 25, 31.6, { face: enamel(GALV), end: enamel(GALV), top: enamel(GALV), edge: GALV[0] });
    const F = (u: number, z: number) => P3(p, side, u, 0.42, z);
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = F(uc - 0.24, 26 + i);
      const [bx, by] = F(uc + 0.24, 26 + i);
      ln(p.c, ax, ay, bx, by, i % 2 ? GALV[1] : '#3a3c42');
    }
    // the gas pipe down the wall, a yellow valve
    const pl = planeOf(p, side);
    pq(p, pl, uc + 0.18, uc + 0.22, 14.4, 25, YEL[3]);
    pq(p, pl, uc + 0.14, uc + 0.26, 19, 19.8, YEL[5]);
    const [vx, vy] = pl.F(uc + 0.2, 19.4);
    px(p.c, vx - 4, vy - 1, '#c8302a', 8, 2);
  },
  anim(p, side, k) {
    const uc = k.wp.at + 0.55;
    const u = p.k / 4;
    const on = Math.sin(k.t * 0.3 + k.seed) > -0.3;
    if (!on) return;
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = P3(p, side, uc - 0.18 + i * 0.18, 0.44, 26.5 + i * 1.6);
      px(p.c, ax - 2 * u, ay, Math.sin(k.t * 3 + i) > 0 ? '#ffb05a' : '#f08a3a', Math.max(1, 4 * u), Math.max(1, u));
    }
  },
};

/** A wall rack of cable drums on a steel bar, the ends hanging. */
const rob_spoolrack: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.24;
    const u1 = k.wp.at + 0.9;
    for (const u of [u0, u1]) pq(p, pl, u - 0.03, u + 0.03, 17, 25, STEEL[pl.light ? 3 : 2]);
    const [b0x, b0y] = P3(p, side, u0, 0.22, 22);
    const [b1x, b1y] = P3(p, side, u1, 0.22, 22);
    ln(p.c, b0x, b0y, b1x, b1y, GALV[4], 2);
    const cols = [ORANGE[3], '#1e1e24', RED[3]];
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3;
      const x = b0x + (b1x - b0x) * t;
      const y = b0y + (b1y - b0y) * t;
      layer(
        p.c,
        (l) => {
          ell(l, x + 2, y, 6, 9, '#2a2a30');
          ell(l, x, y, 5, 8, cols[(i + k.seed) % 3]);
          for (let j = -6; j <= 6; j += 2) px(l, x - 4, y + j, i === 1 ? '#3a3a44' : '#ffffff', 8, 1);
          ell(l, x - 2, y, 6, 9, '#3a3a40');
          ell(l, x - 2, y, 2, 3, '#121214');
          ln(l, x + 3, y + 7, x + 5, y + 20 + i * 3, cols[(i + k.seed) % 3]);
        },
        { outline: 0.5, rect: [x - 10, y - 12, x + 10, y + 28] },
      );
    }
  },
};

/** A cork board of team photos, a competition medal and a pennant. */
const rob_photos: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + 0.9;
    const z0 = 16;
    const z1 = 26;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.5, z1 - 0.5, 'rgba(30,22,34,0.3)');
    pq(p, pl, u0, u1, z0, z1, BIRCH[pl.light ? 3 : 2]);
    pt(p, pl, u0 + 0.05, u1 - 0.05, z0 + 0.4, z1 - 0.4, (_u: number, _v: number, x: number, y: number) => at(['#8a5e34', '#a07040', '#b6844e', '#c8975e', '#d6a86e'], 2.6 + (hash(x, y, 51) - 0.5) * 2.4), pl.light);
    for (let i = 0; i < 5; i++) {
      const u = u0 + 0.08 + (i % 3) * 0.19;
      const z = z0 + 1 + Math.floor(i / 3) * 4.4 + (i % 2) * 0.6;
      pq(p, pl, u, u + 0.16, z, z + 3.2, '#f6f4ee');
      pq(p, pl, u + 0.015, u + 0.145, z + 0.6, z + 3.0, ['#6a9ac2', '#c8a868', '#7aa05a', '#a87ab8', '#5a6a7a'][(i + k.seed) % 5]);
      pq(p, pl, u + 0.04, u + 0.12, z + 0.6, z + 1.6, '#3a3430');
      const [px0, py0] = pl.F(u + 0.08, z + 3);
      px(p.c, px0 - 1, py0 - 1, '#c8382a', 2, 2);
    }
    // a medal on its ribbon and a teal pennant
    const [mx, my] = pl.F(u1 - 0.14, z1 - 2.4);
    ln(p.c, mx - 3, my - 6, mx, my, '#2b98aa', 2);
    ln(p.c, mx + 3, my - 6, mx, my, '#d8402e', 2);
    ell(p.c, mx, my + 3, 3, 3, '#e2b84a');
    px(p.c, mx - 1, my + 2, '#f6dc7a', 2, 1);
    const [fx, fy] = pl.F(u0 + 0.1, z1 + 1.2);
    fillPoly(p.c, [[fx, fy - 4], [fx + 26, fy + 6], [fx, fy + 6]], TEAL[4]);
    px(p.c, fx + 2, fy, '#f2f0ea', 10, 1);
  },
};

export const ROBOTICS_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    const len = side === 'ne' ? w.cols : w.rows;
    drawWall(p, side, len);
    for (const u of [4, 8, 12]) column(p, side, u);
    if (side === 'ne')
      conduit(p, side, len, 15.2, [
        [1.6, 'blue'],
        [3.7, 'yellow'],
        [7.5, 'blue'],
        [8.6, 'red'],
        [12.6, 'blue'],
        [15.6, 'grey'],
      ]);
    else
      conduit(p, side, len, 15.2, [
        [6.6, 'blue'],
        [7.4, 'yellow'],
        [12.6, 'red'],
      ]);
  },
  art: { window, pegboard, whiteboard, door, poster, rob_panel, rob_reel, rob_shelf, rob_safety, rob_prop, rob_chart, rob_fan, rob_kanban, rob_heater, rob_spoolrack, rob_photos },
};

// Data Center — the plant and furniture of the site round the hall (1 z ≈ 10 cm).
//   dc_genset       a sound-proofed diesel generator on its fuel skid, exhaust stack, snow on its roof
//   dc_fueltank     a bunded rectangular diesel tank with a ladder, placards and a fill cabinet
//   dc_container    a storage container, corrugated steel, door bars, rust streaks
//   dc_transformer  a grid transformer: tank, radiator fins, porcelain bushings, conservator
//   dc_gantry       a lattice gantry with insulator strings and the line coming in
//   dc_hut          the substation's control hut in brick under snow
//   dc_fence        security fence: galvanised posts, chain-link, barbed wire, a drift at its foot
//   dc_gatehouse    the gate's security booth, warm inside
//   dc_barrier      the boom barrier across the access road, a card reader post
//   dc_lamp         a tall LED street lamp throwing a warm pool on the snow
//   dc_bollard, dc_sign (elk, dc, hv, speed), dc_gritbin, dc_hydrant (with its snow pole),
//   dc_bikeshed, dc_parkbench, dc_flag
//   dc_kicksled (the vehicles are in vehicles.ts)
import { darken, lighten, mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { contactShadow, curve, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { boards4 } from '../../materials4';
import { front, pq, pt, side } from '../../plane4';
import { brushed, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { at, label, labelXY, snowTop, unit } from './kit';
import { ALU, CAB, CONC, GALV, LED, ORA, RACK, RED, SNOW, STEEL, WARM, YEL } from './palette';
import { EXHAUST, plume } from './plume';
import { driftLine, snowMasses, snowSlab } from './room';

const galvP = brushed(GALV, 0.6);
const SNOWY = snowTop;
type V2 = [number, number];

/** The visible long face and end face of a prop for either rotation: [front, the lit or shaded end]. */
const ends = (p: PropPainter, a0: number, a1: number) => (p.rot === 0 ? side(p, a1) : side(p, a0));

/** A soft warm pool of lamp light on the snow. */
function warmPool(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.2) {
  c.globalAlpha = a * 0.6;
  ell(c, x, y, rx, ry, '#ffd890');
  c.globalAlpha = a;
  ell(c, x, y, rx * 0.6, ry * 0.6, '#ffe2a8');
  c.globalAlpha = 1;
}

/** A slab of snow lying on a box top (a, b span at height z). */
function snowCap(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, puff = 1) {
  snowSlab(p, a0, b0, a1, b1, z, seed, 1.3 * puff);
}

// ── the generator yard ──────────────────────────────────────
const GEN: Ramp = ['#3e4a44', '#4e5c54', '#607066', '#74867a', '#8a9c8e', '#a2b2a4', '#bccabc'];
const dc_genset: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 17;
    footShadow(p, 0.04, 0.06, W - 0.04, 0.94, Z, 0.3);
    // a cable tray across to the hall's wall behind (behind the enclosure, so drawn first)
    lbox(p, W * 0.42, -0.72, 0.22, 0.84, 13.6, 0.4, mono(galvP, GALV[0]));
    // the fuel skid (dark steel), the enclosure (pale green-grey), the roof
    lbox(p, 0.04, 0.08, W - 0.08, 0.84, 0, 2, mono(paint(RACK), RACK[0]));
    const enc: Mat = (light, w, h) => (u, v, x, y) => {
      let i = light ? 3.6 : 2.4;
      if (u % 40 < 1.2 && u > 4 && u < w - 4) i -= 1.6; // panel seams
      if (v > h - 2) i += 1;
      if (hash(x, y, 7) < 0.02) i -= 0.7;
      return at(GEN, i);
    };
    lbox(p, 0.08, 0.12, W - 0.16, 0.76, 2, Z - 2, { front: enc, side: enc, top: paint(GEN), edge: GEN[0] });
    const F = front(p, 0.88);
    const E = ends(p, 0.08, W - 0.08);
    // access doors with louvred panels and handles along the long side
    for (let i = 0; i < 3; i++) {
      const a0 = 0.2 + i * ((W - 0.4) / 3);
      const a1 = a0 + (W - 0.4) / 3 - 0.08;
      pt(p, F, a0 + 0.06, a1 - 0.06, 8, 13, (_u: number, v: number) => (v % 3 < 1.1 ? '#232c28' : at(GEN, F.light ? 2.6 : 1.8)), F.light);
      pq(p, F, a1 - 0.08, a1 - 0.05, 5.6, 7.6, '#2a302c');
    }
    // the control panel window and a placard
    pq(p, F, 0.24, 0.5, 4, 6.6, '#1a2220');
    pq(p, F, 0.26, 0.48, 4.3, 6.3, '#2a4a5a');
    pq(p, F, W - 0.42, W - 0.2, 3.2, 5.4, YEL[4]);
    // the radiator end: a big grille
    const eu0 = p.rot === 0 ? 0.18 : 0.18;
    pt(p, E, eu0, 0.82, 3, 15, (_u: number, v: number) => (v % 2.4 < 1 ? '#1a2220' : at(GEN, E.light ? 3 : 2)), E.light);
    // the exhaust: a silencer on the roof, a stack with a rain cap
    lbox(p, W * 0.62, 0.3, W * 0.28, 0.4, Z, 2.2, mono(paint(['#2a2420', '#3a3028', '#4a3e34', '#5a4c40', '#6a5a4c', '#7a6a5a']), '#1a1410'));
    const [sx, sy] = p.P(W * 0.8, 0.5, Z + 2.2);
    layer(p.c, (l) => {
      for (let j = 0; j < 44; j++) for (let i = -4; i < 4; i++) px(l, sx + i, sy - j, ['#5a4c40', '#4a3e34', '#3a3028', '#2a2420'][Math.min(3, Math.max(0, Math.floor((i + 4) / 2)))]);
      fillPoly(l, [[sx - 6, sy - 44], [sx + 6, sy - 44], [sx + 4, sy - 48], [sx - 4, sy - 48]], '#2a2420');
      // rust streaks under the cap
      for (let i = 0; i < 3; i++) px(l, sx - 3 + i * 3, sy - 43, '#8a4a24', 1, 6 + i * 3);
    }, { rect: [sx - 8, sy - 52, sx + 8, sy + 2] });
    // snow on the roof
    snowCap(p, 0.1, 0.14, W * 0.6, 0.86, Z, k.seed);
  },
  anim(p, k) {
    // one generator on its weekly test run: a puff of exhaust, a green running light
    const F = front(p, 0.88);
    const u = unit(p);
    const [lx, ly] = F.F(0.3, 7);
    const running = k.seed % 3 === 0;
    px(p.c, lx, ly, running ? LED.green : LED.greenDim, 2 * u, u);
    if (!running) return;
    const [sx, sy] = p.P(k.w * 0.8, 0.5, 17 + 2.2 + 12);
    plume(p, sx, sy, EXHAUST, k.t, 0.2, k.seed, 0.75);
  },
};

const TANK: Ramp = ['#2e3e34', '#3a4e42', '#486050', '#58745e', '#6a8870', '#7e9c84'];
const dc_fueltank: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 14;
    footShadow(p, 0.04, 0.06, W - 0.04, 0.94, Z, 0.3);
    // the concrete bund, the double-walled tank with stiffening ribs, a fill cabinet, a ladder and handrail
    lbox(p, 0.02, 0.04, W - 0.04, 0.92, 0, 1.4, mono(paint(CONC), CONC[0]));
    const tank: Mat = (light, w) => (u, v, x, y) => {
      let i = light ? 3.4 : 2.2;
      if (u % 26 < 2 && u > 4 && u < w - 4) i += 0.8;
      if (u % 26 >= 2 && u % 26 < 3) i -= 0.9;
      if (v < 3) i -= 0.6;
      if (hash(x, y, 9) < 0.02) i -= 0.6;
      return at(TANK, i);
    };
    lbox(p, 0.12, 0.14, W - 0.24, 0.72, 1.4, Z - 1.4, { front: tank, side: tank, top: paint(TANK), edge: TANK[0] });
    const F = front(p, 0.86);
    // placards: the orange UN plate and a flammable diamond
    pq(p, F, 0.4, 0.82, 7, 9.6, '#1e1e22');
    pq(p, F, 0.42, 0.8, 7.2, 9.4, ORA[4]);
    pq(p, F, 0.42, 0.8, 8.25, 8.35, '#1e1e22');
    const [dx, dy] = F.F(1.2, 8.3);
    fillPoly(p.c, [[dx, dy - 7], [dx + 6, dy - 1], [dx, dy + 5], [dx - 6, dy - 1]], '#c8302a');
    px(p.c, dx - 1, dy - 3, '#f4f2ee', 3, 4);
    // the fill cabinet at the near end and the level gauge
    lbox(p, W - 0.7, 0.86, 0.4, 0.12, 2.5, 4.4, mono(paint(STEEL), STEEL[0]));
    pq(p, front(p, 0.98), W - 0.6, W - 0.4, 4.8, 6, '#f4f6f8');
    // the ladder and the handrail round the top
    for (const a of [0.28, 0.42]) lbox(p, a, 0.86, 0.02, 0.04, 1.4, Z + 3.4, mono(galvP, GALV[0]));
    for (let z = 2.4; z < Z; z += 1.6) lbox(p, 0.28, 0.87, 0.16, 0.02, z, 0.2, mono(galvP, GALV[0]));
    snowCap(p, 0.14, 0.16, W - 0.14, 0.84, Z, k.seed + 3);
    for (const a of [0.2, W * 0.5, W - 0.24]) lbox(p, a, 0.82, 0.03, 0.03, Z, 3.4, mono(galvP, GALV[0]));
    lbox(p, 0.2, 0.82, W - 0.4, 0.03, Z + 3.2, 0.25, mono(paint(YEL), YEL[0]));
  },
};

const BOX_COLS: Record<string, Ramp> = {
  red: ['#3e1612', '#5a201a', '#782c22', '#94382a', '#ac4834', '#c45c44'],
  blue: ['#142438', '#1c3250', '#26426a', '#325486', '#4268a0', '#5a80b8'],
};
const dc_container: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 26;
    const r = BOX_COLS[k.variant ?? (k.seed % 2 ? 'blue' : 'red')] ?? BOX_COLS.red;
    footShadow(p, 0.04, 0.06, W - 0.04, D - 0.06, Z, 0.3);
    const corr: Mat = (light, _w, h) => (u, v, x, y) => {
      const f = u % 8;
      let i = light ? 3.2 : 2;
      if (f < 2) i += 0.8;
      else if (f < 3) i -= 0.9;
      // rust bleeding down from the top rail and the corner posts
      if (v > h - 14 && hash(Math.floor(u / 4), 2, 5) < 0.3 && v > h - 4 - hash(Math.floor(u / 4), 3, 5) * 14) return mix(r[2], '#8a4a24', 0.6);
      if (hash(x, y, 4) < 0.02) i -= 0.6;
      return at(r, i);
    };
    const b0 = 0.2;
    const b1 = D - 0.2;
    lbox(p, 0.1, b0, W - 0.2, b1 - b0, 0, Z, { front: corr, side: corr, top: paint(r), edge: r[0] });
    // the doors at the visible end: two leaves, four locking bars with their handles
    const E = ends(p, 0.1, W - 0.1);
    const span = b1 - b0;
    for (let i = 0; i < 4; i++) {
      const u = b0 + span * (0.12 + i * 0.23);
      pq(p, E, u, u + 0.04, 1, Z - 1, darken(r[2], 0.3));
      pq(p, E, u - 0.03, u + 0.07, 10, 11.6, '#2a2a30');
    }
    pq(p, E, b0 + span * 0.5 - 0.02, b0 + span * 0.5 + 0.02, 0.6, Z - 0.6, r[0]);
    // the corner castings and a stencilled number on the long side
    const F = front(p, b1);
    label(p, F, W * 0.3, Z - 4, 'DCLU 2048', '#e8e2d2');
    snowCap(p, 0.12, b0 + 0.02, W - 0.12, b1 - 0.02, Z, k.seed + 1, 1.2);
  },
};

// ── the substation ──────────────────────────────────────────
const TRF: Ramp = ['#2a3432', '#36423e', '#44524c', '#54645c', '#66786e', '#7a8c82'];
const PORC: Ramp = ['#4a2a1e', '#6a3a26', '#8a4c30', '#a8603c', '#c07a50'];
/** A porcelain insulator column: brown sheds stacked up a rod. */
function insulator(c: CanvasRenderingContext2D, x: number, y: number, n: number, s = 1) {
  for (let i = 0; i < n; i++) {
    const yy = y - i * 4 * s;
    ell(c, x, yy, 5 * s, 2 * s, PORC[1]);
    ell(c, x - 1, yy - 1, 4 * s, 1.4 * s, PORC[3]);
    px(c, x - 3 * s, yy - 1, PORC[4], 1, 1);
  }
  px(c, x - 1, y - n * 4 * s - 3, GALV[4], 3, 4);
}

const dc_transformer: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 20;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, Z, 0.32);
    // the plinth, the tank, radiator banks on its two visible sides
    lbox(p, 0.1, 0.1, W - 0.2, D - 0.2, 0, 1.2, mono(paint(CONC), CONC[0]));
    const tank = paint(TRF);
    lbox(p, 0.45, 0.45, W - 0.9, D - 0.9, 1.2, Z - 1.2, { front: tank, side: tank, top: tank, edge: TRF[0] });
    const fins: Mat = (light) => (u) => at(TRF, (light ? 3 : 2) + (u % 4 < 1.5 ? 1 : u % 4 < 2.2 ? -1 : 0));
    lbox(p, 0.6, D - 0.45, W - 1.2, 0.3, 2, Z - 5, { front: fins, side: paint(TRF), top: paint(TRF), edge: TRF[0] });
    lbox(p, W - 0.45, 0.6, 0.3, D - 1.2, 2, Z - 5, { front: paint(TRF), side: fins, top: paint(TRF), edge: TRF[0] });
    // warning plate
    pq(p, front(p, D - 0.15), 0.8, 1.1, 8, 10.6, YEL[4]);
    const [wx, wy] = front(p, D - 0.15).F(0.95, 9.6);
    ln(p.c, wx - 1, wy - 3, wx + 1, wy, '#1e1e22', 2);
    ln(p.c, wx + 1, wy, wx - 1, wy + 3, '#1e1e22', 2);
    snowCap(p, 0.5, 0.5, W - 0.5, D - 0.5, Z, k.seed, 0.9);
    // the conservator tank on its brackets, HV bushings, LV bushings
    lbox(p, 0.5, 0.55, W - 1, 0.24, Z + 3, 1.8, mono(paint(TRF), TRF[0]));
    for (const a of [0.6, W - 0.7]) lbox(p, a, 0.6, 0.06, 0.06, Z, 3, mono(paint(TRF), TRF[0]));
    for (let i = 0; i < 3; i++) {
      const [bx, by] = p.P(0.7 + i * ((W - 1.4) / 2), D * 0.55, Z);
      layer(p.c, (l) => insulator(l, bx, by, 7), { outline: 0.5, rect: [bx - 8, by - 40, bx + 8, by + 4] });
    }
    for (let i = 0; i < 3; i++) {
      const [bx, by] = p.P(W * 0.68, 0.6 + i * 0.32, Z);
      layer(p.c, (l) => insulator(l, bx, by, 3, 0.8), { outline: 0.5, rect: [bx - 8, by - 20, bx + 8, by + 4] });
    }
  },
};

const dc_gantry: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Hg = 56;
    const c = p.c;
    footShadow(p, 0.1, 0.2, W - 0.1, 0.8, 20, 0.2);
    // two lattice columns, a lattice beam across, insulator strings and conductors coming in high
    const lat = (a0: number, a1: number, b: number, z0: number, z1: number, vertical: boolean) => {
      const P = (a: number, z: number): V2 => p.P(a, b, z);
      const [x0, y0] = P(a0, z0);
      const [x1, y1] = P(a1, z0);
      const [x2, y2] = P(a1, z1);
      const [x3, y3] = P(a0, z1);
      ln(c, x0, y0, x3, y3, GALV[4], 2);
      ln(c, x1, y1, x2, y2, GALV[2], 2);
      if (vertical) {
        ln(c, x0, y0, x1, y1, GALV[3]);
        ln(c, x3, y3, x2, y2, GALV[3]);
      }
      const n = Math.max(2, Math.round((vertical ? Math.abs(y3 - y0) : Math.hypot(x1 - x0, y1 - y0)) / 10));
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        if (vertical) {
          const za = z0 + (z1 - z0) * t0;
          const zb = z0 + (z1 - z0) * t1;
          const A = P(a0, za);
          const B = P(a1, zb);
          ln(c, A[0], A[1], B[0], B[1], GALV[3]);
          const C2 = P(a1, za);
          const D2 = P(a0, zb);
          ln(c, C2[0], C2[1], D2[0], D2[1], GALV[2]);
        } else {
          const aa = a0 + (a1 - a0) * t0;
          const ab = a0 + (a1 - a0) * t1;
          const A = P(aa, z0);
          const B = P(ab, z1);
          ln(c, A[0], A[1], B[0], B[1], GALV[3]);
        }
      }
    };
    for (const a of [0.3, W - 0.6]) {
      lbox(p, a - 0.05, 0.35, 0.4, 0.3, 0, 1, mono(paint(CONC), CONC[0]));
      lat(a, a + 0.3, 0.5, 1, Hg, true);
      lat(a, a + 0.3, 0.42, 1, Hg, true);
    }
    lat(0.3, W - 0.3, 0.5, Hg - 4, Hg, false);
    lat(0.3, W - 0.3, 0.46, Hg - 4, Hg, false);
    // three phases: insulator strings hanging from the beam, conductors running out to the right and down to the transformers
    for (let i = 0; i < 3; i++) {
      const a = 1 + i * ((W - 2) / 2);
      const [ix, iy] = p.P(a, 0.5, Hg - 4);
      layer(c, (l) => {
        for (let j = 0; j < 6; j++) {
          ell(l, ix, iy + 2 + j * 3, 3.5, 1.5, '#b8c4cc');
          px(l, ix - 2, iy + 1 + j * 3, '#e8f0f4', 2, 1);
        }
      }, { outline: 0.4, rect: [ix - 6, iy - 2, ix + 6, iy + 24] });
      const [ex, ey] = p.P(a, 0.5, Hg - 10);
      // the drop down to its bushing on the transformer south-west of the gantry (local: a = 1.9, b = -2.3 …)
      const [tx, ty] = p.P(1.9, -2.3 + i * 0.6, 27.5);
      curve(c, ex, ey, (ex + tx) / 2, Math.max(ey, ty) + 14, tx, ty, '#2a3036');
    }
    // a lightning mast on the far column
    const [mx, my] = p.P(W - 0.45, 0.5, Hg);
    ln(c, mx, my, mx, my - 40, GALV[3], 2);
    void k;
  },
};

// ── the power line: lattice pylons striding off north, the line dropping into the substation ──
const PYLON_H = 118;
/** A lattice pylon standing at local (a, b): tapering legs, cross bracing, two arms with insulator strings, the earth peak. Returns the arm tips (screen). */
function pylon(p: PropPainter, a: number, b: number, seed: number): V2[] {
  const c = p.c;
  const [x, y] = p.P(a, b, 0);
  const top = y - PYLON_H * 4;
  const tips: V2[] = [];
  layer(c, (l) => {
    // concrete footings
    for (const dx of [-22, 22]) {
      ell(l, x + dx, y, 6, 3, CONC[2]);
      ell(l, x + dx, y - 1, 5, 2, CONC[4]);
    }
    // the two visible legs tapering to the waist, then the body to the peak
    const waist = y - PYLON_H * 4 * 0.62;
    const leg = (x0: number, y0: number, x1: number, y1: number, col: string) => ln(l, x0, y0, x1, y1, col, 2);
    leg(x - 22, y, x - 7, waist, GALV[4]);
    leg(x + 22, y, x + 7, waist, GALV[2]);
    leg(x - 7, waist, x - 3, top + 18, GALV[4]);
    leg(x + 7, waist, x + 3, top + 18, GALV[2]);
    // cross bracing in panels
    const panels = 9;
    for (let i = 0; i < panels; i++) {
      const t0 = i / panels;
      const t1 = (i + 1) / panels;
      const ya = y + (top + 18 - y) * t0;
      const yb = y + (top + 18 - y) * t1;
      const w = (t: number) => (t < 0.62 ? 22 - (15 * t) / 0.62 : 7 - ((t - 0.62) / 0.38) * 4);
      ln(l, x - w(t0), ya, x + w(t1), yb, GALV[3]);
      ln(l, x + w(t0), ya, x - w(t1), yb, GALV[2]);
      ln(l, x - w(t1), yb, x + w(t1), yb, GALV[3]);
    }
    // two cross arms, each tapering, insulator strings hanging from the ends
    for (const [ay, half] of [[top + 40, 46], [top + 74, 38]] as const) {
      ln(l, x - half, ay, x + half, ay, GALV[3], 2);
      ln(l, x - half, ay, x, ay - 10, GALV[2]);
      ln(l, x + half, ay, x, ay - 10, GALV[2]);
      for (const dx of [-half + 2, half - 2]) {
        for (let j = 0; j < 5; j++) {
          ell(l, x + dx, ay + 3 + j * 2.6, 3, 1.2, '#b8c4cc');
          px(l, x + dx - 2, ay + 2 + j * 2.6, '#e8f0f4', 2, 1);
        }
        tips.push([x + dx, ay + 16]);
      }
    }
    // the earth-wire peak, snow on the arms
    ln(l, x - 3, top + 18, x, top, GALV[3], 2);
    ln(l, x + 3, top + 18, x, top, GALV[2], 2);
    for (const [ay, half] of [[top + 40, 46], [top + 74, 38]] as const) for (let i = -half; i < half; i += 3) if (hash(i, ay, seed) < 0.6) px(l, x + i, ay - 2, SNOW[6], 2, 1);
  }, { outline: 0.45, rect: [x - 60, top - 6, x + 60, y + 6] });
  tips.push([x, top]);
  return tips;
}

/** Sagging wire between two screen points. */
const wire = (c: CanvasRenderingContext2D, a: V2, b: V2, sag: number, col = '#2a3036') => curve(c, a[0], a[1], (a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag, b[0], b[1], col);

const dc_line: PropArt = {
  draw(p, k) {
    const W = k.w;
    // pylons along the line; their wires run on past the far end, and drop from the near one into the gantry
    const towers = [W - 1.5, 2.4];
    const tips = towers.map((a, i) => pylon(p, a, 0.5, k.seed + i));
    const [far, near] = tips;
    for (let i = 0; i < 5; i++) wire(p.c, far[i], near[i], 26);
    // on past the far pylon toward the frame's edge
    for (let i = 0; i < 5; i++) {
      const [ax, ay] = far[i];
      wire(p.c, [ax, ay], [ax + 300, ay - 150], 16);
    }
    // down into the substation gantry (local: the gantry stands past the line's near end, to the east)
    const g: V2[] = [-1, -2, -3].map((a) => p.P(a, 3.5, 50));
    for (let i = 0; i < 3; i++) wire(p.c, near[i], g[i], 30);
    void k;
  },
};

const dc_hut: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 26;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, Z, 0.3);
    // stained timber boards (the reference's warm brown hut), a lamp over the door
    const brick = boards4(['#2e1a10', '#46281a', '#5e3822', '#78482c', '#905a38', '#a86e46'], 9, false);
    lbox(p, 0.15, 0.15, W - 0.3, D - 0.3, 0, Z, { front: brick, side: brick, top: paint(CONC), edge: '#3a2018' });
    lbox(p, 0.08, 0.08, W - 0.16, D - 0.16, Z, 1.2, { front: paint(CONC), side: paint(CONC), top: SNOWY, edge: CONC[0] });
    const F = front(p, D - 0.15);
    const S = side(p, W - 0.15);
    // a steel door with a danger sign, a barred window on the side, vents
    pq(p, F, 0.5, 1.1, 0, 20, '#2a3038');
    pq(p, F, 0.54, 1.06, 0.4, 19.6, '#4a5866');
    pq(p, F, 0.62, 0.98, 13, 16.6, YEL[4]);
    const [dx, dy] = F.F(0.8, 15.6);
    ln(p.c, dx - 1, dy - 3, dx + 1, dy, '#1e1e22', 2);
    ln(p.c, dx + 1, dy, dx - 1, dy + 3, '#1e1e22', 2);
    pq(p, S, 0.6, 1.2, 12, 18, '#1a2026');
    pt(p, S, 0.62, 1.18, 12.2, 17.8, (u: number) => (u % 6 < 1.4 ? '#5a6068' : '#3a5a6a'), S.light);
    pq(p, F, 1.3, 1.6, 20, 22, '#2a3038');
    pq(p, F, 0.68, 0.92, 21.2, 22.4, '#1a1c20');
    pq(p, F, 0.7, 0.9, 20.8, 21.2, '#fff0c0');
    snowCap(p, 0.15, 0.15, W - 0.15, D - 0.15, Z + 1.2, k.seed, 1.1);
    const [gx, gy] = p.P(0.8, D + 0.3, 0);
    warmPool(p.c, gx, gy, 46, 18, 0.18);
  },
  lights: (k) => [{ a: 0.8, b: k.d - 0.1, z: 21, r: 1.6, color: '#ffd890', kind: 'lamp' }],
};

// ── fences and the gate ─────────────────────────────────────
const dc_fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Hf = 20;
    const sub = k.variant === 'sub';
    const F = front(p, 0.5);

    // the chain-link: a diamond weave, see-through
    pt(p, F, 0, W, 1, Hf, (u: number, v: number) => {
      // a tight dark weave catching a little snow on its wires
      const d1 = (u + v * 1.6) % 5;
      const d2 = (u - v * 1.6 + 5000) % 5;
      if (d1 < 0.9 || d2 < 0.9) return (d1 < 0.9 && d2 < 0.9) ? (hash(Math.floor(u), Math.floor(v), 3) < 0.3 ? SNOW[5] : '#2a3038') : F.light ? '#566068' : '#444c56';
      return null;
    }, F.light);
    // top and bottom rails
    pq(p, F, 0, W, Hf - 0.4, Hf, GALV[4]);
    pq(p, F, 0, W, 0.8, 1.1, GALV[2]);
    // posts with angled arms and three strands of barbed wire
    for (let a = 0.05; a <= W + 0.01; a += 1.25) {
      lbox(p, a, 0.47, 0.06, 0.06, 0, Hf + 1, mono(galvP, GALV[0]));
      const [x0, y0] = p.P(a + 0.03, 0.5, Hf + 1);
      const [x1, y1] = p.P(a + 0.03, 0.25, Hf + 5);
      ln(p.c, x0, y0, x1, y1, GALV[3], 1);
      px(p.c, x0 - 2, y0 - 3, SNOW[6], 5, 2);
      px(p.c, x0 - 1, y0 - 4, SNOW[5], 3, 1);
    }
    for (let s = 0; s < 3; s++) {
      const b = 0.45 - s * 0.08;
      const z = Hf + 1.6 + s * 1.3;
      const [x0, y0] = p.P(0, b, z);
      const [x1, y1] = p.P(W, b, z);
      ln(p.c, x0, y0, x1, y1, '#5a646e');
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 6);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        px(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 1, '#8a949e', 1, 3);
      }
    }
    // signs on the substation's fence: danger of death, high voltage
    if (sub)
      for (let a = 1.8; a < W - 0.5; a += 3.75) {
        pq(p, F, a, a + 0.36, 9, 13, '#f4f6f8');
        pq(p, F, a + 0.02, a + 0.34, 11.2, 12.8, YEL[4]);
        const [sx, sy] = F.F(a + 0.18, 12.2);
        ln(p.c, sx - 1, sy - 3, sx + 1, sy, '#1e1e22', 2);
        ln(p.c, sx + 1, sy, sx - 1, sy + 3, '#1e1e22', 2);
        pq(p, F, a + 0.04, a + 0.32, 9.6, 10.4, '#c8302a');
      }
    driftLine(p, 0.1, W - 0.1, 0.6, 0, 5, k.seed);
  },
};

const dc_gatehouse: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 24;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, Z, 0.3);
    const white = paint(['#7a8088', '#929aa2', '#acb2ba', '#c4cad0', '#d8dce0', '#eceef0']);
    lbox(p, 0.15, 0.15, W - 0.3, D - 0.3, 0, 1, mono(paint(CONC), CONC[0]));
    lbox(p, 0.2, 0.2, W - 0.4, D - 0.4, 1, Z - 1, { front: white, side: white, top: white, edge: '#4a5058' });
    const F = front(p, D - 0.2);
    const S = side(p, W - 0.2);
    // wide windows on both visible sides: warm light, a guard's monitors glowing, a mug on the sill
    const win = (pl: typeof F, u0: number, u1: number) => {
      pq(p, pl, u0 - 0.04, u1 + 0.04, 8.6, 19.4, '#2a3038');
      pt(p, pl, u0, u1, 9, 19, (u: number, v: number) => {
        if ((u * 0.7 + v) % 50 < 5) return '#fff6d8';
        if (v < 12 && u % 22 > 4 && u % 22 < 18) return v > 6 ? '#3a86e0' : '#1e2a3a';
        return at(WARM, 3.4 + v / 40);
      }, pl.light);
    };
    win(F, 0.35, W - 0.75);
    win(S, 0.35, D - 0.35);
    pq(p, F, W - 0.68, W - 0.3, 1, 18, '#3a4a5a');
    pq(p, F, W - 0.64, W - 0.34, 1.4, 17.6, '#5a7088');
    // the roof with its overhang, the sign, a camera on a bracket
    lbox(p, 0.05, 0.05, W - 0.1, D - 0.1, Z, 1.4, { front: brushed(ALU), side: brushed(ALU), top: SNOWY, edge: ALU[0] });
    pq(p, F, 0.4, W - 0.4, Z - 3, Z - 0.6, '#1e4a8a');
    label(p, F, 0.48, Z - 0.9, 'SECURITY', '#f4f6f8');
    snowCap(p, 0.1, 0.1, W - 0.1, D - 0.1, Z + 1.4, k.seed, 1.2);
    const [cx, cy] = p.P(W - 0.2, D - 0.2, Z + 1.4);
    layer(p.c, (l) => {
      px(l, cx, cy - 10, '#5a6068', 2, 10);
      px(l, cx - 6, cy - 14, '#e8eaee', 9, 5);
      px(l, cx - 8, cy - 13, '#1e2430', 2, 3);
    }, { rect: [cx - 12, cy - 18, cx + 6, cy + 2] });
    // the warm light spilling out of the booth onto the snow
    const [gx, gy] = p.P(W * 0.5, D + 0.3, 0);
    warmPool(p.c, gx, gy, 70, 26, 0.16);
  },
  lights: (k) => [
    { a: k.w * 0.45, b: k.d - 0.15, z: 14, r: 1.6, color: '#ffd49a', kind: 'window' },
    { a: k.w - 0.15, b: k.d * 0.5, z: 14, r: 1.4, color: '#ffd49a', kind: 'window' },
  ],
};

const dc_barrier: PropArt = {
  draw(p, k) {
    // the barrier's housing at the near end, the striped boom lowered across the road
    const W = k.w;
    const hz = 8;
    lbox(p, W - 0.6, 0.3, 0.36, 0.4, 0, 9, { front: paint(['#7a8088', '#929aa2', '#acb2ba', '#c4cad0', '#d8dce0', '#eceef0']), side: paint(['#7a8088', '#929aa2', '#acb2ba', '#c4cad0', '#d8dce0', '#eceef0']), top: SNOWY, edge: '#4a5058' });
    pq(p, front(p, 0.7), W - 0.56, W - 0.28, 6.6, 7.4, '#c8302a');
    const [x0, y0] = p.P(W - 0.42, 0.5, hz);
    const [x1, y1] = p.P(0.1, 0.5, hz);
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const red = Math.floor(t * 12) % 2 === 0;
      px(p.c, x, y - 2, red ? '#d83a2e' : '#f4f6f8', 1, 4);
      px(p.c, x, y + 2, red ? '#8a2018' : '#b8bcc4', 1, 1);
    }
    // a rest post at the far end, a card reader post for the drivers
    lbox(p, 0.04, 0.44, 0.08, 0.08, 0, hz, mono(paint(['#7a8088', '#929aa2', '#acb2ba', '#c4cad0', '#d8dce0', '#eceef0']), '#4a5058'));
    const [rx, ry] = p.P(W - 0.4, 1.15, 0);
    layer(p.c, (l) => {
      px(l, rx - 1, ry - 22, '#3a4048', 3, 22);
      px(l, rx - 4, ry - 30, '#2a3038', 8, 9);
      px(l, rx - 3, ry - 28, '#4a5868', 6, 4);
      px(l, rx - 4, ry - 31, SNOW[6], 8, 2);
    }, { rect: [rx - 8, ry - 34, rx + 6, ry + 2] });
    void k;
  },
  anim(p, k) {
    const [rx, ry] = p.P(k.w - 0.4, 1.15, 0);
    const u = unit(p);
    px(p.c, rx - u, ry - 24 * (p.k / 4), Math.sin(k.t * 2) > 0 ? LED.red : LED.redDim, 2 * u, u);
  },
};

// ── street furniture ────────────────────────────────────────
const dc_lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 12, 4, 0.26);
    // the warm pool of light on the snow under the head
    warmPool(p.c, x + 34, y + 6, 74, 30, 0.22);
    layer(p.c, (l) => {
      px(l, x - 4, y - 6, GALV[3], 9, 6);
      px(l, x - 4, y - 6, GALV[5], 2, 6);
      for (let j = 6; j < 196; j++) {
        const w = j < 40 ? 5 : j < 120 ? 4 : 3;
        px(l, x - Math.floor(w / 2), y - j, GALV[3], w, 1);
        px(l, x - Math.floor(w / 2), y - j, GALV[5], 1, 1);
      }
      // the outreach arm and the flat LED head with its glowing lens
      ln(l, x, y - 194, x + 30, y - 182, GALV[3], 2);
      fillPoly(l, [[x + 22, y - 186], [x + 46, y - 176], [x + 46, y - 171], [x + 22, y - 181]], '#4a525c');
      fillPoly(l, [[x + 24, y - 181], [x + 45, y - 172], [x + 44, y - 170], [x + 24, y - 179]], '#fff2c8');
      px(l, x + 22, y - 189, SNOW[6], 22, 2);
    }, { rect: [x - 8, y - 200, x + 50, y + 2] });
    void k;
  },
  lights: () => [{ a: 0.78, b: 0.22, z: 44, r: 3, color: '#ffd28a', kind: 'lamp' }],
  anim(p, k) {
    const [x, y] = anchor(p);
    const u = p.k / 4;
    p.c.globalAlpha = 0.16 + Math.sin(k.t * 0.7 + k.seed) * 0.01;
    ell(p.c, x + 34 * u, y - 176 * u, 22 * u, 12 * u, '#ffe2a8');
    p.c.globalAlpha = 1;
  },
};

const dc_bollard: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 4, y + 2, 8, 3, 0.24);
    layer(p.c, (l) => {
      for (let j = 0; j < 30; j++) for (let i = -5; i < 5; i++) px(l, x + i, y - j, YEL[i < -2 ? 5 : i < 1 ? 4 : i < 3 ? 3 : 2]);
      px(l, x - 5, y - 24, '#1e1e22', 10, 3);
      ell(l, x, y - 31, 6, 3, SNOW[5]);
      ell(l, x - 1, y - 32, 4, 2, SNOW[6]);
    }, { rect: [x - 8, y - 36, x + 8, y + 2] });
    void k;
  },
};

const dc_sign: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const v = k.variant ?? 'dc';
    contactShadow(p.c, x + 6, y + 3, 10, 3, 0.22);
    layer(p.c, (l) => {
      px(l, x - 1, y - 70, GALV[3], 3, 70);
      px(l, x - 1, y - 70, GALV[5], 1, 70);
      const cy = y - 82;
      if (v === 'elk') {
        // the moose warning: a red-bordered yellow triangle, a black elk walking
        fillPoly(l, [[x, cy - 18], [x - 18, cy + 13], [x + 18, cy + 13]], '#c8302a');
        fillPoly(l, [[x, cy - 12], [x - 13, cy + 10], [x + 13, cy + 10]], '#f2c230');
        fillPoly(l, [[x - 7, cy + 2], [x + 4, cy + 1], [x + 5, cy + 4], [x - 6, cy + 5]], '#1e1e22');
        px(l, x + 4, cy - 4, '#1e1e22', 3, 6);
        px(l, x + 3, cy - 6, '#1e1e22', 7, 2);
        for (const lx of [-6, -3, 2, 4]) px(l, x + lx, cy + 5, '#1e1e22', 1, 4);
        px(l, x - 1, cy - 20, SNOW[6], 4, 2);
      } else if (v === 'hv') {
        px(l, x - 12, cy - 12, '#f4f6f8', 24, 24);
        fillPoly(l, [[x, cy - 10], [x - 10, cy + 7], [x + 10, cy + 7]], '#1e1e22');
        fillPoly(l, [[x, cy - 7], [x - 7, cy + 5], [x + 7, cy + 5]], '#f2c230');
        ln(l, x + 1, cy - 4, x - 2, cy + 1, '#1e1e22', 2);
        ln(l, x - 2, cy + 1, x + 1, cy + 4, '#1e1e22', 2);
        px(l, x - 12, cy + 8, '#c8302a', 24, 4);
      } else if (v === 'speed') {
        ell(l, x, cy, 13, 13, '#c8302a');
        ell(l, x, cy, 10, 10, '#f4f6f8');
        labelXY(l, x - 7, cy - 3, '30', '#1e1e22', 1);
      } else {
        // the site sign: teal panel, the logo, DC1 and an arrow
        px(l, x - 22, cy - 14, '#1e4a5a', 44, 26);
        px(l, x - 21, cy - 13, '#2a6a78', 42, 24);
        fillPoly(l, [[x - 16, cy - 6], [x - 10, cy - 10], [x - 4, cy - 6], [x - 10, cy - 2]], '#5cd8c0');
        px(l, x + 8, cy + 4, '#f4f6f8', 10, 2);
        fillPoly(l, [[x + 16, cy + 1], [x + 21, cy + 5], [x + 16, cy + 9]], '#f4f6f8');
        px(l, x - 22, cy - 16, SNOW[6], 44, 2);
        labelXY(l, x + 1, cy - 9, 'DC1', '#f4f6f8', 1);
      }
    }, { rect: [x - 26, y - 110, x + 26, y + 2] });
  },
};

const dc_gritbin: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.25, 0.8, 0.75, 8, 0.24);
    lbox(p, 0.22, 0.28, 0.56, 0.44, 0, 7, { front: paint(YEL), side: paint(YEL), top: paint(YEL), edge: YEL[0] });
    lbox(p, 0.2, 0.26, 0.6, 0.48, 7, 1.2, { front: paint(YEL), side: paint(YEL), top: SNOWY, edge: YEL[0] });
    label(p, front(p, 0.72), 0.3, 5.6, 'GRIT', '#3a2a0a');
    snowCap(p, 0.22, 0.28, 0.78, 0.72, 8.2, k.seed, 0.6);
  },
};

const dc_hydrant: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 5, y + 2, 9, 3, 0.24);
    layer(p.c, (l) => {
      // the red hydrant half in a drift, its tall orange marker pole so the plough can find it
      for (let j = 0; j < 26; j++) {
        const w = j > 20 ? 6 - (j - 20) : 6;
        for (let i = -w; i < w; i++) px(l, x + i, y - j, RED[i < -2 ? 5 : i < 1 ? 4 : i < 3 ? 3 : 2]);
      }
      px(l, x - 9, y - 16, RED[3], 18, 4);
      px(l, x - 2, y - 30, RED[2], 4, 4);
      for (let j = 0; j < 90; j++) px(l, x + 8, y - j, Math.floor(j / 10) % 2 ? '#f4f6f8' : ORA[4], 2, 1);
      snowMasses(l, [{ x: x - 2, y: y - 3, rx: 14, ry: 5, z: 1 }], k.seed);
    }, { rect: [x - 16, y - 94, x + 14, y + 4] });
  },
};

const dc_bikeshed: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 22;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.9, Z, 0.22);
    // steel posts, a mono-pitch roof under a slab of snow, bikes in the rack under it
    for (const a of [0.1, W - 0.16]) {
      lbox(p, a, 0.12, 0.06, 0.06, 0, Z + 1.6, mono(galvP, GALV[0]));
      lbox(p, a, 0.82, 0.06, 0.06, 0, Z, mono(galvP, GALV[0]));
    }
    const Rn = rng(k.seed + 3);
    for (let i = 0; i < 3; i++) {
      const [bx, by] = p.P(0.55 + i * 0.95, 0.52, 0);
      const col = ['#c8302a', '#2a5aa8', '#3cb45a', '#1e1e22', '#e8e2d2'][Math.floor(Rn() * 5)];
      layer(p.c, (l) => {
        // a town bike side-on: wheels 26 px across, a step-through frame, a basket on some
        for (const wx of [-20, 20]) {
          for (let a = 0; a < 40; a++) {
            const ang = (a / 40) * Math.PI * 2;
            px(l, bx + wx + Math.cos(ang) * 13, by - 13 + Math.sin(ang) * 13, '#2a2630', 2, 1);
          }
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            ln(l, bx + wx, by - 13, bx + wx + Math.cos(ang) * 12, by - 13 + Math.sin(ang) * 12, '#9aa0aa');
          }
        }
        ln(l, bx - 20, by - 13, bx - 2, by - 28, col, 2);
        ln(l, bx - 2, by - 28, bx + 16, by - 26, col, 2);
        ln(l, bx + 16, by - 26, bx + 20, by - 13, col, 2);
        ln(l, bx - 20, by - 13, bx, by - 12, col, 2);
        ln(l, bx, by - 12, bx - 2, by - 28, col, 2);
        px(l, bx - 8, by - 33, '#3a2a26', 11, 3);
        px(l, bx - 8, by - 35, SNOW[6], 11, 2);
        ln(l, bx + 16, by - 26, bx + 14, by - 36, '#3a3640', 2);
        px(l, bx + 9, by - 38, '#3a3640', 12, 2);
        if (Rn() < 0.5) {
          px(l, bx + 18, by - 36, '#b8925a', 12, 8);
          for (let j = 0; j < 12; j += 3) px(l, bx + 18 + j, by - 36, '#8a6a3a', 1, 8);
          px(l, bx + 18, by - 38, SNOW[6], 12, 2);
        }
      }, { outline: 0.45, rect: [bx - 36, by - 44, bx + 36, by + 2] });
    }
    // the roof: a polycarbonate sheet seen under its snow
    const P = (a: number, b: number, z: number): V2 => p.P(a, b, z);
    fillPoly(p.c, [P(0, 0.08, Z + 2), P(W, 0.08, Z + 2), P(W, 0.94, Z), P(0, 0.94, Z)], 'rgba(170,200,220,0.5)');
    snowSlab(p, 0.02, 0.1, W - 0.02, 0.92, Z + 1, k.seed, 1.4);
  },
};

const dc_parkbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.25, W - 0.1, 0.75, 6, 0.24);
    const wood = paint(['#3a2a1a', '#5a4026', '#7a5634', '#9a6e44', '#b88a56', '#d2a46a']);
    for (const a of [0.2, W - 0.26]) lbox(p, a, 0.3, 0.06, 0.4, 0, 4.4, mono(paint(RACK), RACK[0]));
    for (let i = 0; i < 3; i++) lbox(p, 0.1, 0.3 + i * 0.13, W - 0.2, 0.1, 4.4, 0.4, mono(wood, '#3a2a1a'));
    for (let i = 0; i < 2; i++) lbox(p, 0.1, 0.26, W - 0.2, 0.04, 5.8 + i * 1.5, 1, mono(wood, '#3a2a1a'));
    snowCap(p, 0.1, 0.3, W - 0.1, 0.7, 4.8, k.seed, 0.8);
  },
};

const dc_flag: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 4, y + 2, 8, 3, 0.22);
    layer(p.c, (l) => {
      px(l, x - 4, y - 4, CONC[3], 8, 4);
      for (let j = 4; j < 210; j++) px(l, x - 1, y - j, j < 150 ? '#e8eaee' : '#d8dce0', 3, 1);
      px(l, x - 1, y - 210, '#c8ccd0', 3, 3);
    }, { rect: [x - 6, y - 214, x + 6, y + 2] });
    void k;
  },
  anim(p, k) {
    // the company flag in the wind: teal with a white mark, rippling
    const [x, y] = anchor(p);
    const u = p.k / 4;
    const top = y - 206 * u;
    for (let i = 0; i < 46; i++) {
      const t = i / 46;
      const wave = Math.sin(t * 6 - k.t * 4 + k.seed) * 4 * u * t;
      const h = 30 * u * (1 - t * 0.2);
      const col = (t > 0.25 && t < 0.4) ? '#f4f6f8' : Math.sin(t * 6 - k.t * 4 + k.seed) > 0.4 ? '#3ab8a0' : '#2a8a7a';
      p.c.fillStyle = col;
      p.c.fillRect(Math.round(x + 2 * u + i * u), Math.round(top + wave + t * 3 * u), Math.max(1, Math.round(u)), Math.round(h));
    }
  },
};

// ── vehicles: see vehicles.ts (cars, ploughs, snowmobile); the kick sled stays here ──
const dc_kicksled: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 2, 16, 4, 0.22);
    layer(p.c, (l) => {
      // long steel runners, a birch seat, the handlebar uprights
      ln(l, x - 22, y + 2, x + 18, y - 6, '#8a929c', 1);
      ln(l, x - 18, y + 6, x + 22, y - 2, '#8a929c', 1);
      ln(l, x + 18, y - 6, x + 21, y - 9, '#8a929c', 1);
      ln(l, x + 22, y - 2, x + 25, y - 5, '#8a929c', 1);
      for (const [dx, dy] of [[4, -2], [10, -4], [8, 1], [14, -1]] as const) ln(l, x + dx, y + dy, x + dx, y + dy - 12, '#6a4a2e', 2);
      fillPoly(l, [[x + 2, y - 12], [x + 12, y - 16], [x + 16, y - 13], [x + 6, y - 9]], '#c8a070');
      ln(l, x - 6, y - 4, x - 8, y - 30, '#6a4a2e', 2);
      ln(l, x - 2, y - 2, x - 4, y - 28, '#6a4a2e', 2);
      ln(l, x - 9, y - 30, x - 3, y - 28, '#3a2a1a', 2);
      px(l, x + 3, y - 14, SNOW[6], 8, 1);
    }, { rect: [x - 26, y - 34, x + 28, y + 8] });
    void k;
  },
};

export const DC_SITE: Record<string, PropArt> = {
  dc_genset,
  dc_fueltank,
  dc_container,
  dc_transformer,
  dc_gantry,
  dc_line,
  dc_hut,
  dc_fence,
  dc_gatehouse,
  dc_barrier,
  dc_lamp,
  dc_bollard,
  dc_sign,
  dc_gritbin,
  dc_hydrant,
  dc_bikeshed,
  dc_parkbench,
  dc_flag,
  dc_kicksled,
};
void lighten;
void curve;
void CAB;

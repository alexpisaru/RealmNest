// Data Center — the data hall round the room (1 z ≈ 10 cm).
//   dc_hall 'main'  the hall's main block behind the north-east wall: slate-blue
//                   trapezoidal cladding, intake louvres, a cage ladder, the DC1
//                   sign, a snowy flat roof behind a parapet with six dry coolers
//                   whose fans turn and whose warm exhaust steams in the cold
//   dc_hall 'wing'  the admin wing to the west: two storeys in charred timber,
//                   warm windows (the NOC glows blue upstairs), a glazed entrance
//                   under a snow-laden canopy, a mast with an aviation light
// Visible faces are the +y front (b = d) and the +x side (a = w).
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { ell, fillPoly, hash, layer, ln, OUTL, px, type Ramp, rng } from '../../kit4';
import { front3, type Plane, pq, pt, side3 } from '../../plane4';
import { tbox } from '../../../hd/kit';
import { brushed, paint } from '../materials';
import { anchor, lbox, mono } from '../util';
import { at, charred, label, ribbed, snowTop, unit } from './kit';
import { ALU, CLAD, GALV, LED, SNOW, STEEL, WARM, YEL } from './palette';
import { plume, STEAM } from './plume';
import { driftLine, snowSlab } from './room';

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };

const MAIN_Z = 72;
const WING_Z = 60;
const PARA = 3;

/** Horizontal louvre blades in an aluminium frame: dark gaps, each blade lit on its upper lip. */
const louvre: Mat = (light) => (_u, v) => {
  const f = v % 5;
  if (f < 1.6) return '#0a0d12';
  if (f < 2.4) return at(CLAD, light ? 1 : 0);
  if (f > 4.2) return at(CLAD, light ? 6 : 5);
  return at(CLAD, light ? 4 : 3);
};

/**
 * A wall lamp on the dark cladding: a black hood with a glowing lens, and the warm
 * cone it throws down the facade (dithered steps of alpha, cheap fills).
 */
function wallLamp(p: PropPainter, pl: Pl, u: number, z: number, drop = 18) {
  const steps = Math.round(drop);
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    const w = 0.1 + f * 0.62;
    pq(p, pl, u - w, u + w, z - i - 1, z - i, `rgba(255,206,130,${(0.34 * (1 - f) ** 1.3).toFixed(3)})`);
  }
  pq(p, pl, u - 0.16, u + 0.16, z - 0.2, z + 1.6, '#0c0e12');
  pq(p, pl, u - 0.14, u + 0.14, z + 1.4, z + 1.6, '#3a4048');
  pq(p, pl, u - 0.12, u + 0.12, z - 0.5, z, '#fff4d0');
}

/** Where the main block's wall lamps are: [plane 'F' | 'S', u, z]. */
function hallLamps(W: number, _D: number): ['F' | 'S', number, number][] {
  const out: ['F' | 'S', number, number][] = [];
  for (let a = 10.1; a < W - 1; a += 4.8) out.push(['F', a, 64]);
  out.push(['S', 2.1, 58], ['S', 6.4, 58]);
  return out;
}

/** The coping along a parapet: a pressed steel cap, its lit top and drip edge, snow lying on it. */
function coping(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number) {
  lbox(p, a0, b0, a1 - a0, b1 - b0, z, 0.6, { front: brushed(ALU), side: brushed(ALU), top: snowTop, edge: ALU[0] });
}

/** Icicles hanging from an eave along a plane, from u0 to u1 at height z. */
function icicles(p: PropPainter, pl: Pl, u0: number, u1: number, z: number, seed: number, density = 1) {
  const Rn = rng(seed);
  const [x0, y0] = pl.F(u0, z);
  const [x1, y1] = pl.F(u1, z);
  const n = Math.floor((Math.hypot(x1 - x0, y1 - y0) / 7) * density);
  for (let i = 0; i < n; i++) {
    if (Rn() < 0.35) continue;
    const t = (i + Rn() * 0.6) / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const len = 3 + Math.floor(Rn() * Rn() * 16);
    for (let j = 0; j < len; j++) px(p.c, x, y + j, j < len * 0.3 ? SNOW[6] : j < len * 0.7 ? '#cfe2f0' : '#a8c6dc', j < len * 0.5 && len > 8 ? 2 : 1, 1);
  }
}

/** A big flat roof under snow: one fill, the parapets' shadow, sparse wind ripples and crystal specks (cheap for whole roofs). */
function flatSnow(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number) {
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], SNOW[5]);
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b0 + 0.35, z), p.P(a0, b0 + 0.35, z)], SNOW[4]);
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a0 + 0.3, b0, z), p.P(a0 + 0.3, b1, z), p.P(a0, b1, z)], SNOW[4]);
  const Rn = rng(seed * 17 + 1);
  const n = Math.round((a1 - a0) * (b1 - b0) * 0.6);
  for (let i = 0; i < n; i++) {
    const a = a0 + 0.4 + Rn() * (a1 - a0 - 0.8);
    const b = b0 + 0.5 + Rn() * (b1 - b0 - 0.8);
    const len = 0.5 + Rn() * 1.8;
    const db = (Rn() - 0.5) * 0.3;
    const [x0, y0] = p.P(a, b, z);
    const [x1, y1] = p.P(Math.min(a1 - 0.2, a + len), b + db, z);
    ln(p.c, x0, y0 + 1, x1, y1 + 1, SNOW[3]);
    ln(p.c, x0 + 1, y0, x1, y1, SNOW[6]);
  }
  for (let i = 0; i < n * 10; i++) {
    const [x, y] = p.P(a0 + Rn() * (a1 - a0), b0 + Rn() * (b1 - b0), z);
    px(p.c, x, y, Rn() < 0.75 ? SNOW[4] : SNOW[6]);
  }
}

/** A dry cooler on the roof: a steel frame, coil banks behind louvres, a row of fan guards on top. */
function cooler(p: PropPainter, a0: number, b0: number, w: number, d: number, z: number) {
  const legH = 1.6;
  const H = 5.2;
  for (const a of [a0 + 0.08, a0 + w - 0.14]) for (const b of [b0 + 0.08, b0 + d - 0.14]) lbox(p, a, b, 0.06, 0.06, z, legH, mono(paint(GALV), GALV[0]));
  lbox(p, a0, b0, w, d, z + legH, H, {
    front: (light, ww) => (u, v) => (v > H * 4 - 3 ? at(ALU, light ? 5 : 4) : u % 3 < 1.2 && u > 3 && u < ww - 3 ? '#2a3440' : at(ALU, light ? 3.4 : 2.3)),
    side: (light) => (_u, v) => (v > H * 4 - 3 ? at(ALU, 4) : v % 3 < 1.2 ? '#222a34' : at(ALU, light ? 3 : 2)),
    top: (light) => (u, v) => at(ALU, (light === 2 ? 4.4 : 3) + ((u + v) % 17 < 1 ? -0.8 : 0)),
    edge: ALU[0],
  });
  // the fan guards: dark discs with a ring and a hub (the blades turn in anim), a cap of snow on the casing between them
  const n = Math.max(2, Math.round(w / 1.15));
  for (let i = 0; i < n; i++) {
    const [cx, cy] = p.P(a0 + (w * (i + 0.5)) / n, b0 + d / 2, z + legH + H);
    ell(p.c, cx, cy, 25, 12.5, '#3a4450');
    ell(p.c, cx, cy, 23, 11.5, '#10161e');
    ell(p.c, cx, cy + 1, 15, 7.5, '#1a222c');
    ell(p.c, cx, cy, 3, 1.6, at(ALU, 3));
  }
  // snow along the casing's ridge and drifted against the near side
  const [s0x, s0y] = p.P(a0, b0 + d, z + legH + H);
  const [s1x, s1y] = p.P(a0 + w, b0 + d, z + legH + H);
  ln(p.c, s0x, s0y, s1x, s1y, SNOW[5], 2);
}

/** A window of the wing: black aluminium frame, warm room light, blinds half down, a lamp or a plant inside. */
function warmWindow(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, seed: number, noc = false) {
  const light = pl.light;
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 0.5, z1 + 0.4, '#0c0c0e');
  const blind = (hash(seed, 1, 9) * 0.45 + 0.05) * (z1 - z0);
  const lit = hash(seed, 2, 9) < 0.82;
  const tex: FaceTex = (u, v, x, y) => {
    const top = (z1 - z0) * 4;
    if (v > top - blind * 4) return (v % 3 < 1 ? '#8a7a5e' : '#c8b48c') as string;
    if (!lit) return (u * 0.8 + v) % 40 < 5 ? '#4a5a6a' : '#1e2630';
    if (noc) {
      // the NOC upstairs: screens glowing blue and green, a cool cast
      const screen = Math.floor(u / 11);
      if (v > 10 && v < top * 0.55 && u % 11 > 1.5 && u % 11 < 9.5) return screen % 3 === 1 ? '#3ac08a' : '#3a86e0';
      return v < 10 ? '#1a2a3a' : '#28465e';
    }
    // a warm room: brighter toward the ceiling lamps, darker furniture low down
    let i = 3.6 + (v / top) * 2;
    if (v < 9) i -= 2;
    if (hash(Math.floor(u / 6), 3, seed) < 0.2 && v < top * 0.6) i -= 1.5;
    if ((u * 0.8 + v) % 46 < 4) i += 1;
    if (hash(x, y, 5) < 0.02) i -= 1;
    return at(WARM, i);
  };
  pt(p, pl, u0, u1, z0, z1, tex, light);
  // the mullion and a transom
  const um = (u0 + u1) / 2;
  pq(p, pl, um - 0.025, um + 0.025, z0, z1, '#0c0c0e');
  // the sill
  pq(p, pl, u0 - 0.07, u1 + 0.07, z0 - 0.8, z0 - 0.4, at(ALU, light ? 5 : 3));
}

// ── the main block ──────────────────────────────────────────
function mainHall(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const Z = MAIN_Z;
  const F = front3(p, D);
  const S = side3(p, W);
  // the box: ribbed cladding to the parapet's top over a concrete plinth. The wing stands in
  // front of this block's south face west of WA and is drawn before it (it sorts in front of the
  // room's walls), so that part of the face is only painted above the wing's parapet.
  const WA = 7.7;
  const plinth = paint(['#5a6068', '#6a7078', '#7a8088', '#8a9098', '#9aa0a8', '#aab0b8']);
  const rib = ribbed(CLAD, 16);
  tbox(p, 0, 0, W, D, 0, 1.6, { right: plinth, outline: false });
  tbox(p, 0, 0, W, D, 1.6, Z + PARA - 1.6, { right: rib, outline: false });
  pt(p, F, WA, W, 0, 1.6, plinth, F.light);
  pt(p, F, WA, W, 1.6, Z + PARA, rib, F.light);
  pt(p, F, 0, WA, WING_Z + PARA + 0.6, Z + PARA, rib, F.light);
  // the silhouette: ground lines and the lit corner
  const E = (a: [number, number, number], b: [number, number, number], col: string) => {
    const [x0, y0] = p.P(...a);
    const [x1, y1] = p.P(...b);
    ln(p.c, x0, y0, x1, y1, col);
  };
  E([W, 0, 0], [W, D, 0], '#151a22');
  E([WA, D, 0], [W, D, 0], '#151a22');
  E([W, D, 0.2], [W, D, Z + PARA], CLAD[5]);
  // a darker band of flashing at the roof line and a drip over the plinth
  pq(p, F, WA, W, Z - 0.6, Z, mix(CLAD[0], OUTL, 0.3));
  pq(p, S, 0, D, Z - 0.6, Z, mix(CLAD[0], OUTL, 0.3));
  pt(p, F, WA, W, 1.4, 2, brushed(GALV), F.light);
  pt(p, S, 0, D, 1.4, 2, brushed(GALV), S.light);
  // the roof: the inner faces of the far parapets, then the snow
  pq(p, front3(p, 0.3), 0.3, W - 0.3, Z, Z + PARA, at(CLAD, 3));
  pq(p, side3(p, 0.3), 0.3, D - 0.3, Z, Z + PARA, at(CLAD, 2));
  flatSnow(p, 0.3, 0.3, W - 0.3, D - 0.3, Z, k.seed);
  // drifts against the far parapets
  driftLine(p, 0.5, W - 0.5, 0.62, Z, 9, k.seed + 5);
  driftLine(p, 0.7, D - 0.5, 0.62, Z, 9, k.seed + 6, true);
  // a walkway of grey pavers to the coolers, cleared of snow
  for (let a = 1.2; a < W - 1.5; a += 0.62) {
    const [x, y] = p.P(a, D * 0.5, Z);
    fillPoly(p.c, [[x - 14, y], [x, y - 7], [x + 14, y], [x, y + 7]], '#8a929c');
    fillPoly(p.c, [[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6]], '#a8b0b8');
  }
  // six dry coolers in two rows, a duct running beside them, a roof hatch, the mast
  const rows = [1.4, D * 0.5 + 0.9];
  for (const b of rows) for (let i = 0; i < 4; i++) cooler(p, 1.4 + i * ((W - 2.4) / 4), b, (W - 2.4) / 4 - 0.8, 1.5, Z);
  lbox(p, 0.9, D * 0.5 - 0.75, W - 1.8, 0.5, Z + 0.6, 1.6, { front: brushed(ALU), side: brushed(ALU), top: snowTop, edge: ALU[0] });
  lbox(p, W - 2.2, D - 1.6, 0.9, 0.7, Z, 1.8, { front: paint(ALU), side: paint(ALU), top: snowTop, edge: ALU[0] });
  // the front parapets' coping (in front of the roof plant) and the far ones
  coping(p, 0, 0, W, 0.32, Z + PARA);
  coping(p, 0, 0, 0.32, D, Z + PARA);
  coping(p, 0, D - 0.32, W, D, Z + PARA);
  coping(p, W - 0.32, 0, W, D, Z + PARA);
  // ── the south face above the room: an intake louvre bank in sections ──
  const L0 = 11.3;
  for (let a = L0; a < W - 1.2; a += 4.8) {
    pq(p, F, a - 0.06, a + 2.06, 46.4, 60.6, at(CLAD, 0));
    pt(p, F, a, a + 2, 47, 60, louvre, F.light);
  }
  pq(p, F, 0.4, 7.4, 64.6, 66, at(ALU, 3));
  // ── the east facade ──
  // the louvre banks over the gensets
  for (const [u0, u1] of [[0.9, 3.0], [4.3, 9.3]] as const) {
    pq(p, S, u0 - 0.06, u1 + 0.06, 33.4, 56.6, at(ALU, 1));
    pt(p, S, u0, u1, 34, 56, louvre, S.light);
  }
  // the personnel door between the gensets: steel, a little canopy, a warm lamp over it
  const du = 3.3;
  pq(p, S, du - 0.06, du + 0.86, 0, 22.4, at(STEEL, 1));
  pt(p, S, du, du + 0.8, 0, 21.6, (u: number, v: number) => (u < 1.5 ? at(CLAD, 4) : v < 10 ? at(CLAD, 2.4) : at(CLAD, 2.8)), S.light);
  pq(p, S, du + 0.08, du + 0.18, 9.6, 10.4, '#c8ccd0');
  lbox(p, W, du - 0.2, 0.9, 1.2, 23.4, 0.7, { front: brushed(ALU), side: brushed(ALU), top: snowTop, edge: ALU[0] });
  for (const b of [du - 0.12, du + 0.92]) {
    // tie rods from the facade down to the canopy's outer edge
    const [rx0, ry0] = p.P(W, b, 30);
    const [rx1, ry1] = p.P(W + 0.86, b, 24.1);
    ln(p.c, rx0, ry0, rx1, ry1, GALV[3]);
    px(p.c, rx0 - 1, ry0 - 1, GALV[1], 3, 3);
  }
  const [lx, ly] = S.F(du + 0.4, 25.6);
  layer(p.c, (l) => {
    px(l, lx - 3, ly - 2, '#2a2e34', 7, 4);
    px(l, lx - 2, ly + 2, '#fff0b8', 5, 2);
  }, { rect: [lx - 6, ly - 4, lx + 6, ly + 6] });
  // the sign high on the facade: DC-1 in white on a dark green board with a pale rim
  pq(p, S, 6.95, 9.15, 61.4, 71.2, '#c8d4cc');
  pq(p, S, 7.0, 9.1, 61.8, 70.8, '#123a2c');
  pq(p, S, 7.0, 9.1, 61.8, 62.3, '#0a2018');
  label(p, S, 8.6, 68.8, 'DC-1', '#f2f6f4', -1, 4);
  // the cage ladder to the roof at the north end
  const cu = 0.55;
  for (const du2 of [-0.12, 0.12]) pq(p, S, cu + du2 - 0.02, cu + du2 + 0.02, 2, Z + PARA + 3, at(YEL, du2 < 0 ? 4 : 2));
  for (let z = 3; z < Z + PARA + 2; z += 1.4) pq(p, S, cu - 0.12, cu + 0.12, z, z + 0.25, at(YEL, 3));
  layer(p.c, (l) => {
    for (let z = 22; z < Z + PARA + 2; z += 4.5) {
      const [x0, y0] = p.P(W, cu - 0.16, z);
      const [x1, y1] = p.P(W, cu + 0.16, z);
      const [xm, ym] = p.P(W + 0.42, cu, z);
      ln(l, x0, y0, xm, ym, YEL[4]);
      ln(l, xm, ym, x1, y1, YEL[2]);
    }
    for (const t of [-0.16, 0, 0.16]) {
      const [xa, ya] = p.P(W + (t === 0 ? 0.42 : 0.3), cu + t, 22);
      const [xb, yb] = p.P(W + (t === 0 ? 0.42 : 0.3), cu + t, Z + PARA + 2);
      ln(l, xa, ya, xb, yb, YEL[2]);
    }
  }, { rect: (() => { const [a1, b1] = p.P(W, cu + 0.3, 0); const [a2, b2] = p.P(W + 0.5, cu - 0.3, Z + 8); return [Math.min(a1, a2) - 8, Math.min(b1, b2) - 8, Math.max(a1, a2) + 8, Math.max(b1, b2) + 8] as [number, number, number, number]; })() });
  // a red fire bell and a CCTV camera on the facade, a drainpipe from the roof
  const [bx, by] = S.F(5.2, 26);
  ell(p.c, bx, by, 4, 4, '#a62c26');
  ell(p.c, bx - 1, by - 1, 2, 2, '#e05844');
  pt(p, S, 9.3, 9.42, 1.6, Z, brushed(GALV), S.light);
  // the wall lamps and their warm cones down the dark cladding
  for (const [pl, u, z] of hallLamps(W, D)) wallLamp(p, pl === 'F' ? F : S, u, z, pl === 'F' ? 20 : 26);
  // icicles along the visible eaves
  icicles(p, S, 0.2, D - 0.2, Z + PARA - 0.2, k.seed + 1);
  icicles(p, F, 0.2, W - 0.2, Z + PARA - 0.2, k.seed + 2, 0.8);
  // the lamp's warm pool on the snow in front of the door
  const [gx, gy] = p.P(W + 0.6, du + 0.4, 0);
  p.c.globalAlpha = 0.16;
  ell(p.c, gx, gy, 46, 20, '#ffd890');
  ell(p.c, gx, gy, 28, 12, '#ffe8b0');
  p.c.globalAlpha = 1;
}

function mainAnim(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const Z = MAIN_Z;
  const u = unit(p);
  const t = k.t;
  const rows = [1.4, D * 0.5 + 0.9];
  const cw = (W - 2.4) / 4 - 0.8;
  let n = 0;
  for (const b of rows)
    for (let i = 0; i < 4; i++) {
      const a0 = 1.4 + i * ((W - 2.4) / 4);
      const fans = Math.max(2, Math.round(cw / 1.15));
      for (let f = 0; f < fans; f++) {
        n++;
        const [cx, cy] = p.P(a0 + (cw * (f + 0.5)) / fans, b + 0.75, Z + 6.8);
        // the blades turning
        const ang = t * (3 + (n % 3)) + n;
        for (let bl = 0; bl < 3; bl++) {
          const a = ang + (bl * Math.PI * 2) / 3;
          ln(p.c, cx, cy, cx + Math.cos(a) * 19 * u * 0.5 * 2, cy + Math.sin(a) * 9.5 * u, '#5a6878', Math.max(1, u));
        }
        // warm exhaust condensing into steam: a billowing column drifting east
        if ((n + i) % 2 === 0) continue;
        plume(p, cx, cy - 4 * u, STEAM, t, 0.11, n);
      }
    }
}

/** A row of PV panels on a low frame at height z, from a0 to a1 at depth b0 (0.8 deep), tilted up toward the back. */
function pvRow(p: PropPainter, a0: number, a1: number, b0: number, z: number, seed: number) {
  const P = (a: number, b: number, zz: number) => p.P(a, b, zz);
  const b1 = b0 + 0.8;
  const zl = z + 1.2;
  const zh = z + 4.2;
  // the frame's back legs, then the panel face, its cells, then the snow on its upper half
  for (let a = a0 + 0.1; a < a1; a += 1.1) {
    const [x0, y0] = P(a, b0 + 0.05, z);
    const [x1, y1] = P(a, b0 + 0.05, zh);
    ln(p.c, x0, y0, x1, y1, GALV[2], 2);
  }
  const pts = [P(a0, b1, zl), P(a1, b1, zl), P(a1, b0, zh), P(a0, b0, zh)];
  fillPoly(p.c, pts, '#1c2c48');
  const n = Math.round((a1 - a0) * 6);
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const [x0, y0] = P(a, b1, zl);
    const [x1, y1] = P(a, b0, zh);
    ln(p.c, x0, y0, x1, y1, '#2e4468');
  }
  for (const f of [0.33, 0.66]) {
    const [x0, y0] = P(a0, b1 - 0.8 * f, zl + 3 * f);
    const [x1, y1] = P(a1, b1 - 0.8 * f, zl + 3 * f);
    ln(p.c, x0, y0, x1, y1, '#2e4468');
  }
  // a glint across the glass
  const [gx0, gy0] = P(a0 + 0.3, b1 - 0.2, zl + 0.75);
  const [gx1, gy1] = P(a0 + 1.1, b1 - 0.2, zl + 0.75);
  ln(p.c, gx0, gy0, gx1, gy1, '#5a7aa8');
  // the snow: one sheet over most of the panel, its lower edge a gentle wave where it has crept down
  const Rn = rng(seed);
  const ph = Rn() * 6;
  const m = 24;
  const edge: [number, number][] = [];
  for (let i = 0; i <= m; i++) {
    const a = a0 + ((a1 - a0) * i) / m;
    const f = 0.78 + 0.1 * Math.sin(i * 0.55 + ph) + 0.04 * Math.sin(i * 1.7 + ph * 2);
    edge.push(P(a, b0 + 0.8 * (1 - f), zh - 3 * (1 - f)));
  }
  fillPoly(p.c, [P(a0, b0, zh), P(a1, b0, zh), ...edge.reverse()], SNOW[5]);
  for (let i = 0; i + 1 < edge.length; i++) ln(p.c, edge[i][0], edge[i][1], edge[i + 1][0], edge[i + 1][1], SNOW[3]);
  for (let i = 0; i + 1 < edge.length; i++) ln(p.c, edge[i][0], edge[i][1] - 1, edge[i + 1][0], edge[i + 1][1] - 1, SNOW[6]);
  // the panel's top edge and frame in aluminium, the lower lip
  const [tx0, ty0] = P(a0, b0, zh);
  const [tx1, ty1] = P(a1, b0, zh);
  ln(p.c, tx0, ty0 - 1, tx1, ty1 - 1, SNOW[6], 2);
  const [lx0, ly0] = P(a0, b1, zl);
  const [lx1, ly1] = P(a1, b1, zl);
  ln(p.c, lx0, ly0, lx1, ly1, ALU[4]);
  ln(p.c, lx0, ly0 + 1, lx1, ly1 + 1, ALU[1]);
}

// ── the admin wing ──────────────────────────────────────────
function wing(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const Z = WING_Z;
  const F = front3(p, D);
  const S = side3(p, W);
  lbox(p, 0, 0, W, D, 0, 1.6, mono(paint(['#4a5058', '#5a6068', '#6a7078', '#7a8088', '#8a9098', '#9aa0a8']), '#2a3038'));
  lbox(p, 0, 0, W, D, 1.6, Z + PARA - 1.6, { front: charred, side: charred, top: paint(CLAD), edge: '#0a0806' });
  // a pale band of flashing between the storeys and at the roof line
  for (const z of [30, Z]) {
    pq(p, F, 0, W, z - 0.8, z, at(ALU, 4));
    pq(p, S, 0, D, z - 0.8, z, at(ALU, 2.6));
  }
  // the roof: snow behind the parapet, an air handler, vent stacks, the mast
  pq(p, front3(p, 0.3), 0.3, W - 0.3, Z, Z + PARA, '#1b1714');
  pq(p, side3(p, 0.3), 0.3, D - 0.3, Z, Z + PARA, '#110e0c');
  flatSnow(p, 0.3, 0.3, W - 0.3, D - 0.3, Z, k.seed);
  driftLine(p, 0.5, W - 0.5, 0.62, Z, 8, k.seed + 3);
  driftLine(p, 0.7, D - 0.5, 0.62, Z, 8, k.seed + 4, true);
  // rows of solar panels tilted to the south: snow lying on their upper half, the lower cells slid clear
  for (const b0 of [1.2, 2.5, 3.8]) pvRow(p, 4.3, W - 1.5, b0, Z, k.seed + Math.round(b0 * 10));
  // roof lights in a row, domes under snow, and the access hatch with boot prints to the plant
  for (let b = 6.4; b < D - 1.2; b += 1.5) {
    const [qx, qy] = p.P(W * 0.62, b, Z);
    layer(p.c, (l) => {
      fillPoly(l, [[qx - 20, qy], [qx, qy - 10], [qx + 20, qy], [qx, qy + 10]], ALU[3]);
      ell(l, qx, qy - 5, 15, 8, SNOW[5]);
      ell(l, qx - 3, qy - 7, 9, 4, SNOW[6]);
      ell(l, qx + 6, qy - 3, 7, 3, SNOW[4]);
    }, { outline: 0.4, rect: [qx - 24, qy - 16, qx + 24, qy + 12] });
  }
  lbox(p, 4.6, 10.8, 0.8, 0.7, Z, 1.4, { front: paint(ALU), side: paint(ALU), top: snowTop, edge: ALU[0] });
  {
    const Rn2 = rng(k.seed * 11 + 5);
    let a = 4.9;
    let b = 10.6;
    for (let i = 0; i < 16; i++) {
      a -= 0.16 + Rn2() * 0.03;
      b -= 0.42 + Rn2() * 0.05;
      const off = i % 2 ? 0.05 : -0.05;
      const [fx, fy] = p.P(a + off, b, Z);
      px(p.c, fx - 2, fy, SNOW[2], 4, 2);
      px(p.c, fx - 2, fy + 2, SNOW[6], 4, 1);
    }
  }
  lbox(p, 1.2, 6.8, 2.2, 1.4, Z, 4.2, { front: (light) => (_u, v) => (v % 4 < 1.2 ? '#2a3440' : at(ALU, light ? 4 : 3)), side: (light) => (_u, v) => (v % 4 < 1.2 ? '#222a34' : at(ALU, light ? 3 : 2)), top: snowTop, edge: ALU[0] });
  lbox(p, 1.4, 3, 2.4, 1.6, Z, 4.6, { front: (light) => (_u, v) => (v % 4 < 1.2 ? '#2a3440' : at(ALU, light ? 4 : 3)), side: (light) => (_u, v) => (v % 4 < 1.2 ? '#222a34' : at(ALU, light ? 3 : 2)), top: snowTop, edge: ALU[0] });
  // packaged air handlers and condensers: louvred grey boxes under caps of snow, a duct between two
  const hvac = { front: (light: number) => (_u: number, v: number) => (v % 4 < 1.2 ? '#2a3440' : at(ALU, light ? 4 : 3)), side: (light: number) => (_u: number, v: number) => (v % 4 < 1.2 ? '#222a34' : at(ALU, light ? 3 : 2)), top: snowTop, edge: ALU[0] } as const;
  for (const [a, b, w, d, h] of [[1.3, 1.2, 1.1, 0.9, 3], [3.0, 1.3, 0.9, 0.8, 2.6], [5.6, 11.6, 1.2, 1.0, 3.2], [1.4, 9.4, 0.8, 0.8, 2.4], [3.4, 12.6, 1.6, 0.7, 2.2]] as const) lbox(p, a, b, w, d, Z, h, hvac);
  lbox(p, 2.4, 1.55, 0.6, 0.3, Z + 1, 1, { front: brushed(ALU), side: brushed(ALU), top: snowTop, edge: ALU[0] });
  for (const [a, b] of [[4.8, 6.5], [5.4, 9.4], [2.6, 11.2]] as const) {
    lbox(p, a, b, 0.24, 0.24, Z, 4, mono(brushed(GALV), GALV[0]));
    lbox(p, a - 0.06, b - 0.06, 0.36, 0.36, Z + 4, 0.6, { front: paint(GALV), side: paint(GALV), top: snowTop, edge: GALV[0] });
  }
  // the mast: a lattice of galvanised steel with an antenna and the aviation light
  const [mx, my] = p.P(W - 0.9, 1.6, Z);
  layer(p.c, (l) => {
    const H = 120;
    for (const dx of [-5, 5]) ln(l, mx + dx, my, mx + dx * 0.3, my - H, GALV[dx < 0 ? 4 : 2], 2);
    for (let j = 6; j < H - 6; j += 9) {
      const w1 = 5 - (j / H) * 3.5;
      ln(l, mx - w1, my - j, mx + w1 * 0.92, my - j - 9, GALV[3]);
      ln(l, mx + w1, my - j, mx - w1 * 0.92, my - j - 9, GALV[2]);
    }
    px(l, mx - 1, my - H - 22, GALV[4], 2, 22);
    ell(l, mx - 9, my - H + 14, 5, 6, '#e8eaee');
    ell(l, mx - 9, my - H + 14, 3, 4, '#c8ccd0');
    px(l, mx - 2, my - H - 26, '#a62c26', 4, 4);
  }, { rect: [mx - 20, my - 154, mx + 14, my + 4] });
  // ── the south facade: windows on two floors, the entrance under its canopy ──
  const ent = W * 0.5;
  for (let a = 0.6; a < W - 0.8; a += 1.25) {
    const c = a + 0.5;
    if (Math.abs(c - ent) > 0.9) warmWindow(p, F, a, a + 0.9, 7, 24, k.seed * 13 + Math.round(a * 7));
    warmWindow(p, F, a, a + 0.9, 36, 54, k.seed * 17 + Math.round(a * 7), a > W * 0.45);
  }
  // the entrance: a glazed vestibule, warm inside, a dark mat, the canopy with a thick cushion of snow
  pq(p, F, ent - 1.05, ent + 1.05, 0, 25, '#0c0c0e');
  pt(p, F, ent - 1, ent + 1, 0, 24.4, (u: number, v: number) => {
    const ww = 2 * 71.55;
    if (u % (ww / 4) < 1.6 || v % 48 < 1.4) return '#0c0c0e';
    if ((u * 0.7 + v) % 60 < 6) return '#fff4cc';
    return v < 10 ? '#7a5a2a' : at(WARM, 3.2 + (v / 98) * 2);
  }, F.light);
  for (const a of [ent - 1.4, ent + 1.32]) lbox(p, a, D + 1.24, 0.08, 0.08, 0, 24, mono(brushed(STEEL), STEEL[0]));
  // the canopy: a deep charcoal fascia carrying the site's name, its soffit lit warm, a slab of snow on top
  const FASC: Ramp = ['#14161a', '#1c1f24', '#25292f', '#30353c', '#3c424a', '#4a515a'];
  lbox(p, ent - 1.5, D, 3, 1.4, 24, 3.2, { front: paint(FASC), side: paint(FASC), top: paint(FASC), edge: FASC[0] });
  const CF = front3(p, D + 1.4);
  pq(p, CF, ent - 1.5, ent + 1.5, 24, 24.3, '#ffe2a8');
  label(p, CF, ent - 0.95, 26.6, 'FJORD DC1', '#eef2f6');
  pq(p, CF, ent + 0.95, ent + 1.2, 25, 26.6, '#5cd8c0');
  snowSlab(p, ent - 1.5, D, ent + 1.5, D + 1.4, 27.2, k.seed + 9, 1.8);
  icicles(p, CF, ent - 1.5, ent + 1.5, 24, k.seed + 4, 1.4);
  // the warm light falling out of the entrance onto the snow
  const [gx, gy] = p.P(ent, D + 1.2, 0);
  p.c.globalAlpha = 0.18;
  ell(p.c, gx, gy, 90, 38, '#ffd890');
  ell(p.c, gx, gy - 4, 56, 22, '#ffe8b0');
  p.c.globalAlpha = 1;
  // ── the east face above the room's wall: the upper floor's windows ──
  for (let b = 0.9; b < D - 1; b += 1.6) warmWindow(p, S, b, b + 1.1, 36, 54, k.seed * 19 + Math.round(b * 5), b > D * 0.55);
  icicles(p, F, 0.2, W - 0.2, Z + PARA - 0.2, k.seed + 6);
  icicles(p, front3(p, D), ent - 1.4, ent + 1.4, 30, k.seed + 8, 0.6);
  coping(p, 0, 0, W, 0.3, Z + PARA);
  coping(p, 0, 0, 0.3, D, Z + PARA);
  coping(p, 0, D - 0.3, W, D, Z + PARA);
  coping(p, W - 0.3, 0, W, D, Z + PARA);
}

function wingAnim(p: PropPainter, k: PropCtx) {
  // the aviation light on the mast, slow red blinks
  const [mx, my] = p.P(k.w - 0.9, 1.6, WING_Z);
  const u = p.k / 4;
  if (Math.sin(k.t * 1.6) > 0.3) {
    p.c.globalAlpha = 0.35;
    ell(p.c, mx, my - 144 * u, 7 * u, 7 * u, '#ff5a3a');
    p.c.globalAlpha = 1;
    px(p.c, mx - 2 * u, my - 146 * u, LED.red, Math.max(1, Math.round(4 * u)), Math.max(1, Math.round(4 * u)));
  }
}

const dc_hall: PropArt = {
  draw(p, k) {
    if (k.variant === 'wing') wing(p, k);
    else mainHall(p, k);
  },
  lights(k) {
    const W = k.w;
    const D = k.d;
    const out: PropLight[] = [];
    if (k.variant === 'wing') {
      // the lit windows on both floors of the south face, the upper floor of the east face, the entrance
      const ent = W * 0.5;
      for (let a = 0.6; a < W - 0.8; a += 2.5) {
        if (Math.abs(a + 0.5 - ent) > 0.9) out.push({ a: a + 0.45, b: D, z: 15, r: 1.1, color: '#ffd49a', kind: 'window' });
        out.push({ a: a + 0.45, b: D, z: 45, r: 1.1, color: '#ffd49a', kind: 'window' });
      }
      for (let b = 0.9; b < D - 1; b += 3.2) out.push({ a: W, b: b + 0.55, z: 45, r: 1.1, color: '#ffd49a', kind: 'window' });
      out.push({ a: ent, b: D + 1.3, z: 23, r: 2.2, color: '#ffcf8a', kind: 'lamp' });
      return out;
    }
    for (const [pl, u, z] of hallLamps(W, D)) out.push(pl === 'F' ? { a: u, b: D + 0.1, z, r: 1.8, color: '#ffce88', kind: 'lamp' } : { a: W + 0.1, b: u, z, r: 2.4, color: '#ffce88', kind: 'lamp' });
    out.push({ a: W + 0.6, b: 3.7, z: 25, r: 1.8, color: '#ffd890', kind: 'lamp' });
    return out;
  },
  anim(p, k) {
    if (k.variant === 'wing') wingAnim(p, k);
    else mainAnim(p, k);
  },
};

export const DC_HALL: Record<string, PropArt> = { dc_hall };
void darken;
void lighten;
void anchor;
void (null as unknown as Ramp);

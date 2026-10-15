// Chemical Lab — the working furniture at 128×64 (1 z ≈ 10 cm; a person ≈ 17.5 z).
// White powder-coated steel, black epoxy-resin worktops, stainless trim and
// teal accents: sash fume hoods with live experiments, island lab benches
// with service spines and reagent shelves, an HPLC station, a vented glass
// reagent cabinet.
import { darken, lighten, mix } from '../../../color';
import type { FaceTex } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, bayer, type C, ell, fillPoly, hash, layer, ln, px, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import {
  ANTH,
  beaker,
  BLU,
  bottle,
  card,
  coat,
  cyl,
  erlen,
  ghs,
  glassMat,
  GRN,
  LIQ,
  LIQS,
  LW,
  P,
  planeText,
  rbFlask,
  RED,
  RESIN,
  resinMat,
  STEEL,
  steelMat,
  stirrer,
  TEAL,
  tubeRack,
  washBottle,
  YEL,
} from './lk';

const lwCoat = coat(LW);
const steel = steelMat();
const anth = coat(ANTH);

/** A horizontal bar handle on a plane (stainless or teal): a lit top line over a dark one. */
function handle(p: PropPainter, pl: ReturnType<typeof front>, u0: number, u1: number, z: number, col: readonly string[] = STEEL) {
  pq(p, pl, u0, u1, z - 0.25, z + 0.25, col[pl.light ? 2 : 1]);
  pq(p, pl, u0, u1, z + 0.05, z + 0.25, col[pl.light ? 5 : 3]);
}

// ── the fume hood ───────────────────────────────────────────
const ZW = 8.6; // work surface
const ZT = 24; // top of the hood
const ZO = 21.8; // top of the opening
const ZS = 13.6; // the sash, raised to a safe working height

/** Back baffle of the hood's interior: slotted panels, bright under the light. */
const baffle: FaceTex = (u, v, x, y) => {
  const H = (ZO - ZW) * 4;
  let i = 3.4 + (v / H) * 1.4;
  const s1 = Math.abs(v - H * 0.22);
  const s2 = Math.abs(v - H * 0.64);
  if (s1 < 1.5 || s2 < 1.5) return at(LW, 0.6);
  if (s1 < 2.5 || s2 < 2.5) i -= 1.2;
  if (v > H - 4) return v > H - 2 ? '#fffbe8' : '#f4f2e0';
  if (u % 58 < 1) i -= 1.5;
  if (hash(x, y, 7) < 0.015) i -= 1;
  return at(LW, i + (bayer(x, y) - 0.5) * 0.5);
};

function hoodTitration(p: PropPainter, c: C) {
  const [bx, by] = P(p, 0.5, 0.48, ZW);
  layer(
    c,
    (l) => {
      // reagent bottles at the back left
      bottle(l, P(p, 0.32, 0.4, ZW)[0], P(p, 0.32, 0.4, ZW)[1], 4, 14, '#7a3e12', '#2a2a30', '#f4f1e6', RED[3]);
      bottle(l, P(p, 0.26, 0.56, ZW)[0], P(p, 0.26, 0.56, ZW)[1], 3, 11, '#e8eeee', BLU[3], '#f4f1e6', BLU[3]);
      // the retort stand: a black base, a steel rod
      fillPoly(l, [[bx - 10, by], [bx + 2, by - 6], [bx + 10, by - 2], [bx - 2, by + 4]], ANTH[1]);
      fillPoly(l, [[bx - 10, by - 1], [bx + 2, by - 7], [bx + 10, by - 3], [bx - 2, by + 3]], ANTH[3]);
      px(l, bx - 4, by - 46, STEEL[4], 2, 46);
      px(l, bx - 4, by - 46, STEEL[6], 1, 46);
      // burette clamp and the burette, with a teal stopcock
      px(l, bx - 4, by - 30, ANTH[2], 14, 3);
      px(l, bx + 8, by - 32, ANTH[1], 3, 6);
      const tx = bx + 12;
      px(l, tx - 2, by - 44, '#9fc3cb', 4, 32);
      px(l, tx - 1, by - 43, '#eaf6f8', 2, 30);
      px(l, tx - 1, by - 36, '#f6c6dc', 2, 22);
      for (let i = 0; i < 9; i++) px(l, tx - 2, by - 41 + i * 3, '#6a8a92', 1, 1);
      px(l, tx - 4, by - 13, TEAL[4], 8, 2);
      px(l, tx - 1, by - 12, '#9fc3cb', 2, 4);
      // the flask below on a stirrer: pink at the end point
      stirrer(l, tx, by + 4);
      erlen(l, tx, by + 2, 15, LIQ.pink, 0.42);
      // a pH meter with its probe in a beaker, a beaker of blue stock
      const [mx, my] = P(p, 1.45, 0.42, ZW);
      fillPoly(l, [[mx - 9, my - 2], [mx + 1, my - 7], [mx + 9, my - 3], [mx - 1, my + 2]], '#d8e0e0');
      fillPoly(l, [[mx - 9, my - 2], [mx - 1, my + 2], [mx - 1, my + 6], [mx - 9, my + 2]], '#b8c4c6');
      fillPoly(l, [[mx - 1, my + 2], [mx + 9, my - 3], [mx + 9, my + 1], [mx - 1, my + 6]], '#98a6a8');
      fillPoly(l, [[mx - 6, my - 2], [mx + 1, my - 5.5], [mx + 5, my - 3.5], [mx - 2, my]], '#1e3a2a');
      px(l, mx - 3, my - 4, '#5ae08a', 4, 1);
      beaker(l, mx + 14, my + 4, 4, 10, LIQ.clear, 0.6);
      ln(l, mx + 4, my - 4, mx + 14, my - 10, ANTH[1]);
      px(l, mx + 14, my - 12, ANTH[2], 2, 12);
      beaker(l, P(p, 1.05, 0.6, ZW)[0], P(p, 1.05, 0.6, ZW)[1], 5, 11, LIQ.blue, 0.62);
      // the waste bottle with a funnel
      const [wx, wy] = P(p, 1.66, 0.36, ZW);
      bottle(l, wx, wy, 5, 16, '#eef2f0', '#e0b030', '#f6d860', '#1a1a1e');
      fillPoly(l, [[wx - 4, wy - 22], [wx + 4, wy - 22], [wx + 1, wy - 17], [wx - 1, wy - 17]], '#d8e6ea');
      washBottle(l, P(p, 1.3, 0.76, ZW)[0], P(p, 1.3, 0.76, ZW)[1], RED[3]);
    },
    { outline: 0.5 },
  );
}

function hoodDistillation(p: PropPainter, c: C) {
  layer(
    c,
    (l) => {
      // retort stand at the back
      const [sx, sy] = P(p, 0.3, 0.38, ZW);
      fillPoly(l, [[sx - 9, sy], [sx + 2, sy - 5], [sx + 9, sy - 2], [sx - 2, sy + 3]], ANTH[3]);
      px(l, sx - 1, sy - 48, STEEL[4], 2, 47);
      px(l, sx - 1, sy - 48, STEEL[6], 1, 47);
      // heating mantle with the round-bottom flask of orange reaction mixture
      const [hx, hy] = P(p, 0.55, 0.58, ZW);
      ell(l, hx, hy - 3, 12, 6, '#5a6068');
      px(l, hx - 12, hy - 10, '#6e757e', 24, 7);
      px(l, hx - 12, hy - 10, '#8a929a', 6, 7);
      ell(l, hx, hy - 10, 12, 5, '#3a3e44');
      px(l, hx + 6, hy - 6, '#d84a30', 3, 2);
      rbFlask(l, hx, hy - 9, 8, LIQ.orange, 5);
      // the distillation head, a thermometer, and the condenser running down to the right
      const [ax, ay] = [hx, hy - 34];
      px(l, ax - 2, ay - 6, '#9fc3cb', 4, 10);
      px(l, ax - 1, ay - 5, '#eaf6f8', 2, 8);
      px(l, ax, ay - 18, '#c8d8dc', 1, 13);
      px(l, ax, ay - 6, '#d23a30', 1, 2);
      const [ex, ey] = P(p, 1.26, 0.58, ZW + 4.6);
      // outer water jacket, inner tube
      ln(l, ax + 2, ay - 2, ex, ey, '#9fc3cb', 5);
      ln(l, ax + 2, ay - 1, ex, ey + 1, '#dcf0f4', 3);
      ln(l, ax + 2, ay, ex, ey + 2, '#f6fcfd', 1);
      // clamps from the stand to the neck and to the condenser
      px(l, sx, ay + 6, ANTH[2], hx - sx, 2);
      px(l, sx, ay - 10, ANTH[2], Math.round((ax + ex) / 2) - sx, 2);
      // water hoses (blue in, clear out) looping down to the work surface
      const [jx, jy] = [Math.round(ax + (ex - ax) * 0.85), Math.round(ay + (ey - ay) * 0.85)];
      for (let i = 0; i <= 10; i++) px(l, jx + i * 0.6, jy + 2 + i * 1.9 + Math.sin(i * 0.5) * 2, '#3a6ac8', 2, 2);
      const [kx, ky] = [Math.round(ax + (ex - ax) * 0.18), Math.round(ay + (ey - ay) * 0.18)];
      for (let i = 0; i <= 10; i++) px(l, kx + 2 - i * 0.4, ky + 3 + i * 2.6, '#cfdfe4', 2, 2);
      // the receiving flask under the condenser's tip
      erlen(l, ex + 3, P(p, 1.32, 0.6, ZW)[1], 13, '#e8f2c8', 0.28);
      // solvent bottle and a beaker of ice
      bottle(l, P(p, 1.62, 0.36, ZW)[0], P(p, 1.62, 0.36, ZW)[1], 5, 17, '#7a3e12', '#2a2a30', '#f4f1e6', YEL[3]);
      const [ix, iy] = P(p, 1.6, 0.68, ZW);
      beaker(l, ix, iy, 5, 9, '#dceef6', 0.7);
      for (let i = 0; i < 4; i++) px(l, ix - 4 + i * 2, iy - 7 + (i % 2), '#ffffff', 2, 2);
    },
    { outline: 0.5 },
  );
}

const fumehood: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = 0.9;
    const B0 = 0.08;
    const IB = 0.32;
    const A0 = 0.16;
    const A1 = W - 0.16;
    const titr = k.seed % 2 === 1;
    footShadow(p, 0.05, 0.1, W - 0.05, D, 18, 0.26);
    // the exhaust duct rises behind from the hood's roof to the ceiling (cut at the wall's height)
    // plinth and base cabinets
    lbox(p, 0.1, B0 + 0.04, W - 0.2, D - B0 - 0.1, 0, 0.9, mono(anth, ANTH[0]));
    lbox(p, 0.04, B0, W - 0.08, D - B0, 0.9, ZW - 1.3, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const F = front(p, D);
    const mid = W / 2;
    for (const [u0, u1] of [[0.06, mid - 0.02], [mid + 0.02, W - 0.06]] as const) {
      pq(p, F, u0, u1, 1.0, 7.9, LW[F.light ? 2 : 1]);
      pq(p, F, u0 + 0.03, u1 - 0.03, 1.15, 7.75, LW[F.light ? 4 : 2]);
      pq(p, F, (u0 + u1) / 2 - 0.006, (u0 + u1) / 2 + 0.006, 1.15, 7.75, LW[1]);
      handle(p, F, (u0 + u1) / 2 - 0.2, (u0 + u1) / 2 - 0.04, 6.9);
      handle(p, F, (u0 + u1) / 2 + 0.04, (u0 + u1) / 2 + 0.2, 6.9);
    }
    // the left cupboard is vented acid storage, the right one solvents
    for (let i = 0; i < 4; i++) pq(p, F, 0.2, 0.56, 1.5 + i * 0.5, 1.7 + i * 0.5, LW[1]);
    pq(p, F, 0.58, 0.92, 3.9, 5.8, BLU[3]);
    planeText(p, F, 0.58, 0.92, 3.9, 5.8, 'ACID', '#f4f6f8');
    pq(p, F, mid + 0.12, mid + 0.54, 3.9, 5.8, YEL[4]);
    planeText(p, F, mid + 0.12, mid + 0.54, 3.9, 5.8, 'FLAM', '#2a2a2e');
    // interior: the bright slotted baffle, the left cheek, the resin work surface
    pt(p, front(p, IB), A0, A1, ZW, ZO, baffle, 1);
    lbox(p, 0.04, B0, A0 - 0.04, D - B0, ZW - 0.4, ZT - ZW + 0.4, { front: lwCoat, side: (light) => (_u, v, x, y) => at(LW, (light ? 3 : 2.2) + (v > (ZO - ZW) * 4 ? 0 : -0.4) + (hash(x, y, 9) < 0.02 ? -1 : 0)), top: lwCoat, edge: LW[0] });
    lbox(p, A0, IB, A1 - A0, D - IB, ZW - 0.5, 0.5, { front: steel, side: steel, top: steelMat(STEEL, 0.5), edge: STEEL[1] });
    // a raised marine edge round the stainless work surface
    pq(p, front(p, D - 0.02), A0, A1, ZW, ZW + 0.25, STEEL[5]);
    if (titr) hoodTitration(p, p.c);
    else hoodDistillation(p, p.c);
    // the right cheek, the fascia with its airflow monitor, the airfoil sill
    lbox(p, A1, B0, W - 0.04 - A1, D - B0, ZW - 0.4, ZT - ZW + 0.4, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    lbox(p, A0, B0, A1 - A0, D - B0, ZO, ZT - ZO, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    pq(p, F, A0, A1, ZO, ZO + 0.35, TEAL[F.light ? 4 : 3]);
    pq(p, F, 0.3, 0.92, ZO + 0.9, ZO + 2.3, '#f8faf8');
    planeText(p, F, 0.3, 0.92, ZO + 0.9, ZO + 2.3, titr ? 'HOOD 1' : 'HOOD 2', '#2a3a3a');
    pq(p, F, W - 0.66, W - 0.28, ZO + 0.8, ZO + 2.4, ANTH[1]);
    pq(p, F, W - 0.62, W - 0.42, ZO + 1.1, ZO + 2.1, '#0e2418');
    lbox(p, A0 - 0.02, D - 0.03, A1 - A0 + 0.04, 0.09, ZW - 0.55, 0.65, mono(steel, STEEL[1]));
    // the sash: a glass panel raised to the safe height, a stainless frame and handle
    const SF = front(p, D + 0.012);
    p.c.globalAlpha = 0.22;
    pq(p, SF, A0 + 0.02, A1 - 0.02, ZS, ZO, '#bfe2ea');
    p.c.globalAlpha = 0.45;
    pt(p, SF, A0 + 0.02, A1 - 0.02, ZS, ZO, (u: number, v: number) => ((u * 0.6 + v) % 90 < 3 ? '#ffffff' : null), SF.light);
    p.c.globalAlpha = 1;
    // the light inside the hood's roof
    pq(p, front(p, D - 0.04), A0 + 0.04, A1 - 0.04, ZO - 0.5, ZO, '#fff6d8');
    pq(p, SF, A0 + 0.02, A0 + 0.05, ZS, ZO, STEEL[3]);
    pq(p, SF, A1 - 0.05, A1 - 0.02, ZS, ZO, STEEL[2]);
    pq(p, SF, A0 + 0.02, A1 - 0.02, ZS - 0.35, ZS + 0.3, STEEL[2]);
    pq(p, SF, A0 + 0.02, A1 - 0.02, ZS + 0.05, ZS + 0.3, STEEL[5]);
    // a sticker on the sash: "sash at or below this line", a yellow arrow
    const [ax, ay] = SF.F(A0 + 0.06, ZS + 0.9);
    fillPoly(p.c, [[ax, ay - 3], [ax + 5, ay], [ax, ay + 3]], YEL[4]);
    // service fixtures on the right cheek: water, gas, vacuum, a socket
    const S = side(p, W - 0.04);
    for (const [i, col] of [[0, BLU[4]], [1, YEL[4]], [2, '#f4f4f0'], [3, GRN[4]]] as const) {
      const [qx, qy] = S.F(D - 0.12 - i * 0.13, 12.4);
      px(p.c, qx - 2, qy - 2, STEEL[3], 4, 3);
      px(p.c, qx - 2, qy - 4, col, 4, 2);
      px(p.c, qx - 1, qy + 1, STEEL[2], 2, 2);
    }
    pq(p, S, D - 0.4, D - 0.1, 9.6, 10.9, '#f2f2ee');
    pq(p, S, D - 0.36, D - 0.26, 9.9, 10.6, ANTH[2]);
    pq(p, S, D - 0.22, D - 0.12, 9.9, 10.6, ANTH[2]);
    // an inspection sticker
    pq(p, S, 0.3, 0.52, 17, 18.6, '#f6f2d8');
    pq(p, S, 0.3, 0.52, 18.2, 18.6, GRN[4]);
    // exhaust: a stainless duct from the roof to the ceiling line, a damper and its actuator
    const [dx, dy] = P(p, mid + 0.12, 0.42, ZT);
    layer(
      p.c,
      (l) => {
        cyl(l, dx, dy, 12, 64, STEEL, { ribs: [5, 30, 56], top: null });
        // the cut at the ceiling: the duct's wall section and its dark inside
        ell(l, dx, dy - 64, 12, 6, STEEL[5]);
        ell(l, dx, dy - 64, 10, 4.6, '#2a2e34');
        // collar on the roof
        ell(l, dx, dy + 1, 15, 7.5, STEEL[2]);
        cyl(l, dx, dy, 14, 3, STEEL, { top: STEEL[4] });
        cyl(l, dx, dy - 3, 12, 0.1, STEEL, { top: null });
        // damper actuator box with a yellow tag
        px(l, dx + 9, dy - 24, ANTH[2], 7, 8);
        px(l, dx + 9, dy - 24, ANTH[4], 7, 1);
        px(l, dx + 10, dy - 21, YEL[4], 3, 2);
      },
      { outline: 0.55, rect: [dx - 20, dy - 80, dx + 22, dy + 12] },
    );
  },
  anim(p, k) {
    const W = k.w;
    const u = p.k / 4;
    const c = p.c;
    // the airflow monitor: a green bar and a blinking "safe" lamp
    const F = front(p, 0.9);
    const [mx, my] = F.F(W - 0.6, ZO + 1.6);
    const n = 3 + Math.round((Math.sin(k.t * 0.9 + k.seed) + 1) * 1.5);
    for (let i = 0; i < n; i++) px(c, mx + i * 2 * u, my + i * u, '#5ae08a', Math.max(1, u), Math.max(1, u));
    const [lx, ly] = F.F(W - 0.36, ZO + 1.5);
    px(c, lx, ly, Math.sin(k.t * 3 + k.seed) > -0.6 ? '#7af0a0' : '#2a6a40', Math.max(1, 2 * u), Math.max(1, 2 * u));
    if (k.seed % 2 === 1) {
      // titration: a drop forms and falls from the burette tip; the stir bar turns
      const [bx, by] = P(p, 0.5, 0.48, ZW);
      const tx = bx + 12 * u;
      const tt = (k.t * 0.8 + k.seed * 0.3) % 1;
      if (tt < 0.7) px(c, tx - u, by - 8 * u + tt * 5 * u, '#f6c6dc', Math.max(1, u), Math.max(1, u));
      const sp = Math.floor(k.t * 6) % 2;
      px(c, tx - 2 * u + sp * u, by + 1 * u, '#f8f8f8', Math.max(1, 2 * u), Math.max(1, u));
    } else {
      // distillation: bubbles in the boiling flask, a drop from the condenser
      const [hx, hy] = P(p, 0.55, 0.58, ZW);
      for (let i = 0; i < 3; i++) {
        const t = (k.t * 1.3 + i / 3) % 1;
        px(c, hx + (i - 1) * 3 * u, hy - 12 * u - t * 6 * u, '#ffd8a0', Math.max(1, u), Math.max(1, u));
      }
      const [ex, ey] = P(p, 1.26, 0.58, ZW + 4.6);
      const t2 = (k.t * 0.7) % 1;
      if (t2 < 0.5) px(c, ex, ey + 3 * u + t2 * 6 * u, '#e8f8d0', Math.max(1, u), Math.max(1, u));
    }
  },
};

// ── the lab bench (an island with a service spine and reagent shelves) ──
const ZB = 9.2; // worktop surface

/** Things on a shelf row: bottles, boxes, a binder, from a seed. */
function shelfRow(l: C, p: PropPainter, a0: number, a1: number, b: number, z: number, seed: number) {
  const Rn = rng(seed);
  let a = a0;
  while (a < a1 - 0.08) {
    const r = Rn();
    const [x, y] = P(p, a, b, z);
    if (r < 0.14 && a < a1 - 0.3) {
      // a box of gloves or filters
      const col = [BLU[4], '#f2f2ec', '#e8b0d0', GRN[4]][Math.floor(Rn() * 4)];
      fillPoly(l, [[x, y], [x + 14, y - 7], [x + 14, y - 15], [x, y - 8]], col);
      fillPoly(l, [[x, y - 8], [x + 14, y - 15], [x + 10, y - 17], [x - 4, y - 10]], lighten(col, 0.25));
      fillPoly(l, [[x - 4, y - 2], [x, y], [x, y - 8], [x - 4, y - 10]], darken(col, 0.15));
      px(l, x + 3, y - 8, '#ffffff', 5, 2);
      a += 0.26;
    } else if (r < 0.24) {
      // a white plastic jar with a coloured lid
      const cap = [RED[3], BLU[3], '#2a2a30', YEL[4]][Math.floor(Rn() * 4)];
      bottle(l, x + 3, y, 4, 9, '#eef2f0', cap, '#f4f1e6', cap);
      a += 0.15;
    } else {
      // reagent bottles: amber glass or clear glass with a coloured liquid
      const amber = Rn() < 0.55;
      const h = 9 + Math.floor(Rn() * 7);
      const w = h > 13 ? 4 : 3;
      const body = amber ? ['#6e3810', '#86460f', '#5e3012'][Math.floor(Rn() * 3)] : LIQS[Math.floor(Rn() * LIQS.length)];
      bottle(l, x + w, y, w, h, amber ? body : mix(body, '#e8f4f6', 0.35), ['#2a2a30', RED[3], BLU[3], '#f2f2ec', YEL[4]][Math.floor(Rn() * 5)], '#f6f3e8', Rn() < 0.5 ? [RED[3], YEL[4], BLU[3], GRN[3]][Math.floor(Rn() * 4)] : undefined);
      a += w * 0.024 + 0.05 + Rn() * 0.03;
    }
  }
}

/** A lab microscope (white stand, black optics, a lit stage) with a slide on it. */
function microscope(l: C, x: number, y: number) {
  const W1 = '#f4f7f7';
  const W2 = '#d6dfe0';
  const W3 = '#a8b4b6';
  // the heavy base, an iso slab with the illuminator lens glowing on top
  fillPoly(l, [[x - 16, y - 1], [x, y - 9], [x + 14, y - 2], [x - 2, y + 6]], W1);
  fillPoly(l, [[x - 16, y - 1], [x - 2, y + 6], [x - 2, y + 10], [x - 16, y + 3]], W2);
  fillPoly(l, [[x - 2, y + 6], [x + 14, y - 2], [x + 14, y + 2], [x - 2, y + 10]], W3);
  ell(l, x - 2, y - 1, 3, 1.6, '#fff4b8');
  // the curved arm rising from the back of the base and leaning over the stage
  for (let j = 0; j < 40; j++) {
    const lean = j > 22 ? Math.round((j - 22) * 0.45) : 0;
    px(l, x + 4 - lean, y - 5 - j, W1, 3, 1);
    px(l, x + 7 - lean, y - 5 - j, W2, 3, 1);
    px(l, x + 10 - lean, y - 5 - j, W3, 1, 1);
  }
  // coarse and fine focus knobs on the arm
  ell(l, x + 11, y - 14, 3.5, 3.5, '#2a2e34');
  ell(l, x + 11, y - 14, 1.5, 1.5, '#9aa2aa');
  ell(l, x + 12, y - 19, 2, 2, '#3a3e44');
  // the stage: a black square plate with clips and a slide with a stained sample
  fillPoly(l, [[x - 13, y - 17], [x - 1, y - 23], [x + 9, y - 18], [x - 3, y - 12]], '#26292e');
  fillPoly(l, [[x - 13, y - 17], [x - 3, y - 12], [x - 3, y - 10], [x - 13, y - 15]], '#16181c');
  fillPoly(l, [[x - 8, y - 17], [x - 1, y - 20.5], [x + 4, y - 18], [x - 3, y - 14.5]], '#e2f2f6');
  px(l, x - 3, y - 18, '#d0408a', 3, 1);
  px(l, x - 2, y - 17, '#9a3aa8', 2, 1);
  px(l, x - 9, y - 18, '#9aa2aa', 4, 1);
  // the nosepiece with three objectives (coloured rings)
  px(l, x - 4, y - 33, '#3a3e44', 9, 4);
  px(l, x - 4, y - 33, '#5a6068', 9, 1);
  px(l, x - 3, y - 29, '#c8ced4', 2, 6);
  px(l, x - 3, y - 26, '#d84a3a', 2, 1);
  px(l, x, y - 29, '#c8ced4', 2, 5);
  px(l, x, y - 27, '#e8c040', 2, 1);
  px(l, x + 3, y - 29, '#c8ced4', 2, 4);
  px(l, x + 3, y - 28, '#3a8ad8', 2, 1);
  // the binocular head and two eyepiece tubes angled toward the user
  fillPoly(l, [[x - 6, y - 34], [x + 8, y - 40], [x + 8, y - 47], [x - 6, y - 41]], W1);
  fillPoly(l, [[x - 6, y - 41], [x + 8, y - 47], [x + 4, y - 49], [x - 10, y - 43]], W2);
  for (const [dx, dy] of [[-9, 0], [-3, -3]] as const) {
    ln(l, x + dx + 3, y - 44 + dy, x + dx - 3, y - 55 + dy, '#1e2024', 4);
    ln(l, x + dx + 2, y - 44 + dy, x + dx - 4, y - 55 + dy, '#3a3e44', 1);
    px(l, x + dx - 6, y - 58 + dy, '#101114', 5, 3);
  }
}

const labbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? '';
    const seed = k.seed;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.92, 10, 0.26);
    // plinth, base cabinets, the resin worktop
    lbox(p, 0.1, 0.22, W - 0.2, 0.58, 0, 0.8, mono(anth, ANTH[0]));
    lbox(p, 0.05, 0.16, W - 0.1, 0.7, 0.8, ZB - 1.6, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const F = front(p, 0.86);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const u0 = 0.07 + ((W - 0.14) * i) / n;
      const u1 = 0.07 + ((W - 0.14) * (i + 1)) / n - 0.03;
      pq(p, F, u0, u1, 1.0, ZB - 1.0, LW[F.light ? 2 : 1]);
      const kind = (i + seed) % 3;
      if (kind === 0) {
        // a drawer stack
        for (let j = 0; j < 4; j++) {
          const z0 = 1.1 + j * 1.75;
          pq(p, F, u0 + 0.025, u1 - 0.025, z0, z0 + 1.6, LW[F.light ? 4 : 2]);
          handle(p, F, (u0 + u1) / 2 - 0.15, (u0 + u1) / 2 + 0.15, z0 + 1.2, TEAL);
        }
      } else if (kind === 1) {
        // a double cupboard
        pq(p, F, u0 + 0.025, (u0 + u1) / 2 - 0.008, 1.1, ZB - 1.1, LW[F.light ? 4 : 2]);
        pq(p, F, (u0 + u1) / 2 + 0.008, u1 - 0.025, 1.1, ZB - 1.1, LW[F.light ? 4 : 2]);
        handle(p, F, (u0 + u1) / 2 - 0.12, (u0 + u1) / 2 - 0.04, ZB - 2.2, TEAL);
        handle(p, F, (u0 + u1) / 2 + 0.04, (u0 + u1) / 2 + 0.12, ZB - 2.2, TEAL);
      } else {
        // a drawer over a cupboard
        pq(p, F, u0 + 0.025, u1 - 0.025, ZB - 2.7, ZB - 1.1, LW[F.light ? 4 : 2]);
        pq(p, F, u0 + 0.025, u1 - 0.025, 1.1, ZB - 2.9, LW[F.light ? 4 : 2]);
        handle(p, F, (u0 + u1) / 2 - 0.15, (u0 + u1) / 2 + 0.15, ZB - 1.8, TEAL);
        handle(p, F, u1 - 0.18, u1 - 0.07, ZB - 3.6, TEAL);
      }
    }
    // a hazard sticker and an asset label here and there
    const [gx, gy] = F.F(0.3 + (seed % 3) * 0.9, 6.2);
    if (seed % 2) ghs(p.c, gx, gy, 4, seed);
    lbox(p, 0, 0.1, W, 0.84, ZB - 0.8, 0.8, { front: resinMat, side: resinMat, top: resinMat, edge: RESIN[0] });
    pq(p, front(p, 0.94), 0, W, ZB - 0.8, ZB - 0.62, RESIN[4]);
    // the service spine: sockets and gas turrets; two steel uprights and reagent shelves
    lbox(p, 0.1, 0.12, W - 0.2, 0.16, ZB, 2.4, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const SP = front(p, 0.28);
    for (let a = 0.35; a < W - 0.2; a += 0.7) {
      pq(p, SP, a - 0.1, a + 0.1, ZB + 0.6, ZB + 1.8, '#f4f6f4');
      pq(p, SP, a - 0.07, a - 0.02, ZB + 1, ZB + 1.4, ANTH[2]);
      pq(p, SP, a + 0.02, a + 0.07, ZB + 1, ZB + 1.4, ANTH[2]);
      pq(p, SP, a + 0.16, a + 0.2, ZB + 0.8, ZB + 1.6, RED[4]);
    }
    for (const [a, col] of [[0.62, BLU[4]], [1.5, YEL[4]], [2.38, GRN[4]]] as const) {
      if (a > W - 0.2) continue;
      const [tx, ty] = P(p, a, 0.3, ZB + 2.4);
      px(p.c, tx - 1, ty - 7, STEEL[3], 3, 7);
      px(p.c, tx - 1, ty - 7, STEEL[5], 1, 7);
      px(p.c, tx + 1, ty - 7, STEEL[3], 5, 2);
      px(p.c, tx - 3, ty - 10, col, 6, 3);
      px(p.c, tx - 3, ty - 10, lighten(col, 0.3), 6, 1);
    }
    for (const a of [0.12, W / 2 - 0.03, W - 0.18]) lbox(p, a, 0.12, 0.06, 0.06, ZB + 2.4, 9.6, mono(steel, STEEL[1]));
    const shelves = [ZB + 5.4, ZB + 10.8];
    shelves.forEach((z, si) => {
      lbox(p, 0.08, 0.1, W - 0.16, 0.3, z, 0.3, { front: steel, side: steel, top: coat(['#8aa4a8', '#a6bec2', '#c0d4d6', '#d6e6e8', '#e6f2f2', '#f4fafa']), edge: STEEL[1] });
      // the lip rail that keeps bottles from sliding off
      pq(p, front(p, 0.4), 0.08, W - 0.16, z + 0.9, z + 1.1, STEEL[4]);
      layer(p.c, (l) => shelfRow(l, p, 0.14, W - 0.14, 0.34, z + 0.3, seed * 17 + si * 5), { outline: 0.5 });
      pq(p, front(p, 0.4), 0.08, W - 0.16, z + 0.9, z + 1.1, STEEL[4]);
    });
    // an LED strip under the lower shelf
    pq(p, front(p, 0.38), 0.12, W - 0.12, shelves[0] - 0.12, shelves[0], '#fff8de');
    // things on the worktop, back to front
    const T = (a: number, b: number) => P(p, a, b, ZB);
    const c = p.c;
    layer(
      c,
      (l) => {
        if (v === 'microscope') {
          const [mx, my] = T(0.78, 0.56);
          microscope(l, mx, my);
          // a monitor showing the camera image (filled live), slide boxes, a centrifuge
          const [sx, sy] = T(1.38, 0.42);
          px(l, sx - 2, sy - 10, ANTH[2], 4, 10);
          fillPoly(l, [[sx - 8, sy + 2], [sx + 4, sy - 4], [sx + 8, sy - 2], [sx - 4, sy + 4]], ANTH[1]);
          fillPoly(l, [[sx - 14, sy - 10], [sx + 14, sy - 24], [sx + 14, sy - 44], [sx - 14, sy - 30]], ANTH[0]);
          fillPoly(l, [[sx - 12, sy - 12], [sx + 12, sy - 24], [sx + 12, sy - 42], [sx - 12, sy - 30]], '#141a24');
          for (let i = 0; i < 3; i++) {
            const [bx, by] = T(1.1 + i * 0.1, 0.78);
            fillPoly(l, [[bx - 6, by], [bx, by - 3], [bx + 6, by], [bx, by + 3]], ['#2a5aa8', '#e8e0d0', '#c8382a'][i]);
          }
          const [cx2, cy2] = T(2.2, 0.5);
          // benchtop centrifuge: a white tub with a grey lid and a display
          ell(l, cx2, cy2 - 2, 14, 7, '#c4ccce');
          px(l, cx2 - 14, cy2 - 12, '#e2e8e8', 28, 10);
          px(l, cx2 - 14, cy2 - 12, '#f4f8f8', 7, 10);
          px(l, cx2 + 8, cy2 - 12, '#b8c2c4', 6, 10);
          ell(l, cx2, cy2 - 12, 14, 7, '#8a949a');
          ell(l, cx2 - 2, cy2 - 13, 9, 4, '#a8b2b6');
          px(l, cx2 - 6, cy2 - 6, '#1e3a2a', 7, 3);
          px(l, cx2 - 5, cy2 - 5, '#5ae08a', 4, 1);
          tubeRack(l, T(2.62, 0.44)[0], T(2.62, 0.44)[1], 5, [LIQ.yellow, LIQ.clear, LIQ.red], seed);
          card(l, T(2.5, 0.8)[0] - 6, T(2.5, 0.8)[1] - 3, 12, 6);
        } else if (seed % 2 === 1) {
          // mixing: a stirrer, a row of flasks, a test-tube rack, wash bottles, the notebook
          const [s0, s1] = T(0.5, 0.55);
          stirrer(l, s0, s1, LIQ.blue);
          const fl = [LIQ.orange, LIQ.green, LIQ.purple];
          fl.forEach((col, i) => {
            const [fx, fy] = T(0.95 + i * 0.17, 0.46 + (i % 2) * 0.14);
            erlen(l, fx, fy, 13 + (i % 2) * 3, col, 0.45 + i * 0.08);
          });
          const [rx, ry] = T(1.72, 0.5);
          tubeRack(l, rx, ry, 6, [LIQ.blue, LIQ.cyan, LIQ.green, LIQ.yellow, LIQ.pink], seed);
          const [w1, w2] = T(2.15, 0.42);
          washBottle(l, w1, w2, BLU[3]);
          washBottle(l, w1 + 8, w2 + 4, RED[3]);
          const [nx, ny] = T(2.55, 0.72);
          fillPoly(l, [[nx - 12, ny], [nx, ny - 6], [nx + 12, ny], [nx, ny + 6]], '#2a3a5a');
          fillPoly(l, [[nx - 10, ny], [nx, ny - 5], [nx + 10, ny], [nx, ny + 5]], '#f6f4ec');
          for (let i = 0; i < 3; i++) ln(l, nx - 6 + i * 2, ny + 1 - i, nx + 2 + i * 2, ny - 3 - i, '#8a90a0');
          ln(l, nx - 2, ny + 4, nx + 8, ny - 1, '#c8382a');
          const [gx2, gy2] = T(2.75, 0.32);
          fillPoly(l, [[gx2 - 9, gy2], [gx2, gy2 - 4.5], [gx2 + 9, gy2], [gx2, gy2 + 4.5]], '#5a8ae8');
          px(l, gx2 - 9, gy2 - 6, '#4a7ad8', 18, 6);
          fillPoly(l, [[gx2 - 9, gy2 - 6], [gx2, gy2 - 10.5], [gx2 + 9, gy2 - 6], [gx2, gy2 - 1.5]], '#7aa8f4');
          ell(l, gx2, gy2 - 6, 4, 2, '#9ad0f8');
        } else {
          // pipetting: a pipette carousel, tip boxes, a 96-well plate, a vortex, a laptop
          const [px0, py0] = T(0.5, 0.45);
          ell(l, px0, py0, 9, 4.5, '#c8d0d2');
          px(l, px0 - 1, py0 - 28, '#d8e0e2', 2, 28);
          for (let i = 0; i < 4; i++) {
            const ox = px0 - 8 + i * 5;
            ln(l, ox, py0 - 26 + (i % 2) * 3, ox + 1, py0 - 6 + (i % 2) * 3, ['#e8eef0', '#f2c84a', '#e86a6a', '#5a8ae8'][i], 2);
            px(l, ox - 1, py0 - 28 + (i % 2) * 3, '#3a3e44', 4, 3);
          }
          for (let i = 0; i < 2; i++) {
            const [tx, ty] = T(0.9 + i * 0.22, 0.52 + i * 0.1);
            fillPoly(l, [[tx - 9, ty], [tx, ty - 4.5], [tx + 9, ty], [tx, ty + 4.5]], i ? '#f2c84a' : '#5a8ae8');
            px(l, tx - 9, ty - 5, i ? '#d8a830' : '#3a6ac8', 18, 5);
            fillPoly(l, [[tx - 9, ty - 5], [tx, ty - 9.5], [tx + 9, ty - 5], [tx, ty - 0.5]], i ? '#f8e08a' : '#8ab0f4');
            for (let q = 0; q < 6; q++) px(l, tx - 5 + q * 2, ty - 6 - (q % 2), '#fbfbf6', 1, 1);
          }
          const [wx, wy] = T(1.42, 0.6);
          fillPoly(l, [[wx - 12, wy], [wx, wy - 6], [wx + 12, wy], [wx, wy + 6]], '#e8eef0');
          for (let q = 0; q < 12; q++) px(l, wx - 9 + (q % 6) * 3, wy - 2 + Math.floor(q / 6) * 2 - (q % 6) * 0.6, LIQS[(q + seed) % 5], 2, 1);
          const [vx, vy] = T(1.86, 0.44);
          px(l, vx - 5, vy - 8, '#e8eef0', 10, 8);
          px(l, vx - 5, vy - 8, '#ffffff', 3, 8);
          ell(l, vx, vy - 9, 4, 2, '#2a2e34');
          tubeRack(l, T(2.12, 0.62)[0], T(2.12, 0.62)[1], 6, [LIQ.yellow, LIQ.pink, LIQ.clear], seed + 3);
          // the laptop, open, facing the worker
          const [lx, ly] = T(2.55, 0.58);
          fillPoly(l, [[lx - 13, ly + 1], [lx + 1, ly - 6], [lx + 13, ly - 1], [lx - 1, ly + 6]], '#9aa2aa');
          fillPoly(l, [[lx - 12, ly + 1], [lx + 1, ly - 5], [lx + 12, ly - 1], [lx - 1, ly + 5]], '#c4cad0');
          fillPoly(l, [[lx + 1, ly - 6], [lx + 13, ly - 1], [lx + 13, ly - 17], [lx + 1, ly - 22]], '#3a3e44');
          fillPoly(l, [[lx + 2, ly - 7], [lx + 12, ly - 3], [lx + 12, ly - 16], [lx + 2, ly - 20]], '#1e2c3a');
        }
      },
      { outline: 0.5 },
    );
    // a stool tucked at the front for the sitting tasks
    const [sx, sy] = P(p, W - 0.55, 1.02, 0);
    layer(c, (l) => {
      for (const dx of [-6, 6]) ln(l, sx, sy - 18, sx + dx, sy, STEEL[2], 2);
      ln(l, sx, sy - 18, sx + 1, sy + 3, STEEL[3], 2);
      ell(l, sx, sy - 7, 6, 2.5, STEEL[4]);
      ell(l, sx, sy - 19, 8, 4, '#20403c');
      ell(l, sx - 1, sy - 20, 7, 3, TEAL[2]);
      ell(l, sx - 3, sy - 21, 3, 1.2, TEAL[4]);
    });
  },
  anim(p, k) {
    if ((k.variant ?? '') !== 'microscope') return;
    // the camera image on the monitor: cells drifting slowly
    const u = p.k / 4;
    const [sx, sy] = P(p, 1.38, 0.42, ZB);
    const c = p.c;
    for (let i = 0; i < 6; i++) {
      const ph = k.t * 0.3 + i * 1.7;
      const cx = sx + (Math.sin(ph) * 7 - 4 + (i % 3) * 5) * u;
      const cy = sy + (-30 + Math.cos(ph * 0.8) * 4 + Math.floor(i / 3) * 7 - (i % 3) * 2) * u;
      px(c, cx, cy, i % 2 ? '#c85ab0' : '#8a5ae0', Math.max(1, 3 * u), Math.max(1, 2 * u));
      px(c, cx + u, cy, '#f0c8f0', Math.max(1, u), Math.max(1, u));
    }
  },
};

// ── the analytical station: an HPLC stack on a mobile bench ─
const analyzer: PropArt = {
  draw(p, k) {
    const ZT2 = 7.4;
    footShadow(p, 0.08, 0.12, 0.92, 0.88, 14, 0.26);
    // castors, legs, a lower shelf with a solvent waste can and a gas regulator
    for (const [a, b] of [[0.12, 0.16], [0.82, 0.16], [0.12, 0.8], [0.82, 0.8]] as const) {
      lbox(p, a, b, 0.05, 0.05, 0.6, ZT2 - 0.6, mono(steel, STEEL[1]));
      const [cx, cy] = P(p, a + 0.025, b + 0.025, 0);
      ell(p.c, cx, cy - 2, 3, 2, ANTH[1]);
    }
    lbox(p, 0.1, 0.14, 0.8, 0.7, 1.4, 0.3, mono(steel, STEEL[1]));
    layer(p.c, (l) => {
      const [wx, wy] = P(p, 0.35, 0.5, 1.7);
      bottle(l, wx, wy, 6, 17, '#eef2ee', '#e0b030', '#f6d860', '#1a1a1e');
      const [gx, gy] = P(p, 0.68, 0.46, 1.7);
      bottle(l, gx, gy, 4, 14, '#7a3e12', BLU[3], '#f4f1e6', BLU[3]);
    }, { outline: 0.5 });
    lbox(p, 0.06, 0.1, 0.88, 0.78, ZT2, 0.6, { front: lwCoat, side: lwCoat, top: coat(['#c4ccd0', '#d6dde0', '#e4eaec', '#eef2f4', '#f6f9fa', '#ffffff']), edge: LW[0] });
    // the HPLC modules stacked on the left: pump, degasser, autosampler, column oven, detector
    const mods = [
      { h: 2.6, name: 'PUMP', led: '#5ae08a' },
      { h: 3.2, name: 'ALS', led: '#5ae08a', win: true },
      { h: 2.4, name: 'TCC', led: '#f2b84b' },
      { h: 2.6, name: 'DAD', led: '#5ae08a' },
    ];
    let z = ZT2 + 0.6;
    const A0 = 0.1;
    const A1 = 0.58;
    for (const m of mods) {
      const shell = coat(['#8e989c', '#aab4b8', '#c4ccd0', '#d8dfe2', '#e8eef0', '#f6f9fa']);
      lbox(p, A0, 0.18, A1 - A0, 0.6, z, m.h - 0.08, { front: shell, side: shell, top: shell, edge: '#6a7478' });
      const F = front(p, 0.78);
      pq(p, F, A0 + 0.02, A1 - 0.02, z + 0.06, z + 0.3, TEAL[F.light ? 4 : 3]);
      if (m.win) {
        pq(p, F, A0 + 0.06, A1 - 0.14, z + 0.5, z + m.h - 0.5, '#2a3a44');
        pt(p, F, A0 + 0.07, A1 - 0.15, z + 0.6, z + m.h - 0.6, glassMat(), F.light);
        // the vial tray inside
        for (let i = 0; i < 6; i++) pq(p, F, A0 + 0.1 + i * 0.045, A0 + 0.13 + i * 0.045, z + 0.7, z + 1.3, i % 2 ? '#e8eef0' : '#c8d4d8');
      } else {
        pq(p, F, A0 + 0.06, A0 + 0.26, z + m.h * 0.45, z + m.h * 0.8, '#1a2e24');
        planeText(p, F, A0 + 0.27, A1 - 0.03, z + m.h * 0.4, z + m.h * 0.85, m.name, '#5a6468');
      }
      const [lx, ly] = F.F(A1 - 0.06, z + m.h - 0.6);
      px(p.c, lx - 1, ly - 1, m.led, 2, 2);
      z += m.h;
    }
    // solvent tray on top: four bottles, capped, with their lines going down
    lbox(p, A0 + 0.02, 0.2, A1 - A0 - 0.04, 0.56, z, 0.5, mono(coat(LW), LW[0]));
    layer(p.c, (l) => {
      for (let i = 0; i < 4; i++) {
        const [bx, by] = P(p, A0 + 0.1 + (i % 2) * 0.22, 0.32 + Math.floor(i / 2) * 0.24, z + 0.5);
        bottle(l, bx, by, 4, 14, i === 3 ? '#e8f2c4' : '#e6f2f4', BLU[3], '#f4f1e6', BLU[3]);
        ln(l, bx, by - 15, bx + 4 + i, by - 19, '#c8d4d8');
      }
    }, { outline: 0.5 });
    // the monitor on the right showing the chromatogram (live), a keyboard
    const [mx, my] = P(p, 0.76, 0.5, ZT2 + 0.6);
    layer(p.c, (l) => {
      px(l, mx - 2, my - 10, ANTH[2], 4, 10);
      fillPoly(l, [[mx - 8, my + 2], [mx + 4, my - 4], [mx + 8, my - 2], [mx - 4, my + 4]], ANTH[1]);
      fillPoly(l, [[mx - 14, my - 8], [mx + 14, my - 22], [mx + 14, my - 44], [mx - 14, my - 30]], ANTH[0]);
      fillPoly(l, [[mx - 12, my - 10], [mx + 12, my - 22], [mx + 12, my - 42], [mx - 12, my - 30]], '#0e1820');
      const [kx, ky] = P(p, 0.7, 0.8, ZT2 + 0.6);
      fillPoly(l, [[kx - 12, ky + 2], [kx + 4, ky - 6], [kx + 12, ky - 2], [kx - 4, ky + 6]], '#3a3e44');
      fillPoly(l, [[kx - 10, ky + 2], [kx + 4, ky - 5], [kx + 10, ky - 2], [kx - 4, ky + 5]], '#5a6068');
    }, { outline: 0.5 });
    // an asset tag on the bench front
    const F = front(p, 0.88);
    pq(p, F, 0.62, 0.86, ZT2 + 0.05, ZT2 + 0.55, '#f4f4ec');
    void k;
  },
  anim(p, k) {
    // the chromatogram: a baseline with peaks, drawn up to a moving cursor
    const u = p.k / 4;
    const [mx, my] = P(p, 0.76, 0.5, 7.4 + 0.6);
    const c = p.c;
    const prog = (k.t * 0.25) % 1;
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 22; i++) {
      const f = i / 22;
      if (f > prog) break;
      const peak = Math.exp(-(((f - 0.3) / 0.03) ** 2)) * 9 + Math.exp(-(((f - 0.55) / 0.025) ** 2)) * 14 + Math.exp(-(((f - 0.78) / 0.04) ** 2)) * 6;
      const x = mx + (-11 + f * 22) * u;
      const y = my + (-13 - f * 11 - peak) * u;
      if (prev) ln(c, prev[0], prev[1], x, y, '#5ae0c8');
      prev = [x, y];
    }
    if (prev) px(c, prev[0], prev[1] - 2 * u, '#f2f2a0', Math.max(1, u), Math.max(1, 4 * u));
  },
};

// ── the reagent store: two tall ventilated units, glass doors over acid / base cupboards ──
/** One tall unit from a0 to a1: plinth, cupboard, glazed case with shelves of bottles, its end panel and cornice. */
function reagentUnit(p: PropPainter, a0: number, a1: number, D: number, B0: number, H: number, lab: string, col: string, seed: number, last: boolean) {
  const W = a1 - a0;
  lbox(p, a0 + 0.04, B0 + 0.04, W - 0.08, D - B0 - 0.08, 0, 0.7, mono(anth, ANTH[0]));
  lbox(p, a0, B0, W, D - B0, 0.7, 5.6, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
  const F = front(p, D);
  pq(p, F, a0 + 0.03, a1 - 0.03, 0.9, 6.1, LW[F.light ? 2 : 1]);
  pq(p, F, a0 + 0.05, a1 - 0.05, 1.05, 5.95, LW[F.light ? 4 : 2]);
  for (let i = 0; i < 3; i++) pq(p, F, a0 + 0.12, a0 + 0.4, 1.5 + i * 0.42, 1.7 + i * 0.42, LW[1]);
  pq(p, F, a0 + 0.12, a1 - 0.12, 3.6, 5.5, col);
  planeText(p, F, a0 + 0.12, a1 - 0.12, 3.6, 5.5, lab, '#f4f6f8');
  handle(p, F, a1 - 0.2, a1 - 0.1, 3.0, STEEL);
  // the glazed case: back panel, three shelves of bottles, the door
  const Z0 = 6.3;
  const back0 = p.rot === 0 ? 2.4 : 1.6;
  pt(p, front(p, B0 + 0.06), a0 + 0.02, a1 - 0.02, Z0, H, (_u: number, v: number, x: number, y: number) => at(LW, back0 + (v > 40 ? 0.6 : 0) + (hash(x, y, 3) < 0.02 ? -1 : 0)), 1);
  const Rn = rng(seed);
  for (const z of [Z0 + 0.2, Z0 + 5, Z0 + 9.8]) {
    lbox(p, a0 + 0.05, B0 + 0.06, W - 0.1, D - B0 - 0.12, z - 0.25, 0.25, mono(coat(['#8aa0a4', '#a2b8bc', '#bcced0', '#d2e0e2', '#e2ecee', '#f2f8f8']), STEEL[1]));
    layer(p.c, (l) => {
      const items: [number, number][] = [];
      for (let a = a0 + 0.13; a < a1 - 0.1; a += 0.1 + Rn() * 0.05) items.push([a, 0.4 + Rn() * 0.2]);
      items.sort((m, n) => (p.rot === 0 ? m[0] + m[1] - (n[0] + n[1]) : n[0] - m[0] + (m[1] - n[1])));
      for (const [a, b] of items) {
        const [x, y] = P(p, a, b, z);
        const r = Rn();
        if (r < 0.5) bottle(l, x, y, 3, 10 + Math.floor(Rn() * 6), ['#6e3810', '#86460f', '#5e3012'][Math.floor(Rn() * 3)], ['#2a2a30', RED[3], BLU[3]][Math.floor(Rn() * 3)], '#f6f3e8', Rn() < 0.6 ? [RED[3], YEL[4], BLU[3]][Math.floor(Rn() * 3)] : undefined);
        else if (r < 0.75) bottle(l, x, y, 3, 9 + Math.floor(Rn() * 4), '#eef2f0', [RED[3], BLU[3], YEL[4], GRN[3]][Math.floor(Rn() * 4)], '#f4f1e6');
        else bottle(l, x, y, 3, 11, mix(LIQS[Math.floor(Rn() * LIQS.length)], '#e8f4f6', 0.4), '#2a2a30', '#f6f3e8');
      }
    }, { outline: 0.45 });
  }
  const GF = front(p, D);
  p.c.globalAlpha = 0.22;
  pq(p, GF, a0 + 0.04, a1 - 0.04, Z0, H - 0.9, '#cfe8ee');
  p.c.globalAlpha = 0.5;
  pt(p, GF, a0 + 0.04, a1 - 0.04, Z0, H - 0.9, (u: number, v: number) => ((u * 0.8 + v) % 70 < 5 ? '#ffffff' : null), GF.light);
  p.c.globalAlpha = 1;
  pq(p, GF, a0 + 0.02, a0 + 0.07, Z0, H - 0.9, STEEL[GF.light ? 4 : 2]);
  pq(p, GF, a1 - 0.07, a1 - 0.02, Z0, H - 0.9, STEEL[GF.light ? 3 : 1]);
  pq(p, GF, a0 + 0.02, a1 - 0.02, Z0, Z0 + 0.35, STEEL[GF.light ? 3 : 2]);
  handle(p, GF, a1 - 0.18, a1 - 0.1, 12.6);
  const [gx, gy] = GF.F(a0 + W * 0.42, H - 4.2);
  ghs(p.c, gx, gy, 5, seed);
  // the cornice with a vent grille, the unit's visible end panel, its silhouette
  pq(p, GF, a0, a1, H - 0.9, H, LW[GF.light ? 4 : 2]);
  for (let i = 0; i < 4; i++) pq(p, GF, a0 + 0.2 + i * 0.12, a0 + 0.28 + i * 0.12, H - 0.7, H - 0.2, LW[1]);
  const aV = p.rot === 0 ? a1 : a0;
  const SV = side(p, aV);
  if (last) {
    pt(p, SV, B0, D, Z0, H, lwCoat, SV.light);
    pq(p, SV, D - 0.05, D, Z0, H, LW[SV.light ? 5 : 3]);
  }
  poly3(p, [[a0, B0, H], [a1, B0, H], [a1, D, H], [a0, D, H]], lwCoat, 2);
  lbox(p, a0, B0, W, D - B0, 0.7, H - 0.7, { edge: LW[0] });
}

const reagents: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = 0.82;
    const B0 = 0.14;
    const H = 22.6;
    footShadow(p, 0.05, 0.1, W - 0.05, D, 18, 0.26);
    const units: [number, number, string, string][] = [
      [0.04, W / 2 - 0.03, 'ACIDS', BLU[3]],
      [W / 2 + 0.03, W - 0.04, 'BASES', '#8a4ac8'],
    ];
    // back to front: for rot 1 the far unit is the one at larger a
    const order = p.rot === 0 ? units : [...units].reverse();
    order.forEach(([a0, a1, lab, col], i) => reagentUnit(p, a0, a1, D, B0, H, lab, col, k.seed * 7 + i * 3, i === order.length - 1));
    // vented exhaust ducts from both units up to the ceiling line
    for (const a of [W * 0.27, W * 0.73]) {
      const [dx, dy] = P(p, a, 0.42, H);
      layer(p.c, (l) => {
        px(l, dx - 8, dy - 5, ANTH[2], 16, 5);
        px(l, dx - 8, dy - 5, ANTH[4], 16, 1);
        cyl(l, dx, dy - 4, 6, 66, STEEL, { ribs: [18, 44], top: null });
        ell(l, dx, dy - 70, 6, 3, STEEL[5]);
        ell(l, dx, dy - 70, 4, 2, '#2a2e34');
      }, { outline: 0.55, rect: [dx - 14, dy - 80, dx + 14, dy + 4] });
    }
    // the inventory clipboard on the visible end panel
    const S = side(p, p.rot === 0 ? W - 0.04 : 0.04);
    pq(p, S, 0.3, 0.62, 10, 14.4, '#8a6a46');
    pq(p, S, 0.33, 0.59, 10.2, 14.0, '#fbfaf2');
    for (let i = 0; i < 6; i++) pq(p, S, 0.36, 0.5 + (i % 2) * 0.06, 10.6 + i * 0.55, 10.8 + i * 0.55, '#8a90a0');
    pq(p, S, 0.41, 0.51, 14.0, 14.5, STEEL[4]);
  },
};

export const CHEMLAB_ROOM: Record<string, PropArt> = { fumehood, labbench, analyzer, reagents };
export { handle };

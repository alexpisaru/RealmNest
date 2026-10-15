// Robotics — the hangar's front walls, cut low for the view: slate box-profile
// cladding on a cast plinth, the sandwich panel and the H of each column in
// section on the cut, downpipes, a tap and a hose, weeds at the foot. The
// 'door' section is where the big sliding doors stand open: the leaves are
// telescoped onto their three tracks at both ends, the floor rail runs across
// the threshold and the doorway is painted with hazard stripes.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, ell, fillPoly, foliage, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, pq, poly3 } from '../../plane4';
import { lbox, mono } from '../util';
import { boxProfile, castConcrete, CONC, enamel, GALV, HAZK, RED, SLATE, STEEL, YEL } from './rkit';

const Z = 8;
const T = 0.3;
const INSUL: Ramp = ['#a88a3e', '#c4a452', '#d8bc6a', '#e6d08a'];
const LINER: Ramp = ['#6c706e', '#838784', '#9a9e9a', '#afb2ad', '#c1c3be', '#d0d2cc', '#dee0da'];
const DRYW: Ramp = ['#4c4a26', '#625e30', '#7a743c', '#928a4a', '#a8a05a', '#bcb46e', '#d0c886'];

/** The exterior: box-profile sheet over a cast plinth with a drip flashing. */
const cladding: Mat = (light, w, h) => {
  const sheet = boxProfile(SLATE, { pitch: 14, rust: 0.5, grime: 0, seed: 7 })(light, w, h);
  const plinth = castConcrete(CONC, 70)(light, w, h);
  return (u, v, x, y) => {
    if (v < 8.8) return plinth(u, v, x, y);
    if (v < 10) return at(GALV, light ? 5 : 3);
    if (v < 10.8) return 'rgba(30,22,34,0.55)';
    return sheet(u, v, x, y);
  };
};

/** The cut section on top: liner, insulation, outer sheet; an H where a column runs through. */
function cutTop(cols: number[]): FaceTex {
  return (u, v) => {
    const a = u / 71.55;
    for (const c of cols)
      if (Math.abs(a - c) < 0.13) {
        if (v < 2.5 || v > 15.5) return SLATE[2];
        return Math.abs(a - c) < 0.025 ? SLATE[2] : SLATE[0];
      }
    if (v < 1.6) return LINER[5];
    if (v < 2.6) return LINER[3];
    if (v > 18.5) return Math.floor(u / 3) & 1 ? SLATE[3] : SLATE[2];
    if (v > 17.5) return SLATE[1];
    return INSUL[(Math.floor(u * 0.7 + v * 1.3) * 7) % 11 < 2 ? 0 : Math.floor(u + v) % 5 === 0 ? 3 : 2];
  };
}

/** The end of a cut wall: plinth, sandwich layers. */
const endCap: Mat = (light, w) => (u, v) => {
  if (v < 8.8) return at(CONC, light ? 4 : 2);
  if (u < 2) return LINER[light ? 5 : 3];
  if (u > w - 3) return at(SLATE, light ? 3 : 2);
  return INSUL[light ? 2 : 1];
};

/** Dry grass, a dandelion or two and a thistle against the foot of the wall. */
function weeds(p: PropPainter, a0: number, a1: number, seed: number) {
  const R0 = rng(seed);
  layer(p.c, (l) => {
    for (let a = a0 + 0.2; a < a1 - 0.2; a += 0.5 + R0() * 1.4) {
      if (R0() < 0.35) continue;
      const [x, y] = p.P(a, T + 0.06, 0);
      const n = 5 + Math.floor(R0() * 6);
      for (let i = 0; i < n; i++) {
        const bx = x + (R0() - 0.5) * 14;
        const h = 5 + R0() * 9;
        const lean = (R0() - 0.5) * 4;
        ln(l, bx, y + 1, bx + lean, y + 1 - h, DRYW[2 + Math.floor(R0() * 4)]);
      }
      if (R0() < 0.3) {
        const fx = x + (R0() - 0.5) * 10;
        ln(l, fx, y, fx + 1, y - 10, '#5e6a30');
        ell(l, fx + 1, y - 11, 2, 2, '#f2c83a');
      }
      if (R0() < 0.2) {
        const masses: Mass[] = [{ x: x + 2, y: y - 4, rx: 6, ry: 4, z: 1 }];
        foliage(l, masses, ['#2e3e22', '#3a5028', '#486230', '#58743a', '#6a8646', '#7e9854', '#94aa64'], seed + Math.floor(a * 10), { cell: 2.4 });
      }
    }
  });
}

const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const door = k.variant === 'door';
    const corner = p.rot === 1 && !door;
    const a0 = corner ? -T : 0;
    const cols = [4, 8, 12].filter((c) => c > 0.3 && c < W - 0.3);
    if (!door) {
      lbox(p, a0, 0, W - a0, T, 0, Z, { front: cladding, side: endCap, edge: SLATE[0] });
      poly3(p, [[a0, 0, Z], [W, 0, Z], [W, T, Z], [a0, T, Z]], cutTop(cols.map((c) => c - a0)), 2, [[a0, 0, Z], [W, 0, Z], [a0, T, Z]]);
      const F = front(p, T);
      // a downpipe from the gutter far above, cut at the same plane, into its gully
      const dp = p.rot === 1 ? W - 0.7 : 0.7;
      pq(p, F, dp - 0.07, dp + 0.07, 0.6, Z, GALV[F.light ? 4 : 2]);
      pq(p, F, dp - 0.07, dp - 0.03, 0.6, Z, GALV[F.light ? 6 : 4]);
      const [sx, sy] = F.F(dp + 0.1, 0.8);
      px(p.c, sx - 6, sy - 2, GALV[3], 8, 3);
      const [gx, gy] = p.P(dp + 0.12, T + 0.18, 0);
      fillPoly(p.c, [[gx - 8, gy], [gx, gy - 4], [gx + 8, gy], [gx, gy + 4]], '#3a3a3e');
      for (let i = -5; i <= 5; i += 2) px(p.c, gx + i, gy - 1, '#1e1e22', 1, 2);
      if (p.rot === 1) {
        // an outside tap with a coiled green hose, an electrical box, a no-smoking sign
        const ta = W * 0.42;
        const [tx, ty] = F.F(ta, 4.6);
        layer(
          p.c,
          (l) => {
            px(l, tx - 1, ty - 2, GALV[4], 3, 4);
            px(l, tx + 1, ty - 1, GALV[5], 4, 2);
            px(l, tx - 2, ty - 5, RED[3], 5, 2);
            for (let i = 0; i < 4; i++) ell(l, tx + 4, ty + 14 - i, 9 - i * 0.4, 4, i & 1 ? '#2e7a3a' : '#3a9a48');
            ell(l, tx + 4, ty + 13, 5, 2, '#1e2a22');
          },
          { rect: [tx - 10, ty - 8, tx + 16, ty + 22] },
        );
        pq(p, F, W * 0.62, W * 0.62 + 0.42, 3.4, 6.6, GALV[F.light ? 4 : 3]);
        pq(p, F, W * 0.62 + 0.04, W * 0.62 + 0.38, 3.6, 6.4, GALV[F.light ? 3 : 2]);
        const [bx, by] = F.F(W * 0.62 + 0.21, 5.6);
        fillPoly(p.c, [[bx, by - 3], [bx + 3, by + 2], [bx - 3, by + 2]], YEL[4]);
        const [nx, ny] = F.F(W * 0.2, 5.2);
        ell(p.c, nx, ny, 5, 5, '#f2f0ea');
        ell(p.c, nx, ny, 4, 4, RED[3]);
        ell(p.c, nx, ny, 2.6, 2.6, '#f2f0ea');
        ln(p.c, nx - 3, ny + 2, nx + 3, ny - 2, RED[3]);
      } else {
        // a stencilled fire-access sign
        pq(p, F, W - 1.2, W - 0.5, 4.2, 6.6, '#f2f0ea');
        pq(p, F, W - 1.16, W - 0.54, 4.4, 6.4, RED[3]);
        pq(p, F, W - 1.0, W - 0.7, 5.2, 5.6, '#f2f0ea');
      }
      weeds(p, a0, W, k.seed * 13 + 1);
      return;
    }
    // ── the open sliding doors ──
    const leaf = 1.75;
    const tracks = [0.03, 0.12, 0.21];
    // hazard stripes across the threshold, and the floor rails
    const n = Math.round(W * 5);
    for (let i = 0; i < n; i++) {
      const u0 = (i / n) * W;
      const u1 = ((i + 1) / n) * W;
      fillPoly(p.c, [p.P(u0, 0.02, 0), p.P(u1, 0.02, 0), p.P(u1 - 0.1, T + 0.05, 0), p.P(u0 - 0.1, T + 0.05, 0)], i % 2 ? YEL[4] : HAZK);
    }
    for (const b of tracks) {
      const [x0, y0] = p.P(0, b + 0.03, 0);
      const [x1, y1] = p.P(W, b + 0.03, 0);
      ln(p.c, x0, y0, x1, y1, GALV[2], 2);
      ln(p.c, x0, y0 - 1, x1, y1 - 1, GALV[5]);
    }
    // the leaves: corrugated, cut at the wall's height, a steel frame and bottom rail on rollers
    const leafMat: Mat = (light, w, h) => {
      const sheet = boxProfile(SLATE, { pitch: 10, rust: 0.6, grime: 6, seed: 11 })(light, w, h);
      return (u, v, x, y) => {
        if (v < 3) return at(STEEL, light ? 3 : 1);
        if (u < 2.5 || u > w - 2.5) return at(STEEL, light ? 4 : 2);
        return sheet(u, v, x, y);
      };
    };
    const leafTop: Mat = () => (u, v) => (v < 1.2 || v > 4.2 ? STEEL[3] : u % 10 < 5 ? SLATE[2] : SLATE[1]);
    const stack = (a: number, dir: number) => {
      // back track first so the nearer leaves overlap it
      for (let i = 0; i < tracks.length; i++) {
        const off = dir * i * 0.16;
        const la = dir > 0 ? a + off : a - leaf + off;
        lbox(p, la, tracks[i], leaf, 0.07, 0, Z, { front: leafMat, side: leafMat, top: leafTop, edge: STEEL[0] });
        const F = front(p, tracks[i] + 0.07);
        // the pull handle and a hazard band on the leading edge
        const ea = dir > 0 ? la + leaf - 0.12 : la + 0.04;
        pq(p, F, ea, ea + 0.08, 0.8, Z, i % 2 ? YEL[4] : HAZK);
        const [hx, hy] = F.F(dir > 0 ? la + leaf - 0.35 : la + 0.35, 4.6);
        px(p.c, hx - 1, hy - 6, GALV[5], 2, 12);
        // rollers
        for (const ra of [la + 0.3, la + leaf - 0.3]) {
          const [rx, ry] = p.P(ra, tracks[i] + 0.08, 0.5);
          ell(p.c, rx, ry, 2.4, 2.4, STEEL[1]);
          px(p.c, rx - 1, ry - 1, GALV[4]);
        }
      }
    };
    stack(0, 1);
    stack(W, -1);
    // the door guide posts at both jambs
    for (const a of [0.02, W - 0.12]) lbox(p, a, 0, 0.1, T, 0, Z + 0.4, mono(enamel(YEL), YEL[1]));
    void k;
  },
};

export const ROBOTICS_FACADE: Record<string, PropArt> = { lowWall };

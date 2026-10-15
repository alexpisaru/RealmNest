// Space — the lit structures added after the owner's reference picture (1 z ≈ 10 cm).
//   spc_hangar   a white prefab shelter with a gabled roof and a row of lit amber windows
//   spc_habdome  a habitation dome: an octagonal drum ringed with lit windows, a ribbed cupola
//   spc_lifesup  a life-support skid: a grey unit with compressors, two tall white tanks
//   spc_antenna  a white antenna mast with equipment boxes and a red beacon on top
//   spc_pod      a cargo trolley riding the top of a truss (a vehicle: it runs along the truss)
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { at, ell, hash, ln, px, type Ramp } from '../../kit4';
import { front, poly3, pq, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { ALU, AMBER, ball, CYAN, cyl, frustum, GOLD, GREEN, grille, GUN, halo, led, plating, RED, shield, tone, WHITE } from './common';

const s4 = (p: PropPainter) => p.k / 4;
/** Lit amber glass: core, mid, rim. */
const glow = (t: number) => (t < 0.25 ? '#fef7d0' : t < 0.6 ? '#fbd262' : '#f1bd3c');
/** painted yellow crates (the reference's cargo) */
export const CRATE_Y: Ramp = ['#5c4210', '#8d5a13', '#b98d3a', '#dcaa4a', '#e3b755', '#eec65e', '#f8e0a0'];

const spc_hangar: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const H0 = 8;
    const H1 = 11;
    footShadow(p, 0.04, 0.04, W - 0.04, D - 0.04, 14, 0.4);
    lbox(p, 0.06, 0.06, W - 0.12, D - 0.12, 0, 1, mono(plating(GUN, 18, 4, 151), GUN[0]));
    lbox(p, 0.1, 0.1, W - 0.2, D - 0.2, 1, H0 - 1, { front: shield(WHITE, 24, 30), side: shield(WHITE, 24, 30), top: tone(WHITE, 0), edge: WHITE[0] });
    // the gabled roof: two slopes along a, the near gable at a = w
    const a0 = 0.02;
    const a1 = W - 0.02;
    const roofTex = (lit: number) => (u: number, v: number, x: number, y: number) => {
      let i = lit;
      if (u % 18 < 1.3) i -= 1.2;
      else if (u % 18 < 2.4) i += 0.6;
      if (v < 1.5) i -= 1.4;
      if (hash(x, y, 152) < 0.02) i -= 0.6;
      return at(WHITE, i);
    };
    poly3(p, [[a0, 0.02, H0], [a1, 0.02, H0], [a1, D / 2, H1], [a0, D / 2, H1]], roofTex(4.4), 1, [[a0, 0.02, H0], [a1, 0.02, H0], [a0, D / 2, H1]]);
    poly3(p, [[a0, D / 2, H1], [a1, D / 2, H1], [a1, D - 0.02, H0], [a0, D - 0.02, H0]], roofTex(5.6), 2, [[a0, D - 0.02, H0], [a1, D - 0.02, H0], [a0, D / 2, H1]]);
    poly3(p, [[a1 - 0.08, 0.02, H0], [a1 - 0.08, D - 0.02, H0], [a1 - 0.08, D / 2, H1]], (_u: number, v: number) => at(WHITE, v < 1.4 ? 1 : 3), 0);
    const F = front(p, D - 0.1);
    pq(p, F, 0.1, W - 0.1, H0 - 0.6, H0 - 0.1, WHITE[2]);
    // windows along the front, lit warm from inside, and a lit door at the near end
    const n = Math.max(2, Math.round((W - 0.6) / 0.62));
    const step = (W - 0.5) / n;
    for (let i = 0; i < n; i++) {
      const u0 = 0.3 + i * step + 0.06;
      const u1 = u0 + step - 0.14;
      pq(p, F, u0 - 0.03, u1 + 0.03, 2.3, 5.9, GUN[1]);
      pq(p, F, u0, u1, 2.6, 5.6, '#f1bd3c');
      pq(p, F, u0, u1, 3.4, 5.6, '#fbd262');
      pq(p, F, u0 + (u1 - u0) * 0.2, u0 + (u1 - u0) * 0.55, 4.2, 5.4, '#fef7d0');
      pq(p, F, (u0 + u1) / 2 - 0.015, (u0 + u1) / 2 + 0.015, 2.6, 5.6, GUN[2]);
    }
    const S = side(p, W - 0.1);
    pq(p, S, D / 2 - 0.3, D / 2 + 0.3, 1, 6.4, GUN[1]);
    pq(p, S, D / 2 - 0.24, D / 2 + 0.24, 1, 6, '#f1bd3c');
    pq(p, S, D / 2 - 0.24, D / 2 + 0.24, 3.4, 6, '#fbd262');
    pq(p, S, D / 2 - 0.4, D / 2 + 0.4, 6.6, 7.1, AMBER[4]);
    // the spill of light on the deck in front of the windows
    for (let i = 0; i < n; i++) {
      const [lx, ly] = p.P(0.3 + (i + 0.5) * step, D + 0.22, 0);
      halo(p.c, lx, ly, 20, 6, '#f1bd3c', 0.16);
    }
  },
  lights: (k) => {
    const out: PropLight[] = [];
    const n = Math.max(2, Math.round((k.w - 0.6) / 0.62));
    const step = (k.w - 0.5) / n;
    for (let i = 0; i < n; i += 2) out.push({ a: 0.3 + (i + 0.5) * step, b: k.d, z: 4, r: 1.3, color: '#fbd262', kind: 'window' });
    out.push({ a: k.w, b: k.d / 2, z: 4, r: 1.2, color: '#fbd262', kind: 'window' });
    return out;
  },
};

const spc_habdome: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    const R0 = Math.min(W, D) / 2 - 0.2;
    footShadow(p, 0.15, 0.15, W - 0.15, D - 0.15, 20, 0.4);
    frustum(p, cx, cb, 0, 1.4, R0 + 0.14, R0 + 0.1, { ramp: GUN, top: GUN, spec: 0.3, tex: (_z, ang) => (Math.abs(((ang * 4) / Math.PI) % 1) < 0.06 ? 1.2 : 0) });
    frustum(p, cx, cb, 1.4, 11, R0, R0, {
      ramp: WHITE,
      spec: 0.6,
      top: false,
      tex: (z, ang) => {
        const f = ((((ang + Math.PI) / (Math.PI * 2)) * 8) % 1 + 1) % 1;
        if (f < 0.05 || f > 0.95) return -1.4;
        if (z > 3 && z < 9.4 && f > 0.13 && f < 0.87) {
          if (z < 3.5 || z > 8.9 || f < 0.18 || f > 0.82) return '#e59733';
          if (Math.abs(f - 0.5) < 0.025 || Math.abs(z - 6.4) < 0.22) return GUN[2];
          return glow(Math.hypot((f - 0.42) * 2.2, (z - 7.4) / 4));
        }
        if (Math.abs(z - 10.2) < 0.4) return at(AMBER, 4);
        return (f - 0.5) * -0.8;
      },
    });
    // the cupola: a ribbed silver dome with a hatch on top
    ball(p, cx, cb, 11, R0, R0, R0 * 0.75, {
      ramp: ALU,
      spec: 0.9,
      dome: true,
      tex: (ns, nt, nw) => {
        const ang = Math.atan2(nt, ns);
        if (Math.abs(((((ang * 8) / (Math.PI * 2)) % 1) + 1) % 1 - 0.5) > 0.45) return -1.6;
        if (Math.abs(nw - 0.5) < 0.03 || Math.abs(nw - 0.82) < 0.03) return -1.2;
        return 0;
      },
    });
    frustum(p, cx, cb, 11 + R0 * 7.5 - 0.6, 11 + R0 * 7.5 + 0.6, 0.3, 0.26, { ramp: ALU, top: ALU, spec: 0.6 });
    const [lx, ly] = p.P(cx, cb + R0 + 0.35, 0);
    halo(p.c, lx, ly, 40, 12, '#f1bd3c', 0.28);
  },
  anim(p, k) {
    const [x, y] = p.P(k.w / 2, k.d / 2, 11 + (Math.min(k.w, k.d) / 2 - 0.2) * 7.5 + 1.4);
    const s = Math.max(1, Math.round(s4(p)));
    if (Math.sin(k.t * 2.1 + k.seed) > 0.5) px(p.c, x - s, y - s, RED[6], 2 * s, 2 * s);
  },
  lights: (k) => {
    const R0 = Math.min(k.w, k.d) / 2 - 0.2;
    return [
      { a: k.w / 2, b: k.d / 2 + R0, z: 6, r: 1.8, color: '#fbd262', kind: 'window' },
      { a: k.w / 2 + R0, b: k.d / 2, z: 6, r: 1.6, color: '#fbd262', kind: 'window' },
    ];
  },
};

const spc_lifesup: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 16, 0.4);
    lbox(p, 0.05, 0.05, W - 0.1, D - 0.1, 0, 0.8, mono(plating(GUN, 18, 4, 161), GUN[0]));
    // the unit: a grey cabinet with a lit status panel, compressors on top
    const uw = Math.min(1.5, W * 0.5);
    lbox(p, 0.15, 0.2, uw, D - 0.4, 0.8, 6.4, { front: plating(ALU, 22, 14, 162), side: grille(ALU, 3), top: plating(ALU, 14, 14, 163), edge: GUN[1] });
    const F = front(p, D - 0.2);
    pq(p, F, 0.3, 0.3 + uw * 0.4, 3.2, 5.6, GUN[1]);
    pq(p, F, 0.34, 0.3 + uw * 0.4 - 0.04, 3.5, 5.3, '#0c2a3a');
    pq(p, F, 0.38, 0.3 + uw * 0.25, 4.6, 5, CYAN[5]);
    pq(p, F, 0.38, 0.3 + uw * 0.18, 3.9, 4.2, AMBER[5]);
    pq(p, F, 0.3 + uw * 0.55, 0.3 + uw * 0.85, 4.8, 5.6, '#f4f2ec');
    pq(p, F, 0.3 + uw * 0.57, 0.3 + uw * 0.66, 4.9, 5.5, AMBER[4]);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const a = 0.15 + uw * (0.28 + i * 0.44);
        const b = 0.2 + (D - 0.4) * (0.3 + j * 0.4);
        cyl(p, a, b, 7.2, a, b, 10.4, 0.2, { ramp: ALU, cap: GUN, spec: 0.7, tex: (t) => (Math.abs(t - 0.12) < 0.03 ? -1.6 : 0), capTex: (rr) => (rr < 0.5 ? -1 : 0.5) });
      }
    // two tall white pressure tanks with domed tops and an orange band
    for (let i = 0; i < 2; i++) {
      const a = uw + 0.55 + i * 0.62;
      if (a > W - 0.3) break;
      const b = D / 2 + (i ? 0.2 : -0.15);
      frustum(p, a, b, 0.8, 11, 0.27, 0.27, { ramp: WHITE, spec: 0.7, top: false, tex: (z) => (Math.abs(z - 8.6) < 0.5 ? at(AMBER, 4) : Math.abs(z - 2) < 0.2 ? -1.4 : 0) });
      ball(p, a, b, 11, 0.27, 0.27, 0.22, { ramp: WHITE, spec: 0.9, dome: true });
      const [lx, ly] = p.P(a, b + 0.27, 5);
      led(p.c, lx, ly, i ? GREEN : AMBER, 2);
    }
    const [x0, y0] = p.P(0.15 + uw, D - 0.3, 3);
    const [x1, y1] = p.P(W - 0.2, D - 0.3, 3);
    ln(p.c, x0, y0, x1, y1, ALU[5], 2);
    ln(p.c, x0, y0 + 2, x1, y1 + 2, GOLD[3], 1);
  },
  lights: (k) => [{ a: 0.5, b: k.d, z: 4.5, r: 0.7, color: '#7ddce9', kind: 'lamp' }],
};

const spc_antenna: PropArt = {
  draw(p, k) {
    const H = k.variant === 'tall' ? 44 : 32;
    footShadow(p, 0.25, 0.25, 0.75, 0.75, 24, 0.34);
    lbox(p, 0.28, 0.28, 0.44, 0.44, 0, 1.6, { front: plating(GUN, 10, 8, 181), side: plating(GUN, 10, 8, 182), top: tone(GUN, 1), edge: GUN[0] });
    cyl(p, 0.5, 0.5, 1.6, 0.5, 0.5, H, 0.08, { ramp: WHITE, cap: false, spec: 0.7, tex: (t) => (Math.abs((t * 10) % 9 - 4.5) < 0.25 ? -1.4 : 0) });
    // equipment boxes clamped to the mast, a crossarm with whips
    lbox(p, 0.36, 0.52, 0.28, 0.2, H * 0.45, 4, { front: plating(ALU, 10, 10, 183), side: plating(ALU, 10, 10, 184), top: tone(ALU, 1), edge: GUN[1] });
    lbox(p, 0.52, 0.34, 0.2, 0.26, H * 0.7, 3, { front: plating(WHITE, 10, 10, 185), side: plating(WHITE, 10, 10, 186), top: tone(WHITE, 1), edge: GUN[1] });
    const [x, y] = p.P(0.5, 0.5, H);
    const s = s4(p);
    ln(p.c, x - 8 * s, y + 10 * s, x + 8 * s, y + 6 * s, ALU[4], 1);
    ln(p.c, x - 7 * s, y + 10 * s, x - 7 * s, y - 2 * s, ALU[5], 1);
    ln(p.c, x + 7 * s, y + 6 * s, x + 7 * s, y - 4 * s, ALU[5], 1);
    // the red beacon: a lamp housing with a steady glow
    px(p.c, x - 3 * s, y - 2 * s, GUN[3], 6 * s, 3 * s);
    halo(p.c, x, y - 5 * s, 9 * s, 9 * s, RED[5], 0.35);
    ell(p.c, x, y - 5 * s, 3 * s, 3 * s, RED[4]);
    px(p.c, x - s, y - 6 * s, RED[6], 2 * s, 2 * s);
  },
  anim(p, k) {
    const H = k.variant === 'tall' ? 44 : 32;
    const [x, y] = p.P(0.5, 0.5, H);
    const s = s4(p);
    if (Math.sin(k.t * 2.4 + k.seed * 1.3) > 0.4) {
      const S = Math.max(1, Math.round(s));
      px(p.c, x - 2 * S, y - 7 * s, '#ffd0c8', 4 * S, 4 * S);
      halo(p.c, x, y - 5 * s, 12 * s, 12 * s, RED[5], 0.3);
    }
  },
  lights: (k) => [{ a: 0.5, b: 0.5, z: k.variant === 'tall' ? 45 : 33, r: 0.6, color: '#e04a3c', kind: 'lamp' }],
};

const spc_pod: PropArt = {
  draw(p, k) {
    const W = k.w;
    const z0 = 17.6;
    // the bogie on the truss's top rails, a wheel at each end
    lbox(p, 0.08, 0.16, W - 0.16, 0.68, z0, 1.2, { front: plating(GUN, 14, 5, 171), side: plating(GUN, 14, 5, 172), top: plating(GUN, 14, 14, 173), edge: GUN[0] });
    for (const a of [0.35, W - 0.35]) {
      const [wx, wy] = p.P(a, 0.86, z0 + 0.3);
      ell(p.c, wx, wy, 4, 3, GUN[0]);
      ell(p.c, wx - 1, wy - 1, 2, 1.5, ALU[3]);
    }
    // the crates: white and yellow, a small white one on top (alike from both ends)
    const crate = (a: number, b: number, w: number, d: number, z: number, h: number, r: Ramp, mark: string) => {
      lbox(p, a, b, w, d, z, h, { front: plating(r, 30, 30, 174), side: plating(r, 30, 30, 175), top: tone(r, 0.6), edge: r[0] });
      const F = front(p, b + d);
      pq(p, F, a + w * 0.08, a + w * 0.92, z + h * 0.8, z + h * 0.88, GUN[2]);
      pq(p, F, a + w * 0.3, a + w * 0.7, z + h * 0.3, z + h * 0.58, mark);
      const S = side(p, a + w);
      pq(p, S, b + d * 0.08, b + d * 0.92, z + h * 0.8, z + h * 0.88, GUN[2]);
    };
    crate(0.1, 0.1, W / 2 - 0.14, 0.8, z0 + 1.2, 8.4, WHITE, AMBER[4]);
    crate(W / 2 + 0.04, 0.1, W / 2 - 0.14, 0.8, z0 + 1.2, 8.4, CRATE_Y, '#f4f2ec');
    crate(W / 2 - 0.4, 0.2, 0.8, 0.6, z0 + 9.6, 5.6, WHITE, CYAN[4]);
  },
  anim(p, k) {
    // amber lamps at both ends, blinking in turn
    const s = Math.max(1, Math.round(s4(p)));
    [0.12, k.w - 0.12].forEach((a, i) => {
      const on = Math.sin(k.t * 3 + i * Math.PI) > 0;
      const [x, y] = p.P(a, 0.86, 18.6);
      px(p.c, x - s, y - s, on ? AMBER[6] : AMBER[2], 2 * s, 2 * s);
      if (on) halo(p.c, x, y, 6 * s, 5 * s, AMBER[5], 0.3);
    });
  },
};

export const SPACE_SPINE: Record<string, PropArt> = { spc_hangar, spc_habdome, spc_lifesup, spc_antenna, spc_pod };

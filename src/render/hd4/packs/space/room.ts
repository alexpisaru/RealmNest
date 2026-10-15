// Space — the command module's furniture at 128×64 (1 z ≈ 10 cm; a person is ~17.5 z).
// Standing flight consoles with live screens, the science bay's capsule glovebox,
// a two-tier hydroponics rack under magenta grow lights, the floor docking port,
// the holo-table, a padded lounge bench, the galley dispenser, a crew locker,
// upright sleep and suit pods, a "Veggie" zinnia unit, cargo, and the module's
// hull cut low for the front walls.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { ALU, AMBER, ball, brushedU, CYAN, cyl, flat, GOLD, GREEN, grille, GUN, halo, led, PAD, plating, quilt, rampAround, RED, SCREEN, shield, tone, VIOLET, WHITE } from './common';

const s4 = (p: PropPainter) => p.k / 4;

// ── flight consoles ─────────────────────────────────────────
/** Point on the slanted control deck: f = 0 at the front edge, 1 at the back. */
const deckP = (p: PropPainter, a: number, f: number): [number, number] => p.P(a, 0.92 - f * 0.46, 8.6 + f * 2);

const consoleFront: Mat = (light, w, h) => (u, v, x, y) => {
  let i = light ? 3 : 2;
  const seam = Math.abs(u - w * 0.33) < 0.8 || Math.abs(u - w * 0.67) < 0.8;
  if (seam) return at(GUN, i - 2);
  if (v < 7) return v % 2.4 < 1.1 ? at(GUN, 0) : at(GUN, i - 0.5);
  if (v > h - 2) i += 1;
  // an inset access panel with four screws in the middle third
  const pu = u - w * 0.36;
  const pv = v - 9;
  if (pu > 0 && pu < w * 0.28 && pv > 0 && pv < h - 16) {
    if (pu < 1.2 || pv > h - 17.2) return at(GUN, i - 1.4);
    if ((pu < 3.5 || pu > w * 0.28 - 3.5) && (pv < 3.5 || pv > h - 19.5)) return at(GUN, i + 2);
    i += 0.4;
  }
  if (hash(x, y, 301) < 0.02) i -= 0.8;
  return at(GUN, i);
};

const ROLE_COL = [CYAN, GREEN, VIOLET, AMBER];

const console_: PropArt = {
  draw(p, k) {
    const W = k.w;
    const role = (k.seed - 1) % 4;
    const RC = ROLE_COL[role];
    footShadow(p, 0.08, 0.12, W - 0.08, 0.96, 14, 0.3);
    // a recessed plinth, the body, the screen housing behind the control deck
    lbox(p, 0.2, 0.3, W - 0.4, 0.54, 0, 1, mono(flat(GUN), GUN[0]));
    // a toe-kick light in the station's colour and its glow on the deck
    const TK = front(p, 0.84);
    pq(p, TK, 0.24, W - 0.24, 0.3, 0.62, RC[5]);
    const [gx0, gy0] = p.P(W / 2, 1.08, 0);
    halo(p.c, gx0, gy0, 64 * (W / 2), 14, RC[5], 0.16);
    lbox(p, 0.08, 0.16, W - 0.16, 0.74, 1, 7.6, { front: consoleFront, side: plating(GUN, 26, 20, 3), top: flat(GUN), edge: GUN[0] });
    const FB = front(p, 0.9);
    pq(p, FB, 0.1, W - 0.1, 7.9, 8.15, RC[3]);
    lbox(p, 0.1, 0.14, W - 0.2, 0.32, 8.6, 8.2, { front: flat(GUN), side: plating(GUN, 22, 18, 4), top: flat(GUN), edge: GUN[0] });
    // the screens' bezels and dark glass (the content is live)
    const F = front(p, 0.46);
    pq(p, F, 0.16, 1.26, 10.9, 16.2, GUN[4]);
    pq(p, F, 0.2, 1.22, 11.2, 15.9, SCREEN);
    pq(p, F, 1.32, W - 0.16, 11.4, 15.4, GUN[4]);
    pq(p, F, 1.35, W - 0.19, 11.7, 15.1, SCREEN);
    // a static frame of the readouts (the anim adds motion)
    screens(p, role, 0, k.seed, true);
    // the status bar on top and a role tag
    pq(p, F, 0.14, W - 0.14, 16.4, 16.8, GUN[1]);
    for (let i = 0; i < 9; i++) pq(p, F, 0.2 + i * 0.18, 0.3 + i * 0.18, 16.45, 16.75, i % 3 === 0 ? RC[5] : GUN[4]);
    pq(p, F, W - 0.62, W - 0.2, 10.1, 10.6, '#e8ecf2');
    pq(p, F, W - 0.6, W - 0.5, 10.2, 10.5, RC[4]);
    // the slanted control deck
    const deck = (u: number, v: number, x: number, y: number) => {
      if (u < 1.5 || v < 1.2) return GUN[1];
      if (v > 26) return GUN[3];
      return hash(x, y, 302) < 0.03 ? GUN[3] : GUN[2];
    };
    poly3(p, [[0.06, 0.92, 8.6], [W - 0.06, 0.92, 8.6], [W - 0.06, 0.46, 10.6], [0.06, 0.46, 10.6]], deck, 2);
    poly3(p, [[W - 0.06, 0.92, 8.6], [W - 0.06, 0.46, 10.6], [W - 0.06, 0.46, 8.6]], (_u: number, _v: number) => GUN[1], 0);
    // keyboard: rows of pale keys
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 12; i++) {
        const [kx, ky] = deckP(p, 0.28 + i * 0.065, 0.18 + r * 0.14);
        px(p.c, kx, ky, r === 0 && i > 9 ? RC[4] : '#9aa2b2', 2, 1);
      }
    // backlit button grid, guarded toggles, a trackball, dials
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 5; i++) {
        const [bx, by] = deckP(p, 1.18 + i * 0.1, 0.25 + r * 0.3);
        px(p.c, bx - 1, by - 1, hash(i, r, k.seed) < 0.3 ? AMBER[5] : RC[hash(i, r + 4, k.seed) < 0.5 ? 4 : 2], 3, 2);
      }
    for (let i = 0; i < 4; i++) {
      const [gx, gy] = deckP(p, 0.34 + i * 0.16, 0.78);
      px(p.c, gx - 1, gy - 3, RED[3], 4, 3);
      px(p.c, gx - 1, gy - 3, RED[5], 4, 1);
      px(p.c, gx + 3, gy - 2, ALU[5], 1, 2);
    }
    const [tbx, tby] = deckP(p, 1.02, 0.4);
    ell(p.c, tbx, tby, 3, 2, GUN[0]);
    px(p.c, tbx - 1, tby - 1, ALU[4], 2, 1);
    // the padded armrest along the front edge
    lbox(p, 0.06, 0.86, W - 0.12, 0.12, 8.1, 0.8, { front: quilt(GUN, 8), side: tone(GUN, -0.5), top: tone(GUN, 1.4), edge: GUN[0] });
    // role details: a T-handle stick (nav), a headset (comms), a checklist (life), a breaker key (power)
    const [hx, hy] = deckP(p, 1.7, 0.45);
    layer(
      p.c,
      (l) => {
        if (role === 0) {
          px(l, hx - 1, hy - 10, GUN[4], 3, 10);
          px(l, hx - 6, hy - 12, GUN[2], 12, 3);
          px(l, hx - 6, hy - 12, ALU[4], 12, 1);
          px(l, hx - 1, hy - 14, RED[4], 3, 2);
          ell(l, hx, hy, 4, 2, GUN[1]);
        } else if (role === 1) {
          // a headset lying on the deck: band and two cups
          ell(l, hx - 5, hy - 2, 3, 2.5, GUN[1]);
          ell(l, hx + 5, hy - 3, 3, 2.5, GUN[1]);
          for (let i = -5; i <= 5; i++) px(l, hx + i, hy - 6 + Math.abs(i) * 0.5, ALU[3]);
          ln(l, hx + 5, hy - 3, hx + 12, hy - 7, GUN[3]);
        } else if (role === 2) {
          fillPoly(l, [[hx - 8, hy], [hx + 2, hy - 5], [hx + 9, hy - 2], [hx - 1, hy + 3]], '#f2f0e8');
          for (let i = 0; i < 3; i++) ln(l, hx - 5 + i * 2, hy - i, hx + 3 + i * 2, hy - 4 - i, '#8a90a0');
          px(l, hx + 4, hy - 6, GREEN[4], 2, 2);
        } else {
          px(l, hx - 3, hy - 4, AMBER[4], 6, 4);
          px(l, hx - 3, hy - 4, AMBER[6], 6, 1);
          px(l, hx, hy - 8, ALU[5], 1, 4);
        }
      },
      { rect: [hx - 14, hy - 18, hx + 16, hy + 6] },
    );
    // a drink pouch velcroed to the housing's side, a sticky note on the bezel
    const [sx, sy] = p.P(0.16, 0.47, 14.6);
    px(p.c, sx - 1, sy - 4, '#f6d860', 5, 4);
    if (role % 2 === 0) {
      const [cx, cy] = p.P(W - 0.1, 0.32, 11);
      layer(p.c, (l) => {
        px(l, cx - 3, cy - 10, '#d8c8a8', 6, 10);
        px(l, cx - 3, cy - 10, '#efe2c4', 2, 10);
        px(l, cx - 1, cy - 13, GUN[3], 1, 3);
        px(l, cx - 3, cy - 6, '#6a3a1e', 6, 2);
      }, { rect: [cx - 6, cy - 16, cx + 6, cy + 2] });
    }
  },
  anim(p, k) {
    screens(p, (k.seed - 1) % 4, k.t, k.seed, false);
    // status LEDs chasing along the top bar
    const F = front(p, 0.46);
    const RC = ROLE_COL[(k.seed - 1) % 4];
    const i = Math.floor(k.t * 3 + k.seed) % 9;
    const [x0, y0] = F.F(0.2 + i * 0.18, 16.75);
    const [x1] = F.F(0.3 + i * 0.18, 16.75);
    px(p.c, x0, y0, RC[6], Math.max(1, Math.round(x1 - x0)), Math.max(1, Math.round(s4(p))));
  },
};

/** The console readouts: navigation, comms, life support, power (static frame or live overlay). */
function screens(p: PropPainter, role: number, t: number, seed: number, base: boolean) {
  const F = front(p, 0.46);
  const s = Math.max(1, Math.round(s4(p)));
  const L = (ua: number, za: number, ub: number, zb: number, col: string) => {
    const [x0, y0] = F.F(ua, za);
    const [x1, y1] = F.F(ub, zb);
    ln(p.c, x0, y0, x1, y1, col, s);
  };
  const dot = (u: number, z: number, col: string, w = 1, h = 1) => {
    const [x, y] = F.F(u, z);
    px(p.c, x, y, col, w * s, h * s);
  };
  // main screen u 0.2 … 1.22, z 11.2 … 15.9; side screen u 1.35 … 1.81, z 11.7 … 15.1
  if (role === 0) {
    // an orbit about the planet, the station on it, the next burn marked
    if (base) {
      const [cx, cy] = F.F(0.6, 13.5);
      ell(p.c, cx, cy, 9, 8, '#1f4a78');
      ell(p.c, cx - 2, cy - 2, 5, 4, '#2c62aa');
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        if (i % 2) dot(0.66 + Math.cos(a) * 0.36, 13.5 + Math.sin(a) * 1.7, CYAN[4]);
      }
      for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) dot(1.4 + i * 0.1, 14.6 - r * 0.6, i === 0 ? CYAN[5] : '#5a7088', 2, 1);
    } else {
      const a = t * 0.6 + seed;
      dot(0.66 + Math.cos(a) * 0.36, 13.5 + Math.sin(a) * 1.7, '#ffffff', 2, 2);
      if (Math.sin(t * 5) > 0) dot(1.4 + 0.4, 12.2, CYAN[6], 2, 1);
    }
  } else if (role === 1) {
    // a scrolling waveform and signal bars
    if (base) {
      L(0.24, 13.6, 1.18, 13.6, '#1c3a2c');
      for (let i = 0; i < 5; i++) {
        const [x0, y0] = F.F(1.4 + i * 0.08, 11.9);
        px(p.c, x0, y0 - (2 + i * 2) * s, i < 4 ? GREEN[4] : '#1c3a2c', 2 * s, (2 + i * 2) * s);
      }
    } else {
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 24; i++) {
        const u = 0.24 + (i / 24) * 0.94;
        const z = 13.6 + Math.sin(i * 0.9 + t * 6) * 0.9 * Math.sin(i * 0.23 + t * 1.3) + (hash(i, Math.floor(t * 8), seed) - 0.5) * 0.4;
        const q = F.F(u, z);
        if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], GREEN[5], s);
        prev = q;
      }
      const row = Math.floor(t * 0.8) % 4;
      dot(1.38, 14.6 - row * 0.8, GREEN[6], 4, 1);
    }
  } else if (role === 2) {
    // O2 and CO2 traces, a big gauge
    if (base) {
      L(0.24, 12.4, 0.86, 12.4, '#2a2448');
      L(0.24, 14.6, 0.86, 14.6, '#2a2448');
      const [gx, gy] = F.F(1.03, 13.4);
      for (let i = 0; i < 20; i++) {
        const a = Math.PI * (0.8 + (i / 19) * 1.4);
        px(p.c, gx + Math.cos(a) * 7, gy + Math.sin(a) * 7, i < 14 ? GREEN[4] : AMBER[4]);
      }
      for (let i = 0; i < 3; i++) dot(1.42 + i * 0.12, 13.6, VIOLET[5], 3, 4);
    } else {
      for (const [z0, col, f] of [[12.4, GREEN[5], 0.7], [14.6, AMBER[5], 1.3]] as const) {
        let prev: [number, number] | null = null;
        for (let i = 0; i <= 14; i++) {
          const u = 0.24 + (i / 14) * 0.62;
          const z = z0 + Math.sin(i * 0.7 + t * f + seed) * 0.5;
          const q = F.F(u, z);
          if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], col, s);
          prev = q;
        }
      }
      const a = Math.PI * (0.8 + (0.55 + 0.1 * Math.sin(t * 0.7)) * 1.4);
      const [gx, gy] = F.F(1.03, 13.4);
      ln(p.c, gx, gy, gx + Math.cos(a) * 6 * s, gy + Math.sin(a) * 6 * s, '#ffffff', s);
    }
  } else {
    // power: solar array output bars and the battery
    if (base) {
      for (let i = 0; i < 8; i++) dot(0.26 + i * 0.12, 11.6, AMBER[2], 6, 1);
      dot(1.42, 14.4, '#e8ecf2', 10, 6);
      dot(1.44, 14.2, GREEN[4], 6, 4);
    } else {
      for (let i = 0; i < 8; i++) {
        const h = (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.8 + seed))) * 3.6;
        const [x0, y0] = F.F(0.26 + i * 0.12, 11.7);
        const [, y1] = F.F(0.26 + i * 0.12, 11.7 + h);
        px(p.c, x0, y1, i === 5 ? AMBER[6] : AMBER[4], 5 * s, Math.max(s, Math.round(y0 - y1)));
      }
      if (Math.sin(t * 3) > 0) dot(1.66, 14.2, GREEN[6], 2, 4);
    }
  }
}

// ── the science bay: a capsule glovebox, microscope, centrifuge, sample rack ──
const labbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.06, 0.1, W - 0.06, 0.95, 12, 0.3);
    // white lab cabinets with drawers on a dark plinth, a composite worktop with a lit edge
    lbox(p, 0.1, 0.2, W - 0.2, 0.66, 0, 0.9, mono(flat(GUN), GUN[0]));
    lbox(p, 0.06, 0.14, W - 0.12, 0.76, 0.9, 6.4, { front: shield(WHITE, 34, 14), side: shield(WHITE, 30, 14), top: tone(WHITE), edge: WHITE[0] });
    const F = front(p, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = 0.14 + (i % 3) * ((W - 0.28) / 3);
      const z = i < 3 ? 1.6 : 4.4;
      pq(p, F, a + 0.3, a + 0.62, z + 1.4, z + 1.8, GUN[3]);
    }
    lbox(p, 0.02, 0.1, W - 0.04, 0.84, 7.3, 0.6, { front: tone(ALU, 0.4), side: tone(ALU, -0.4), top: brushedU(['#3a4052', '#485066', '#566078', '#68728a', '#7a849c', '#8e98ae', '#a4aec2']), edge: GUN[1] });
    const E = front(p, 0.94);
    pq(p, E, 0.04, W - 0.04, 7.35, 7.55, CYAN[5]);
    const tz = 7.9;
    // the glovebox: a lit enclosure of glass in an aluminium frame, two glove ports in its front
    const ga = 0.3;
    const gb = 1.66;
    const g0 = 0.2;
    const g1 = 0.84;
    const zb = tz + 1.1;
    const zt = tz + 6.8;
    lbox(p, ga - 0.04, g0 - 0.02, gb - ga + 0.08, g1 - g0 + 0.04, tz, 1.1, { front: flat(GUN), side: flat(GUN), top: tone(ALU, 1), edge: GUN[0] });
    // inside: a glowing back panel with a grid, the inner left wall, the experiment
    const B = front(p, g0 + 0.02);
    pt(p, B, ga + 0.02, gb - 0.02, zb, zt, ((u: number, v: number) => (u % 14 < 1 || v % 12 < 1 ? '#7ac4d2' : v > 18 ? '#d8f4f8' : '#b4e6ee')) as FaceTex, 1);
    pq(p, side(p, ga + 0.02), g0 + 0.02, g1, zb, zt, '#5a8e9c');
    const [wx, wy] = p.P(0.84, 0.52, tz + 4.4);
    layer(p.c, (l) => {
      // a floating water sphere with a bubble, a sample tray and vials in a rack
      ell(l, wx, wy, 7, 7, '#2c62aa');
      ell(l, wx - 1, wy - 1, 6, 6, '#5090cc');
      ell(l, wx - 2, wy - 3, 2, 2, '#e8f8ff');
      ell(l, wx + 2, wy + 2, 1.5, 1.5, '#8ac4ec');
      for (let i = 0; i < 4; i++) {
        const [vx, vy] = p.P(1.2 + i * 0.08, 0.4, zb);
        px(l, vx - 1, vy - 9, '#e8f6fa', 3, 9);
        px(l, vx - 1, vy - 5, ['#e04a3c', '#46b456', '#f2c43a', '#9264cc'][i], 3, 4);
        px(l, vx - 1, vy - 10, GUN[4], 3, 2);
      }
      const [dx, dy] = p.P(0.62, 0.62, zb);
      ell(l, dx, dy, 6, 3, '#e8ecf2');
      ell(l, dx, dy - 1, 4, 2, '#8ac86a');
    }, { rect: [wx - 30, wy - 40, wx + 60, wy + 40] });
    // the glove sleeves reaching in from the ports
    for (const u of [0.72, 1.26]) cyl(p, u, g1 - 0.34, tz + 4, u, g1, tz + 4, 0.12, { ramp: WHITE, cap: false, spec: 0.4, tex: (t) => (t < 0.06 ? -1 : 0) });
    // the glass: front, right side and lid, faintly blue with two reflections
    const glass = (u: number, v: number) => ((u * 0.8 + v) % 34 < 3 ? 'rgba(235,250,255,0.6)' : (u * 0.8 + v) % 34 < 5 ? 'rgba(200,236,248,0.3)' : 'rgba(160,210,230,0.14)');
    poly3(p, [[ga, g1, zb], [gb, g1, zb], [gb, g1, zt], [ga, g1, zt]], glass, 1);
    poly3(p, [[gb, g1, zb], [gb, g0, zb], [gb, g0, zt], [gb, g1, zt]], glass, 0);
    poly3(p, [[ga, g1, zt], [gb, g1, zt], [gb, g0, zt], [ga, g0, zt]], (u: number, v: number) => ((u + v) % 30 < 3 ? 'rgba(235,250,255,0.5)' : 'rgba(170,215,235,0.12)'), 2);
    // the aluminium frame: back edges dim, front edges bright
    const E3 = (a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, c: string, w = 2) => {
      const q0 = p.P(a0, b0, z0);
      const q1 = p.P(a1, b1, z1);
      ln(p.c, q0[0], q0[1], q1[0], q1[1], c, w);
    };
    E3(ga, g0, zt, gb, g0, zt, ALU[3]);
    E3(ga, g0, zt, ga, g1, zt, ALU[3]);
    E3(ga, g0, zb, ga, g0, zt, ALU[2]);
    E3(gb, g0, zb, gb, g0, zt, ALU[3]);
    E3(gb, g0, zt, gb, g1, zt, ALU[5]);
    E3(ga, g1, zt, gb, g1, zt, ALU[6]);
    E3(ga, g1, zb, ga, g1, zt, ALU[5]);
    E3(gb, g1, zb, gb, g1, zt, ALU[4]);
    E3(ga, g1, zb, gb, g1, zb, GUN[1]);
    // glove ports on the front: rubber rings with white gloves reaching in
    const FG = front(p, g1);
    for (const u of [0.72, 1.26]) {
      const ring = (r: number) => Array.from({ length: 20 }, (_, i) => {
        const t = (i / 20) * Math.PI * 2;
        return FG.F(u + Math.cos(t) * r, tz + 4 + Math.sin(t) * r * 10);
      });
      // a dark rubber ring standing on the glass, the sleeve seen through its hole
      const outer = ring(0.2);
      const inner = ring(0.13);
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length;
        fillPoly(p.c, [outer[i], outer[j], inner[j], inner[i]], i < outer.length / 2 ? GUN[1] : GUN[3]);
      }
    }
    // a light bar on the lid
    lbox(p, ga + 0.1, g0 + 0.24, gb - ga - 0.2, 0.18, zt, 0.4, { front: tone(CYAN, 2), side: tone(GUN), top: tone(GUN, 1), edge: GUN[0] });
    // right: the microscope, the centrifuge, the sample capsule rack, a tablet
    const [mx, my] = p.P(2.2, 0.42, tz);
    layer(p.c, (l) => {
      px(l, mx - 7, my - 3, '#e8ecf2', 14, 4);
      px(l, mx - 2, my - 22, '#e8ecf2', 6, 20);
      px(l, mx - 2, my - 22, '#ffffff', 2, 20);
      px(l, mx - 6, my - 26, GUN[2], 10, 5);
      ln(l, mx - 4, my - 26, mx - 8, my - 33, GUN[1], 2);
      px(l, mx + 3, my - 12, GUN[2], 5, 2);
      px(l, mx - 5, my - 9, ALU[4], 9, 2);
    }, { rect: [mx - 12, my - 36, mx + 12, my + 4] });
    const [cx, cy] = p.P(2.62, 0.5, tz);
    layer(p.c, (l) => {
      px(l, cx - 8, cy - 8, '#d8dce4', 16, 8);
      px(l, cx - 8, cy - 8, '#f2f4f6', 3, 8);
      ell(l, cx, cy - 9, 8, 4, '#b8bec8');
      ell(l, cx, cy - 10, 6, 3, '#e8ecf2');
      px(l, cx + 4, cy - 5, GUN[3], 3, 2);
    }, { rect: [cx - 11, cy - 15, cx + 11, cy + 2] });
    for (let i = 0; i < 6; i++) {
      const [vx, vy] = p.P(1.86 + (i % 3) * 0.07, 0.72 + Math.floor(i / 3) * 0.08, tz);
      px(p.c, vx - 1, vy - 6, '#e8f4f8', 3, 6);
      px(p.c, vx - 1, vy - 7, ['#e04a3c', '#46b456', '#f2c43a'][i % 3], 3, 2);
    }
    const [tx, ty] = p.P(0.18, 0.66, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[tx - 6, ty + 1], [tx + 4, ty - 4], [tx + 10, ty - 1], [tx, ty + 4]], '#20242e');
      fillPoly(l, [[tx - 4, ty + 1], [tx + 4, ty - 3], [tx + 8, ty - 1], [tx, ty + 3]], '#2a5a8a');
    }, { rect: [tx - 8, ty - 6, tx + 12, ty + 6] });
    void k;
  },
  anim(p, k) {
    // the water sphere wobbles; the centrifuge light blinks
    const [wx, wy] = p.P(0.84, 0.52, 7.9 + 4.4);
    const s = s4(p);
    const w = Math.sin(k.t * 2.3) * 0.8;
    p.c.globalAlpha = 0.85;
    ell(p.c, wx, wy - w * s, (6 + w) * s, (6 - w) * s, '#5090cc');
    ell(p.c, wx - 2 * s, wy - 3 * s, 2 * s, 2 * s, '#c8e8ff');
    p.c.globalAlpha = 1;
    const [cx, cy] = p.P(2.62, 0.5, 7.9);
    if (Math.sin(k.t * 9) > 0) px(p.c, cx + 4 * s, cy - 5 * s, GREEN[6], Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(s)));
  },
};

// ── hydroponics: two trays of greens under magenta grow lights ──
const LEAF: Ramp = ['#1a3a22', '#22502a', '#2e6a32', '#3e843a', '#56a046', '#78bc56', '#a2d870'];
const KALE: Ramp = ['#2a1a3a', '#3e2650', '#563468', '#6e4a7e', '#8a6294', '#a87eaa', '#c8a0c4'];
/** leaves under magenta grow light: their lit tips go pink */
const LEAF_M: Ramp = ['#183022', '#1f442a', '#2a5c32', '#3a763e', '#58904e', '#94a87a', '#d8a8d0'];
const hydro: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.06, 0.12, W - 0.06, 0.94, 16, 0.32);
    // the reservoir cabinet: a level window with bubbles, a small plant screen
    lbox(p, 0.08, 0.16, W - 0.16, 0.7, 0, 4.2, { front: shield(WHITE, 30, 16), side: shield(WHITE, 24, 16), top: tone(WHITE), edge: WHITE[0] });
    const F = front(p, 0.86);
    pq(p, F, 0.22, 0.92, 0.9, 3.5, GUN[1]);
    pq(p, F, 0.25, 0.89, 1.1, 2.4, '#2c62aa');
    pq(p, F, 0.25, 0.89, 2.25, 2.4, '#7ab4e6');
    for (let i = 0; i < 5; i++) {
      const [bx, by] = F.F(0.32 + i * 0.12, 1.4 + (i % 3) * 0.3);
      px(p.c, bx, by, '#a8d8f8');
    }
    pq(p, F, 1.08, 1.82, 1.8, 3.4, GUN[1]);
    pq(p, F, 1.11, 1.79, 2, 3.2, SCREEN);
    for (let i = 0; i < 4; i++) pq(p, F, 1.16 + i * 0.16, 1.26 + i * 0.16, 2.3, 2.9 + (i % 2) * 0.2, i === 2 ? AMBER[4] : GREEN[4]);
    // slim uprights and the two trays
    for (const a of [0.1, W - 0.16]) for (const b of [0.18, 0.8]) lbox(p, a, b, 0.06, 0.06, 4.2, b < 0.5 ? 16.4 : 8.6, mono(tone(ALU), GUN[1]));
    const tray = (z: number, seed: number, light: number) => {
      lbox(p, 0.12, 0.2, W - 0.24, 0.64, z, 0.9, { front: flat(WHITE), side: flat(WHITE), top: tone(['#141a16', '#1c241e', '#243028', '#2c3a30', '#344436', '#3c4e3e', '#46584a'], -1), edge: WHITE[0] });
      const F2 = front(p, 0.84);
      pq(p, F2, 0.14, W - 0.14, z + 0.3, z + 0.5, '#46b456');
      // the plants, lit pink from the grow light above
      const Rn = rng(seed);
      const box = (() => {
        const a = p.P(0.1, 1.0, z);
        const b = p.P(W, 0.2, z + 9);
        return [Math.min(a[0], b[0]) - 24, Math.min(a[1], b[1]) - 24, Math.max(a[0], b[0]) + 24, Math.max(a[1], b[1]) + 10] as [number, number, number, number];
      })();
      layer(p.c, (l) => {
        for (let r = 0; r < 2; r++)
          for (let i = 0; i < 4; i++) {
            const [x, y] = p.P(0.3 + i * 0.44 + r * 0.2, 0.36 + r * 0.3, z + 0.9);
            const kind = (i + r * 2 + seed) % 4;
            if (kind === 3) {
              // a cherry-tomato plant: a stem, leaves, red fruit
              ln(l, x, y, x + 1, y - 26, LEAF[2], 2);
              const m: Mass[] = [{ x: x - 7, y: y - 16, rx: 8, ry: 6, z: 0 }, { x: x + 7, y: y - 22, rx: 8, ry: 6, z: 1 }, { x: x - 1, y: y - 29, rx: 7, ry: 5.5, z: 2 }];
              foliage(l, m, LEAF_M, seed + i * 3 + r, { cell: 2.6, dots: ['#e04a3c', '#f2683c', '#ff8a5a'], dotChance: 0.9, dotSize: 4 });
            } else {
              const m: Mass[] = [];
              const sz = kind === 1 ? 1.2 : 1;
              for (let j = 0; j < 6; j++) m.push({ x: x - 9 + (j % 3) * 9 + (Rn() - 0.5) * 3, y: y - 6 - Math.floor(j / 3) * 7 - (j % 3 === 1 ? 3 : 0), rx: 8 * sz, ry: 6 * sz, z: j });
              foliage(l, m, kind === 1 ? KALE : LEAF_M, seed * 7 + i + r * 11, { cell: 2.6, tilt: 0.32 });
            }
          }
        // a few trailing leaves over the tray's front lip
        for (let i = 0; i < 5; i++) {
          const [x, y] = p.P(0.3 + i * 0.36, 0.86, z + 0.6);
          for (let q = 0; q < 4 + (i % 3) * 2; q++) px(l, x + (q % 3 === 2 ? 1 : 0), y + q, LEAF[3 + (q & 1)]);
        }
      }, { rect: box });
      // the grow light's magenta wash on the leaves
      p.c.globalAlpha = 0.12 * light;
      const [x0, y0] = p.P(0.12, 0.84, z + 4);
      const [x1, y1] = p.P(W - 0.12, 0.2, z + 4);
      halo(p.c, (x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2 + 6, 18, '#ff58e0', 1);
      p.c.globalAlpha = 1;
    };
    tray(4.2, k.seed * 3 + 1, 1);
    // the grow light bar over the lower tray (under the upper one)
    const bar = (z: number) => {
      lbox(p, 0.14, 0.3, W - 0.28, 0.36, z, 0.5, { front: flat(GUN), side: flat(GUN), top: flat(GUN), edge: GUN[0] });
      const G = front(p, 0.66);
      pq(p, G, 0.16, W - 0.16, z - 0.25, z, '#ff8aec');
      for (let a = 0.2; a < W - 0.2; a += 0.08) {
        const [lx, ly] = G.F(a, z - 0.12);
        px(p.c, lx, ly, Math.round(a * 12.5) % 3 === 0 ? '#7a9aff' : '#ff4a7a');
      }
    };
    bar(11.4);
    tray(11.9, k.seed * 3 + 2, 0.8);
    // the upper light: a slim bar along the back on two arms, the top left open
    for (const a of [0.13, W - 0.13]) {
      const [x0, y0] = p.P(a, 0.21, 17.8);
      const [x1, y1] = p.P(a, 0.21, 20.6);
      ln(p.c, x0, y0, x1, y1, ALU[3], 2);
    }
    lbox(p, 0.12, 0.16, W - 0.24, 0.16, 20.4, 0.6, { front: flat(GUN), side: flat(GUN), top: flat(GUN), edge: GUN[0] });
    const G2 = front(p, 0.32);
    pq(p, G2, 0.14, W - 0.14, 20.15, 20.4, '#ff8aec');
    // tubing up the side, a nutrient bag hanging, a spray bottle on the cabinet
    const [ux, uy] = p.P(W - 0.1, 0.6, 1);
    const [vx, vy] = p.P(W - 0.1, 0.6, 15.5);
    ln(p.c, ux + 2, uy, vx + 2, vy, '#a8d8f0');
    ln(p.c, ux + 3, uy, vx + 3, vy, '#5090cc');
    const [bx, by] = p.P(W - 0.04, 0.42, 13);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 3, by - 10], [bx + 5, by - 12], [bx + 5, by + 2], [bx - 3, by + 4]], '#e8f0d8');
      fillPoly(l, [[bx - 2, by - 4], [bx + 4, by - 6], [bx + 4, by + 1], [bx - 2, by + 3]], '#9ac86a');
    }, { rect: [bx - 6, by - 16, bx + 8, by + 6] });
  },
};

// ── the floor docking port ───────────────────────────────────
const hatch: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    // a raised square collar with bolts, then the round hatch
    lbox(p, 0.04, 0.04, W - 0.08, D - 0.08, 0, 0.6, { front: flat(GUN), side: flat(GUN), top: plating(GUN, 16, 16, 6), edge: GUN[0] });
    const [cx, cy] = p.P(W / 2, D / 2, 0.6);
    const s = s4(p);
    const R0 = 0.82 * 90.5 * s * (W / 2);
    const ry = R0 * 0.5;
    layer(p.c, (l) => {
      // the collar ring, the hatch door dished in concentric rings
      ell(l, cx, cy + 3 * s, R0, ry, GUN[0]);
      ell(l, cx, cy, R0, ry, ALU[3]);
      ell(l, cx, cy - 1 * s, R0 - 3 * s, ry - 1.5 * s, ALU[5]);
      ell(l, cx, cy, R0 - 9 * s, ry - 4.5 * s, GUN[2]);
      for (let r = 0; r < 4; r++) ell(l, cx, cy, R0 - (12 + r * 9) * s, ry - (6 + r * 4.5) * s, r % 2 ? ALU[3] : ALU[4]);
      ell(l, cx - 6 * s, cy - 4 * s, R0 * 0.3, ry * 0.25, ALU[5]);
      // latches round the rim
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        px(l, cx + Math.cos(a) * (R0 - 6 * s) - 2 * s, cy + Math.sin(a) * (ry - 3 * s) - s, GUN[1], 4 * s, 3 * s);
        px(l, cx + Math.cos(a) * (R0 - 6 * s) - 2 * s, cy + Math.sin(a) * (ry - 3 * s) - s, ALU[6], 4 * s, s);
      }
      // the hand wheel at the centre: rim and spokes
      ell(l, cx, cy - 2 * s, 16 * s, 8 * s, AMBER[2]);
      ell(l, cx, cy - 3 * s, 16 * s, 8 * s, AMBER[4]);
      ell(l, cx, cy - 3 * s, 12 * s, 6 * s, ALU[3]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ln(l, cx, cy - 3 * s, cx + Math.cos(a) * 13 * s, cy - 3 * s + Math.sin(a) * 6.5 * s, AMBER[3], Math.max(1, Math.round(2 * s)));
      }
      ell(l, cx, cy - 3 * s, 3 * s, 2 * s, GUN[2]);
    }, { rect: [cx - R0 - 6, cy - ry - 8, cx + R0 + 6, cy + ry + 8] });
    // stencil on the collar
    const [lx, ly] = p.P(0.3, D - 0.12, 0.6);
    for (let i = 0; i < 6; i++) px(p.c, lx + i * 3, ly - 1 + i * 1.5, '#e8ecf2', 2, 2);
    void k;
  },
  anim(p, k) {
    // guide lights at the four corners, chasing
    const s = Math.max(1, Math.round(s4(p)));
    const pts: [number, number][] = [[0.18, 0.18], [k.w - 0.18, 0.18], [k.w - 0.18, k.d - 0.18], [0.18, k.d - 0.18]];
    const on = Math.floor(k.t * 2.5) % 4;
    pts.forEach(([a, b], i) => {
      const [x, y] = p.P(a, b, 0.6);
      const c = i === on ? '#c2f6f6' : '#1f7482';
      px(p.c, x - s, y - s, c, 3 * s, 2 * s);
      if (i === on) {
        p.c.globalAlpha = 0.3;
        px(p.c, x - 3 * s, y - 3 * s, '#7adde2', 7 * s, 6 * s);
        p.c.globalAlpha = 1;
      }
    });
  },
};

// ── the holo-table ───────────────────────────────────────────
const hologram: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    footShadow(p, 0.3, 0.3, W - 0.3, D - 0.3, 10, 0.3);
    // the pedestal: a fluted column with a lit foot ring
    cyl(p, cx, cb, 0, cx, cb, 0.6, 0.55, { ramp: GUN, cap: GUN, spec: 0.3 });
    cyl(p, cx, cb, 0.6, cx, cb, 7, 0.34, {
      ramp: GUN,
      spec: 0.6,
      tex: (_t, ang) => (Math.abs(((ang / (Math.PI * 2)) * 16) % 1) < 0.18 ? -1.2 : 0),
      cap: false,
    });
    const [fx, fy] = p.P(cx, cb, 0.65);
    ell(p.c, fx, fy + 1, 42, 20, '#0e3a44');
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      if (Math.sin(a) > -0.2) px(p.c, fx + Math.cos(a) * 38, fy + Math.sin(a) * 18, CYAN[i % 3 ? 4 : 6]);
    }
    // the octagonal top: a dark glass slab with a cyan grid and an edge light
    const R0 = 0.86;
    const oct = (r: number, z: number): [number, number, number][] => Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [cx + Math.cos(a) * r, cb + Math.sin(a) * r, z] as [number, number, number];
    });
    // rim faces (front-facing ones), then the top
    const top = oct(R0, 7.8);
    const bot = oct(R0, 7);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const am = ((i + 0.5) / 8) * Math.PI * 2 + Math.PI / 8;
      const nx = Math.cos(am);
      const ny = Math.sin(am);
      const wx = p.rot === 0 ? nx : ny;
      const wy = p.rot === 0 ? ny : -nx;
      if (wx + wy <= 0) continue;
      const shade = wy * 0.62 - wx * 0.34;
      poly3(p, [bot[i], bot[j], top[j], top[i]], (_u: number, v: number) => (v > 2 ? CYAN[5] : at(GUN, 2 + shade * 2.5)), 1);
    }
    poly3(p, top, (u: number, v: number, x: number, y: number) => {
      if ((u % 12 < 1 || v % 12 < 1) && hash(x, y, 311) < 0.8) return '#164a56';
      return bayer(x, y) > 0.86 ? '#12303a' : '#0c1c26';
    }, 2);
    // the emitter lens in the centre
    const [ex, ey] = p.P(cx, cb, 7.8);
    ell(p.c, ex, ey, 12, 6, GUN[1]);
    ell(p.c, ex, ey - 1, 9, 4.5, CYAN[3]);
    ell(p.c, ex - 2, ey - 2, 4, 2, CYAN[6]);
    // a faint cone of light above it
    halo(p.c, ex, ey - 36, 34, 40, '#7adde2', 0.16);
    // tablets and a coffee pouch left on the table's edge
    const [tx, ty] = p.P(cx + 0.45, cb + 0.45, 7.8);
    fillPoly(p.c, [[tx - 8, ty], [tx + 2, ty - 5], [tx + 9, ty - 2], [tx - 1, ty + 3]], '#20242e');
    fillPoly(p.c, [[tx - 6, ty], [tx + 2, ty - 4], [tx + 7, ty - 2], [tx - 1, ty + 2]], '#2c6a8a');
    void k;
  },
  anim(p, k) {
    // the projection: a cone of light, a turning wireframe planet, its orbit ring, the station's blip, data cards
    const W = k.w;
    const D = k.d;
    const [ex, ey] = p.P(W / 2, D / 2, 7.9);
    const [cx, cy] = p.P(W / 2, D / 2, 14.6);
    const s = s4(p);
    const R0 = 32 * s;
    const ry = 28 * s;
    const t = k.t * 0.35;
    const c = p.c;
    const S = Math.max(1, Math.round(s));
    // the light cone from the emitter
    c.globalAlpha = 0.1;
    c.fillStyle = '#7adde2';
    for (let yy = Math.round(cy + ry * 0.6); yy < ey; yy += 1) {
      const f = (yy - (cy + ry * 0.6)) / Math.max(1, ey - (cy + ry * 0.6));
      const hw = R0 * 0.8 * (1 - f) + 8 * s * f;
      c.fillRect(Math.round(ex - hw), yy, Math.round(hw * 2), 1);
    }
    // the globe's glow, latitude rings, turning meridians
    c.globalAlpha = 0.14;
    ell(c, cx, cy, R0 + 6 * s, ry + 6 * s, '#45bcc4');
    c.globalAlpha = 0.16;
    ell(c, cx, cy, R0, ry, '#7adde2');
    c.globalAlpha = 0.9;
    for (let lat = -2; lat <= 2; lat++) {
      const yy = (lat / 3) * ry;
      const rr = R0 * Math.sqrt(1 - (lat / 3) ** 2);
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * Math.PI * 2;
        const front = Math.sin(a) > 0;
        if (!front && i % 2) continue;
        px(c, cx + Math.cos(a) * rr, cy + yy + Math.sin(a) * rr * 0.16, front ? '#a8f0f4' : '#2c98a4', S, S);
      }
    }
    for (let m = 0; m < 8; m++) {
      const lon = t + (m / 8) * Math.PI;
      const cosL = Math.cos(lon);
      const front = Math.sin(lon) > 0;
      for (let i = 0; i < 22; i++) {
        if (!front && i % 2) continue;
        const b = -Math.PI / 2 + (i / 21) * Math.PI;
        px(c, cx + Math.cos(b) * cosL * R0, cy + Math.sin(b) * ry, front ? '#7adde2' : '#1f7482', S, S);
      }
    }
    // continents: clusters of bright cells drifting with the rotation
    for (let i = 0; i < 70; i++) {
      const lon = t + hash(i % 9, 1, 7) * Math.PI * 2 + (hash(i, 3, 7) - 0.5) * 0.5;
      const lat = (hash(i % 9, 2, 7) - 0.5) * 2 + (hash(i, 4, 7) - 0.5) * 0.4;
      if (Math.sin(lon) < 0.05) continue;
      px(c, cx + Math.cos(lon) * Math.cos(lat) * R0 * 0.94, cy + Math.sin(lat) * ry * 0.94, '#e8ffff', 2 * S, 2 * S);
    }
    // the orbit ring and the station with a short trail
    c.globalAlpha = 0.75;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      if (i % 2) px(c, cx + Math.cos(a) * R0 * 1.5, cy + Math.sin(a) * ry * 0.4 - Math.cos(a) * 6 * s, '#f2a83e', S, S);
    }
    const a0 = k.t * 0.9;
    for (let j = 0; j < 5; j++) {
      const a = a0 - j * 0.07;
      c.globalAlpha = 0.95 - j * 0.17;
      px(c, cx + Math.cos(a) * R0 * 1.5 - S, cy + Math.sin(a) * ry * 0.4 - Math.cos(a) * 6 * s - S, j ? '#f8c46a' : '#fff4d0', (j ? 2 : 3) * S, (j ? 2 : 3) * S);
    }
    // two floating data cards
    c.globalAlpha = 0.32;
    px(c, cx - R0 - 28 * s, cy - 22 * s, '#45bcc4', Math.round(20 * s), Math.round(13 * s));
    px(c, cx + R0 + 10 * s, cy - 8 * s, '#45bcc4', Math.round(17 * s), Math.round(11 * s));
    c.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) px(c, cx - R0 - 26 * s, cy - (20 - i * 3.5) * s, '#c2f6f6', Math.round((9 + (i * 5) % 7) * s), S);
    for (let i = 0; i < 2; i++) px(c, cx + R0 + 12 * s, cy - (6 - i * 3.5) * s, '#c2f6f6', Math.round((11 - i * 3) * s), S);
    // a scanline sweeping up the globe
    const sl = ((k.t * 0.6) % 1) * 2 - 1;
    c.globalAlpha = 0.4;
    const hw = R0 * Math.sqrt(Math.max(0, 1 - sl * sl));
    px(c, cx - hw, cy + sl * ry, '#e8ffff', Math.round(2 * hw), S);
    c.globalAlpha = 1;
  },
};

// ── the crew lounge: a padded module bench ───────────────────
/** A cushion's top: puffed, brighter toward the middle, a piped seam round the edge. */
const puff =
  (r: Ramp): Mat =>
  (light, w, h) =>
  (u, v, x, y) => {
    const e = Math.min(u / w, 1 - u / w, v / h, 1 - v / h);
    let i = (light === 2 ? 4.2 : light ? 3.4 : 2.2) + Math.min(0.25, e) * 4 - 0.6;
    if (e < 0.05) i -= 1.4;
    if (hash(x, y, 331) < 0.04) i -= 0.5;
    return at(r, i);
  };
/** A cushion's side: a rolled top edge, a seam, a shadowed foot. */
const roll =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = light ? 3 : 1.9;
    if (v > h - 2.5) i += 1.2;
    else if (v > h - 5) i += 0.5;
    if (v < 2.5) i -= 1;
    if (Math.abs(v - h * 0.45) < 0.6) i -= 0.7;
    if (hash(x, y, 332) < 0.04) i -= 0.5;
    void u;
    return at(r, i);
  };

const sofa: PropArt = {
  draw(p, k) {
    const W = k.w;
    const fab = rampAround(k.color ?? '#5e6aa8');
    footShadow(p, 0.06, 0.12, W - 0.06, 0.96, 9, 0.32);
    // a recessed plinth with a warm light strip, the aluminium shell with a high back
    lbox(p, 0.16, 0.26, W - 0.32, 0.58, 0, 1.2, mono(flat(GUN), GUN[0]));
    const P0 = front(p, 0.84);
    pq(p, P0, 0.2, W - 0.2, 0.3, 0.6, AMBER[5]);
    lbox(p, 0.06, 0.1, W - 0.12, 0.84, 1.2, 1.4, { front: brushedU(GUN, 0.6), side: brushedU(GUN, 0.6), top: tone(GUN, 1), edge: GUN[0] });
    lbox(p, 0.06, 0.06, W - 0.12, 0.14, 1.2, 8.6, { front: brushedU(GUN, 0.5), side: tone(GUN, -0.4), top: tone(ALU, 0.6), edge: GUN[0] });
    // three back cushions leaning on the shell, three puffed seat cushions
    const n = 3;
    const sw = (W - 0.56) / n;
    for (let i = 0; i < n; i++) {
      const a0 = 0.28 + i * sw + 0.02;
      const a1 = a0 + sw - 0.04;
      const q: [number, number, number][] = [[a0, 0.44, 4.6], [a1, 0.44, 4.6], [a1, 0.22, 10], [a0, 0.22, 10]];
      poly3(p, q, puff(fab), 1, [q[0], q[1], q[3]]);
      const [t0x, t0y] = p.P(a0, 0.22, 10);
      const [t1x, t1y] = p.P(a1, 0.22, 10);
      ln(p.c, t0x, t0y, t1x, t1y, fab[6], 2);
      // its right flank, in shade
      poly3(p, [[a1, 0.44, 4.6], [a1, 0.2, 4.6], [a1, 0.2, 10], [a1, 0.22, 10]], (_u: number, _v: number) => fab[1], 0);
    }
    for (let i = 0; i < n; i++) {
      const a0 = 0.28 + i * sw + 0.02;
      lbox(p, a0, 0.34, sw - 0.04, 0.58, 2.6, 2.2, { front: roll(fab), side: roll(fab), top: puff(fab), edge: fab[0] });
      // a lap strap with a buckle lying across each seat
      const [x0, y0] = p.P(a0 + 0.1, 0.9, 4.8);
      const [x1, y1] = p.P(a0 + sw - 0.14, 0.4, 4.8);
      ln(p.c, x0, y0, x1, y1, '#2a2c34', 2);
      const [bx, by] = p.P(a0 + sw * 0.5, 0.65, 4.8);
      px(p.c, bx - 2, by - 2, ALU[5], 4, 3);
    }
    // padded arms with cup holders
    for (const a of [0.06, W - 0.28]) {
      lbox(p, a, 0.1, 0.22, 0.82, 2.6, 3.8, { front: roll(fab), side: roll(fab), top: puff(fab), edge: fab[0] });
      const [hx, hy] = p.P(a + 0.11, 0.72, 6.2);
      ell(p.c, hx, hy, 3, 1.6, GUN[0]);
      px(p.c, hx - 2, hy - 1, ALU[4], 1, 1);
    }
    // a pillow with a mission patch, a tablet on the seat, a fleece throw over the arm
    const [px0, py0] = p.P(0.6, 0.48, 4.9);
    layer(p.c, (l) => {
      fillPoly(l, [[px0 - 9, py0 + 2], [px0 + 7, py0 - 6], [px0 + 9, py0 - 18], [px0 - 7, py0 - 11]], '#d8c8a0');
      fillPoly(l, [[px0 - 8, py0 + 1], [px0 + 6, py0 - 6], [px0 + 8, py0 - 17], [px0 - 6, py0 - 10]], '#efe2c0');
      ell(l, px0, py0 - 8, 4, 4, '#2a4a8a');
      ell(l, px0, py0 - 8, 2.5, 2.5, '#e8c040');
    }, { rect: [px0 - 12, py0 - 22, px0 + 12, py0 + 4] });
    const [tx, ty] = p.P(W * 0.55, 0.64, 4.75);
    fillPoly(p.c, [[tx - 7, ty], [tx + 2, ty - 4], [tx + 8, ty - 1], [tx - 1, ty + 3]], '#20242e');
    fillPoly(p.c, [[tx - 5, ty], [tx + 2, ty - 3], [tx + 6, ty - 1], [tx - 1, ty + 2]], '#8a5aa8');
    const [kx, ky] = p.P(W - 0.17, 0.6, 6.2);
    layer(p.c, (l) => {
      fillPoly(l, [[kx - 9, ky - 3], [kx + 7, ky - 10], [kx + 10, ky + 8], [kx - 5, ky + 14]], '#c8582a');
      for (let i = 0; i < 4; i++) ln(l, kx - 7 + i * 4, ky - 3 - i * 1.6, kx - 3 + i * 4, ky + 12 - i * 1.6, '#a8441e');
    }, { rect: [kx - 12, ky - 14, kx + 14, ky + 18] });
  },
};

// ── the galley: hot-water dispenser and food warmer ──────────
const dispenser: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.9, 0.9, 18, 0.3);
    lbox(p, 0.12, 0.16, 0.76, 0.7, 0, 0.8, mono(flat(GUN), GUN[0]));
    lbox(p, 0.1, 0.12, 0.8, 0.74, 0.8, 18, { front: brushedU(ALU, 0.75), side: plating(ALU, 20, 26, 12), top: tone(ALU, 1), edge: GUN[1] });
    const F = front(p, 0.86);
    // menu display
    pq(p, F, 0.2, 0.8, 15.4, 17.8, GUN[1]);
    pq(p, F, 0.23, 0.77, 15.6, 17.6, SCREEN);
    // the dispensing alcove with a nozzle and a drink pouch under it
    pq(p, F, 0.22, 0.78, 8.6, 14.4, GUN[1]);
    pq(p, F, 0.26, 0.74, 8.8, 14.2, '#1a1e28');
    pq(p, F, 0.42, 0.58, 13.2, 14.2, ALU[2]);
    pq(p, F, 0.47, 0.53, 12.6, 13.2, ALU[4]);
    pq(p, F, 0.38, 0.62, 8.8, 9.2, ALU[3]);
    const [cx, cy] = F.F(0.5, 9.2);
    layer(p.c, (l) => {
      fillPoly(l, [[cx - 6, cy], [cx + 6, cy], [cx + 7, cy - 12], [cx + 3, cy - 15], [cx - 3, cy - 15], [cx - 7, cy - 12]], '#d8d0b8');
      fillPoly(l, [[cx - 5, cy - 1], [cx - 2, cy - 1], [cx - 3, cy - 13], [cx - 6, cy - 11]], '#efe8d4');
      px(l, cx - 4, cy - 8, '#6a3a1e', 8, 3);
      px(l, cx - 1, cy - 19, GUN[3], 2, 4);
    }, { rect: [cx - 9, cy - 22, cx + 9, cy + 2] });
    // buttons: hot, ambient, cold
    for (const [i, c] of [[0, RED[4]], [1, '#e8ecf2'], [2, CYAN[4]]] as const) pq(p, F, 0.27 + i * 0.17, 0.39 + i * 0.17, 14.6, 15.1, c);
    // the food warmer drawer with an orange window, storage below
    pq(p, F, 0.18, 0.82, 4.6, 8.2, GUN[2]);
    pq(p, F, 0.3, 0.7, 5.6, 7.4, '#5a2a10');
    pq(p, F, 0.32, 0.68, 5.8, 7.2, '#e88a3a');
    pq(p, F, 0.4, 0.6, 7.8, 8.05, ALU[5]);
    pq(p, F, 0.18, 0.82, 1.2, 4.2, GUN[3]);
    pq(p, F, 0.42, 0.58, 3.4, 3.7, ALU[5]);
    // on top: a stack of food pouches and a bag of tortillas; condiments on velcro on the side
    const [tx, ty] = p.P(0.42, 0.5, 18.8);
    layer(p.c, (l) => {
      for (let i = 0; i < 4; i++) {
        const c = ['#9aa2b0', '#c8ced8', '#a8b0bc', '#dce0e6'][i];
        fillPoly(l, [[tx - 12, ty - i * 3], [tx, ty - 6 - i * 3], [tx + 12, ty - i * 3], [tx, ty + 6 - i * 3]], c);
        px(l, tx - 3, ty - 1 - i * 3, ['#e04a3c', '#46b456', '#f2a83e', '#5090cc'][i], 6, 2);
      }
      fillPoly(l, [[tx + 6, ty - 14], [tx + 18, ty - 20], [tx + 26, ty - 16], [tx + 14, ty - 10]], '#f2e6c8');
      ell(l, tx + 16, ty - 15, 4, 2, '#d8b878');
    }, { rect: [tx - 14, ty - 26, tx + 30, ty + 8] });
    const S = side(p, 0.9);
    for (let i = 0; i < 4; i++) pq(p, S, 0.24 + i * 0.13, 0.34 + i * 0.13, 10 + (i % 2), 11.2 + (i % 2), ['#e04a3c', '#f2c43a', '#e04a3c', '#8a5a2a'][i]);
    void k;
  },
  anim(p, k) {
    // steam curling from the pouch's straw, the menu cursor
    const F = front(p, 0.86);
    const [x, y] = F.F(0.5, 13);
    const s = s4(p);
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.5 + i / 3) % 1;
      p.c.globalAlpha = 0.3 * (1 - t);
      ell(p.c, x + Math.sin(t * 6 + i) * 2 * s, y - t * 12 * s, (1 + t * 2) * s, (1 + t * 1.5) * s, '#ffffff');
    }
    p.c.globalAlpha = 1;
    const row = Math.floor(k.t * 0.7) % 3;
    const [mx, my] = F.F(0.26, 17.2 - row * 0.6);
    const S = Math.max(1, Math.round(s));
    px(p.c, mx, my, CYAN[5], 14 * S, S);
    for (let i = 0; i < 3; i++) {
      if (i === row) continue;
      const [ax, ay] = F.F(0.26, 17.2 - i * 0.6);
      px(p.c, ax, ay, CYAN[2], 10 * S, S);
    }
  },
};

// ── crew locker ──────────────────────────────────────────────
const cabinet: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 18, 0.3);
    const BLUE: Ramp = ['#1e2440', '#283058', '#343e70', '#424e86', '#54609c', '#6a76b0', '#8490c4'];
    lbox(p, 0.12, 0.14, 0.76, 0.72, 0, 0.7, mono(flat(GUN), GUN[0]));
    lbox(p, 0.1, 0.12, 0.8, 0.74, 0.7, 19, { front: flat(ALU), side: plating(ALU, 22, 30, 13), top: tone(ALU, 1), edge: GUN[1] });
    const F = front(p, 0.86);
    // the door: a padded panel, vents top and bottom, name tag, handle, a patch sticker and a photo
    pq(p, F, 0.16, 0.84, 1.2, 19.2, GUN[2]);
    pt(p, F, 0.2, 0.8, 4, 16, quilt(BLUE, 11), F.light);
    pt(p, F, 0.24, 0.76, 1.6, 3.4, grille(GUN, 3), F.light);
    pt(p, F, 0.24, 0.76, 16.8, 18.6, grille(GUN, 3), F.light);
    pq(p, F, 0.26, 0.66, 14.6, 15.6, '#f2f4f6');
    pq(p, F, 0.26, 0.36, 14.6, 15.6, k.seed % 2 ? AMBER[4] : CYAN[4]);
    for (let i = 0; i < 4; i++) pq(p, F, 0.4 + i * 0.06, 0.44 + i * 0.06, 14.9, 15.3, '#3a3e48');
    pq(p, F, 0.72, 0.78, 8, 11, ALU[5]);
    pq(p, F, 0.74, 0.78, 8, 11, GUN[1]);
    const [sx, sy] = F.F(0.4, 11.5);
    ell(p.c, sx, sy, 4, 4, '#2a4a8a');
    ell(p.c, sx, sy, 2.5, 2.5, '#e8c040');
    pq(p, F, 0.48, 0.64, 6.4, 8.6, '#fbfbf6');
    pq(p, F, 0.5, 0.62, 6.8, 8.4, '#6a9ac2');
    // on top: a white helmet with a gold visor and a folded jacket
    const [hx, hy] = p.P(0.5, 0.48, 19.7);
    const s = s4(p);
    layer(p.c, (l) => {
      fillPoly(l, [[hx - 12 * s, hy], [hx, hy - 6 * s], [hx + 12 * s, hy], [hx, hy + 6 * s]], '#3a4a6a');
      ell(l, hx + 2 * s, hy - 9 * s, 9 * s, 8 * s, WHITE[4]);
      ell(l, hx + 1 * s, hy - 10 * s, 7 * s, 6 * s, WHITE[6]);
      ell(l, hx + 4 * s, hy - 8 * s, 5 * s, 4 * s, GOLD[3]);
      px(l, hx + 2 * s, hy - 10 * s, GOLD[6], 2 * s, s);
    }, { rect: [hx - 14 * s, hy - 20 * s, hx + 14 * s, hy + 8 * s] });
  },
};

// ── pods: an open sleep station and a suit locker behind glass ──
const pod: PropArt = {
  draw(p, k) {
    const sleep = k.seed % 2 === 0;
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 20, 0.32);
    const cx = 0.5;
    const cb = 0.5;
    const r = 0.42;
    cyl(p, cx, cb, 0, cx, cb, 0.9, r + 0.04, { ramp: GUN, cap: GUN, spec: 0.3 });
    const front0 = Math.PI / 2 + (p.rot === 0 ? 0 : 0);
    const SLEEP: Ramp = ['#14203e', '#1c2c56', '#263a70', '#324a8a', '#425ea4', '#5674bc', '#708ed0'];
    cyl(p, cx, cb, 0.9, cx, cb, 18, r, {
      ramp: WHITE,
      spec: 0.7,
      cap: false,
      tex: (t, ang, x, y) => {
        // the front opening spans ±0.62 rad round +b and t 0.3 … 1.5 m
        const da = Math.atan2(Math.sin(ang - front0), Math.cos(ang - front0));
        const z = t * 10 + 0.9;
        if (Math.abs(da) < 0.62 && z > 2.6 && z < 16.2) {
          const fu = da / 0.62;
          const fz = (z - 2.6) / 13.6;
          if (Math.abs(fu) > 0.9 || fz < 0.04 || fz > 0.96) return '#2a2e3a';
          if (sleep) {
            // inside: a sleeping bag strapped to the back wall, a pillow, a reading lamp, photos
            if (Math.abs(fu) < 0.5 && fz > 0.1 && fz < 0.86) {
              if (fz > 0.72) return fz > 0.8 ? '#e8e2d0' : '#d0c8b0';
              const fold = (Math.floor(fz * 12) & 1) === 0;
              return SLEEP[(fold ? 3 : 4) + (fu < -0.2 ? 1 : 0) - (fu > 0.3 ? 1 : 0)];
            }
            if (fz > 0.86 && fu > 0.5) return '#ffe2a0';
            if (fu < -0.55 && fz > 0.55 && fz < 0.7) return (x + y) % 3 ? '#6a9ac2' : '#f2f2ec';
            return bayer(x, y) > 0.7 ? '#3a3e4c' : '#2e3240';
          }
          // the suit locker: tinted glass with the suit inside
          if (fz > 0.78 && Math.abs(fu) < 0.34) return Math.hypot(fu * 1.4, fz - 0.88) < 0.12 ? GOLD[4] : WHITE[5];
          if (fz > 0.42 && fz <= 0.78 && Math.abs(fu) < 0.42) return Math.abs(fu) < 0.12 && fz > 0.6 ? '#c8ccd4' : WHITE[Math.abs(fu) > 0.3 ? 3 : 4];
          if (fz > 0.08 && fz <= 0.42 && Math.abs(fu) < 0.3 && Math.abs(Math.abs(fu) - 0.15) > 0.04) return WHITE[3];
          if ((fu * 0.9 + fz * 2.2) % 0.7 < 0.08) return '#a8d8e8';
          return bayer(x, y) > 0.6 ? '#1c3a48' : '#16303c';
        }
        // panel rings and a name stripe
        if (Math.abs(((t * 10) % 5.6) - 0.3) < 0.18) return -1.4;
        if (Math.abs(da - 0.95) < 0.12 && z > 10 && z < 12.4) return sleep ? AMBER[4] : CYAN[4];
        return 0;
      },
    });
    // the dome cap with a vent, and the base ring's light strip
    ball(p, cx, cb, 18, r, r, 0.26, { ramp: WHITE, dome: true, spec: 0.8 });
    const [vx, vy] = p.P(cx, cb, 20.2);
    ell(p.c, vx, vy, 6, 3, GUN[2]);
    for (let i = -4; i <= 4; i += 2) px(p.c, vx + i, vy - 1, GUN[0], 1, 2);
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.1 + (i / 11) * Math.PI * 0.95;
      const [lx, ly] = p.P(cx + Math.cos(a) * (r + 0.05), cb + Math.sin(a) * (r + 0.05), 0.55);
      px(p.c, lx, ly, sleep ? AMBER[5] : CYAN[5]);
    }
    // a vitals display beside the opening
    const [dx, dy] = p.P(cx + Math.cos(front0 - 0.95) * r, cb + Math.sin(front0 - 0.95) * r, 12.6);
    px(p.c, dx - 3, dy - 6, GUN[1], 6, 8);
    px(p.c, dx - 2, dy - 5, SCREEN, 4, 6);
    px(p.c, dx - 2, dy - 2, GREEN[5], 4, 1);
  },
  anim(p, k) {
    if (k.seed % 2 !== 0) return;
    // the reading lamp's soft glow inside the sleep station
    const [x, y] = p.P(0.62, 0.86, 14.6);
    const s = s4(p);
    p.c.globalAlpha = 0.12 + Math.sin(k.t * 1.3) * 0.02;
    ell(p.c, x, y + 8 * s, 10 * s, 18 * s, '#ffe7a8');
    p.c.globalAlpha = 1;
  },
};

// ── a "Veggie" unit with red lettuce and orange zinnias ──────
const plant: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.12, 0.88, 0.88, 12, 0.32);
    // the base unit with its little screen
    lbox(p, 0.12, 0.14, 0.76, 0.72, 0, 3.6, { front: shield(WHITE, 20, 14), side: shield(WHITE, 18, 14), top: tone(WHITE), edge: WHITE[0] });
    const F = front(p, 0.86);
    pq(p, F, 0.2, 0.5, 1.2, 2.8, SCREEN);
    pq(p, F, 0.23, 0.34, 1.6, 2.2, GREEN[4]);
    pq(p, F, 0.58, 0.8, 2.2, 2.6, AMBER[4]);
    // the plant pillows: red lettuce at the front, zinnias rising behind
    const [x, y] = p.P(0.5, 0.52, 3.6);
    const s = s4(p);
    layer(p.c, (l) => {
      for (const [dx, h] of [[-7, 36], [2, 44], [9, 30], [-2, 26]] as const) {
        ln(l, x + dx * s, y - 4 * s, x + dx * s + s, y - h * s, '#3e843a', Math.max(1, Math.round(s)));
        const m: Mass[] = [{ x: x + dx * s - 3 * s, y: y - h * s + 12 * s, rx: 4 * s, ry: 2.8 * s, z: 0 }, { x: x + dx * s + 3 * s, y: y - h * s + 18 * s, rx: 4 * s, ry: 2.8 * s, z: 1 }];
        foliage(l, m, LEAF_M, k.seed + dx, { cell: 2 });
        // a zinnia: layered orange petals round a dark centre
        ell(l, x + dx * s, y - h * s, 6 * s, 4 * s, '#c8461a');
        ell(l, x + dx * s - s, y - h * s - s, 5 * s, 3.2 * s, '#ee6a26');
        ell(l, x + dx * s - 2 * s, y - h * s - 2 * s, 2.6 * s, 1.6 * s, '#ff9a4a');
        ell(l, x + dx * s, y - h * s, 1.6 * s, 1.2 * s, '#5a2a10');
      }
      const lettuce: Mass[] = [{ x: x - 9 * s, y: y - 6 * s, rx: 8 * s, ry: 5.5 * s, z: 0 }, { x: x + 9 * s, y: y - 5 * s, rx: 8 * s, ry: 5.5 * s, z: 1 }, { x, y: y - 3 * s, rx: 7 * s, ry: 5 * s, z: 2 }];
      foliage(l, lettuce, ['#3a1424', '#561c32', '#742842', '#8e3a4e', '#a8546a', '#6a9a4a', '#8ab45a'], k.seed + 3, { cell: 2.3 });
    }, { rect: [x - 30 * s, y - 56 * s, x + 30 * s, y + 6] });
    // the clear bellows with reflections, the LED lid glowing pink
    const glass = (u: number, v: number) => ((u * 0.7 + v) % 26 < 3 ? 'rgba(235,250,255,0.5)' : 'rgba(180,215,232,0.1)');
    poly3(p, [[0.14, 0.84, 3.6], [0.86, 0.84, 3.6], [0.86, 0.84, 15.2], [0.14, 0.84, 15.2]], glass, 1);
    poly3(p, [[0.86, 0.84, 3.6], [0.86, 0.16, 3.6], [0.86, 0.16, 15.2], [0.86, 0.84, 15.2]], glass, 0);
    for (const a of [0.14, 0.86]) for (const b of [0.16, 0.84]) {
      const [x0, y0] = p.P(a, b, 3.6);
      const [, y1] = p.P(a, b, 15.2);
      px(p.c, x0, y1, ALU[4], 1, Math.round(y0 - y1));
    }
    // the LED light bank on two arms over the back edge, glowing pink onto the plants
    for (const a of [0.16, 0.84]) {
      const [x0, y0] = p.P(a, 0.18, 3.6);
      const [x1, y1] = p.P(a, 0.18, 17.6);
      ln(p.c, x0, y0, x1, y1, ALU[3], 2);
    }
    lbox(p, 0.12, 0.12, 0.76, 0.2, 17.2, 0.8, { front: flat(GUN), side: flat(GUN), top: plating(GUN, 14, 8, 15), edge: GUN[0] });
    const G = front(p, 0.32);
    pq(p, G, 0.14, 0.86, 16.95, 17.2, '#ff8aec');
    const [hx, hy] = p.P(0.5, 0.5, 12);
    halo(p.c, hx, hy, 34, 26, '#ff6ae0', 0.12);
  },
};

// ── cargo: a hard case or a strapped stack of soft bags ──────
const crate: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 8, 0.3);
    const NOMEX: Ramp = ['#6a6250', '#857c66', '#a0967e', '#b8ae94', '#ccc3aa', '#ddd6c0', '#ebe6d4'];
    if (k.seed % 2) {
      // a hard cargo case: white body, blue lid, latches, a barcode label and hazard diamond
      lbox(p, 0.14, 0.18, 0.72, 0.64, 0, 5.6, { front: shield(WHITE, 22, 12), side: shield(WHITE, 20, 12), top: tone(WHITE, 0.5), edge: WHITE[0] });
      lbox(p, 0.12, 0.16, 0.76, 0.68, 5.6, 1.4, { front: flat(['#14203e', '#1c2c56', '#263a70', '#324a8a', '#425ea4', '#5674bc', '#708ed0']), side: flat(['#14203e', '#1c2c56', '#263a70', '#324a8a', '#425ea4', '#5674bc', '#708ed0']), top: plating(['#14203e', '#1c2c56', '#263a70', '#324a8a', '#425ea4', '#5674bc', '#708ed0'], 14, 14, 17), edge: '#0c1430' });
      const F = front(p, 0.82);
      pq(p, F, 0.22, 0.52, 2.2, 4.4, '#f6f4ec');
      for (let i = 0; i < 7; i++) pq(p, F, 0.24 + i * 0.035, 0.25 + i * 0.035, 2.6, 3.6, '#2a2a30');
      for (const a of [0.24, 0.72]) pq(p, F, a - 0.03, a + 0.03, 4.8, 6.2, ALU[5]);
      const [hx, hy] = F.F(0.68, 3.3);
      fillPoly(p.c, [[hx, hy - 5], [hx + 5, hy], [hx, hy + 5], [hx - 5, hy]], AMBER[4]);
      px(p.c, hx - 1, hy - 2, '#1c1e26', 2, 4);
      // a second, smaller case on top
      lbox(p, 0.26, 0.28, 0.46, 0.4, 7, 3.4, { front: shield(WHITE, 16, 10), side: shield(WHITE, 14, 10), top: plating(ALU, 12, 12, 18), edge: WHITE[0] });
      const G = front(p, 0.68);
      pq(p, G, 0.32, 0.5, 8.2, 9.4, '#f6f4ec');
      pq(p, G, 0.34, 0.42, 8.5, 9.1, RED[4]);
    } else {
      // soft cargo transfer bags, stacked and strapped with an orange cargo strap
      const bags: [number, number, number, number, number][] = [[0.12, 0.16, 0.76, 0.66, 0], [0.16, 0.2, 0.66, 0.58, 4.4], [0.22, 0.26, 0.52, 0.46, 8.4]];
      bags.forEach(([a, b, w, d, z], i) => {
        lbox(p, a, b, w, d, z, 4, { front: quilt(NOMEX, 30), side: quilt(NOMEX, 30), top: tone(NOMEX, 0.8), edge: NOMEX[0] });
        const F = front(p, b + d);
        pq(p, F, a + w * 0.1, a + w * 0.38, z + 1.4, z + 2.8, '#f6f4ec');
        for (let j = 0; j < 4; j++) pq(p, F, a + w * 0.12 + j * 0.04, a + w * 0.13 + j * 0.04, z + 1.7, z + 2.4, '#2a2a30');
        pq(p, F, a + w * 0.6, a + w * 0.9, z + 2.4, z + 3.2, i === 1 ? '#3a6aa0' : '#c8bfa6');
      });
      const F = front(p, 0.82);
      pq(p, F, 0.46, 0.56, 0, 8.4, AMBER[4]);
      pq(p, F, 0.46, 0.48, 0, 8.4, AMBER[6]);
      const S = side(p, 0.88);
      pq(p, S, 0.44, 0.54, 0, 8.4, AMBER[3]);
      const [bx, by] = F.F(0.51, 5);
      px(p.c, bx - 3, by - 2, ALU[5], 6, 4);
    }
  },
};

// ── the front walls: the module's hull, cut low ──────────────
const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 6.6;
    const T = 0.3;
    // outside: white shield panels over a gunmetal footing with a cyan livery band
    const fac: Mat = (light, w, h) => {
      const sh = shield(WHITE, 30, 30)(light, w, h);
      return (u, v, x, y) => {
        if (v < 6) return at(GUN, (light ? 3 : 2) + (u % 40 < 1 ? -1.5 : 0));
        if (v > 14 && v < 18) return at(CYAN, light ? 4 : 3);
        if (v > 18 && v < 19.2) return at(GUN, 1);
        return sh(u, v, x, y);
      };
    };
    // the cut: shield, pressure shell, gold foil, padding
    const cut: Mat = (_light) => (_u, v) => {
      const t = v / (T * 57.2);
      if (t < 0.22) return PAD[5];
      if (t < 0.55) return GOLD[4];
      if (t < 0.78) return ALU[4];
      return WHITE[5];
    };
    lbox(p, 0, 0, W, T, 0, Z, { front: fac, side: fac, top: cut, edge: GUN[0] });
    const F = front(p, T);
    // an EVA handrail on stand-offs, small portholes' lower rims, marker lights
    for (let a = 0.6; a < W - 0.3; a += 1.6) {
      const [x0, y0] = p.P(a, T, 4.2);
      const [x1, y1] = p.P(a, T + 0.08, 4.2);
      ln(p.c, x0, y0, x1, y1, GUN[4], 2);
    }
    const [r0x, r0y] = p.P(0.3, T + 0.08, 4.2);
    const [r1x, r1y] = p.P(W - 0.3, T + 0.08, 4.2);
    ln(p.c, r0x, r0y - 1, r1x, r1y - 1, AMBER[5], 2);
    ln(p.c, r0x, r0y + 1, r1x, r1y + 1, AMBER[2], 1);
    for (let a = 1.5; a < W - 0.5; a += 3) {
      pq(p, F, a - 0.32, a + 0.32, Z - 1, Z, GUN[1]);
      pq(p, F, a - 0.26, a + 0.26, Z - 0.7, Z, '#1a2636');
    }
    for (let a = 0.8; a < W; a += 2.4) {
      const [lx, ly] = F.F(a, 2.6);
      led(p.c, lx, ly, (Math.floor(a) & 1) === 0 ? GREEN : AMBER, 2);
    }
    // a run of cable along the foot, clipped
    const [c0x, c0y] = p.P(0, T + 0.1, 0.3);
    const [c1x, c1y] = p.P(W, T + 0.1, 0.3);
    ln(p.c, c0x, c0y, c1x, c1y, '#2a2c34', 2);
    void k;
  },
};

export const SPACE_ROOM: Record<string, PropArt> = {
  console: console_,
  labbench,
  hydro,
  hatch,
  hologram,
  sofa,
  dispenser,
  cabinet,
  pod,
  plant,
  crate,
  lowWall,
};


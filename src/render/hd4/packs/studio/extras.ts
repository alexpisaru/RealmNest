// Creative Studio — more life for the district.
//   std_tree       garden trees: tamarisk (feathery, pink plumes), frangipani
//                  (candelabra branches, cream-and-yellow flowers), sea grape tree
//   std_windbreak  a striped canvas windbreak on the beach
//   std_volley     a beach volleyball net with a ball in the sand
//   std_bin        a slatted timber litter bin
//   std_aboard     an A-board chalk sign (gelato, surf lessons, open studio)
import type { PropArt } from '../../../props';
import { contactShadow, curve, ell, fillPoly, foliage, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front3, pq, pt } from '../../plane4';
import type { Mat } from '../../../hd/kit';
import { at, hash } from '../../kit4';
import { mural } from './houses';
import { anchor, footShadow, lbox, mono } from '../util';
import { ALU, coat, CREAM, darken, DRIFT, lighten, PINE, pmod, TEAL, weathered } from './kit';

const TAMARISK: Ramp = ['#2e3e30', '#3c5040', '#4c6450', '#5e7862', '#728c74', '#8aa288', '#a4b8a0'];
const SEAGRAPE: Ramp = ['#22401e', '#2c5426', '#386a2e', '#468236', '#589a40', '#70b04c', '#90c460'];
const BARKG: Ramp = ['#3a3430', '#524a42', '#6a6056', '#82786c', '#9a9082', '#b2a898'];

const tree: PropArt = {
  draw(p, k) {
    const kind = k.variant ?? ['tamarisk', 'frangipani', 'seagrape'][pmod(k.seed + p.x * 3 + p.y, 3)];
    const [x, y] = anchor(p, k.w / 2, k.d / 2);
    const Rn = rng(k.seed * 23 + 9);
    const c = p.c;
    if (kind === 'frangipani') {
      contactShadow(c, x + 30, y + 8, 50, 16, 0.38);
      // a short grey trunk forking into thick candelabra branches with leaf rosettes at the tips
      const tips: [number, number][] = [];
      layer(c, (l) => {
        ln(l, x, y, x + 1, y - 38, BARKG[2], 7);
        ln(l, x - 2, y, x - 1, y - 38, BARKG[4], 2);
        const fork = (bx: number, by: number, a: number, len: number, w: number, depth: number) => {
          const ex = bx + Math.sin(a) * len;
          const ey = by - Math.cos(a) * len;
          ln(l, bx, by, ex, ey, BARKG[2], w);
          ln(l, bx - 1, by, ex - 1, ey, BARKG[4], 1);
          if (depth === 0) tips.push([ex, ey]);
          else for (const s of [-1, 1]) fork(ex, ey, a + s * (0.35 + Rn() * 0.3), len * 0.7, Math.max(2, w - 2), depth - 1);
        };
        for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) fork(x, y - 34, a, 26 + Rn() * 10, 6, 2);
      }, { outline: 0.6 });
      layer(c, (l) => {
        const masses: Mass[] = tips.map(([tx, ty]) => ({ x: tx, y: ty - 6, rx: 17 + Rn() * 5, ry: 12 + Rn() * 3, z: ty }));
        masses.push({ x, y: y - 82, rx: 34, ry: 18, z: -999 });
        foliage(l, masses, SEAGRAPE, k.seed + 1, { cell: 4, tilt: 0.22, dots: ['#fbf6ec', '#f6e8a8', '#f8f2e0'], dotChance: 0.55, dotSize: 4 });
      }, { outline: 0.6 });
      return;
    }
    if (kind === 'seagrape') {
      contactShadow(c, x + 34, y + 8, 58, 18, 0.41);
      layer(c, (l) => {
        for (const [dx, a] of [[-6, -0.4], [4, 0.3], [0, 0]] as const) curve(l, x + dx, y, x + dx + a * 20, y - 30, x + dx + a * 40, y - 46, BARKG[2], 4);
      }, { outline: 0.6 });
      layer(c, (l) => {
        const masses: Mass[] = [];
        for (let i = 0; i < 9; i++) masses.push({ x: x + (Rn() - 0.5) * 80, y: y - 52 + (Rn() - 0.5) * 36, rx: 22 + Rn() * 10, ry: 17 + Rn() * 6, z: i });
        masses.push({ x, y: y - 70, rx: 32, ry: 24, z: 10 });
        for (const m of masses) m.z = m.y + m.ry * 0.4;
        // big round leaves: a coarse leaf cell, a few red old leaves
        foliage(l, masses, SEAGRAPE, k.seed, { cell: 6, tilt: 0.25, holes: 0.05, dots: ['#c8402a', '#d86a3a'], dotChance: 0.06, dotSize: 4 });
      }, { outline: 0.6 });
      return;
    }
    // tamarisk: a leaning trunk, a feathery grey-green crown in soft lobes, pink plumes
    contactShadow(c, x + 36, y + 8, 60, 18, 0.38);
    layer(c, (l) => {
      curve(l, x, y, x + 8, y - 30, x + 2, y - 54, BARKG[2], 6);
      curve(l, x - 2, y, x + 6, y - 30, x, y - 54, BARKG[4], 1);
      ln(l, x + 4, y - 36, x - 26, y - 62, BARKG[2], 3);
      ln(l, x + 4, y - 40, x + 30, y - 66, BARKG[2], 3);
    }, { outline: 0.6 });
    layer(c, (l) => {
      const masses: Mass[] = [];
      for (let i = 0; i < 12; i++) masses.push({ x: x + (Rn() - 0.5) * 96, y: y - 70 + (Rn() - 0.5) * 40, rx: 18 + Rn() * 8, ry: 14 + Rn() * 5 });
      for (const m of masses) m.z = m.y + m.ry * 0.3;
      foliage(l, masses, TAMARISK, k.seed + 3, { cell: 3, stretch: 1.6, tilt: 0.14, holes: 0.06, dots: ['#f0a6c8', '#e888b0', '#f8c8dc'], dotChance: 0.35, dotSize: 4 });
    }, { outline: 0.55 });
  },
};

// ── beach kit ────────────────────────────────────────────────
const STRIPES = [['#e0402a', '#f6eedc'], ['#2a5ab8', '#f6eedc'], ['#2a8a86', '#f2c84a'], ['#f08a3a', '#f6eedc']];

const windbreak: PropArt = {
  draw(p, k) {
    const W = k.w;
    // most windbreaks are the classic red and white (the reference); a few other colours
    const [c1, c2] = k.variant === 'red' || pmod(k.seed + p.x * 5 + p.y, 3) !== 0 ? STRIPES[0] : STRIPES[pmod(k.seed + p.x + p.y * 3, STRIPES.length)];
    footShadow(p, 0, 0.3, W, 0.8, 7, 0.29);
    layer(p.c, (l) => {
      const n = Math.max(2, Math.round(W / 0.7) + 1);
      const poles: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = 0.05 + ((W - 0.1) * i) / (n - 1);
        const b = 0.5 + Math.sin(i * 1.3 + k.seed) * 0.12;
        poles.push([a, b]);
      }
      for (let i = 0; i + 1 < poles.length; i++) {
        const [a0, b0] = poles[i];
        const [a1, b1] = poles[i + 1];
        const m = 12;
        for (let j = 0; j < m; j++) {
          const t0 = j / m;
          const t1 = (j + 1) / m;
          const sag = (t: number) => Math.sin(t * Math.PI) * 0.6;
          const q0 = p.P(a0 + (a1 - a0) * t0, b0 + (b1 - b0) * t0, 0.8);
          const q1 = p.P(a0 + (a1 - a0) * t1, b0 + (b1 - b0) * t1, 0.8);
          const q2 = p.P(a0 + (a1 - a0) * t1, b0 + (b1 - b0) * t1, 7.2 - sag(t1));
          const q3 = p.P(a0 + (a1 - a0) * t0, b0 + (b1 - b0) * t0, 7.2 - sag(t0));
          const col = Math.floor((i * m + j) / 3) % 2 ? c1 : c2;
          fillPoly(l, [q0, q1, q2, q3], j < m / 2 ? col : darken(col, 0.06));
        }
      }
      for (const [a, b] of poles) {
        const [x, y] = p.P(a, b, 0);
        px(l, x - 1, y - 32, PINE[3], 2, 33);
        px(l, x - 1, y - 32, PINE[5], 1, 33);
      }
    }, { outline: 0.5 });
  },
};

const volley: PropArt = {
  draw(p, k) {
    const W = k.w;
    layer(p.c, (l) => {
      const tops: [number, number][] = [];
      for (const a of [0.1, W - 0.1]) {
        const [x, y] = p.P(a, 0.5, 0);
        contactShadow(l, x + 5, y + 2, 6, 2.5, 0.29);
        px(l, x - 2, y - 46, CREAM[4], 4, 46);
        px(l, x - 2, y - 46, CREAM[6], 1, 46);
        tops.push([x, y - 44]);
        // a guy rope to a peg
        const [gx, gy] = p.P(a < 1 ? a - 0.3 : a + 0.3, 0.5, 0);
        ln(l, x, y - 44, gx, gy, '#c8b490');
      }
      // the net: a mesh band between the posts, a white top tape
      const [x0, y0] = tops[0];
      const [x1, y1] = tops[1];
      for (let j = 0; j < 4; j++) ln(l, x0, y0 + 2 + j * 3, x1, y1 + 2 + j * 3, j === 0 ? '#fbf8f2' : '#5a5a62');
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 4);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        ln(l, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 2, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 11, '#5a5a62');
      }
    }, { outline: 0.45 });
    // the ball and a scuffed court line in the sand
    const [bx, by] = anchor(p, W * 0.7, 0.92, 0);
    layer(p.c, (l) => {
      ell(l, bx, by - 4, 5, 5, '#fbf6ee');
      fillPoly(l, [[bx - 4, by - 7], [bx + 1, by - 9], [bx + 1, by - 4]], '#f2c84a');
      fillPoly(l, [[bx + 1, by - 4], [bx + 5, by - 3], [bx + 1, by + 1]], '#2a5ab8');
    }, { outline: 0.5 });
    void k;
  },
};

// ── the beach volleyball court ──────────────────────────────
// A raked court roped off with timber posts, its blue boundary tapes, the net
// across the middle (along b), guy ropes, a ball, a kit bag and water bottles.
const court: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const Rn = rng(k.seed * 17 + 5);
    // the raked sand inside: paler, with fine rake lines
    const q = (a: number, b: number, z = 0) => p.P(a, b, z);
    c.globalAlpha = 0.32;
    fillPoly(c, [q(0.35, 0.35), q(W - 0.35, 0.35), q(W - 0.35, D - 0.35), q(0.35, D - 0.35)], '#fff0c8');
    c.globalAlpha = 0.22;
    for (let a = 0.5; a < W - 0.4; a += 0.18) {
      const [x0, y0] = q(a, 0.45);
      const [x1, y1] = q(a, D - 0.45);
      ln(c, x0, y0, x1, y1, '#b8864e');
    }
    c.globalAlpha = 1;
    // scuffs and footprints round the net
    for (let i = 0; i < 40; i++) {
      const [fx, fy] = q(W / 2 + (Rn() - 0.5) * (W - 1.2), 0.6 + Rn() * (D - 1.2));
      ell(c, fx, fy, 2.4, 1.2, Rn() < 0.5 ? '#c8945a' : '#e2b478');
    }
    // the boundary tapes, pegged at the corners
    const L0 = 0.55;
    const corners: [number, number][] = [[L0, L0], [W - L0, L0], [W - L0, D - L0], [L0, D - L0]];
    for (let i = 0; i < 4; i++) {
      const [a0, b0] = corners[i];
      const [a1, b1] = corners[(i + 1) % 4];
      const [x0, y0] = q(a0, b0);
      const [x1, y1] = q(a1, b1);
      ln(c, x0, y0 + 1, x1, y1 + 1, '#1a3a7a', 3);
      ln(c, x0, y0, x1, y1, '#3a7ae0', 2);
      px(c, x0 - 2, y0 - 2, '#f6f2ea', 4, 3);
    }
    // the net posts with guy ropes, the net between them
    const nb0 = 0.25;
    const nb1 = D - 0.25;
    const am = W / 2;
    layer(c, (l) => {
      for (const b of [nb0, nb1]) {
        const g = b < D / 2 ? -0.3 : 0.3;
        const [tx, ty] = q(am, b, 25);
        for (const da of [-0.5, 0.5]) {
          const [gx, gy] = q(am + da, b + g, 0);
          ln(l, tx, ty, gx, gy, '#e8dcc0');
          px(l, gx - 1, gy - 3, '#6a4a2a', 2, 4);
        }
      }
      // the net: a dark mesh band, a white top tape and a lower tape, red-white antennae
      const N = 22;
      const top = 24;
      const bot = 16;
      for (let i = 0; i <= N; i++) {
        const b = nb0 + ((nb1 - nb0) * i) / N;
        const [x0, y0] = q(am, b, top);
        const [x1, y1] = q(am, b, bot);
        ln(l, x0, y0, x1, y1, '#3a3a44');
      }
      for (let z = bot; z <= top; z += 2) {
        const [x0, y0] = q(am, nb0, z);
        const [x1, y1] = q(am, nb1, z);
        ln(l, x0, y0, x1, y1, '#3a3a44');
      }
      const [t0x, t0y] = q(am, nb0, top);
      const [t1x, t1y] = q(am, nb1, top);
      ln(l, t0x, t0y, t1x, t1y, '#ffffff', 3);
      const [u0x, u0y] = q(am, nb0, bot);
      const [u1x, u1y] = q(am, nb1, bot);
      ln(l, u0x, u0y, u1x, u1y, '#e8e4dc', 2);
      for (const b of [nb0 + 0.35, nb1 - 0.35]) {
        const [ax, ay] = q(am, b, top);
        for (let j = 0; j < 6; j++) px(l, ax - 1, ay - 3 - j * 3, j % 2 ? '#fbf6ee' : '#e0302a', 2, 3);
      }
      // the posts last, over the net ends: white with a padded blue sleeve
      for (const b of [nb0, nb1]) {
        const [x, y] = q(am, b, 0);
        const [, yt] = q(am, b, 26);
        contactShadow(l, x + 6, y + 2, 7, 3, 0.4);
        px(l, x - 2, yt, '#e8e4dc', 5, y - yt);
        px(l, x - 2, yt, '#ffffff', 1, y - yt);
        px(l, x + 2, yt, '#a8a49c', 1, y - yt);
        px(l, x - 3, y - 14, '#2a5ab8', 7, 12);
        px(l, x - 3, y - 14, '#5a8ae0', 1, 12);
      }
    }, { outline: 0.5 });
    // the ball, a kit bag with a towel, two water bottles, flip-flops
    layer(c, (l) => {
      const [bx, by] = q(W * 0.28, D * 0.62);
      contactShadow(l, bx + 4, by + 2, 7, 3, 0.35);
      ell(l, bx, by - 6, 6, 6, '#fbf6ee');
      fillPoly(l, [[bx - 5, by - 9], [bx + 1, by - 12], [bx + 1, by - 6]], '#f2c84a');
      fillPoly(l, [[bx + 1, by - 6], [bx + 6, by - 4], [bx + 1, by - 1]], '#2a5ab8');
      px(l, bx - 3, by - 10, '#ffffff', 2, 2);
      const [kx, ky] = q(W - 0.2, D * 0.3);
      contactShadow(l, kx + 5, ky + 2, 12, 4, 0.35);
      fillPoly(l, [[kx - 12, ky - 2], [kx + 2, ky - 9], [kx + 12, ky - 4], [kx - 2, ky + 3]], '#e0402a');
      fillPoly(l, [[kx - 12, ky - 2], [kx - 12, ky - 9], [kx + 2, ky - 16], [kx + 2, ky - 9]], '#b82a20');
      fillPoly(l, [[kx - 12, ky - 9], [kx + 2, ky - 16], [kx + 12, ky - 11], [kx - 2, ky - 4]], '#f05a40');
      ln(l, kx - 10, ky - 9, kx + 10, ky - 11, '#1e1e24', 2);
      for (const [dx, col] of [[16, '#3a8ad8'], [20, '#f6f2ea']] as const) {
        px(l, kx + dx - 2, ky - 10, col, 4, 10);
        px(l, kx + dx - 1, ky - 12, '#1e1e24', 2, 2);
        px(l, kx + dx - 2, ky - 10, '#ffffff', 1, 8);
      }
    }, { outline: 0.5 });
    // timber posts with a sagging rope all round
    layer(c, (l) => {
      const ring: [number, number][] = [[0.08, 0.08], [W - 0.08, 0.08], [W - 0.08, D - 0.08], [0.08, D - 0.08]];
      const posts: [number, number][] = [];
      for (let i = 0; i < 4; i++) {
        const [a0, b0] = ring[i];
        const [a1, b1] = ring[(i + 1) % 4];
        const n = Math.max(1, Math.round(Math.hypot(a1 - a0, b1 - b0) / 1.25));
        for (let j = 0; j < n; j++) posts.push([a0 + ((a1 - a0) * j) / n, b0 + ((b1 - b0) * j) / n]);
      }
      // the gap in the rope where the players walk in (the near side)
      const gapAt = Math.floor(posts.length * 0.6);
      for (let i = 0; i < posts.length; i++) {
        if (i === gapAt) continue;
        const [a0, b0] = posts[i];
        const [a1, b1] = posts[(i + 1) % posts.length];
        let prev: [number, number] | null = null;
        for (let t = 0; t <= 1.001; t += 0.125) {
          const qq = q(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 7 - Math.sin(t * Math.PI) * 2.2);
          if (prev) ln(l, prev[0], prev[1], qq[0], qq[1], '#c8a46a', 2);
          prev = qq;
        }
      }
      for (const [a, b] of posts) {
        const [x, y] = q(a, b, 0);
        contactShadow(l, x + 3, y + 1, 4, 2, 0.4);
        px(l, x - 2, y - 26, PINE[2], 4, 26);
        px(l, x - 2, y - 26, PINE[5], 1, 26);
        px(l, x - 2, y - 27, PINE[6], 4, 2);
      }
    }, { outline: 0.5 });
  },
};

// ── a camper van ────────────────────────────────────────────

// ── small street furniture ──────────────────────────────────
const bin: PropArt = {
  draw(p, k) {
    footShadow(p, 0.3, 0.3, 0.7, 0.7, 6, 0.35);
    const wood = weathered(DRIFT, 'v');
    lbox(p, 0.34, 0.34, 0.32, 0.32, 0, 7, { front: wood, side: wood, top: (l) => () => (l ? '#2a2226' : '#2a2226'), edge: DRIFT[0] });
    lbox(p, 0.31, 0.31, 0.38, 0.38, 7, 0.6, mono(coat(TEAL), TEAL[0]));
    const F = front3(p, 0.66);
    pq(p, F, 0.42, 0.58, 3.4, 4.6, CREAM[5]);
    void k;
  },
};

const aboard: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 6, y + 2, 10, 4, 0.32);
    const kind = pmod(k.seed + p.x + p.y, 3);
    layer(p.c, (l) => {
      fillPoly(l, [[x - 10, y], [x - 7, y - 32], [x + 7, y - 32], [x + 10, y]], PINE[2]);
      fillPoly(l, [[x - 8, y - 3], [x - 6, y - 30], [x + 6, y - 30], [x + 8, y - 3]], '#2a302c');
      if (kind === 0) {
        // a cone of gelato
        fillPoly(l, [[x - 3, y - 16], [x + 3, y - 16], [x, y - 8]], '#d8a868');
        ell(l, x, y - 19, 4, 3, '#f0a6c0');
        for (let i = 0; i < 2; i++) ln(l, x - 4, y - 25 - i * 3, x + 4, y - 25 - i * 3, '#f2efe6');
      } else if (kind === 1) {
        // a wave and lines: surf lessons
        for (let i = -5; i <= 5; i++) px(l, x + i, y - 16 + Math.round(Math.sin(i * 0.8) * 2), '#7ac7bb', 1, 2);
        for (let i = 0; i < 3; i++) ln(l, x - 4, y - 26 + i * 3, x + 4 - i, y - 26 + i * 3, '#f2efe6');
      } else {
        // a palette: open studio
        ell(l, x, y - 17, 5, 4, '#d8b078');
        for (const [dx, dy, col] of [[-2, -2, '#e0603e'], [2, -2, '#2a8a86'], [0, 1, '#f2c84a']] as const) px(l, x + dx, y - 17 + dy, col, 2, 2);
        ln(l, x - 4, y - 26, x + 4, y - 26, '#f2efe6');
      }
    }, { outline: 0.55 });
  },
};

// ── a freestanding mural wall and a totem ───────────────────
const muralWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const kind = pmod(k.seed * 3 + p.x + p.y, 6);
    const m = mural(kind);
    footShadow(p, 0, 0.3, W, 0.75, 14, 0.35);
    const conc: Mat = (light) => (_u, vv, x, y) => at(['#6a6460', '#827c76', '#9a948c', '#b0aaa2', '#c4beb6', '#d6d0c8'], (light === 2 ? 4.4 : light ? 3.4 : 2) + (vv < 2 ? -1 : 0) + (hash(x, y, 7) < 0.05 ? -0.8 : 0));
    lbox(p, 0, 0.35, W, 0.3, 0, 15, { front: conc, side: conc, top: conc, edge: '#4a4440' });
    const F = front3(p, 0.65);
    const len = W * 71.6;
    pt(p, F, 0.06, W - 0.06, 1.2, 14.4, (u: number, vv: number, x: number, y: number) => {
      const c = m(u / len, vv / 53, u, vv + 1);
      if (!c) return hash(x >> 2, y >> 2, 9) < 0.5 ? '#e8e2d6' : '#f2ece0';
      return c;
    }, F.light);
    // a tag in the corner and a row of paint tins at the foot
    const [tx, ty] = F.F(W - 0.4, 2.6);
    ln(p.c, tx - 8, ty, tx - 2, ty - 5, '#3a3036', 1);
    ln(p.c, tx - 2, ty - 5, tx + 3, ty - 1, '#3a3036', 1);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) {
        const [cx, cy] = p.P(0.4 + i * 0.22, 0.86, 0);
        px(l, cx - 3, cy - 6, ALU[3], 6, 6);
        px(l, cx - 3, cy - 6, ['#e0603e', '#2a8a86', '#f2c84a'][i], 6, 2);
      }
    }, { outline: 0.5 });
  },
};

const totem: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 14, y + 4, 22, 8, 0.38);
    const stone: Mat = (light) => (_u, vv, xx, yy) => at(['#6a6460', '#827c76', '#9a948c', '#b0aaa2', '#c4beb6', '#d6d0c8'], (light === 2 ? 4.4 : light ? 3.4 : 2) + (vv < 2 ? -1 : 0) + (hash(xx, yy, 3) < 0.06 ? -0.7 : 0));
    lbox(p, 0.22, 0.22, 0.56, 0.56, 0, 3, { front: stone, side: stone, top: stone, edge: '#4a4440' });
    // a stack of painted driftwood forms and buoys, a fish on top
    const parts: [number, number, number, string][] = [[0, 10, 9, '#e0603e'], [14, 8, 10, '#2a8a86'], [28, 11, 7, '#f2c84a'], [40, 7, 9, '#f6f2ea'], [52, 9, 8, '#9a7ad0'], [64, 8, 8, '#e0603e']];
    layer(p.c, (l) => {
      px(l, x - 2, y - 92, '#3a3036', 4, 80);
      for (const [h, rx, ry, col] of parts) {
        const cy = y - 14 - h - ry;
        ell(l, x, cy, rx + 1, ry, darken(col, 0.28));
        ell(l, x - 1, cy - 1, rx, ry - 1, col);
        ell(l, x - rx * 0.4, cy - ry * 0.4, rx * 0.35, ry * 0.3, lighten(col, 0.3));
        for (let i = -rx + 2; i < rx - 1; i += 4) px(l, x + i, cy + ry * 0.4, darken(col, 0.15), 2, 1);
      }
      const fy = y - 98;
      fillPoly(l, [[x - 14, fy], [x - 4, fy - 7], [x + 8, fy - 5], [x + 12, fy], [x + 8, fy + 5], [x - 4, fy + 7]], '#4aa8c8');
      fillPoly(l, [[x - 14, fy], [x - 20, fy - 6], [x - 20, fy + 6]], '#2a7a9a');
      fillPoly(l, [[x - 4, fy - 7], [x + 8, fy - 5], [x + 4, fy - 2], [x - 6, fy - 3]], '#8ad0e8');
      px(l, x + 6, fy - 2, '#1e2a3a', 2, 2);
    }, { outline: 0.6 });
    // a little plaque
    const F = front3(p, 0.78);
    pq(p, F, 0.38, 0.62, 1, 2.2, '#c89a42');
    void k;
  },
};

export const STUDIO_EXTRAS: Record<string, PropArt> = { std_muralWall: muralWall, std_totem: totem, std_tree: tree, std_windbreak: windbreak, std_volley: volley, std_court: court, std_bin: bin, std_aboard: aboard };

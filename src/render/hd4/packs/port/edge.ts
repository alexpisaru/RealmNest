// Logistics Port — the quay's furniture and the flat details of the ground.
//   prt_quaywall  a tile of quay wall over the playable water (the same pixels
//                 as the water shader paints, as a sprite over the ripples)
//   prt_lamp      cast-iron harbour lamp · prt_mast  terminal floodlight mast
//   prt_fence     chain-link security fence · prt_lifebuoy  a ring on a post
//   prt_nets      a heap of green net with floats · prt_netrack  nets drying
//   prt_pots      stacked lobster pots · prt_fishbox  plastic fish boxes, ice
//   prt_pallets   a stack of empty pallets · prt_drums  oil drums · prt_cone
//   prt_buffer    a rail end stop · prt_bin  a litter bin
//   prt_decal     (flat) puddle, oil, tyre marks, drain, manhole, rust, rope
//                 end, feathers, scales, weeds, sand drift, flotsam
//   prt_mark      (flat) road dashes, zebra, arrow, container slot, hatched box,
//                 a berth number
//   prt_track     (flat) a rail track: sleepers, two rails, ballast between
//   prt_tree      a street conifer in a kerbed bed · prt_planter  a flower box
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, rng, soft } from '../../kit4';
import { front, pq, side } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { coil, gullStand, plate, rope, stencil, text } from './kit';
import { GALV, IRON, P, ROPE, RUST, STEEL } from './palette';
import { wallColor } from './quaywall';

// ── a tile of quay wall over the playable water ──────────────
const quaywall: PropArt = {
  draw(p) {
    const s = soft(p.c);
    if (!s) return;
    const W = p.w;
    const tx = p.x;
    const ty = p.y;
    const pts = [p.P(0, 0), p.P(1, 0), p.P(1, 1), p.P(0, 1)];
    const x0 = Math.floor(Math.min(...pts.map((q) => q[0])));
    const x1 = Math.ceil(Math.max(...pts.map((q) => q[0])));
    const y0 = Math.floor(Math.min(...pts.map((q) => q[1])));
    const y1 = Math.ceil(Math.max(...pts.map((q) => q[1])));
    const kx = 16 * W.k;
    const ky = 8 * W.k;
    for (let sy = y0; sy < y1; sy++)
      for (let sx = x0; sx < x1; sx++) {
        const X = (sx + 0.5 - W.ox) / kx;
        const Y = (sy + 0.5 - W.oy) / ky;
        const x = (Y + X) / 2;
        const y = (Y - X) / 2;
        if (x < tx || x >= tx + 1 || y < ty || y >= ty + 1) continue;
        const c = wallColor(x, y);
        if (c < 0) continue;
        s.put(sx - s.ox, sy - s.oy, (0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0);
      }
  },
};

// ── lamps and masts ──────────────────────────────────────────
const lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 10, y + 3, 14, 5, 0.28);
    layer(p.c, (l) => {
      // a fluted cast-iron post in harbour green, a ring, a swan-neck arm and a lantern
      const G = ['#0e1e18', '#16281f', '#1f3529', '#2a4434', '#385642', '#4a6a54'];
      fillPoly(l, [[x - 7, y], [x + 7, y], [x + 5, y - 12], [x - 5, y - 12]], G[2]);
      px(l, x - 5, y - 12, G[4], 2, 12);
      for (let j = 12; j < 150; j++) {
        px(l, x - 2, y - j, G[2], 5, 1);
        px(l, x - 2, y - j, G[4], 1, 1);
        if (j % 3 === 0) px(l, x + 1, y - j, G[1], 1, 1);
      }
      px(l, x - 4, y - 60, G[3], 9, 3);
      // the arm curling over to the lantern (toward the quay)
      const dir = k.seed % 2 ? 1 : -1;
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        px(l, x + dir * t * 22, y - 150 - Math.sin(t * Math.PI) * 9, G[3], 2, 2);
      }
      const lx = x + dir * 22;
      const ly = y - 146;
      fillPoly(l, [[lx - 7, ly], [lx + 7, ly], [lx + 5, ly + 14], [lx - 5, ly + 14]], G[1]);
      fillPoly(l, [[lx - 5, ly + 2], [lx + 5, ly + 2], [lx + 4, ly + 12], [lx - 4, ly + 12]], '#f2dca0');
      px(l, lx - 2, ly + 3, '#fff6d8', 2, 8);
      fillPoly(l, [[lx - 9, ly], [lx + 9, ly], [lx, ly - 7]], G[3]);
      px(l, lx - 1, ly - 10, G[4], 2, 3);
    }, { rect: [x - 34, y - 170, x + 34, y + 4] });
    // a lifebuoy hung on the post by the quay
    if (k.variant === 'quay' && k.seed % 2 === 0) {
      layer(p.c, (l) => {
        ell(l, x, y - 34, 9, 10, '#e2552a');
        for (const [dx, dy] of [[-8, 0], [8, 0], [0, -9], [0, 9]] as const) px(l, x + dx - 2, y - 34 + dy - 2, '#f4f0e6', 4, 4);
        ell(l, x, y - 34, 4, 5, '#2a4434');
      }, { rect: [x - 12, y - 46, x + 12, y - 22] });
    }
  },
};

const mast: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 16, y + 4, 22, 7, 0.3);
    layer(p.c, (l) => {
      // a tall galvanised mast on a concrete foot, a platform with floodlights
      fillPoly(l, [[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6]], '#7a7872');
      fillPoly(l, [[x - 12, y], [x, y + 6], [x, y + 10], [x - 12, y + 4]], '#a4a29a');
      fillPoly(l, [[x, y + 6], [x + 12, y], [x + 12, y + 4], [x, y + 10]], '#5e5c58');
      const H = 420;
      for (let j = 0; j < H; j++) {
        const w = 5 - Math.floor((j / H) * 3);
        px(l, x - w, y - j, GALV[2], w * 2, 1);
        px(l, x - w, y - j, GALV[5], 2, 1);
        if (j % 40 === 20) px(l, x - w - 1, y - j, GALV[1], w * 2 + 2, 1);
      }
      // the ladder cage up the side
      for (let j = 10; j < H - 10; j += 5) px(l, x + 4, y - j, GALV[1], 3, 1);
      // the head frame and eight floodlights in two rows
      px(l, x - 26, y - H - 2, GALV[2], 52, 3);
      px(l, x - 26, y - H - 2, GALV[5], 52, 1);
      for (let i = 0; i < 8; i++) {
        const fx = x - 24 + (i % 4) * 14;
        const fy = y - H - 12 - Math.floor(i / 4) * 12;
        px(l, fx, fy, '#3a3e44', 10, 8);
        px(l, fx + 1, fy + 5, '#fff2c8', 8, 2);
        px(l, fx + 1, fy + 1, '#5a5e64', 8, 1);
      }
      px(l, x - 1, y - H - 34, '#d8402a', 3, 3);
    }, { rect: [x - 32, y - 470, x + 32, y + 12] });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    if (Math.sin(k.t * 2.2 + k.seed) > 0.4) px(p.c, x - 1, y - 454, '#ff6a4a', 3, 3);
  },
};

// ── fences ───────────────────────────────────────────────────
const fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const gate = k.variant === 'gate';
    // concrete feet, galvanised posts every tile, chain-link mesh, barbed wire on top
    for (let i = 0; i <= W; i++) {
      if (gate && i > 0 && i < W) continue;
      const a = Math.min(W - 0.04, Math.max(0.02, i));
      lbox(p, a - 0.06, 0.42, 0.12, 0.16, 0, 1.2, mono(plate(['#6a6862', '#7e7c76', '#92908a', '#a6a49c', '#b8b6ae', '#cac8c0']), '#5a5852'));
      lbox(p, a - 0.02, 0.48, 0.04, 0.04, 1.2, 19, mono(plate(GALV), GALV[0]));
    }
    if (gate) return;
    const F = front(p, 0.5);
    // the mesh: a fine diamond lattice drawn in screen space between the posts
    const [ax, ay] = F.F(0, 1.4);
    const [bx, by] = F.F(W, 1.4);
    const H = 17 * 4;
    const slope = (by - ay) / (bx - ax);
    layer(c, (l) => {
      for (let xx = Math.ceil(ax); xx < bx; xx++) {
        const yb = ay + (xx - ax) * slope;
        for (let j = 0; j < H; j++) {
          const yy = Math.round(yb - j);
          if ((xx + j) % 6 === 0 || (xx - j + 600) % 6 === 0) px(l, xx, yy, (xx + j) % 6 === 0 ? '#9aa0a6' : '#7a8086');
        }
        // top and bottom rails
        px(l, xx, Math.round(yb - H), '#b4bac0');
        px(l, xx, Math.round(yb - H - 1), '#7a8086');
        // barbed wire: three strands with knots
        for (const dz of [8, 13, 18]) {
          const yy = Math.round(yb - H - dz + Math.sin(xx * 0.4) * 0.6);
          px(l, xx, yy, xx % 5 === 0 ? '#c8ccd0' : '#6a7076');
        }
      }
    }, { outline: false, rect: [ax - 2, ay - H - 26, bx + 2, by + 4] });
    // a sign on the mesh
    if (k.seed % 3 === 0 && W >= 3) {
      pq(p, front(p, 0.52), W / 2 - 0.3, W / 2 + 0.3, 8, 12, '#f4f0e6');
      pq(p, front(p, 0.52), W / 2 - 0.28, W / 2 + 0.28, 11, 11.8, '#d8402a');
      stencil(p, front(p, 0.53), W / 2 - 0.25, 10.4, 'ISPS', '#2a2a30');
    }
  },
};

const lifebuoy: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.6);
    contactShadow(p.c, x + 6, y + 2, 8, 3, 0.26);
    layer(p.c, (l) => {
      // a red post with a white cabinet, the orange ring hung on it
      px(l, x - 2, y - 40, '#a8322a', 4, 40);
      px(l, x - 2, y - 40, '#d85c48', 1, 40);
      px(l, x - 8, y - 46, '#f4f0e6', 16, 8);
      px(l, x - 8, y - 46, '#ffffff', 16, 1);
      text(l, x - 6, y - 44, 'SOS', '#a8322a');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const cx = x + Math.cos(a) * 8;
        const cy = y - 24 + Math.sin(a) * 9;
        px(l, cx - 1.5, cy - 1.5, Math.floor(i / 3) % 2 ? '#f4f0e6' : '#e8562a', 3, 3);
      }
      ln(l, x - 6, y - 16, x - 10, y - 4, ROPE[3]);
    }, { rect: [x - 14, y - 50, x + 12, y + 4] });
    void k;
  },
};

// ── nets, pots, fish boxes ───────────────────────────────────
const nets: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 10, y + 2, 26, 8, 0.28);
    const Rn = rng(k.seed * 11 + 3);
    const green = k.seed % 3 === 0 ? ['#4a2a1a', '#6a3a22', '#8a4e2c', '#a8643a'] : ['#1a3a2a', '#24503a', '#2e6448', '#3e7a58'];
    layer(p.c, (l) => {
      // a heap of netting: lumpy folds with mesh, floats and a lead line
      for (let i = 0; i < 34; i++) {
        const hx = x - 22 + Rn() * 44;
        const hy = y - 4 - Rn() * 14 + Math.abs(hx - x) * 0.25;
        ell(l, hx, hy, 7 + Rn() * 4, 4 + Rn() * 2, green[1 + Math.floor(Rn() * 3)]);
      }
      for (let i = 0; i < 90; i++) px(l, x - 24 + Rn() * 48, y - 18 + Rn() * 18, green[0]);
      for (let i = 0; i < 9; i++) {
        const fx = x - 18 + Rn() * 36;
        const fy = y - 6 - Rn() * 12;
        ell(l, fx, fy, 2.5, 2, i % 3 ? '#f2a02a' : '#e8e4da');
        px(l, fx - 1, fy - 1, '#fff2c0');
      }
      for (let i = 0; i < 20; i++) px(l, x - 20 + i * 2, y + 1 + Math.sin(i * 0.7) * 1.5, '#3a3a40', 2, 1);
    }, { rect: [x - 30, y - 26, x + 30, y + 6] });
  },
};

const netrack: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.3, W - 0.05, 0.7, 14, 0.22);
    // timber trestles with a pole, nets hung over it to dry, a buoy or two
    for (const a of [0.15, W - 0.2]) {
      const [x0, y0] = p.P(a, 0.35, 0);
      const [x1, y1] = p.P(a, 0.65, 0);
      const [xt, yt] = p.P(a, 0.5, 15);
      ln(p.c, x0, y0, xt, yt, '#5a4632', 2);
      ln(p.c, x1, y1, xt, yt, '#4a3828', 2);
    }
    const [ax, ay] = p.P(0.15, 0.5, 15);
    const [bx, by] = p.P(W - 0.2, 0.5, 15);
    ln(p.c, ax, ay, bx, by, '#6a5440', 2);
    const Rn = rng(k.seed * 7 + 5);
    layer(p.c, (l) => {
      const n = Math.floor((bx - ax) / 3);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const h = 26 + Math.sin(t * 9 + k.seed) * 8 + Rn() * 6;
        for (let j = 1; j < h; j++) if ((j + i) % 3 !== 0 || j > h - 3) px(l, x, y + j - (j > h - 4 ? 0 : 0), j % 4 === 0 ? '#1e3a2a' : (i + j) % 7 === 0 ? '#3e7a58' : '#2e6448');
        if (i % 9 === 4) ell(l, x, y + h * 0.6, 2.5, 2, '#f2a02a');
      }
    }, { rect: [ax - 4, ay - 4, bx + 4, by + 46] });
  },
};

const pots: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 8, y + 2, 22, 7, 0.28);
    layer(p.c, (l) => {
      // lobster pots: half-round frames with netting, stacked three high, a buoy and its line
      const pot = (cx: number, cy: number) => {
        fillPoly(l, [[cx - 12, cy], [cx + 4, cy - 6], [cx + 14, cy], [cx - 2, cy + 6]], '#5a4632');
        for (let j = 0; j < 9; j++) {
          const w = Math.sqrt(1 - (j / 9) ** 2);
          ln(l, cx - 12 * w + j * 0.2, cy - j, cx + 14 * w + j * 0.2, cy - j - 2, j % 3 === 0 ? '#2a3a3a' : '#4a6a6a');
        }
        for (let i = -2; i <= 2; i++) ln(l, cx + i * 5, cy + 3 - i * 1.5, cx + i * 4, cy - 9 - i * 1.2, '#7a5a3a');
        px(l, cx - 3, cy - 4, '#1e2a2a', 6, 3);
      };
      const n = 2 + (k.seed % 2);
      for (let j = 0; j < n; j++) pot(x - 2 + (j % 2) * 3, y - j * 10);
      pot(x + 18, y + 4);
      ell(l, x - 18, y - 2, 4, 4, '#e8402a');
      px(l, x - 20, y - 4, '#ff8a6a', 2, 1);
      ln(l, x - 18, y + 2, x - 10, y + 6, ROPE[3]);
    }, { rect: [x - 26, y - 40, x + 36, y + 12] });
  },
};

const fishbox: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.15, 0.9, 0.9, 10, 0.26);
    const Rn = rng(k.seed * 3 + 1);
    const cols = [P.blue, P.red, P.green, P.white];
    // stacks of plastic fish boxes, the top one full of ice and fish
    for (const [a, b, n] of [[0.14, 0.18, 2 + (k.seed % 3)], [0.52, 0.5, 1 + (k.seed % 2)]] as const) {
      for (let j = 0; j < n; j++) {
        const c = cols[Math.floor(Rn() * cols.length)];
        lbox(p, a, b, 0.36, 0.32, j * 2.4, 2.4, mono(plate(c), c[0]));
        pq(p, front(p, b + 0.32), a + 0.08, a + 0.28, j * 2.4 + 1.2, j * 2.4 + 1.8, c[1]);
      }
      const [ix, iy] = anchor(p, a + 0.18, b + 0.16, n * 2.4);
      for (let i = 0; i < 10; i++) px(p.c, ix - 9 + hash(i, 1, k.seed) * 18, iy - 3 + hash(i, 2, k.seed) * 6, i % 3 ? '#eaf6f8' : '#bcdde6', 2, 1);
      for (let i = 0; i < 3; i++) {
        const fx = ix - 6 + i * 5;
        const fy = iy - 1 + (i % 2);
        ln(p.c, fx, fy, fx + 5, fy - 2, '#a8b4bc', 2);
        px(p.c, fx + 5, fy - 3, '#6a7a86', 2, 2);
      }
    }
  },
};

const pallets: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.1, 0.92, 0.9, 12, 0.26);
    const PINE = ['#5e4228', '#7a5834', '#967042', '#b08852', '#c6a066', '#d8b67e'];
    const n = 5 + (k.seed % 5);
    for (let j = 0; j < n; j++) {
      const da = (hash(j, 1, k.seed) - 0.5) * 0.06;
      lbox(p, 0.12 + da, 0.14, 0.76, 0.7, j * 1.3, 1.3, { front: plate(PINE, 0), side: plate(PINE, 0), top: plate(PINE, 0), edge: PINE[0] });
      const F = front(p, 0.84);
      pq(p, F, 0.12 + da, 0.88 + da, j * 1.3 + 0.35, j * 1.3 + 0.95, '#2a2018');
      for (const t of [0.14, 0.47, 0.8]) pq(p, F, 0.12 + da + t * 0.76 - 0.04, 0.12 + da + t * 0.76 + 0.04, j * 1.3, j * 1.3 + 1.3, PINE[1]);
    }
  },
};

const drums: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 12, y + 2, 24, 8, 0.28);
    const Rn = rng(k.seed * 5 + 2);
    const cols = [P.blue, P.red, P.green, P.yellow, P.grey];
    layer(p.c, (l) => {
      for (const [dx, dy] of [[-12, -4], [4, -8], [-4, 4], [12, 0]] as const) {
        const col = cols[Math.floor(Rn() * cols.length)];
        const cx = x + dx;
        const cy = y + dy;
        for (let j = 0; j < 26; j++)
          for (let i = -8; i < 8; i++) {
            const t = (i + 8) / 16;
            let tone = t < 0.2 ? 5 : t < 0.5 ? 4 : t < 0.8 ? 3 : 2;
            if (j % 9 === 4) tone -= 1;
            if (Rn() < 0.04 + (j < 6 ? 0.1 : 0)) {
              px(l, cx + i, cy - j, RUST[Math.max(1, tone - 1)]);
              continue;
            }
            px(l, cx + i, cy - j, col[tone]);
          }
        ell(l, cx, cy - 26, 8, 3.5, col[5]);
        ell(l, cx, cy - 26, 6.5, 2.5, col[3]);
        ell(l, cx + 3, cy - 27, 1.5, 1, '#1a1a1e');
      }
    }, { rect: [x - 24, y - 40, x + 24, y + 8] });
  },
};

const cone: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 4, y + 2, 7, 3, 0.26);
    layer(p.c, (l) => {
      fillPoly(l, [[x - 7, y + 1], [x + 7, y + 1], [x + 7, y - 2], [x - 7, y - 2]], '#2a2a30');
      fillPoly(l, [[x - 5, y - 2], [x + 5, y - 2], [x + 1, y - 20], [x - 1, y - 20]], '#e8622a');
      fillPoly(l, [[x - 5, y - 2], [x - 1, y - 2], [x - 1, y - 20]], '#f48a4a');
      px(l, x - 3, y - 12, '#f4f0e6', 6, 2);
      px(l, x - 4, y - 7, '#f4f0e6', 8, 2);
    }, { rect: [x - 9, y - 22, x + 9, y + 3] });
    void k;
  },
};

const buffer: PropArt = {
  draw(p, k) {
    // a rail end stop: a steel frame with two hazard-striped buffers facing along the rail
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 10, 0.26);
    lbox(p, 0.3, 0.32, 0.4, 0.36, 0, 5, mono(plate(STEEL), STEEL[0]));
    const S = side(p, 0.7);
    for (let i = 0; i < 4; i++) pq(p, S, 0.34 + i * 0.08, 0.38 + i * 0.08, 0.6, 4.4, i % 2 ? '#1e1e24' : '#e8b42a');
    for (const b of [0.38, 0.62]) {
      const [x, y] = p.P(0.72, b, 3.4);
      ell(p.c, x + 2, y, 3, 3, '#2a2a30');
      ell(p.c, x + 2, y, 2, 2, '#c8ccd0');
    }
    void k;
  },
};

const bin: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 5, y + 2, 9, 3, 0.26);
    layer(p.c, (l) => {
      for (let j = 0; j < 18; j++) px(l, x - 6, y - j, j % 5 === 0 ? '#245038' : '#2e6448', 12, 1);
      px(l, x - 6, y - 18, '#24503a', 12, 1);
      px(l, x - 6, y - 17, '#3e7a58', 3, 17);
      ell(l, x, y - 19, 7, 2.5, '#3a3e44');
      px(l, x - 3, y - 21, '#f4f0e6', 3, 2);
    }, { rect: [x - 8, y - 24, x + 8, y + 2] });
    void k;
  },
};

// ── a fishmonger's stall ─────────────────────────────────────
const stall: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.2, W - 0.05, 0.95, 10, 0.26);
    const legs = mono(plate(GALV), GALV[0]);
    for (const a of [0.12, W - 0.18]) for (const b of [0.28, 0.82]) lbox(p, a, b, 0.05, 0.05, 0, 7.6, legs);
    // a blue skirt round the stand (the reference's market stalls), a white hem
    const skirt = plate(P.blue);
    lbox(p, 0.1, 0.26, W - 0.2, 0.62, 0.6, 7, { front: skirt, side: skirt, top: skirt, edge: P.blue[0] });
    pq(p, front(p, 0.88), 0.1, W - 0.1, 6.2, 7.2, '#f4f0e6');
    pq(p, side(p, W - 0.1), 0.26, 0.88, 6.2, 7.2, '#d8d4ca');
    // the zinc tray heaped with crushed ice
    lbox(p, 0.06, 0.22, W - 0.12, 0.7, 7.6, 1.4, { front: plate(['#5a5e64', '#6e7278', '#82868c', '#969a9e', '#aaaeb2', '#bec2c4']), side: plate(['#5a5e64', '#6e7278', '#82868c', '#969a9e', '#aaaeb2', '#bec2c4']), top: () => (_u: number, _v: number, x: number, y: number) => (hash(x, y, 3) < 0.3 ? '#ffffff' : hash(x, y, 4) < 0.5 ? '#e2f0f4' : '#c4dfe6'), edge: '#4a4e54' });
    const Rn = rng(k.seed * 7 + 1);
    const fish = [['#9aa8b4', '#c8d4dc', '#6a7884'], ['#c84a3a', '#e47a62', '#8a2a22'], ['#8a7a5a', '#b4a47e', '#5a4a34'], ['#5a6e7a', '#8aa0aa', '#3a4a54']];
    for (let i = 0; i < W * 9; i++) {
      const a = 0.18 + Rn() * (W - 0.36);
      const b = 0.32 + Rn() * 0.5;
      const [x, y] = p.P(a, b, 9);
      const f = fish[Math.floor(Rn() * fish.length)];
      const dir = Rn() < 0.5 ? 1 : -1;
      ln(p.c, x - 5 * dir, y + 1, x + 5 * dir, y - 2, f[0], 3);
      ln(p.c, x - 4 * dir, y, x + 4 * dir, y - 3, f[1], 1);
      px(p.c, x + 5 * dir - (dir < 0 ? 1 : 0), y - 3, f[2], 2, 2);
      px(p.c, x - 6 * dir - (dir < 0 ? 1 : 0), y, f[2], 2, 3);
    }
    // a crab and a lobster on top, lemons, a price card
    const [cx, cy] = p.P(W * 0.7, 0.55, 9.4);
    ell(p.c, cx, cy, 5, 3, '#c8582a');
    ell(p.c, cx - 1, cy - 1, 3, 1.5, '#e8824a');
    for (const dx of [-6, -5, 5, 6]) px(p.c, cx + dx, cy + 1, '#a8421e', 1, 2);
    const [lx, ly] = p.P(W * 0.3, 0.5, 9.4);
    ln(p.c, lx - 8, ly + 2, lx + 6, ly - 4, '#2a3a6a', 3);
    px(p.c, lx + 6, ly - 6, '#3a4a7a', 3, 3);
    for (let i = 0; i < 3; i++) px(p.c, lx - 10 + i * 4, ly + 5, '#f2d240', 3, 2);
    const F = front(p, 0.92);
    pq(p, F, 0.25, 0.65, 9.6, 12, '#2a2a30');
    stencil(p, F, 0.28, 11.6, `${3 + (k.seed % 6)}.90`, '#f4f0e6');
    // the hanging scale on a post
    const [sx, sy] = p.P(W - 0.2, 0.3, 7.6);
    ln(p.c, sx, sy, sx, sy - 34, '#5a5e64', 2);
    ln(p.c, sx, sy - 34, sx - 10, sy - 36, '#5a5e64', 2);
    ell(p.c, sx - 10, sy - 28, 5, 5, '#d8d4ca');
    ell(p.c, sx - 10, sy - 28, 3, 3, '#f4f0e6');
    ln(p.c, sx - 10, sy - 23, sx - 10, sy - 18, '#3a3a40');
    ell(p.c, sx - 10, sy - 17, 5, 2, '#9aa0a6');
  },
};

// ── flat details baked into the ground ───────────────────────
const decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'puddle';
    const c = p.c;
    const [x, y] = anchor(p, 0.5 * p.pw, 0.5 * p.pd);
    const Rn = rng(k.seed * 17 + 3);
    if (v === 'puddle') {
      // still water in a dip: an irregular pool of two or three lobes, a dark wet rim, the sky in it
      const rx = 16 + Rn() * 14;
      const lobes: [number, number, number][] = [[0, 0, 1], [(Rn() - 0.5) * rx * 1.2, (Rn() - 0.5) * 6, 0.55 + Rn() * 0.3], [(Rn() - 0.5) * rx, (Rn() - 0.5) * 5, 0.4 + Rn() * 0.3]];
      c.globalAlpha = 0.35;
      for (const [dx, dy, s2] of lobes) ell(c, x + dx + 1, y + dy + 1, rx * s2 + 4, (rx * s2 + 4) * 0.45, '#2a2a2e');
      c.globalAlpha = 1;
      for (const [dx, dy, s2] of lobes) ell(c, x + dx, y + dy, rx * s2, rx * s2 * 0.42, '#4e5e6a');
      for (const [dx, dy, s2] of lobes) ell(c, x + dx - rx * s2 * 0.1, y + dy - 1, rx * s2 * 0.78, rx * s2 * 0.3, '#6a8294');
      ell(c, x - rx * 0.3, y - rx * 0.1, rx * 0.38, rx * 0.1, '#a2bccc');
      for (let i = 0; i < 6; i++) px(c, x - rx * 0.5 + i * rx * 0.18, y + rx * 0.16 + (i % 2), '#86a0b0', 3, 1);
    } else if (v === 'oil') {
      const rx = 14 + Rn() * 12;
      c.globalAlpha = 0.55;
      ell(c, x, y, rx, rx * 0.45, '#1a1a1e');
      ell(c, x + rx * 0.5, y + 2, rx * 0.45, rx * 0.2, '#1a1a1e');
      c.globalAlpha = 1;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        px(c, x + Math.cos(a) * rx * 0.85, y + Math.sin(a) * rx * 0.38, ['#6a5290', '#3e6a9a', '#3a8a74', '#a49c48'][i % 4], 2, 1);
      }
    } else if (v === 'tyre') {
      // two curving tyre tracks
      c.globalAlpha = 0.35;
      for (const off of [-6, 6]) {
        let px0 = x - 40;
        let py0 = y + off + 14;
        for (let i = 1; i <= 20; i++) {
          const t = i / 20;
          const xx = x - 40 + t * 80;
          const yy = y + off + 14 - t * 30 + Math.sin(t * 3) * 6;
          ln(c, px0, py0, xx, yy, '#1e1e22', 3);
          px0 = xx;
          py0 = yy;
        }
      }
      c.globalAlpha = 1;
    } else if (v === 'drain') {
      fillPoly(c, [[x - 18, y], [x, y - 9], [x + 18, y], [x, y + 9]], '#2a2a2e');
      fillPoly(c, [[x - 15, y], [x, y - 7.5], [x + 15, y], [x, y + 7.5]], '#4a4a50');
      for (let i = -12; i <= 12; i += 3) ln(c, x + i - 3, y + 1.5 + i * -0.0, x + i + 3, y - 1.5, '#1a1a1e');
    } else if (v === 'manhole') {
      ell(c, x, y, 18, 9, '#2a2a2e');
      ell(c, x, y, 16, 8, '#4e4e54');
      for (let r = 4; r < 16; r += 4) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          px(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, '#3a3a40');
        }
      }
      ell(c, x - 3, y - 1, 5, 2, '#6a6a70');
    } else if (v === 'rust') {
      c.globalAlpha = 0.45;
      for (let i = 0; i < 6; i++) ell(c, x + (Rn() - 0.5) * 30, y + (Rn() - 0.5) * 12, 6 + Rn() * 8, 3 + Rn() * 3, RUST[2 + (i % 3)]);
      c.globalAlpha = 1;
    } else if (v === 'rope') {
      rope(c, x - 22, y + 4, x + 20, y - 6, -3, ROPE[2], ROPE[4]);
      px(c, x + 19, y - 8, ROPE[4], 3, 2);
      px(c, x - 24, y + 3, ROPE[4], 3, 2);
    } else if (v === 'feathers') {
      for (let i = 0; i < 5; i++) {
        const fx = x + (Rn() - 0.5) * 50;
        const fy = y + (Rn() - 0.5) * 20;
        ln(c, fx, fy, fx + 5, fy - 2, '#e8eaec');
        px(c, fx + 5, fy - 2, '#9aa2ac');
      }
      for (let i = 0; i < 8; i++) px(c, x + (Rn() - 0.5) * 60, y + (Rn() - 0.5) * 26, '#f2f0ea', 2, 1);
    } else if (v === 'scales') {
      // a wet patch where fish were gutted: glinting scales, a fish head, a gull's leftovers
      c.globalAlpha = 0.4;
      ell(c, x, y, 26, 11, '#3a4a50');
      c.globalAlpha = 1;
      for (let i = 0; i < 26; i++) px(c, x + (Rn() - 0.5) * 46, y + (Rn() - 0.5) * 18, i % 3 ? '#c8d8e0' : '#ffffff');
      ln(c, x + 4, y, x + 12, y - 3, '#8a9aa6', 3);
      px(c, x + 12, y - 4, '#d8402a', 2, 2);
    } else if (v === 'weeds') {
      for (let i = 0; i < 9; i++) {
        const wx = x + (Rn() - 0.5) * 60;
        const wy = y + (Rn() - 0.5) * 24;
        for (let j = 0; j < 4 + Rn() * 4; j++) px(c, wx + (j % 2) * (Rn() < 0.5 ? -1 : 1), wy - j, j > 3 ? '#7a9a3e' : '#4a6a2a');
      }
    } else if (v === 'sand') {
      c.globalAlpha = 0.5;
      for (let i = 0; i < 40; i++) px(c, x + (Rn() - 0.5) * 70, y + (Rn() - 0.5) * 26, Rn() < 0.5 ? '#c8b688' : '#a89470', 2, 1);
      c.globalAlpha = 1;
    } else if (v === 'flotsam') {
      // a bit of drift on the water: a plank, weed, a bottle, a foam streak
      ln(c, x - 10, y + 2, x + 8, y - 4, '#7a6044', 3);
      ln(c, x - 10, y + 1, x + 8, y - 5, '#9a7c5a', 1);
      for (let i = 0; i < 10; i++) px(c, x - 18 + i * 4, y + 6 + Math.sin(i) * 2, '#2e4a22', 3, 1);
      px(c, x + 14, y + 2, '#3a7a4a', 4, 2);
      px(c, x + 14, y + 2, '#8ac89a', 1, 1);
      for (let i = 0; i < 14; i++) px(c, x - 26 + i * 4, y - 6 + Math.sin(i * 0.8) * 1.5, '#cfe4de', 2, 1);
    }
  },
};

const mark: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'dash';
    const c = p.c;
    const W = p.pw;
    const D = p.pd;
    const paint = (pts: [number, number][], col: string) => fillPoly(c, pts.map(([a, b]) => p.P(a, b)), col);
    if (v === 'dash') {
      paint([[0.1, D / 2 - 0.04], [0.9 * W - 0.1, D / 2 - 0.04], [0.9 * W - 0.1, D / 2 + 0.04], [0.1, D / 2 + 0.04]], '#e8e4d8');
    } else if (v === 'dashes') {
      for (let a = 0.3; a < W - 0.6; a += 2) paint([[a, D / 2 - 0.04], [a + 1.0, D / 2 - 0.04], [a + 1.0, D / 2 + 0.04], [a, D / 2 + 0.04]], '#e8e4d8');
    } else if (v === 'edge') {
      paint([[0, D / 2 - 0.03], [W, D / 2 - 0.03], [W, D / 2 + 0.03], [0, D / 2 + 0.03]], '#e8e4d8');
    } else if (v === 'zebra') {
      for (let i = 0; i < 6; i++) paint([[0.06 + i * (W / 6), 0.05], [0.06 + i * (W / 6) + W / 12, 0.05], [0.06 + i * (W / 6) + W / 12, D - 0.05], [0.06 + i * (W / 6), D - 0.05]], '#e8e4d8');
    } else if (v === 'arrow') {
      paint([[0.2, 0.45], [0.62, 0.45], [0.62, 0.55], [0.2, 0.55]], '#e8e4d8');
      paint([[0.6, 0.3], [0.85, 0.5], [0.6, 0.7]], '#e8e4d8');
    } else if (v === 'slot') {
      // a container slot outline in white with its number
      const t = 0.035;
      paint([[0, 0], [W, 0], [W, t], [0, t]], '#d8d4c8');
      paint([[0, D - t], [W, D - t], [W, D], [0, D]], '#d8d4c8');
      paint([[0, 0], [t * 1.6, 0], [t * 1.6, D], [0, D]], '#d8d4c8');
      paint([[W - t * 1.6, 0], [W, 0], [W, D], [W - t * 1.6, D]], '#d8d4c8');
      const [tx, ty] = p.P(0.25, D * 0.55);
      text(c, tx, ty - 3, `${String.fromCharCode(65 + (k.seed % 6))}${(k.seed * 7) % 40}`, '#d8d4c8', 0.5);
    } else if (v === 'box') {
      // a yellow hatched keep-clear box
      const t = 0.05;
      paint([[0, 0], [W, 0], [W, t], [0, t]], '#d8b034');
      paint([[0, D - t], [W, D - t], [W, D], [0, D]], '#d8b034');
      paint([[0, 0], [t, 0], [t, D], [0, D]], '#d8b034');
      paint([[W - t, 0], [W, 0], [W, D], [W - t, D]], '#d8b034');
      for (let i = 1; i < W * 3; i++) {
        const a = i / 3;
        const a0 = Math.max(t, a - D);
        paint([[a, t], [a + 0.06, t], [Math.max(t, a + 0.06 - D + 2 * t), D - t], [Math.max(t, a - D + 2 * t), D - t]], '#d8b034');
        void a0;
      }
    } else if (v === 'berth') {
      // a big berth number painted on the quay by the edge
      const [tx, ty] = p.P(0.2, D * 0.7);
      text(c, tx, ty - 12, k.color ?? '3', '#e8e4d8', 0.5, 4);
    } else if (v === 'stop') {
      paint([[0, D / 2 - 0.06], [W, D / 2 - 0.06], [W, D / 2 + 0.06], [0, D / 2 + 0.06]], '#e8e4d8');
    }
  },
};

/** A rail track along a (sleepers across, two rails), on ballast laid by the ground. */
const track: PropArt = {
  draw(p, k) {
    const W = p.pw;
    const c = p.c;
    const g0 = 0.5 - 0.36;
    const g1 = 0.5 + 0.36;
    for (let a = 0.12; a < W; a += 0.3) {
      const q = [p.P(a, 0.2), p.P(a + 0.12, 0.2), p.P(a + 0.12, 0.8), p.P(a, 0.8)];
      fillPoly(c, q, hash(Math.floor(a * 10), 1, k.seed) < 0.15 ? '#3a3632' : '#4a3a2c');
      const q2 = [p.P(a, 0.2), p.P(a + 0.04, 0.2), p.P(a + 0.04, 0.8), p.P(a, 0.8)];
      fillPoly(c, q2, '#5e4a38');
    }
    for (const b of [g0, g1]) {
      const [x0, y0] = p.P(0, b);
      const [x1, y1] = p.P(W, b);
      ln(c, x0, y0 + 1, x1, y1 + 1, '#2a2622', 2);
      ln(c, x0, y0 - 1, x1, y1 - 1, '#7a5a42', 1);
      ln(c, x0, y0, x1, y1, '#c8c8c4', 1);
    }
  },
};

// ── street greenery (the reference's trees and flower boxes along the road) ──
const TREE: string[] = ['#163a20', '#1e4a28', '#285c32', '#326e3c', '#3e8046', '#4e9252', '#64a462'];
const tree: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const Rn = rng(k.seed * 11 + 3);
    contactShadow(p.c, x + 22, y + 4, 40, 11, 0.28);
    // the bed: a granite kerb round soil and grass
    fillPoly(p.c, [[x - 26, y], [x, y - 13], [x + 26, y], [x, y + 13]], '#9a938a');
    fillPoly(p.c, [[x - 21, y], [x, y - 10], [x + 21, y], [x, y + 10]], '#4a6a2a');
    for (let i = 0; i < 16; i++) px(p.c, x - 14 + Rn() * 28, y - 5 + Rn() * 10, Rn() < 0.5 ? '#6a8e34' : '#3a5a22', 2, 1);
    layer(p.c, (l) => {
      const H = 176 + Rn() * 36;
      for (let j = 0; j < 34; j++) px(l, x - 3, y - j, j % 5 ? '#5a3e2a' : '#4a3222', 7, 1);
      // a conifer: stacked masses tapering to a point
      const masses: Mass[] = [];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        masses.push({ x: x + (Rn() - 0.5) * 8, y: y - 34 - t * (H - 44), rx: 40 - t * 31 + Rn() * 4, ry: 18 - t * 9, z: i });
      }
      foliage(l, masses, TREE, k.seed, { cell: 6, stretch: 1.3, holes: 0.04 });
    }, { outline: 0.55, rect: [x - 56, y - 240, x + 56, y + 4] });
  },
};

const planter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 7 + 5);
    footShadow(p, 0.08, 0.2, W - 0.08, 0.8, 8, 0.24);
    const box = plate(['#5a3e2a', '#6e4c32', '#84603e', '#9a724a', '#ae8458', '#c09868']);
    lbox(p, 0.08, 0.2, W - 0.16, 0.6, 0, 5, { front: box, side: box, top: plate(['#3a2a1e', '#4a3626', '#5a4430', '#6a523a', '#7a6044', '#8a6e50']), edge: '#3a2618' });
    const [x0, y0] = p.P(0.2, 0.5, 5);
    const [x1, y1] = p.P(W - 0.2, 0.5, 5);
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      const n = Math.max(3, Math.round(W * 4));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        masses.push({ x: x0 + (x1 - x0) * t + (Rn() - 0.5) * 4, y: y0 + (y1 - y0) * t - 6 - Rn() * 4, rx: 9 + Rn() * 4, ry: 6 + Rn() * 3, z: i });
      }
      foliage(l, masses, TREE, k.seed, { cell: 3, dots: ['#e84a3a', '#f2c42a', '#f4f0e6', '#e86aa8'], dotChance: 0.5, dotSize: 2 });
    }, { outline: 0.5, rect: [Math.min(x0, x1) - 18, Math.min(y0, y1) - 30, Math.max(x0, x1) + 18, Math.max(y0, y1) + 8] });
  },
};

// ── night lights ────────────────────────────────────────────
lamp.lights = () => [{ a: 0.5, b: 0.5, z: 37, r: 3, color: '#ffd9a0', kind: 'lamp' }];
mast.lights = () => [{ a: 0.5, b: 0.5, z: 105, r: 6, color: '#f2f6ff', kind: 'lamp' }];

export const PORT_EDGE: Record<string, PropArt> = {
  prt_tree: tree,
  prt_planter: planter,
  prt_quaywall: quaywall,
  prt_lamp: lamp,
  prt_mast: mast,
  prt_fence: fence,
  prt_lifebuoy: lifebuoy,
  prt_nets: nets,
  prt_netrack: netrack,
  prt_pots: pots,
  prt_fishbox: fishbox,
  prt_pallets: pallets,
  prt_drums: drums,
  prt_cone: cone,
  prt_buffer: buffer,
  prt_bin: bin,
  prt_stall: stall,
  prt_decal: decal,
  prt_mark: mark,
  prt_track: track,
};

export { coil, gullStand, IRON };
export type { PropPainter };

// Factory — the canal and its banks (1 z ≈ 10 cm; the water lies ~35 cm below the coping).
//   fac_quay      granite coping along the canal: 'near' (the wharf: the wall drops to the
//                 water, iron rings, a green waterline) or 'far' (the towpath's lip)
//   fac_barge, fac_bridge  the coal boat and the raised footbridge: see barge.ts
//   fac_crane     an iron hand crane on the wharf, its jib over the water
//   fac_bollard   cast-iron mooring post · fac_lifebuoy  a ring on its post
//   fac_buddleia  the butterfly bush that grows out of every crack on the estate
//   fac_birch     a self-seeded birch · fac_reeds  rushes where the coping has gone
//   fac_fence     chain-link on concrete posts, barbed wire on cranked arms
import type { Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { FACTORY_BOATS } from './barge';
import { at, BIRCHLEAF, BUDDLEIA, CONC, IRON, massRect, OLDWOOD, RED, STONE, WEED } from './palette';

const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const WATER_Z = -5;

/** Granite coping blocks with joints, chips and rope grooves. */
const coping: Mat = (light) => (u, v, x, y) => {
  const bw = 34;
  const col = Math.floor(u / bw);
  if (u - col * bw < 1.2) return at(STONE, 0);
  let i = (light === 2 ? 4 : light ? 3.2 : 2) + (hash(col, 1, 7) - 0.5) * 1.2;
  if (hash(x, y, 8) < 0.07) i -= 1;
  if (hash(x, y, 9) > 0.96) i += 1;
  if (v < 1.5 && light === 2) i -= 0.6;
  return at(STONE, i);
};

// ── the canal edges ─────────────────────────────────────────
const fac_quay: PropArt = {
  draw(p, k) {
    const W = k.w;
    const far = k.variant === 'far';
    if (far) {
      // the towpath's lip: coping blocks, the bank's shadow on the water in front of them
      p.c.globalAlpha = 0.35;
      pq(p, front(p, 0.02), -0.02, W + 0.02, WATER_Z, 0, '#101814');
      p.c.globalAlpha = 1;
      lbox(p, 0, 0.02, W, 0.38, -0.4, 1, { front: coping, side: coping, top: coping, edge: STONE[0] });
      // weeds and moss along the back edge of the coping
      const Rn = rng(k.seed * 5 + 1);
      for (let a = 0.2; a < W - 0.1; a += 0.5 + Rn() * 0.8) {
        const [x, y] = p.P(a, 0.44, 0.4);
        px(p.c, x, y - 2, WEED[3 + (Rn() < 0.5 ? 1 : 0)], 2, 2);
        px(p.c, x + 2, y - 1, WEED[2], 2, 1);
      }
      return;
    }
    const b1 = 1;
    const b0 = 0.62;
    // the wall face dropping to the water: blue brick, a slick green band at the waterline
    const F = front(p, b1);
    pt(p, F, 0, W, WATER_Z, 0, (u: number, v: number, x: number, y: number) => {
      if (v < 3) return hash(x, y, 4) < 0.4 ? '#1e2a22' : '#16201a';
      if (v < 7) return at(['#24402a', '#2e5232', '#3a623a', '#4a7244'], 1.4 + (hash(x, y, 5) < 0.3 ? 1 : 0) + (v > 5.5 ? 1 : 0));
      const row = Math.floor(v / 4);
      if (v % 4 < 1 || (u + (row & 1) * 6) % 13 < 1) return '#4e4448';
      return at(['#4a302a', '#5e3a32', '#72463a', '#865444', '#9a6450', '#ae765e'], 2.6 + (hash(Math.floor((u + (row & 1) * 6) / 13), row, 6) - 0.5) * 1.8 - (hash(x, y, 7) < 0.05 ? 1 : 0) - (v < 10 ? 0.8 : 0));
    }, F.light);
    // the coping, standing a little proud of the wharf
    lbox(p, 0, b0, W, b1 - b0, 0, 0.8, { front: coping, side: coping, top: coping, edge: STONE[0] });
    // iron mooring rings let into the coping, a timber rubbing strake on the wall
    const Rn = rng(k.seed * 3 + 2);
    for (let a = 0.8 + Rn() * 0.6; a < W - 0.4; a += 2.2 + Rn()) {
      const [x, y] = p.P(a, b0 + 0.2, 0.8);
      ell(p.c, x, y, 4, 2, IRON[1]);
      ell(p.c, x, y, 2.6, 1.2, IRON[3]);
      ell(p.c, x - 1, y, 3, 1.6, 'rgba(0,0,0,0)');
    }
    pq(p, front(p, b1 + 0.01), 0, W, -1.6, -0.9, OLDWOOD[2]);
    pq(p, front(p, b1 + 0.01), 0, W, -1.1, -0.9, OLDWOOD[4]);
  },
};

// ── the wharf crane ─────────────────────────────────────────
const fac_crane: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 1.2, 1.2, 34, 0.3);
    // a stone plinth, a tapering cast-iron post with a winch, a curved lattice jib reaching over the water
    lbox(p, 0.12, 0.12, 0.96, 0.96, 0, 1.6, { front: flat(STONE, 3, 2), side: flat(STONE, 3, 2), top: (light) => (u, v, x, y) => at(STONE, (light === 2 ? 4 : 3) - (u % 30 < 1 || v % 30 < 1 ? 1.4 : 0) - (hash(x, y, 3) < 0.06 ? 1 : 0)), edge: STONE[0] });
    const [x, y] = anchor(p, 0.6, 0.6, 1.6);
    const [jx, jy] = anchor(p, 0.62, k.d - 0.35, 64);
    const G: Ramp = ['#122218', '#1a3022', '#22402c', '#2c5238', '#386446', '#487656'];
    const top = y - 140;
    layer(p.c, (l) => {
      // the post: fluted, lit on the left
      for (let j = 0; j < 140; j++) {
        const w = 9 - j * 0.03;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, G[t < 0.22 ? 5 : t < 0.5 ? 4 : t < 0.78 ? 3 : 2]);
        }
      }
      for (const yy of [-8, -70, -136]) px(l, x - 11, y + yy, G[1], 22, 4);
      // the jib: a thick curved top boom and a lower strut meeting at the head, lattice between
      const B = (t: number, a: [number, number], c: [number, number], b: [number, number]): [number, number] => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
      const a1: [number, number] = [x, top];
      const c1: [number, number] = [x - 30, top - 40];
      const a2: [number, number] = [x + 2, y - 70];
      const c2: [number, number] = [x - 20, jy + 30];
      const hd: [number, number] = [jx, jy];
      for (let i = 0; i <= 90; i++) {
        const [px1, py1] = B(i / 90, a1, c1, hd);
        px(l, px1 - 3, py1 - 3, G[3], 6, 6);
        px(l, px1 - 3, py1 - 3, G[5], 6, 2);
        const [px2, py2] = B(i / 90, a2, c2, hd);
        px(l, px2 - 2, py2 - 2, G[2], 4, 4);
      }
      for (let i = 1; i < 10; i++) {
        const [ux, uy] = B(i / 10, a1, c1, hd);
        const [vx, vy] = B((i + (i % 2 ? 0.5 : -0.5)) / 10, a2, c2, hd);
        ln(l, ux, uy, vx, vy, G[2], 2);
      }
      // the winch: a drum, gear wheels, the crank handle
      ell(l, x + 12, y - 52, 9, 9, G[1]);
      ell(l, x + 11, y - 53, 7, 7, G[4]);
      ell(l, x + 12, y - 52, 3, 3, IRON[2]);
      ell(l, x - 10, y - 46, 6, 6, RED[2]);
      ell(l, x - 11, y - 47, 4, 4, RED[4]);
      ln(l, x + 12, y - 52, x + 26, y - 44, IRON[3], 2);
      px(l, x + 25, y - 47, '#c8a870', 4, 7);
      // the chain from the jib head to a coal tub hanging over the boat
      for (let j = 0; j < 160; j += 3) px(l, jx - 1, jy + 4 + j, IRON[4], 2, 2);
      const ty = jy + 168;
      ln(l, jx - 8, ty - 6, jx, ty - 12, IRON[3]);
      ln(l, jx + 8, ty - 6, jx, ty - 12, IRON[3]);
      fillPoly(l, [[jx - 10, ty - 6], [jx + 10, ty - 6], [jx + 8, ty + 6], [jx - 8, ty + 6]], IRON[2]);
      fillPoly(l, [[jx - 10, ty - 6], [jx - 4, ty - 6], [jx - 4, ty + 6], [jx - 8, ty + 6]], IRON[4]);
      for (let i = 0; i < 6; i++) px(l, jx - 7 + i * 2.6, ty - 8 - (i % 2), i % 2 ? '#2a2830' : '#4a4856', 3, 2);
    }, { outline: 0.62, rect: [Math.min(x, jx) - 40, Math.min(jy, top) - 50, Math.max(x, jx) + 34, Math.max(y, jy + 180) + 4] });
  },
};

const fac_bollard: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 5, y + 2, 9, 3, 0.28);
    layer(p.c, (l) => {
      // a cast-iron bollard: a flared foot, a waisted body, a domed cap
      for (let j = 0; j < 22; j++) {
        const w = j < 4 ? 8 - j * 0.5 : j > 17 ? 7 + (j - 17) * 0.3 : 5.5 + Math.abs(j - 11) * 0.12;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, IRON[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.8 ? 3 : 2]);
        }
      }
      ell(l, x, y - 23, 8, 4, IRON[4]);
      ell(l, x - 2, y - 24, 4, 2, IRON[5]);
      // a rope's wear has polished a band
      px(l, x - 5, y - 15, '#7a7884', 10, 2);
    }, { outline: 0.6, rect: [x - 12, y - 30, x + 12, y + 2] });
    void k;
  },
};

const fac_lifebuoy: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 5, y + 2, 8, 3, 0.26);
    layer(p.c, (l) => {
      px(l, x - 2, y - 46, OLDWOOD[2], 4, 46);
      px(l, x - 2, y - 46, OLDWOOD[4], 1, 46);
      px(l, x - 8, y - 48, OLDWOOD[1], 16, 4);
      // the ring: red and white quarters, a rope round it
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const q = Math.floor((a / (Math.PI * 2)) * 4);
        for (let r = 7; r < 11; r++) px(l, x + Math.cos(a) * r, y - 30 + Math.sin(a) * r * 1.05, q % 2 ? '#f2eee2' : RED[3]);
      }
      for (let a = 0; a < Math.PI * 2; a += 0.6) px(l, x + Math.cos(a) * 11, y - 30 + Math.sin(a) * 11.5, '#c8b890');
    }, { outline: 0.6, rect: [x - 14, y - 52, x + 14, y + 2] });
    void k;
  },
};

// ── waste-ground plants ─────────────────────────────────────
const fac_buddleia: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 13 + 7);
    const s = 1.15 + Rn() * 0.55;
    contactShadow(p.c, x + 16 * s, y + 4, 36 * s, 12 * s, 0.28);
    // arching stems, grey-green leaves, cones of purple flowers drooping at the tips
    const masses: Mass[] = [];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9;
      const r = (16 + Rn() * 14) * s;
      masses.push({ x: x + Math.cos(a) * r * 1.3, y: y - 26 * s + Math.sin(a) * r * 0.9, rx: (12 + Rn() * 6) * s, ry: (10 + Rn() * 4) * s, z: i });
    }
    masses.push({ x, y: y - 30 * s, rx: 18 * s, ry: 14 * s, z: 9 });
    const LEAF: Ramp = ['#26301e', '#323e26', '#404e30', '#506038', '#627244', '#768650', '#8a985e'];
    layer(p.c, (l) => {
      for (let i = 0; i < 5; i++) curve(l, x, y, x + (Rn() - 0.5) * 30 * s, y - 30 * s, x + (Rn() - 0.5) * 60 * s, y - 40 * s, '#5a4e3a', 2);
      foliage(l, masses, LEAF, k.seed, { cell: 3.2, tilt: 0.25 });
      for (let i = 0; i < 12; i++) {
        const m = masses[Math.floor(Rn() * masses.length)];
        const fx = m.x + (Rn() - 0.5) * m.rx;
        const fy = m.y - m.ry * 0.5 + Rn() * 4;
        const len = (8 + Rn() * 6) * s;
        const dir = fx < x ? -1 : 1;
        for (let j = 0; j < len; j++) {
          const w = Math.max(1, 3 - j * 0.2);
          const col = BUDDLEIA[j < 2 ? 4 : j < len * 0.6 ? 3 : 2];
          px(l, fx + dir * j * 0.5 - w / 2, fy + j * 0.6, col, Math.round(w), 1);
        }
        px(l, fx - 1, fy - 1, BUDDLEIA[5], 2, 1);
      }
    }, { outline: 0.6, rect: massRect(masses, 30) });
  },
};

const fac_birch: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 17 + 3);
    const s = 1.1 + Rn() * 0.45;
    const H = 150 * s;
    const lean = (Rn() - 0.3) * 14;
    contactShadow(p.c, x + 40 * s, y + 8, 56 * s, 18 * s, 0.26);
    const tx = (t: number) => x + Math.sin(t * 2.2 + k.seed) * 3 + t * lean;
    layer(p.c, (l) => {
      // a slim white trunk with black lenticels, forking high; thin dark twigs drooping
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const w = Math.max(2, 8 * s * (1 - t * 0.7));
        const cx = tx(t);
        for (let i = 0; i < w; i++) {
          const u = i / w;
          let col = u < 0.35 ? '#f2eee6' : u < 0.7 ? '#d8d4ca' : '#a8a49c';
          if (hash(Math.floor((cx - w / 2 + i) / 2), Math.floor((y - j) / 3), k.seed) < 0.13) col = '#2a2628';
          if (t < 0.12 && hash(i, j, k.seed) < 0.3) col = '#5a5250';
          px(l, cx - w / 2 + i, y - j, col);
        }
      }
      for (let i = 0; i < 9; i++) {
        const t = 0.45 + Rn() * 0.5;
        const bx = tx(t);
        const by = y - H * t;
        const ex = bx + (Rn() - 0.5) * 70 * s;
        const ey = by - (8 + Rn() * 24) * s;
        curve(l, bx, by, (bx + ex) / 2, ey - 6, ex, ey + 10 * s, '#4a4040');
      }
    }, { outline: 0.6, rect: [x - 60 * s, y - H - 20, x + 70 * s, y + 4] });
    // a light, airy crown: small leaf clumps in drooping tiers with plenty of gaps
    const masses: Mass[] = [];
    for (let i = 0; i < 16; i++) {
      const t = 0.42 + Rn() * 0.58;
      const spread = (1 - (t - 0.42) * 0.8) * 46 * s;
      masses.push({ x: tx(t) + (Rn() - 0.5) * 2 * spread, y: y - H * t + 6 * s, rx: (9 + Rn() * 7) * s, ry: (10 + Rn() * 7) * s, z: i });
    }
    layer(p.c, (l) => foliage(l, masses, BIRCHLEAF, k.seed, { cell: 3, holes: 0.22, tilt: 0.25, stretch: 1.3 }), { outline: 0.6, rect: massRect(masses) });
  },
};

const fac_reeds: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 9);
    layer(p.c, (l) => {
      for (let i = 0; i < 26; i++) {
        const bx = x - 22 + Rn() * 44;
        const by = y - 6 + Rn() * 12;
        const h = 18 + Rn() * 22;
        const lean = (Rn() - 0.5) * 8;
        ln(l, bx, by, bx + lean, by - h, Rn() < 0.5 ? WEED[3] : WEED[4]);
        if (Rn() < 0.25) px(l, bx + lean - 1, by - h - 5, '#5a3a22', 3, 6);
      }
    }, { outline: 0.55, rect: [x - 32, y - 52, x + 32, y + 10] });
  },
};

// ── chain-link fence ────────────────────────────────────────
const fac_fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const b = 0.5;
    const H = 18;
    const Rn = rng(k.seed * 11 + 5);
    // the mesh: a sparse diamond lattice between the posts, sagging a little, one hole
    const F = front(p, b);
    const hole = Rn() < 0.4 ? 0.6 + Rn() * (W - 1.6) : -9;
    pt(p, F, 0, W, 0.4, H - 1, (u: number, v: number) => {
      const du = u - (hole - 0) * 71.5;
      if (du > 0 && du < 28 && v < 30 && (du - 14) ** 2 / 196 + (v - 10) ** 2 / 400 < 1) return null;
      const a = (u + v) % 6;
      const c = (u - v + 600) % 6;
      if (a < 1 || c < 1) return a < 1 && c < 1 ? '#c8ccce' : F.light ? '#8e9296' : '#6e7276';
      return null;
    }, F.light);
    // concrete posts with cranked tops, three strands of barbed wire
    for (let a = 0; a <= W + 0.01; a += 1.5) {
      lbox(p, a - 0.05, b - 0.05, 0.1, 0.1, 0, H, mono(flat(CONC, 4, 3, 5), CONC[0]));
      const [x0, y0] = p.P(a, b, H);
      const [x1, y1] = p.P(a, b - 0.35, H + 4);
      ln(p.c, x0, y0, x1, y1, CONC[3], 3);
    }
    for (let i = 1; i <= 3; i++) {
      const [x0, y0] = p.P(0, b - 0.117 * i, H + 1.33 * i);
      const [x1, y1] = p.P(W, b - 0.117 * i, H + 1.33 * i);
      ln(p.c, x0, y0 + 1, x1, y1 + 1, '#2e3034');
      ln(p.c, x0, y0, x1, y1, '#5a5e62');
      for (let t = 0.02; t < 1; t += 0.035) {
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        px(p.c, x - 1, y - 1, '#8a8e92');
        px(p.c, x + 1, y + 1, '#3e4246');
      }
    }
    // top and bottom wires, a few weeds and a plastic bag caught in the mesh
    const [t0x, t0y] = F.F(0, H - 1);
    const [t1x, t1y] = F.F(W, H - 1);
    ln(p.c, t0x, t0y, t1x, t1y, '#5a5e62', 2);
    ln(p.c, t0x, t0y - 1, t1x, t1y - 1, '#a8acae');
    for (let a = 0.3; a < W; a += 0.7 + Rn()) {
      const [x, y] = p.P(a, b + 0.05, 0);
      px(p.c, x, y - 4, WEED[3], 2, 4);
      px(p.c, x + 2, y - 6, WEED[4], 2, 6);
      px(p.c, x - 2, y - 3, WEED[2], 2, 3);
    }
    if (Rn() < 0.5) {
      const [bx, by] = F.F(0.4 + Rn() * (W - 0.8), 6 + Rn() * 6);
      fillPoly(p.c, [[bx - 4, by - 3], [bx + 5, by - 4], [bx + 3, by + 4], [bx - 3, by + 3]], '#e8e4dc');
      px(p.c, bx - 2, by - 2, '#ffffff', 3, 1);
    }
  },
};

/** Things in the canal: a shopping trolley half sunk, a bobbing bottle, a tyre, a drift of leaves. */
const fac_flotsam: PropArt = {
  draw(p, k) {
    const v = k.variant ?? ['trolley', 'tyre', 'bottle'][k.seed % 3];
    const [x, y] = p.P(0.5, 0.5, WATER_Z);
    const ring = (rx: number, ry: number) => {
      p.c.globalAlpha = 0.5;
      for (let a = 0; a < Math.PI * 2; a += 0.15) px(p.c, x + Math.cos(a) * rx, y + Math.sin(a) * ry, '#8aa09a', 2, 1);
      p.c.globalAlpha = 1;
    };
    if (v === 'trolley') {
      // the handle and the top of the basket above the water, a dark shape below
      layer(p.c, (l) => {
        p.c.globalAlpha = 1;
        fillPoly(l, [[x - 16, y + 2], [x + 10, y - 6], [x + 18, y + 2], [x - 8, y + 10]], '#1a2a24');
        for (let i = 0; i < 6; i++) ln(l, x - 14 + i * 5, y - 2 - i * 1.5, x - 10 + i * 5, y - 14 - i * 1.5, '#8a8e96');
        ln(l, x - 14, y - 14, x + 12, y - 22, '#a8acb4', 2);
        ln(l, x - 14, y - 2, x + 12, y - 10, '#7a7e86');
        ln(l, x + 12, y - 22, x + 20, y - 26, '#c8302a', 3);
      }, { outline: 0.5, rect: [x - 22, y - 32, x + 26, y + 14] });
      ring(24, 9);
    } else if (v === 'tyre') {
      ell(p.c, x, y, 11, 5, '#1a181e');
      ell(p.c, x, y - 1, 11, 5, '#2a2830');
      ell(p.c, x, y - 1, 5, 2, '#1e2c26');
      ring(15, 6);
    } else {
      px(p.c, x - 3, y - 3, '#d8e8e4', 6, 3);
      px(p.c, x + 3, y - 2, '#3a7ac8', 2, 2);
      ring(7, 3);
      for (let i = 0; i < 7; i++) px(p.c, x - 20 + hash(i, 1, k.seed) * 40, y - 6 + hash(i, 2, k.seed) * 12, ['#8a6a3a', '#a87a3a', '#6a7a3a'][i % 3], 3, 1);
    }
  },
  anim(p, k) {
    // slow rings spreading round it
    const [x, y] = p.P(0.5, 0.5, WATER_Z);
    const u = p.k / 4;
    const t = (k.t * 0.4 + k.seed * 0.3) % 1;
    p.c.globalAlpha = 0.35 * (1 - t);
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      p.c.fillStyle = '#b8ccc8';
      p.c.fillRect(Math.round(x + Math.cos(a) * (14 + t * 22) * u), Math.round(y + Math.sin(a) * (6 + t * 9) * u), Math.max(1, Math.round(2 * u)), Math.max(1, Math.round(u)));
    }
    p.c.globalAlpha = 1;
  },
};

export const FACTORY_CANAL: Record<string, PropArt> = {
  fac_quay,
  ...FACTORY_BOATS,
  fac_crane,
  fac_bollard,
  fac_lifebuoy,
  fac_buddleia,
  fac_birch,
  fac_reeds,
  fac_fence,
  fac_flotsam,
};

export { WATER_Z };

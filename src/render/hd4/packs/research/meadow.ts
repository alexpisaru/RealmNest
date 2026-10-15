// Research Hub — the rich alpine slope round the lodge (1 z ≈ 10 cm).
//   res_steps     a flight of granite steps between two cheek walls, set into a
//                 grassy bank (rot 1 for a flight along y)
//   res_outcrop   a rocky outcrop: big pale granite blocks heaped together,
//                 lichen, moss and flowers in their joints (2×2)
//   res_falls     a little waterfall: water spilling off a rock step into the
//                 pond, white foam at its foot
//   res_bloom     a dense drift of mixed alpine flowers (rose, pink, purple,
//                 yellow, white) round a few leafy tufts
//   res_rhodo     an alpenrose (rhododendron) bush in full bloom
//   res_hummock   a grassy hummock: a lit mound of turf with flowers on it
import type { Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { anchor, lbox } from '../util';
import { grassSkirt, plot, rockMass } from './kit';

/** Pale sunlit granite, as the reference's boulders: white tops, mid-grey flanks, dark clefts. */
export const ROCKL: Ramp = ['#3a3a3e', '#525256', '#6a6a6e', '#848486', '#9e9d9c', '#b8b6b2', '#d2d0cc', '#ecebe6'];
const LEAF: Ramp = ['#142a12', '#1e3c18', '#2a521e', '#386826', '#4a7e2e', '#62963a', '#7eae48'];
const TURF: Ramp = ['#24380e', '#344c16', '#46621e', '#5a7a28', '#709234', '#8aaa42', '#a6c254'];
/** Bloom colours of the drifts: [petal, highlight]. */
const BLOOMS: [string, string][] = [
  ['#d8304a', '#f06a78'], // red campion
  ['#e0508a', '#f490b8'], // pink primula
  ['#9a5ad0', '#c49af0'], // purple bellflower
  ['#f0c828', '#fff07a'], // yellow globeflower
  ['#f4f2ea', '#ffffff'], // white daisies
  ['#5a6ae0', '#8a9af8'], // gentian
];

// ── stone steps ─────────────────────────────────────────────
const res_steps: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const n = 4;
    const rise = 1.6;
    const tread = (D - 0.1) / n;
    const cut = (top: boolean): Mat => (light) => (u, v, x, y) => {
      // granite slabs: joints every slab, a worn lit nosing, speckle
      if ((u % 26) < 1.1) return '#3e3e42';
      let i = top ? 5 : light === 1 ? 3.4 : 2;
      if (!top && v > 4.2) i += 1.2;
      if (top && v < 2) i -= 0.6;
      if (hash(x, y, 7) < 0.08) i -= 1;
      else if (hash(x, y, 8) > 0.94) i += 0.8;
      return at(ROCKL, i);
    };
    const wall: Mat = (light) => (u, v, x, y) => {
      // a coursed rubble cheek wall with dark joints
      const row = Math.floor(v / 4.5);
      const off = row & 1 ? 7 : 0;
      const col = Math.floor((u + off) / 14);
      if (v - row * 4.5 < 0.9 || (u + off) - col * 14 < 1) return '#2e2e32';
      let i = (light === 2 ? 5 : light ? 3.8 : 2.2) + (hash(col, row, 31) - 0.5) * 1.6;
      if (hash(x, y, 32) < 0.06) i -= 1;
      return at(ROCKL, i);
    };
    const cw = 0.16;
    const side = (a0: number) => {
      for (let i = 0; i < n; i++) lbox(p, a0, 0, cw, D - i * tread, i * rise, rise + (i === n - 1 ? 1.4 : 0), { front: wall, side: wall, top: wall, edge: '#2a2a2e' });
    };
    // the far cheek wall, the treads from the bottom up, the near cheek wall
    side(0);
    for (let i = 0; i < n; i++) lbox(p, cw, 0, W - cw * 2, D - i * tread, i * rise, rise, { front: cut(false), side: cut(false), top: cut(true), edge: '#2e2e32' });
    side(W - cw);
    // moss on the treads' back edges, tufts along the cheek walls
    const R = rng(k.seed * 7 + 3);
    layer(p.c, (l) => {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 4; j++) {
          const a = cw + 0.06 + R() * (W - cw * 2 - 0.12);
          const [x, y] = p.P(a, D - (i + 1) * tread + 0.03, (i + 1) * rise);
          px(l, x, y, R() < 0.5 ? '#4e6e2a' : '#6a8a34', 2, 1);
        }
      }
      for (const a of [cw / 2, W - cw / 2]) {
        const [x, y] = p.P(a, D, 0);
        for (let i = 0; i < 6; i++) ln(l, x + i * 2 - 5, y + 1, x + i * 2 - 6 + R() * 3, y - 3 - R() * 6, TURF[2 + (i % 4)]);
        const [tx, ty] = p.P(a, 0.1, n * rise + 1.4);
        for (let i = 0; i < 5; i++) ln(l, tx + i * 2 - 4, ty, tx + i * 2 - 5 + R() * 3, ty - 3 - R() * 4, TURF[3 + (i % 3)]);
        px(l, tx - 2, ty - 5, '#f2d240', 2, 2);
      }
    }, { outline: 0.45 });
  },
};

// ── a rocky outcrop ─────────────────────────────────────────
const res_outcrop: PropArt = {
  draw(p, k) {
    const W = k.w;
    const [x, y] = anchor(p, W / 2, k.d / 2, 0);
    const R = rng(k.seed * 23 + 9);
    const S = (W / 2) * (0.85 + R() * 0.3);
    contactShadow(p.c, x + 30 * S, y + 10 * S, 110 * S, 36 * S, 0.34);
    // the blocks, back to front: a tall one behind, flanking ones, low ones in front
    const blocks: [number, number, number, number][] = [
      [-6, -26, 58, 44],
      [-58, -6, 44, 32],
      [48, -10, 46, 34],
      [10, 10, 52, 30],
      [-34, 18, 36, 22],
      [56, 22, 28, 18],
    ];
    const n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const [dx, dy, rx, ry] = blocks[i];
      const j = 0.85 + R() * 0.3;
      layer(p.c, (l) => rockMass(l, x + dx * S, y + dy * S - ry * S * 0.5, rx * S * j, ry * S * j, k.seed * 11 + i * 5, ROCKL, { lichen: 0.015, moss: i > 2 ? 0.5 : 0.2 }), { outline: 0.66 });
    }
    // grass, flowers and a little juniper in the joints and round the foot
    layer(p.c, (l) => {
      grassSkirt(l, x, y + 18 * S, 96 * S, 24 * S, k.seed, 34, TURF);
      for (let i = 0; i < 18; i++) {
        const a = R() * Math.PI;
        const bx = x + Math.cos(a) * 92 * S * (0.7 + R() * 0.35);
        const by = y + 14 * S + Math.sin(a) * 22 * S * (0.6 + R() * 0.4);
        const [c0, c1] = BLOOMS[Math.floor(R() * BLOOMS.length)];
        px(l, bx, by - 3, c0, 2, 2);
        px(l, bx, by - 3, c1);
      }
    }, { outline: 0.4 });
    if (R() < 0.6) layer(p.c, (l) => foliage(l, [{ x: x + 70 * S, y: y + 6 * S, rx: 22 * S, ry: 11 * S, z: 1 }, { x: x + 88 * S, y: y + 12 * S, rx: 14 * S, ry: 8 * S, z: 2 }], ['#142a26', '#1c3830', '#264a3a', '#325c46', '#426e52', '#58845e'], k.seed, { cell: 2.6 }), { outline: 0.6 });
  },
};

// ── the pond's little waterfall ─────────────────────────────
// A sheet of water spilling through a notch between two rocks: a bright lip, ribbons with light streaks and
// clean dark edges, a ring of foam and spray where it lands. The animation slides streaks down the same
// ribbons (FALL_GEOM), so it always sits exactly on the drawn sheet.
const FALL = { lip: '#ffffff', lipEdge: '#9ccfe4', edge: '#2e6a8c', edge2: '#6aa8c8', seam: '#9ccbe0', a: '#c6e4f1', b: '#e4f2f9', c: '#b2d8ea', foam: '#ffffff', foamS: '#cfe4ef', pool: '#4a8eb0' };
/** The sheet in px from the prop's ground point: top, bottom, half width; ribbons 4 px wide. */
const FALL_GEOM = { top: -60, bot: -4, hw: 11, rib: 4 };
const res_falls: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const { top, bot, hw, rib } = FALL_GEOM;
    // the rock step the water spills off: two blocks with a notch between them
    layer(p.c, (l) => rockMass(l, x - 30, y - 30, 26, 34, k.seed * 3 + 1, ROCKL, { lichen: 0.01, moss: 0.5 }), { outline: 0.66 });
    layer(p.c, (l) => rockMass(l, x + 30, y - 26, 24, 30, k.seed * 3 + 2, ROCKL, { lichen: 0.01, moss: 0.5 }), { outline: 0.66 });
    layer(p.c, (l) => {
      // the lip: water curling over the edge of the notch
      for (let xx = -hw - 1; xx <= hw + 1; xx++) {
        const lift = Math.round(Math.sqrt(Math.max(0, 1 - (xx / (hw + 1)) ** 2)) * 2);
        for (let j = 0; j < 4; j++) plot(l, x + xx, y + top - lift + j, j === 0 ? FALL.lipEdge : FALL.lip);
      }
      // the sheet: ribbons, a seam between them, a light streak down some, dark clean edges
      for (let yy = top + 4; yy < bot; yy++)
        for (let xx = -hw; xx <= hw; xx++) {
          const e = hw - Math.abs(xx);
          let c: string;
          if (e < 1) c = FALL.edge;
          else if (e < 2) c = FALL.edge2;
          else {
            const ri = Math.floor((xx + hw) / rib);
            const fr = xx + hw - ri * rib;
            const ph = hash(ri, 5, 31);
            if (fr === 0) c = FALL.seam;
            else if (fr === 2 && (yy - top + ph * 40) % 26 < 14) c = FALL.lip;
            else c = ph < 0.35 ? FALL.a : ph < 0.7 ? FALL.b : FALL.c;
          }
          plot(l, x + xx, y + yy, c);
        }
    });
    // the plunge: a little pool, a ring of foam, round puffs of spray over the foot of the sheet
    layer(p.c, (l) => {
      ell(l, x, y + 3, 26, 9, FALL.pool);
      ell(l, x, y + 1, 22, 7, FALL.foamS);
      ell(l, x - 1, y, 19, 5, FALL.foam);
      for (const [dx, dy, r] of [[-10, -4, 6], [0, -6, 7], [10, -4, 6]] as const) {
        ell(l, x + dx, y + dy, r, r * 0.7, FALL.foamS);
        ell(l, x + dx - 1, y + dy - 1, r - 1.5, r * 0.7 - 1.5, FALL.foam);
      }
    }, { outline: 0.35 });
    // grass on the rocks
    layer(p.c, (l) => {
      grassSkirt(l, x - 32, y - 56, 18, 5, k.seed + 3, 10, TURF);
      grassSkirt(l, x + 30, y - 50, 16, 5, k.seed + 4, 10, TURF);
    }, { outline: 0.4 });
  },
  anim(p, k) {
    // bright streaks sliding down the middle of the ribbons, clipped to the sheet above the spray
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const { top, hw, rib } = FALL_GEOM;
    const u = p.k / 4;
    const y0 = top + 6;
    const y1 = -12;
    p.c.fillStyle = FALL.lip;
    for (let ri = 0; ri < Math.floor((2 * hw) / rib); ri++) {
      const xx = -hw + ri * rib + 2;
      if (hw - Math.abs(xx) < 2) continue;
      const t = (k.t * 0.8 + hash(ri, 7, 31)) % 1;
      const ya = y0 + t * (y1 - y0);
      const yb = Math.min(y1, ya + 8);
      if (yb > ya) p.c.fillRect(Math.round(x + xx * u), Math.round(y + ya * u), Math.max(1, Math.round(u)), Math.max(1, Math.round((yb - ya) * u)));
    }
  },
};

// ── a dense drift of mixed flowers ──────────────────────────
const res_bloom: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 37 + 5);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    // one or two dominant colours per drift, the odd other bloom
    const main = k.variant === 'mixed' ? -1 : Math.floor(R() * BLOOMS.length);
    const second = Math.floor(R() * BLOOMS.length);
    layer(p.c, (l) => {
      // leafy tufts under the flowers
      const tufts: Mass[] = [];
      for (let i = 0; i < 6; i++) tufts.push({ x: cx + (R() - 0.5) * 80, y: cy + (R() - 0.5) * 30, rx: 9 + R() * 6, ry: 4 + R() * 2, z: i });
      foliage(l, tufts, LEAF, k.seed, { cell: 2 });
      const n = 46 + Math.floor(R() * 20);
      for (let i = 0; i < n; i++) {
        const x = cx + (R() - 0.5) * 92;
        const y = cy + (R() - 0.5) * 40;
        if (((x - cx) / 46) ** 2 + ((y - cy) / 20) ** 2 > 1) continue;
        const pick = main < 0 ? Math.floor(R() * BLOOMS.length) : R() < 0.62 ? main : R() < 0.7 ? second : Math.floor(R() * BLOOMS.length);
        const [c0, c1] = BLOOMS[pick];
        const h = 2 + R() * 7;
        ln(l, x, y, x + (R() - 0.5) * 2, y - h, LEAF[3 + (i % 3)]);
        px(l, x - 1, y - h - 1, c0, 3, 2);
        px(l, x, y - h - 2, c1, 1, 1);
      }
    }, { outline: 0.42 });
  },
};

// ── an alpenrose bush ───────────────────────────────────────
const res_rhodo: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 43 + 7);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    const s = 0.8 + R() * 0.45;
    contactShadow(p.c, cx + 16 * s, cy + 5, 44 * s, 13 * s, 0.32);
    const m: Mass[] = [];
    for (let i = 0; i < 11; i++) m.push({ x: cx + (R() - 0.5) * 70 * s, y: cy - 8 * s - R() * 26 * s, rx: (12 + R() * 7) * s, ry: (9 + R() * 5) * s, z: i });
    const pink = k.seed % 3 === 0;
    layer(p.c, (l) => foliage(l, m, ['#10220e', '#183216', '#22441c', '#2e5824', '#3c6c2c', '#4e8236', '#66983e'], k.seed, { cell: 2.6, tilt: 0.22, dots: pink ? ['#e0508a', '#f490b8', '#c83a70'] : ['#c8203a', '#e8404a', '#f06a70'], dotChance: 0.75, dotSize: 3 }), { outline: 0.62 });
  },
};

// ── a grassy hummock ────────────────────────────────────────
const res_hummock: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 59 + 3);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    const rx = 30 + R() * 14;
    const ry = 12 + R() * 4;
    const hgt = 6 + R() * 5;
    contactShadow(p.c, cx + 12, cy + 4, rx * 0.9, ry * 0.7, 0.24);
    layer(p.c, (l) => {
      // a dome of turf: shaded by its slope, lit upper left, blades and blooms on top
      for (let yy = Math.floor(cy - ry - hgt); yy <= cy + ry; yy++)
        for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
          const dx = (xx - cx) / rx;
          const dyb = (yy - cy) / ry;
          if (dx * dx + dyb * dyb > 1) {
            // the raised part above the footprint ellipse
            const top = cy - Math.sqrt(Math.max(0, 1 - dx * dx)) * ry - hgt * (1 - dx * dx);
            if (yy < top || Math.abs(dx) > 1 || yy > cy) continue;
          }
          const hz = Math.max(0, 1 - dx * dx - dyb * dyb);
          let t = 2.3 + -dx * 1.5 - dyb * 1.1 + Math.sqrt(hz) * 0.7 + (hash(xx, yy, 9) - 0.5) * 1.4;
          if (hash(xx >> 1, yy, 10) < 0.07) t += 1.6;
          plot(l, xx, yy, at(TURF, t));
        }
      for (let i = 0; i < 14; i++) {
        const x = cx + (R() - 0.5) * rx * 1.6;
        const y = cy - hgt * 0.6 + (R() - 0.5) * ry;
        ln(l, x, y, x + (R() - 0.5) * 3, y - 3 - R() * 4, TURF[4 + (i % 3)]);
      }
      for (let i = 0; i < 7; i++) {
        const [c0, c1] = BLOOMS[Math.floor(R() * BLOOMS.length)];
        const x = cx + (R() - 0.5) * rx * 1.4;
        const y = cy - hgt * 0.5 + (R() - 0.5) * ry * 0.8;
        px(l, x, y - 3, c0, 2, 2);
        px(l, x, y - 3, c1);
      }
    }, { outline: 0.35 });
  },
};

export const RESEARCH_MEADOW: Record<string, PropArt> = { res_steps, res_outcrop, res_falls, res_bloom, res_rhodo, res_hummock };

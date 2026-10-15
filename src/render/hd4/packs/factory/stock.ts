// Factory — stock and greenery of the yards (1 z ≈ 10 cm; a tile ≈ 1.6 m).
//   fac_container  a shipping container (6 or 12 m) in a liner's colour: ribbed steel,
//                  doors and locking bars on its +a end, the owner's code
//   fac_pipes      a stack of steel pipes on timber bearers, their open ends toward +a
//   fac_bags       a bulk bag of granulate on a pallet, its lifting loops up
//   fac_tree       a sycamore on the waste ground: a full, bright crown
//   fac_clutter    a patch of yard clutter (w × d): pallets of goods, crates, drums, gas
//                  bottles, totes, bulk bags, pipe stacks, a skip, bins ('yard' · 'scrap' · 'wharf')
import type { Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { contactShadow, ell, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, pq, side } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { drawItem, type Item, type ItemKind } from './estate';
import { planeText } from './font';
import { drawSkip } from './yard';
import { at, corrugated, IRON, massRect, planks, rampOf, TIMBER, visA } from './palette';

const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });

const LIVERY: Record<string, string> = { green: '#46784e', red: '#a84332', blue: '#4a74a0', navy: '#2e4670', grey: '#8a8c90' };

// ── the container ───────────────────────────────────────────
const fac_container: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const col = k.color ?? LIVERY[k.variant ?? ''] ?? Object.values(LIVERY)[k.seed % 4];
    const r = rampOf(col);
    const H = 26;
    footShadow(p, 0.04, 0.04, W, D, H, 0.34);
    const body = corrugated(r, 0.16, 10);
    lbox(p, 0.04, 0.04, W - 0.08, D - 0.08, 0, H, { front: body, side: body, top: (light) => (u, _v, x, y) => at(r, (light === 2 ? 4 : 3) + (u % 24 < 1.5 ? -1 : 0) - (hash(x, y, 3) < 0.04 ? 1 : 0)), edge: r[0] });
    const F = front(p, D - 0.04 + 0.001);
    const S = side(p, visA(p, 0.039, W - 0.039));
    // corner castings and the top and bottom rails
    for (const a of [0.04, W - 0.2]) {
      pq(p, F, a, a + 0.16, 0, 2, r[1]);
      pq(p, F, a, a + 0.16, H - 2, H, r[1]);
    }
    pq(p, F, 0.04, W - 0.04, 0, 1.4, r[1]);
    pq(p, F, 0.04, W - 0.04, H - 1.4, H, r[F.light ? 4 : 2]);
    // the doors on the end: a split down the middle, four locking bars, hinges
    const bm = D / 2;
    pq(p, S, bm - 0.02, bm + 0.02, 1, H - 1, r[0]);
    for (const b of [0.28, bm - 0.22, bm + 0.22, D - 0.32]) {
      pq(p, S, b - 0.025, b + 0.025, 1.4, H - 1.4, IRON[3]);
      pq(p, S, b - 0.05, b + 0.05, 10, 11, IRON[4]);
    }
    pq(p, S, 0.04, D - 0.04, H - 1.4, H, r[1]);
    // the owner's code and a hazard diamond now and then
    const code = ['HLXU', 'MSKU', 'CMAU', 'TGHU', 'EWLU'][k.seed % 5] + ' ' + (200000 + Math.floor(hash(k.seed, 7) * 799999));
    planeText(p.c, F, W * 0.7, H - 6, code, '#ece8de', 1);
    if (W > 5) planeText(p.c, F, W * 0.32, H * 0.55, ['HILSON', 'EVERWAY', 'ALBION'][k.seed % 3], '#ece8de', 3);
  },
};

// ── a stack of pipes ────────────────────────────────────────
const fac_pipes: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const black = k.variant === 'black' || (k.variant === undefined && k.seed % 2 === 0);
    const PR: Ramp = black ? ['#16161a', '#222228', '#2e2e36', '#3c3c46', '#50505c', '#6c6c78'] : ['#4a4c52', '#5e6066', '#74767c', '#8a8c92', '#a4a6ac', '#c8cace'];
    footShadow(p, 0.05, 0.05, W, D, 14, 0.32);
    // timber bearers across, under the stack
    for (const a of [0.4, W / 2, W - 0.6]) lbox(p, a, 0.02, 0.18, D - 0.04, 0, 1.4, mono(planks(TIMBER, 3), TIMBER[0]));
    // rows of pipes along a: each a lit band and a dark belly, its open end on the +a face
    const r = 0.16; // radius in tiles (≈ 25 cm)
    const rz = r * 16; // in z units: a tile is ~16 z wide here
    const rows = [Math.max(1, Math.floor((D - 0.1) / (2 * r)))];
    while (rows[rows.length - 1] > 1 && rows.length < 4) rows.push(rows[rows.length - 1] - 1);
    rows.forEach((n, row) => {
      const z = 1.4 + rz + row * rz * 1.7;
      const off = (D - n * 2 * r) / 2;
      for (let i = 0; i < n; i++) {
        const b = off + r + i * 2 * r;
        const [x0, y0] = p.P(0.05, b, z);
        const [x1, y1] = p.P(W - 0.05, b, z);
        const R = rz * 4;
        // the body: bands from the lit top to the shaded belly
        for (let j = -R; j <= R; j++) {
          const f = (j + R) / (2 * R);
          const col = PR[f < 0.15 ? 5 : f < 0.35 ? 4 : f < 0.6 ? 3 : f < 0.85 ? 2 : 1];
          ln(p.c, x0, y0 + j, x1, y1 + j, col);
        }
        // the open end: a ring and the dark bore
        layer(p.c, (l) => {
          ell(l, x1, y1, R * 0.62, R, PR[2]);
          ell(l, x1 - 1, y1, R * 0.5, R * 0.82, PR[4]);
          ell(l, x1, y1 + 1, R * 0.4, R * 0.66, '#121014');
        }, { outline: 0.5, rect: [x1 - R - 2, y1 - R - 2, x1 + R + 2, y1 + R + 2] });
      }
    });
    // a strap and a painted end mark
    const F = front(p, D);
    pq(p, F, W * 0.3, W * 0.3 + 0.05, 1.4, 1.4 + rows.length * rz * 1.7 + rz, '#c8382a');
  },
};

// ── a bulk bag ──────────────────────────────────────────────
const fac_bags: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 14, 0.3);
    lbox(p, 0.1, 0.1, 0.8, 0.8, 0, 1.3, mono(planks(TIMBER, 3), TIMBER[0]));
    const WH: Ramp = ['#8a8678', '#a8a496', '#c4c0b0', '#dad6c6', '#ebe8da', '#f6f4ec'];
    const woven: Mat = (light) => (u, v, x, y) => at(WH, (light === 2 ? 4 : light ? 3.4 : 2.2) + ((u + v) % 4 < 1 ? -0.4 : 0) + (v < 3 ? -0.6 : 0) - (hash(x, y, 4) < 0.04 ? 0.8 : 0));
    lbox(p, 0.14, 0.14, 0.72, 0.72, 1.3, 11, mono(woven, WH[0]));
    // a bulge, the loops at the corners, a label
    const F = front(p, 0.86);
    pq(p, F, 0.14, 0.86, 6, 6.6, WH[2]);
    pq(p, F, 0.3, 0.6, 3.5, 6, k.seed % 2 ? '#3a6aa8' : '#d8a828');
    for (const [a, b] of [[0.18, 0.82], [0.82, 0.82], [0.82, 0.18], [0.18, 0.18]] as const) {
      const [x, y] = p.P(a, b, 12.3);
      ln(p.c, x - 2, y, x, y - 6, '#3a6aa8', 2);
      ln(p.c, x, y - 6, x + 2, y, '#3a6aa8', 2);
    }
  },
};

// ── a sycamore ──────────────────────────────────────────────
const LEAF: Ramp = ['#1e2c0c', '#2c4012', '#3c5618', '#4e6e20', '#64882a', '#80a236', '#a2bc52'];
const fac_tree: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 23 + 5);
    const s = 0.9 + Rn() * 0.4;
    const H = 58 * s;
    contactShadow(p.c, x + 44 * s, y + 8, 70 * s, 22 * s, 0.3);
    layer(p.c, (l) => {
      // a short trunk forking into three limbs
      for (let j = 0; j < H; j++) {
        const w = Math.max(3, 9 * s * (1 - j / H * 0.5));
        for (let i = 0; i < w; i++) px(l, x - w / 2 + i, y - j, i < w * 0.35 ? '#7a6650' : i < w * 0.75 ? '#5a4a3a' : '#3e3228');
      }
      for (const dx of [-28, 4, 26]) ln(l, x, y - H * 0.75, x + dx * s, y - H - 26 * s, '#4a3c2e', 3);
    }, { outline: 0.6, rect: [x - 40 * s, y - H - 40, x + 40 * s, y + 4] });
    // a full crown of leaf clumps, brighter to the upper left
    const masses: Mass[] = [];
    for (let i = 0; i < 20; i++) {
      const ang = Rn() * Math.PI * 2;
      const rr = Rn() * 52 * s;
      masses.push({ x: x + Math.cos(ang) * rr * 1.2, y: y - H - 44 * s + Math.sin(ang) * rr * 0.85, rx: (26 + Rn() * 12) * s, ry: (22 + Rn() * 10) * s, z: i });
    }
    layer(p.c, (l) => foliage(l, masses, LEAF, k.seed, { cell: 3.4, holes: 0.08, tilt: 0.3 }), { outline: 0.6, rect: massRect(masses) });
  },
};

// ── a patch of clutter ──────────────────────────────────────
const MIX: Record<string, ItemKind[]> = {
  yard: ['pallet', 'pallet', 'pallet', 'crate', 'crate', 'bags', 'ibc', 'drum', 'pipes', 'gas'],
  scrap: ['pipes', 'pipes', 'drum', 'skip', 'gas', 'bin', 'pallet', 'crate'],
  wharf: ['crate', 'crate', 'pallet', 'drum', 'bags', 'pallet', 'ibc'],
};
const WIDTH: Record<ItemKind, number> = { pallet: 0.95, crate: 0.85, drum: 0.55, gas: 0.6, skip: 1.25, bin: 0.72, ibc: 0.5, bags: 0.95, pipes: 1.1 };
const fac_clutter: PropArt = {
  draw(p, k) {
    // stock at true size: a pallet is 1.2 m (0.75 tile)
    const S = 1.6;
    const R = rng(k.seed * 7919 + 17);
    const mix = MIX[k.variant ?? 'yard'] ?? MIX.yard;
    const items: Item[] = [];
    for (let b = 0.05; b < k.d - 0.5 * S; b += 0.62 * S) {
      for (let a = 0.05 + R() * 0.2; a < k.w - 0.45 * S; ) {
        const kind = mix[Math.floor(R() * mix.length)];
        const n = kind === 'pallet' || kind === 'bags' ? (R() < 0.6 ? 2 : 1) : 1 + Math.floor(R() * 3);
        const w = (kind === 'pallet' || kind === 'bags' ? 0.48 * n : WIDTH[kind]) * S;
        if (a + w > k.w) break;
        if (R() < 0.85) items.push({ kind, a, b, n, seed: k.seed * 131 + items.length * 7 + 1, s: S });
        a += w + 0.05 + R() * 0.15;
      }
    }
    items.sort((m, n) => m.a + m.b - (n.a + n.b));
    // a skip is drawn by the yard's own skip art at full size (the estate's little one is for the far blocks)
    for (const it of items) if (it.kind === 'skip') drawSkip(p, it.a - 0.05, it.b - 0.05, WIDTH.skip * S, Math.min(1, k.d - it.b + 0.05), it.seed, hash(it.seed, 2, 9) < 0.6 ? '#e4ae22' : '#2f5eaa', 13);
    else drawItem(p, it);
  },
};

export const FACTORY_STOCK: Record<string, PropArt> = { fac_container, fac_pipes, fac_bags, fac_tree, fac_clutter };

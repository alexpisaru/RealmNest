// Factory — the estate round the Albion Works, to the frame's edge (flat fills: cheap to draw).
//   fac_roofs   a 12 × 12 block of the estate: brick sheds, warehouses and mill offices
//               packed along alleys, under blue slate in visible courses, tarred flat roofs
//               crowded with plant (air handlers, ducts, vents, rooflights), grey corrugated
//               sheeting or north-light glass; rows of lit windows with stone sills and
//               lintels, quoined corners, open loading bays glowing warm with a pool of lamp
//               light on the setts, pipe racks across and along the alleys, and the alleys'
//               clutter: pallets, crates, drums, gas bottles, skips, bins, totes, pipe stacks
// The block's plan (one per sprite variation) is shared by the drawing, the smoke and
// the night lights. Light comes from the upper left: +b faces lit, +a faces in shade,
// cast shadows fall onto the ground past the +a faces.
import { darken, lighten } from '../../../color';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { ell, fillPoly, ln, px, rng } from '../../kit4';
import { front, type Plane, pq, side } from '../../plane4';

type V2 = [number, number];
type V3 = [number, number, number];

type Kind = 'slateA' | 'slateB' | 'flat' | 'corr' | 'saw';
interface Bld {
  a0: number;
  b0: number;
  a1: number;
  b1: number;
  /** eaves height (z) and storeys */
  h: number;
  n: number;
  kind: Kind;
  wall: string;
  /** chimney stack on the roof: a, b, height above the eaves */
  chim?: [number, number, number];
  /** a loading bay on the front (+b) or side (+a) face: centre u, open (lit) or shut */
  bayF?: [number, boolean];
  bayS?: [number, boolean];
  /** arched windows (the older mill buildings) */
  arched: boolean;
  seed: number;
}
interface Rack {
  /** a pipe bridge over an alley: along a or along b, from-to, at the other coordinate */
  along: 'a' | 'b';
  u0: number;
  u1: number;
  at: number;
  z: number;
}
type ItemKind = 'pallet' | 'crate' | 'drum' | 'gas' | 'skip' | 'bin' | 'ibc' | 'bags' | 'pipes';
interface Item {
  kind: ItemKind;
  a: number;
  b: number;
  n: number;
  seed: number;
  /** drawing scale (1: the estate's, seen from afar) */
  s?: number;
}
interface Plan {
  blds: Bld[];
  racks: Rack[];
  items: Item[];
  /** the alleys (open ground) as rectangles a0, b0, a1, b1 */
  alleys: [number, number, number, number][];
}

/** The sprite variations repeat every this many blocks (see the pack's reuse map). */
export const ESTATE_VARIANTS = 8;
const variantOf = (k: PropCtx) => ((Math.max(1, k.seed) - 1) % ESTATE_VARIANTS) + 1;

// the reference's estate: rich brick, blue slate, tar, galvanised sheet, warm lit glass
const WALLS = ['#b8664a', '#c07250', '#a95c40', '#b46a4c', '#9e5238', '#c47a58', '#b05e40'];
const SLATE_R = ['#1e2029', '#262833', '#30333f', '#3c3f4c', '#4a4e5c', '#5a5f6e', '#737a8a', '#8e95a4'];
const TAR = ['#38373a', '#454447', '#4f4e51', '#58575a', '#626164', '#706f72', '#828184'];
const SHEET_R = ['#4c4c52', '#5e5e64', '#727278', '#86858b', '#9a999e', '#b2b1b6', '#cccbd0'];
const GLAZE = ['#1e2a32', '#33434c', '#4a5e68', '#62787f', '#80989e', '#a8bcc0', '#d8e8ea'];
const LIT = '#f4c858';
const LIT_HI = '#ffeaa8';
const LIT_LO = '#c8923a';
const DARK_WIN = '#1e2832';
const FRAME = '#221c20';
const SILL = '#ddd0b6';
const MOSS = ['#4a5426', '#5e6a2e', '#76823a'];
const SHADE = '#120c16';

const plans = new Map<string, Plan>();

function planOf(k: PropCtx): Plan {
  const v = variantOf(k);
  const key = `${k.w}|${k.d}|${v}`;
  let P = plans.get(key);
  if (P) return P;
  const R = rng(v * 977 + 131);
  const W = k.w;
  const D = k.d;
  const inset = 0.4;
  const blds: Bld[] = [];
  const racks: Rack[] = [];
  const items: Item[] = [];
  const alleys: [number, number, number, number][] = [];
  let iseed = v * 101;
  const KINDS: ItemKind[] = ['pallet', 'pallet', 'crate', 'drum', 'gas', 'skip', 'bin', 'ibc', 'bags', 'pipes', 'crate', 'drum'];
  const pick = () => KINDS[Math.floor(R() * KINDS.length)];
  // columns along a, buildings along b in each; alleys between some of them
  const cols: [number, number][] = [];
  for (let a = inset; a < W - inset - 0.5; ) {
    let wa = 2.6 + R() * 2.4;
    if (W - inset - (a + wa) < 2.4) wa = W - inset - a;
    cols.push([a, a + wa]);
    const gap = R() < 0.62 ? 1.0 + R() * 0.6 : 0.1;
    a += wa + gap;
  }
  let s = v * 31;
  for (const [ca0, ca1] of cols) {
    for (let b = inset; b < D - inset - 0.5; ) {
      let db = 2.3 + R() * 1.9;
      if (D - inset - (b + db) < 2.2) db = D - inset - b;
      const r = R();
      const n = r < 0.3 ? 1 : r < 0.78 ? 2 : 3;
      const kr = R();
      let kind: Kind;
      if (n === 1) kind = kr < 0.28 ? 'corr' : kr < 0.5 ? 'slateA' : kr < 0.66 ? 'saw' : kr < 0.84 ? 'flat' : 'slateB';
      else kind = kr < 0.3 ? 'slateB' : kr < 0.56 ? 'slateA' : kr < 0.86 ? 'flat' : 'corr';
      const h = 6 + n * 20;
      const bld: Bld = { a0: ca0, b0: b, a1: ca1, b1: b + db, h, n, kind, wall: WALLS[Math.floor(R() * WALLS.length)], arched: R() < 0.4, seed: s++ };
      if (R() < 0.38) bld.chim = [ca0 + (ca1 - ca0) * (0.25 + R() * 0.5), b + db * (0.2 + R() * 0.4), 16 + R() * 20];
      if (R() < 0.6) bld.bayF = [ca0 + 0.8 + R() * Math.max(0.1, ca1 - ca0 - 1.6), R() < 0.7];
      if (R() < 0.5) bld.bayS = [b + 0.8 + R() * Math.max(0.1, db - 1.6), R() < 0.65];
      blds.push(bld);
      const gap = R() < 0.5 ? 1.0 + R() * 0.6 : 0.1;
      if (gap > 0.5) {
        alleys.push([ca0, b + db, ca1, b + db + gap]);
        // a pipe bridge over the alley; its clutter along the walls
        if (R() < 0.7) racks.push({ along: 'b', u0: b + db - 0.4, u1: b + db + gap + 0.4, at: ca0 + 0.6 + R() * (ca1 - ca0 - 1.2), z: 16 + Math.floor(R() * 3) * 6 });
        for (let a = ca0 + 0.15; a < ca1 - 0.6; a += 0.55 + R() * 0.5) if (R() < 0.6) items.push({ kind: pick(), a, b: b + db + 0.12 + (R() < 0.5 ? 0 : gap - 0.62), n: 1 + Math.floor(R() * 3), seed: iseed++ });
      }
      b += db + gap;
    }
  }
  // pipe bridges and runs over the alleys between the columns, and their clutter
  for (let i = 0; i + 1 < cols.length; i++) {
    const g0 = cols[i][1];
    const g1 = cols[i + 1][0];
    if (g1 - g0 < 0.5) continue;
    alleys.push([g0, 0, g1, D]);
    for (let j = 0; j < 2; j++) if (R() < 0.75) racks.push({ along: 'a', u0: g0 - 0.4, u1: g1 + 0.4, at: 1 + R() * (D - 2), z: 18 + Math.floor(R() * 3) * 6 });
    // a long run of pipes down the alley on posts, close to one wall
    if (R() < 0.6) racks.push({ along: 'b', u0: 0.2, u1: D - 0.2, at: g0 + 0.18 + R() * 0.2, z: 20 + Math.floor(R() * 2) * 6 });
    for (let b = 0.4; b < D - 0.6; b += 0.5 + R() * 0.55) if (R() < 0.62) items.push({ kind: pick(), a: R() < 0.5 ? g0 + 0.1 : g1 - 0.62, b, n: 1 + Math.floor(R() * 3), seed: iseed++ });
  }
  P = { blds, racks, items, alleys };
  plans.set(key, P);
  return P;
}

// ── drawing helpers ─────────────────────────────────────────
const quad = (p: PropPainter, pts: V3[], col: string) => fillPoly(p.c, pts.map(([a, b, z]) => p.P(a, b, z)) as V2[], col);

function lineP(p: PropPainter, A: V3, B: V3, col: string, w = 1) {
  const [x0, y0] = p.P(...A);
  const [x1, y1] = p.P(...B);
  ln(p.c, x0, y0, x1, y1, col, w);
}

/** A little box (roof plant, crates): its top, its lit front (+b) and its shaded side (+a), a dark seam. */
function box(p: PropPainter, a: number, b: number, z: number, w: number, d: number, h: number, top: string, fr: string, sd: string, edge = true) {
  quad(p, [[a, b + d, z], [a + w, b + d, z], [a + w, b + d, z + h], [a, b + d, z + h]], fr);
  quad(p, [[a + w, b + d, z], [a + w, b, z], [a + w, b, z + h], [a + w, b + d, z + h]], sd);
  quad(p, [[a, b, z + h], [a + w, b, z + h], [a + w, b + d, z + h], [a, b + d, z + h]], top);
  if (edge) {
    lineP(p, [a, b + d, z + h], [a + w, b + d, z + h], lighten(top, 0.18));
    lineP(p, [a + w, b + d, z], [a + w, b + d, z + h], darken(sd, 0.35));
  }
}

/** A dark blot on the ground (contact shadow), at alpha. */
function groundShade(p: PropPainter, pts: V3[], alpha: number, col = SHADE) {
  p.c.globalAlpha = alpha;
  quad(p, pts, col);
  p.c.globalAlpha = 1;
}

/** A brick face: courses, speckled bricks, a sooty plinth, a string course per storey, a stone band and dark eaves. */
function brickFace(p: PropPainter, pl: Plane, u0: number, u1: number, h: number, n: number, col: string, seed: number) {
  pq(p, pl, u0, u1, 0, h, col);
  const course = darken(col, 0.12);
  for (let z = 1.5; z < h - 1; z += 1.5) {
    const [x0, y0] = pl.F(u0, z);
    const [x1, y1] = pl.F(u1, z);
    ln(p.c, x0, y0, x1, y1, course);
  }
  // odd bricks: lighter and darker ones, a few burnt patches
  const R = rng(seed * 7 + 5);
  const cnt = Math.round((u1 - u0) * h * 0.9);
  for (let i = 0; i < cnt; i++) {
    const [x, y] = pl.F(u0 + R() * (u1 - u0), 3 + R() * (h - 4));
    const r = R();
    px(p.c, x, y, r < 0.45 ? lighten(col, 0.13) : r < 0.85 ? darken(col, 0.18) : darken(col, 0.32), 5, 2);
  }
  // sooty plinth, string courses, the stone band and the dark shadow under the eaves
  pq(p, pl, u0, u1, 0, 3, darken(col, 0.42));
  pq(p, pl, u0, u1, 3, 3.6, darken(col, 0.22));
  const st = pl.light ? SILL : darken(SILL, 0.32);
  for (let s = 1; s < n; s++) pq(p, pl, u0, u1, s * 20 + 3, s * 20 + 4, st);
  pq(p, pl, u0, u1, h - 1.4, h, st);
  pq(p, pl, u0, u1, h - 2.6, h - 1.4, darken(col, 0.55));
  // quoins at the far corner: stone blocks, long and short in turn
  for (let z = 4; z < h - 3; z += 4) {
    const wq = Math.floor(z / 4) & 1 ? 0.22 : 0.14;
    pq(p, pl, u1 - wq, u1, z, z + 3, pl.light ? '#e4d8be' : '#a89c86');
  }
}

/** A window: dark frame, glass dark or lit warm (glazing bars), a stone sill and a lintel (or a brick arch). */
function win(p: PropPainter, pl: Plane, u: number, w: number, z: number, hz: number, lit: boolean, col: string, arched: boolean) {
  pq(p, pl, u - 0.03, u + w + 0.03, z - 0.5, z + hz + 0.5, FRAME);
  if (lit) {
    pq(p, pl, u, u + w, z, z + hz, LIT);
    pq(p, pl, u, u + w * 0.45, z + hz * 0.5, z + hz, LIT_HI);
    pq(p, pl, u, u + w, z, z + 1.4, LIT_LO);
  } else {
    pq(p, pl, u, u + w, z, z + hz, pl.light ? DARK_WIN : darken(DARK_WIN, 0.25));
    pq(p, pl, u + w * 0.12, u + w * 0.36, z + hz * 0.45, z + hz - 0.6, pl.light ? '#5a6c7a' : '#3e4a56');
    if (pl.light) pq(p, pl, u + w * 0.62, u + w * 0.74, z + hz * 0.7, z + hz - 0.6, '#8aa0ae');
  }
  pq(p, pl, u + w * 0.46, u + w * 0.54, z, z + hz, FRAME);
  pq(p, pl, u, u + w, z + hz * 0.5 - 0.3, z + hz * 0.5 + 0.3, FRAME);
  const st = pl.light ? SILL : darken(SILL, 0.32);
  pq(p, pl, u - 0.06, u + w + 0.06, z - 1.3, z - 0.5, st);
  pq(p, pl, u - 0.06, u + w + 0.06, z - 1.6, z - 1.3, darken(col, 0.5));
  if (arched) {
    // a segmental brick arch: a lighter rim and a keystone
    pq(p, pl, u - 0.04, u + w + 0.04, z + hz + 0.5, z + hz + 1.8, lighten(col, pl.light ? 0.16 : 0.05));
    pq(p, pl, u + w * 0.4, u + w * 0.6, z + hz + 0.5, z + hz + 2.2, st);
  } else pq(p, pl, u - 0.06, u + w + 0.06, z + hz + 0.5, z + hz + 1.8, st);
}

/** A loading bay: open and glowing warm with stock inside, or a grey roller shutter; a lamp over it. */
function bay(p: PropPainter, pl: Plane, u: number, open: boolean) {
  const w = 0.62;
  pq(p, pl, u - w - 0.08, u + w + 0.08, 0, 17, FRAME);
  if (open) {
    pq(p, pl, u - w, u + w, 0, 16, '#d09848');
    pq(p, pl, u - w, u + w, 11, 16, '#a87434');
    pq(p, pl, u - w, u + w, 0, 2, '#8a6030');
    // stock inside: racking, crates and pallets in silhouette
    pq(p, pl, u - w + 0.06, u - w + 0.12, 2, 15, '#4a3420');
    pq(p, pl, u - w + 0.06, u + w - 0.06, 9, 9.6, '#4a3420');
    pq(p, pl, u - w + 0.14, u - 0.15, 0, 6, '#6a4a28');
    pq(p, pl, u - w + 0.16, u - 0.17, 4.8, 6, '#f0c070');
    pq(p, pl, u + 0.1, u + w - 0.12, 0, 8, '#5a3e24');
    pq(p, pl, u + 0.12, u + w - 0.14, 6.6, 8, '#e8b860');
    pq(p, pl, u - 0.3, u + 0.2, 9.6, 13, '#7a5a30');
  } else {
    pq(p, pl, u - w, u + w, 0, 16, pl.light ? '#8e8e94' : '#6a6a70');
    for (let z = 1; z < 16; z += 1.4) pq(p, pl, u - w, u + w, z, z + 0.5, pl.light ? '#62626a' : '#4e4e56');
    pq(p, pl, u - w, u + w, 0, 1, '#e4b030');
  }
  // a canopy and the lamp: a bracket and a warm bulb
  pq(p, pl, u - w - 0.14, u + w + 0.14, 17, 18.6, '#2e2e34');
  pq(p, pl, u - w - 0.14, u + w + 0.14, 18.6, 19.2, '#6a6a72');
  const [lx, ly] = pl.F(u, 21);
  px(p.c, lx - 3, ly - 2, '#1e1e22', 7, 3);
  px(p.c, lx - 2, ly + 1, LIT, 5, 2);
  px(p.c, lx - 1, ly + 1, '#fff6d0', 2, 1);
}

/** A point on the parallelogram E0 + (E1-E0) s + (R0-E0) t. */
const on = (E0: V3, E1: V3, R0: V3, s: number, t: number): V3 => [
  E0[0] + (E1[0] - E0[0]) * s + (R0[0] - E0[0]) * t,
  E0[1] + (E1[1] - E0[1]) * s + (R0[1] - E0[1]) * t,
  E0[2] + (E1[2] - E0[2]) * s + (R0[2] - E0[2]) * t,
];

/** Slates on a slope in courses you can see from afar: a dark shadow under each course's lip, a lit lip, odd slates, moss. */
function slateRows(p: PropPainter, E0: V3, E1: V3, R0: V3, base: number, seed: number) {
  const R1 = on(E0, E1, R0, 1, 1);
  quad(p, [E0, E1, R1, R0], SLATE_R[base]);
  const [ex, ey] = p.P(...E0);
  const [rx, ry] = p.P(...R0);
  const n = Math.max(3, Math.round(Math.hypot(rx - ex, ry - ey) / 9));
  const lenT = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
  const m = Math.max(2, Math.round(lenT / 0.2));
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    // odd slates a shade off, staggered by half a slate each course
    const off = i & 1 ? 0.5 : 0;
    for (let j = 0; j < m; j++) {
      const r = R();
      if (r > 0.42) continue;
      const s0 = Math.max(0, (j + off) / m);
      const s1 = Math.min(1, (j + off + 1) / m);
      const col = SLATE_R[Math.max(0, Math.min(7, base + (r < 0.16 ? -1 : r < 0.36 ? 1 : 2)))];
      quad(p, [on(E0, E1, R0, s0, t0), on(E0, E1, R0, s1, t0), on(E0, E1, R0, s1, t1), on(E0, E1, R0, s0, t1)], col);
    }
    // the course line: a 2 px shadow under the lip of the course above, its lit edge just over it
    lineP(p, on(E0, E1, R0, 0, t1), on(E0, E1, R0, 1, t1), SLATE_R[Math.max(0, base - 2)], 2);
    const tl = t1 + 0.35 / n;
    if (tl < 1) lineP(p, on(E0, E1, R0, 0, tl), on(E0, E1, R0, 1, tl), SLATE_R[Math.min(7, base + 1)]);
  }
  // moss and lichen patches toward the eaves
  for (let i = 0; i < lenT * 0.7; i++) {
    if (R() > 0.5) continue;
    const [x, y] = p.P(...on(E0, E1, R0, R(), R() * 0.5));
    ell(p.c, x, y, 5 + R() * 6, 2 + R() * 2, MOSS[Math.floor(R() * 3)]);
  }
  // the eaves' lit edge
  lineP(p, E0, E1, SLATE_R[Math.min(7, base + 3)], 2);
}

/** Corrugated sheet on a slope: ribs running from the eaves to the ridge, a rust streak or two. */
function sheetRows(p: PropPainter, E0: V3, E1: V3, R0: V3, base: number, seed: number) {
  const R1 = on(E0, E1, R0, 1, 1);
  quad(p, [E0, E1, R1, R0], SHEET_R[base]);
  const len = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
  const n = Math.round(len / 0.12);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    lineP(p, on(E0, E1, R0, t, 0), on(E0, E1, R0, t, 1), i % 2 ? SHEET_R[Math.max(0, base - 2)] : SHEET_R[Math.min(6, base + 1)], i % 2 ? 2 : 1);
  }
  const R = rng(seed);
  // sheet laps across, rust bleeding from the fixings
  for (const t of [0.34, 0.68]) lineP(p, on(E0, E1, R0, 0, t), on(E0, E1, R0, 1, t), SHEET_R[Math.max(0, base - 2)]);
  for (let i = 0; i < len * 0.8; i++) {
    const s = R();
    const t = R() * 0.6;
    lineP(p, on(E0, E1, R0, s, t), on(E0, E1, R0, s, t + 0.25 + R() * 0.2), R() < 0.5 ? '#8a5030' : '#6e4028', 2);
  }
  lineP(p, E0, E1, SHEET_R[Math.min(6, base + 2)], 2);
}

/** An air-handling unit on a roof: a pale box, louvres on its front, a fan grille on top, its shadow. */
function acUnit(p: PropPainter, a: number, b: number, z: number, big: boolean) {
  const w = big ? 0.66 : 0.42;
  const d = w * 0.8;
  const h = big ? 7 : 5;
  groundShade(p, [[a + w, b + d, z], [a + w + 0.2, b + d - 0.05, z], [a + w + 0.2, b - 0.1, z], [a + w, b, z]], 0.5);
  box(p, a, b, z, w, d, h, '#eceae4', '#cfccc4', '#94928c');
  const F = front(p, b + d);
  for (let zz = z + 1; zz < z + h - 1; zz += 1.2) pq(p, F, a + 0.05, a + w - 0.05, zz, zz + 0.5, '#8a8882');
  const [cx, cy] = p.P(a + w / 2, b + d / 2, z + h);
  ell(p.c, cx, cy, big ? 12 : 8, big ? 6 : 4, '#4a4a4e');
  ell(p.c, cx, cy, big ? 8 : 5, big ? 4 : 2.5, '#26262a');
  px(p.c, cx - 1, cy - 1, '#9a9a9e', 2, 2);
}

/** A rooflight on a flat roof: a raised glazed box with a bright glint on its top. */
function rooflight(p: PropPainter, a: number, b: number, z: number, w: number, d: number) {
  box(p, a, b, z, w, d, 1.6, GLAZE[3], GLAZE[2], GLAZE[1]);
  lineP(p, [a + w * 0.15, b + d * 0.25, z + 1.6], [a + w * 0.55, b + d * 0.25, z + 1.6], GLAZE[6], 2);
  lineP(p, [a + w * 0.15, b + d * 0.6, z + 1.6], [a + w * 0.4, b + d * 0.6, z + 1.6], GLAZE[5]);
}

/** A cowl ventilator: a short galvanised stalk with a round head. */
function cowl(p: PropPainter, a: number, b: number, z: number) {
  const [x, y] = p.P(a, b, z);
  px(p.c, x - 2, y - 14, '#7a7a80', 4, 14);
  px(p.c, x - 2, y - 14, '#c4c4ca', 1, 14);
  ell(p.c, x, y - 16, 6, 4, '#8a8a90');
  ell(p.c, x - 1, y - 17, 4, 2, '#d8d8de');
  px(p.c, x - 6, y - 14, '#3a3a40', 12, 1);
}

function drawBld(p: PropPainter, B: Bld) {
  const { a0, b0, a1, b1, h, n, kind, wall } = B;
  const F = front(p, b1);
  const S = side(p, a1);
  const R = rng(B.seed * 13 + 7);
  const wallS = darken(wall, 0.34);
  // the roof's rise
  const rise = kind === 'flat' ? 0 : kind === 'saw' ? 11 : Math.min(17, 5 + (kind === 'slateA' ? b1 - b0 : a1 - a0) * 2.8);
  // walls
  brickFace(p, F, a0, a1, h, n, wall, B.seed);
  brickFace(p, S, b0, b1, h, n, wallS, B.seed + 1);
  // the corner: a lit arris between the faces
  lineP(p, [a1, b1, 0], [a1, b1, h], lighten(wall, 0.22));
  // gables
  if (kind === 'slateB' || kind === 'corr') {
    const am = (a0 + a1) / 2;
    quad(p, [[a0, b1, h], [a1, b1, h], [am, b1, h + rise]], wall);
    for (let z = h + 1.5; z < h + rise; z += 1.5) {
      const f = 1 - (z - h) / rise;
      lineP(p, [am - ((a1 - a0) / 2) * f, b1, z], [am + ((a1 - a0) / 2) * f, b1, z], darken(wall, 0.12));
    }
    // a round vent in the gable, the coping up the verges
    const [gx, gy] = p.P(am, b1, h + rise * 0.4);
    ell(p.c, gx, gy, 6, 6, SILL);
    ell(p.c, gx, gy, 4, 4, FRAME);
    lineP(p, [a0, b1, h], [am, b1, h + rise], SILL, 2);
    lineP(p, [am, b1, h + rise], [a1, b1, h], darken(SILL, 0.15), 2);
  }
  if (kind === 'slateA') {
    const bm = (b0 + b1) / 2;
    quad(p, [[a1, b1, h], [a1, b0, h], [a1, bm, h + rise]], wallS);
    for (let z = h + 1.5; z < h + rise; z += 1.5) {
      const f = 1 - (z - h) / rise;
      lineP(p, [a1, bm + ((b1 - b0) / 2) * f, z], [a1, bm - ((b1 - b0) / 2) * f, z], darken(wallS, 0.12));
    }
    lineP(p, [a1, b1, h], [a1, bm, h + rise], darken(SILL, 0.3), 2);
  }
  // windows, storey by storey; the loading bays on the ground floor
  const litP = 0.4;
  for (let s = 0; s < n; s++) {
    const z = 6 + s * 20;
    for (let u = a0 + 0.3; u < a1 - 0.45; u += 0.66) {
      if (s === 0 && B.bayF && Math.abs(u + 0.15 - B.bayF[0]) < 0.95) continue;
      win(p, F, u, 0.3, z, 11, R() < litP, wall, B.arched);
    }
    for (let u = b0 + 0.3; u < b1 - 0.45; u += 0.66) {
      if (s === 0 && B.bayS && Math.abs(u + 0.15 - B.bayS[0]) < 0.95) continue;
      win(p, S, u, 0.3, z, 11, R() < litP * 0.8, wallS, B.arched);
    }
  }
  if (B.bayF) bay(p, F, B.bayF[0], B.bayF[1]);
  if (B.bayS) bay(p, S, B.bayS[0], B.bayS[1]);
  // downpipes at the front corner and on the side
  for (const [pl, u] of [[F, a1 - 0.1], [S, b0 + 0.2]] as const) {
    const [dx0, dy0] = pl.F(u, 0);
    const [, dy1] = pl.F(u, h);
    px(p.c, dx0 - 2, dy1, '#24202a', 4, dy0 - dy1);
    px(p.c, dx0 - 1, dy1, '#4a4650', 1, dy0 - dy1);
  }
  // the roof
  const o = 0.12; // eaves overhang
  if (kind === 'flat') {
    quad(p, [[a0, b0, h], [a1, b0, h], [a1, b1, h], [a0, b1, h]], TAR[3]);
    // felt in strips with lapped seams, patched strips, damp hollows, gravel
    for (let a = a0 + 0.4; a < a1; a += 0.4) {
      const r = R();
      if (r < 0.35) quad(p, [[a - 0.4, b0, h], [a, b0, h], [a, b1, h], [a - 0.4, b1, h]], r < 0.15 ? TAR[1] : r < 0.25 ? TAR[2] : TAR[5]);
      lineP(p, [a, b0, h], [a, b1, h], TAR[1], 2);
      lineP(p, [a + 0.03, b0, h], [a + 0.03, b1, h], TAR[5]);
    }
    for (let i = 0; i < (a1 - a0) * (b1 - b0) * 10; i++) {
      const [x, y] = p.P(a0 + R() * (a1 - a0), b0 + R() * (b1 - b0), h);
      px(p.c, x, y, R() < 0.5 ? TAR[0] : TAR[6], 3, 2);
    }
    for (let i = 0; i < 2; i++) {
      const [x, y] = p.P(a0 + 0.5 + R() * (a1 - a0 - 1), b0 + 0.5 + R() * (b1 - b0 - 1), h);
      ell(p.c, x, y, 16 + R() * 12, 5 + R() * 4, TAR[1]);
      ell(p.c, x - 4, y - 1, 7, 2, '#7a8088');
    }
    // the parapet: a raised wall with bright coping, its inner shadow
    const pz = 2.4;
    quad(p, [[a0, b0, h], [a1, b0, h], [a1, b0 + 0.12, h], [a0, b0 + 0.12, h]], SHADE);
    quad(p, [[a0, b0, h], [a0 + 0.1, b0, h], [a0 + 0.1, b1, h], [a0, b1, h]], darken(TAR[1], 0.3));
    box(p, a0, b0 - 0.06, h, a1 - a0, 0.08, pz, SILL, darken(wall, 0.3), wallS, false);
    box(p, a0 - 0.06, b0, h, 0.08, b1 - b0, pz, SILL, darken(wall, 0.2), wallS, false);
    // plant on the roof: a run of rooflights, ducting, air handlers, a stair head, vent stacks, cowls
    if (R() < 0.7 && b1 - b0 > 2) {
      const a = a0 + 0.45 + R() * (a1 - a0 - 1.3);
      for (let b = b0 + 0.4; b < b1 - 0.8; b += 0.8) rooflight(p, a, b, h, 0.55, 0.55);
    }
    if (R() < 0.6) {
      // a duct along b on low stands
      const a = a0 + 0.3 + R() * (a1 - a0 - 1);
      const bA = b0 + 0.3;
      const bB = b1 - 0.4;
      box(p, a, bA, h + 1.5, 0.3, bB - bA, 2.6, '#b8bcc2', '#9a9ea4', '#6e7278');
      for (let b = bA; b < bB; b += 0.5) lineP(p, [a, b, h + 4.1], [a + 0.3, b, h + 4.1], '#7a7e84');
    }
    if (R() < 0.5) {
      const a = a0 + 0.3 + R() * (a1 - a0 - 1.4);
      const b = b0 + 0.3 + R() * (b1 - b0 - 1.4);
      box(p, a, b, h, 0.85, 0.85, 8, TAR[2], wall, wallS);
      const D2 = front(p, b + 0.85);
      pq(p, D2, a + 0.28, a + 0.58, h, h + 6.5, '#2e3e34');
      pq(p, D2, a + 0.28, a + 0.58, h + 6.5, h + 7, SILL);
    }
    const units = 2 + Math.floor(R() * Math.min(5, (a1 - a0) * (b1 - b0) * 0.35));
    for (let i = 0; i < units; i++) acUnit(p, a0 + 0.3 + R() * (a1 - a0 - 1.1), b0 + 0.3 + R() * (b1 - b0 - 1.0), h, R() < 0.5);
    for (let i = 0; i < 2; i++) if (R() < 0.7) cowl(p, a0 + 0.4 + R() * (a1 - a0 - 0.8), b0 + 0.4 + R() * (b1 - b0 - 0.8), h);
    if (R() < 0.6) {
      const [vx, vy] = p.P(a0 + 0.5 + R() * (a1 - a0 - 1), b0 + 0.5 + R() * (b1 - b0 - 1), h);
      px(p.c, vx - 4, vy - 30, '#8a8a8e', 8, 30);
      px(p.c, vx - 4, vy - 30, '#d4d4d8', 2, 30);
      px(p.c, vx + 2, vy - 30, '#5a5a5e', 2, 30);
      px(p.c, vx - 6, vy - 33, '#4a4a4e', 12, 4);
    }
  } else if (kind === 'slateB' || kind === 'corr') {
    // ridge along b: the -a slope (lit), then the +a slope (shade)
    const am = (a0 + a1) / 2;
    const eL0: V3 = [a0 - o, b0 - o, h - 0.6];
    const eL1: V3 = [a0 - o, b1 + o, h - 0.6];
    const r1: V3 = [am, b1 + o, h + rise];
    const r0: V3 = [am, b0 - o, h + rise];
    const eR0: V3 = [a1 + o, b0 - o, h - 0.6];
    const eR1: V3 = [a1 + o, b1 + o, h - 0.6];
    if (kind === 'corr') {
      sheetRows(p, eL1, eL0, r1, 4, B.seed);
      sheetRows(p, eR1, eR0, r1, 2, B.seed + 3);
    } else {
      slateRows(p, eL1, eL0, r1, 5, B.seed);
      slateRows(p, eR1, eR0, r1, 3, B.seed + 3);
    }
    lineP(p, r0, r1, kind === 'corr' ? SHEET_R[6] : SLATE_R[7], 3);
    lineP(p, [r0[0] + 0.04, r0[1], r0[2] - 1], [r1[0] + 0.04, r1[1], r1[2] - 1], SHADE);
    lineP(p, eL1, r1, kind === 'corr' ? SHEET_R[6] : SLATE_R[7], 2);
    lineP(p, r1, eR1, kind === 'corr' ? SHEET_R[1] : SLATE_R[0], 2);
    // roof lights down the shaded slope, glinting
    if (kind === 'slateB' && R() < 0.75)
      for (let b = b0 + 0.5; b < b1 - 0.7; b += 1.3) {
        const A = (t: number): V3 => [a1 + o + (am - a1 - o) * t, b, h - 0.6 + (rise + 0.6) * t];
        const Bq = (t: number): V3 => [a1 + o + (am - a1 - o) * t, b + 0.5, h - 0.6 + (rise + 0.6) * t];
        quad(p, [A(0.28), Bq(0.28), Bq(0.64), A(0.64)], GLAZE[3]);
        lineP(p, A(0.5), Bq(0.5), GLAZE[6], 2);
        lineP(p, A(0.28), Bq(0.28), SLATE_R[7]);
      }
    // ridge vents
    if (R() < 0.6) for (let b = b0 + 0.6; b < b1 - 0.4; b += 1.4) box(p, am - 0.15, b, h + rise - 1, 0.3, 0.36, 4, '#5a5e68', '#4a4e58', '#30333c');
  } else if (kind === 'slateA') {
    // ridge along a: the -b slope (hidden mostly), then the +b slope (lit)
    const bm = (b0 + b1) / 2;
    const eB0: V3 = [a0 - o, b0 - o, h - 0.6];
    const eB1: V3 = [a1 + o, b0 - o, h - 0.6];
    const r0: V3 = [a0 - o, bm, h + rise];
    const r1: V3 = [a1 + o, bm, h + rise];
    const eF0: V3 = [a0 - o, b1 + o, h - 0.6];
    const eF1: V3 = [a1 + o, b1 + o, h - 0.6];
    slateRows(p, eB0, eB1, r0, 2, B.seed);
    slateRows(p, eF0, eF1, r0, 5, B.seed + 5);
    lineP(p, r0, r1, SLATE_R[7], 3);
    lineP(p, eF1, r1, darken(SILL, 0.3), 2);
    // dormer roof lights with a glint, a cowl or two on the ridge
    if (R() < 0.65)
      for (let a = a0 + 0.6; a < a1 - 0.8; a += 1.4) {
        const A = (t: number, da: number): V3 => [a + da, b1 + o + (bm - b1 - o) * t, h - 0.6 + (rise + 0.6) * t];
        quad(p, [A(0.25, 0), A(0.25, 0.55), A(0.6, 0.55), A(0.6, 0)], GLAZE[4]);
        lineP(p, A(0.45, 0.05), A(0.45, 0.5), GLAZE[6], 2);
        lineP(p, A(0.25, 0), A(0.25, 0.55), SLATE_R[7]);
      }
    if (R() < 0.5) cowl(p, a0 + (a1 - a0) * (0.3 + R() * 0.4), bm, h + rise);
  } else {
    // north lights: teeth along a, slate slopes rising to +a, glass facing +a
    const nT = Math.max(1, Math.round((a1 - a0) / 1.3));
    const tw = (a1 - a0) / nT;
    for (let i = 0; i < nT; i++) {
      const x0 = a0 + i * tw;
      const x1 = x0 + tw;
      slateRows(p, [x0, b1, h], [x0, b0, h], [x1, b1, h + rise], 5, B.seed + i);
      quad(p, [[x1, b1, h], [x1, b0, h], [x1, b0, h + rise], [x1, b1, h + rise]], GLAZE[2]);
      for (let bb = b0 + 0.25; bb < b1; bb += 0.25) lineP(p, [x1, bb, h], [x1, bb, h + rise], GLAZE[0]);
      lineP(p, [x1, b0, h + rise * 0.5], [x1, b1, h + rise * 0.5], GLAZE[0]);
      for (let bb = b0 + 0.12; bb < b1; bb += 0.5) if (R() < 0.45) lineP(p, [x1, bb, h + 1], [x1, bb + 0.1, h + rise - 1], GLAZE[5], 2);
      lineP(p, [x0, b0, h], [x0, b1, h], SHADE, 2);
      lineP(p, [x1, b0, h + rise], [x1, b1, h + rise], SLATE_R[7], 2);
      quad(p, [[x0, b1, h], [x1, b1, h], [x1, b1, h + rise]], wall);
      lineP(p, [x0, b1, h], [x1, b1, h + rise], SILL, 2);
      if (R() < 0.5) cowl(p, x0 + tw * 0.5, b0 + (b1 - b0) * (0.3 + R() * 0.4), h + rise * 0.5);
    }
  }
  // a chimney stack
  if (B.chim) {
    const [ca, cb, ch] = B.chim;
    const zb = kind === 'flat' ? h : h + rise * 0.6;
    box(p, ca - 0.18, cb - 0.18, zb - 4, 0.36, 0.36, ch + 4, '#3a2a28', darken(wall, 0.02), darken(wall, 0.4));
    for (let z = zb; z < zb + ch; z += 1.5) lineP(p, [ca - 0.18, cb + 0.18, z], [ca + 0.18, cb + 0.18, z], darken(wall, 0.2));
    box(p, ca - 0.23, cb - 0.23, zb + ch - 2, 0.46, 0.46, 2, '#2a2224', SILL, darken(SILL, 0.3));
    const [tx, ty] = p.P(ca, cb, zb + ch);
    px(p.c, tx - 3, ty - 6, '#8a4a32', 3, 6);
    px(p.c, tx + 1, ty - 5, '#6a3826', 3, 5);
    px(p.c, tx - 3, ty - 7, '#1a1416', 3, 1);
  }
}

/** The ground of the block's alleys: setts and patched tarmac, cracks, stains, drains (under everything). */
function drawAlleys(p: PropPainter, P: Plan, seed: number) {
  const R = rng(seed * 17 + 3);
  for (const [a0, b0, a1, b1] of P.alleys) {
    const area = (a1 - a0) * (b1 - b0);
    // patches of darker and lighter surface
    for (let i = 0; i < area * 70; i++) {
      const a = a0 + R() * (a1 - a0);
      const b = b0 + R() * (b1 - b0);
      const [x, y] = p.P(a, b, 0);
      const r = R();
      px(p.c, x, y, r < 0.4 ? '#36333a' : r < 0.75 ? '#5e5a5c' : r < 0.92 ? '#6c6866' : '#2a272c', 4 + Math.floor(R() * 5), 2);
    }
    // cracks
    for (let i = 0; i < area * 0.8; i++) {
      let [x, y] = p.P(a0 + R() * (a1 - a0), b0 + R() * (b1 - b0), 0);
      for (let j = 0; j < 4; j++) {
        const nx = x + (R() - 0.3) * 14;
        const ny = y + (R() - 0.5) * 6;
        ln(p.c, x, y, nx, ny, '#1e1c22');
        x = nx;
        y = ny;
      }
    }
    // oil stains and puddles
    for (let i = 0; i < area * 0.25; i++) {
      const [x, y] = p.P(a0 + 0.2 + R() * (a1 - a0 - 0.4), b0 + 0.2 + R() * (b1 - b0 - 0.4), 0);
      ell(p.c, x, y, 8 + R() * 10, 3 + R() * 3, R() < 0.5 ? '#2a282e' : '#46505a');
      if (R() < 0.5) px(p.c, x - 3, y - 1, '#8a96a2', 5, 1);
    }
    // painted lines along long alleys
    if (b1 - b0 > 4) {
      const am = (a0 + a1) / 2;
      for (let b = b0 + 0.4; b < b1 - 0.4; b += 0.8) lineP(p, [am, b, 0], [am, b + 0.4, 0], '#c8a03a', 2);
    }
  }
}

/** Ground effects of the buildings: shadows cast past their +a faces, dark feet, warm pools under open bays. */
function drawGroundFx(p: PropPainter, P: Plan) {
  for (const B of P.blds) {
    const L = 0.35 + B.n * 0.22;
    groundShade(p, [[B.a1, B.b1, 0], [B.a1 + L, B.b1 - L * 0.4, 0], [B.a1 + L, B.b0 - L * 0.4, 0], [B.a1, B.b0, 0]], 0.42);
    groundShade(p, [[B.a0, B.b1, 0], [B.a1, B.b1, 0], [B.a1, B.b1 + 0.12, 0], [B.a0, B.b1 + 0.12, 0]], 0.5);
    for (const bayAt of [B.bayF, B.bayS]) {
      if (!bayAt || !bayAt[1]) continue;
      const [x, y] = bayAt === B.bayF ? p.P(bayAt[0], B.b1 + 0.45, 0) : p.P(B.a1 + 0.45, bayAt[0], 0);
      p.c.globalAlpha = 0.35;
      ell(p.c, x, y, 46, 20, '#f0b860');
      p.c.globalAlpha = 0.45;
      ell(p.c, x, y, 28, 11, '#ffd890');
      p.c.globalAlpha = 1;
    }
  }
}

/** A pipe bridge over an alley: pipes on a lattice, a yellow handrail; trestles at the ends. */
function drawRack(p: PropPainter, r: Rack) {
  const pt3 = (u: number, dz: number, off: number): V3 => (r.along === 'a' ? [u, r.at + off, r.z + dz] : [r.at + off, u, r.z + dz]);
  const long = r.u1 - r.u0 > 4;
  // its shadow on the ground
  const sh = (u: number, off: number): V3 => (r.along === 'a' ? [u + 0.5, r.at + off - 0.3, 0] : [r.at + off + 0.5, u - 0.3, 0]);
  groundShade(p, [sh(r.u0, -0.15), sh(r.u1, -0.15), sh(r.u1, 0.2), sh(r.u0, 0.2)], 0.3);
  // trestle legs
  const step = long ? 1.6 : r.u1 - r.u0 - 0.6;
  for (let u = r.u0 + 0.3; u <= r.u1 - 0.3 + 0.01; u += step) {
    const [x0, y0] = p.P(...pt3(u, -r.z, 0));
    const [, y1] = p.P(...pt3(u, 0, 0));
    px(p.c, x0 - 2, y1, '#3a3e46', 4, y0 - y1);
    px(p.c, x0 - 2, y1, '#8a8e96', 1, y0 - y1);
    px(p.c, x0 - 4, y0 - 2, '#2a2c32', 8, 2);
  }
  // the deck and the pipes: dark undersides, bright crowns
  lineP(p, pt3(r.u0, 0, 0), pt3(r.u1, 0, 0), '#2a2e36', 3);
  lineP(p, pt3(r.u0, 2.2, -0.16), pt3(r.u1, 2.2, -0.16), '#4e5056', 7);
  lineP(p, pt3(r.u0, 3.4, -0.16), pt3(r.u1, 3.4, -0.16), '#b8bac0', 2);
  lineP(p, pt3(r.u0, 2, 0.12), pt3(r.u1, 2, 0.12), '#7a7c82', 5);
  lineP(p, pt3(r.u0, 2.9, 0.12), pt3(r.u1, 2.9, 0.12), '#dcdee2', 1);
  lineP(p, pt3(r.u0, 1.6, 0.3), pt3(r.u1, 1.6, 0.3), '#a85a30', 3);
  lineP(p, pt3(r.u0, 2.1, 0.3), pt3(r.u1, 2.1, 0.3), '#d88a50', 1);
  if (!long) {
    lineP(p, pt3(r.u0, 6, 0.3), pt3(r.u1, 6, 0.3), '#e0b030', 1);
    for (let u = r.u0 + 0.2; u < r.u1; u += 0.4) lineP(p, pt3(u, 0, 0.3), pt3(u, 6, 0.3), '#b88a20');
  } else for (let u = r.u0 + 0.5; u < r.u1; u += 0.8) lineP(p, pt3(u, -1, -0.2), pt3(u, -1, 0.35), '#2a2e36', 2);
}

// ── the alleys' clutter ─────────────────────────────────────
const WOOD = ['#5e4024', '#8a6236', '#b08048', '#d0a060', '#e8c080'];
function drawItem(p0: PropPainter, it: Item) {
  // at scale S about the item's corner (the yards' stock is drawn at true size, the estate's smaller)
  const S = it.s ?? 1;
  const p = (S === 1 ? p0 : { c: p0.c, k: p0.k, rot: p0.rot, P: (a: number, b: number, z = 0) => p0.P(it.a + (a - it.a) * S, it.b + (b - it.b) * S, z * S) }) as PropPainter;
  const q = (n: number) => Math.max(1, Math.round(n * S));
  const R = rng(it.seed);
  const { a, b } = it;
  // a contact shadow under everything
  const sz = it.kind === 'skip' ? 1 : it.kind === 'pipes' ? 1.1 : 0.48 * Math.min(2, it.n);
  groundShade(p, [[a - 0.04, b + 0.5, 0], [a + sz + 0.12, b + 0.5, 0], [a + sz + 0.2, b - 0.06, 0], [a + 0.04, b - 0.06, 0]], 0.45);
  switch (it.kind) {
    case 'pallet': {
      for (let i = 0; i < Math.min(2, it.n); i++) {
        const aa = a + i * 0.48;
        box(p, aa, b, 0, 0.42, 0.42, 1.6, WOOD[2], WOOD[1], WOOD[0]);
        // the pallet's fork slots, dark in its front and side
        const Fq = front(p, b + 0.42);
        for (const u of [0.06, 0.25]) pq(p, Fq, aa + u, aa + u + 0.11, 0.3, 1.1, '#2a1c12');
        const Sq = side(p, aa + 0.42);
        for (const u of [0.06, 0.25]) pq(p, Sq, b + u, b + u + 0.11, 0.3, 1.1, '#1e140c');
        const r = R();
        if (r < 0.35) box(p, aa + 0.03, b + 0.03, 1.6, 0.36, 0.36, 4, '#f0e8d4', '#d4c8ae', '#9c9078');
        else if (r < 0.6) box(p, aa + 0.03, b + 0.03, 1.6, 0.36, 0.36, 3.6, '#b84a32', '#9a3a26', '#6a2818');
        else if (r < 0.8) for (let j = 0; j < 4; j++) box(p, aa, b, 1.6 + j * 1.6, 0.42, 0.42, 1.6, j & 1 ? WOOD[3] : WOOD[2], WOOD[1], WOOD[0]);
        else box(p, aa + 0.04, b + 0.04, 1.6, 0.34, 0.34, 3, '#3a6aa8', '#2e5690', '#1e3a64');
      }
      break;
    }
    case 'crate': {
      for (let i = 0; i < it.n; i++) {
        const z = i === 2 ? 4.4 : 0;
        const aa = a + (i === 1 ? 0.42 : i === 2 ? 0.2 : 0);
        box(p, aa, b, z, 0.38, 0.38, 4.4, WOOD[3], WOOD[2], WOOD[1]);
        // slats, a brace, the dark frame, a stencilled mark
        const Fp = front(p, b + 0.38);
        const Sp = side(p, aa + 0.38);
        for (const zz of [1.4, 2.9]) {
          pq(p, Fp, aa, aa + 0.38, z + zz, z + zz + 0.3, WOOD[0]);
          pq(p, Sp, b, b + 0.38, z + zz, z + zz + 0.3, '#3a2814');
        }
        pq(p, Fp, aa, aa + 0.04, z, z + 4.4, WOOD[1]);
        pq(p, Fp, aa + 0.34, aa + 0.38, z, z + 4.4, WOOD[1]);
        lineP(p, [aa, b + 0.38, z], [aa + 0.38, b + 0.38, z + 4.4], WOOD[1]);
        pq(p, Fp, aa + 0.12, aa + 0.24, z + 3.4, z + 3.8, '#2a2420');
      }
      break;
    }
    case 'drum': {
      const cols = ['#2e5ea8', '#c43028', '#3a7a4a', '#e0a020', '#3a3a40'];
      const col = cols[Math.floor(R() * cols.length)];
      for (let i = 0; i < it.n + 1; i++) {
        const aa = a + (i % 2) * 0.24;
        const bb = b + Math.floor(i / 2) * 0.24;
        const [x, y] = p.P(aa + 0.12, bb + 0.12, 0);
        px(p.c, x - q(6), y - q(16), darken(col, 0.1), q(12), q(16));
        px(p.c, x - q(6), y - q(16), lighten(col, 0.25), q(3), q(16));
        px(p.c, x + q(3), y - q(16), darken(col, 0.45), q(3), q(16));
        px(p.c, x - q(6), y - q(11), darken(col, 0.4), q(12), 1);
        px(p.c, x - q(6), y - q(5), darken(col, 0.4), q(12), 1);
        ell(p.c, x, y - q(16), q(6), q(3), lighten(col, 0.15));
        px(p.c, x + 1, y - q(17), '#1a1a1e', q(2), 1);
      }
      break;
    }
    case 'gas': {
      // a mesh cage of bottles
      box(p, a, b, 0, 0.5, 0.36, 1, '#3a3a40', '#2a2a30', '#202026');
      for (let i = 0; i < 5; i++) {
        const [x, y] = p.P(a + 0.06 + i * 0.09, b + 0.18, 1);
        const col = i % 3 === 0 ? '#2a2a30' : i % 3 === 1 ? '#c8c8c0' : '#3a6aa8';
        px(p.c, x - q(2), y - q(18), col, q(5), q(18));
        px(p.c, x - q(2), y - q(18), lighten(col, 0.3), 1, q(18));
        px(p.c, x - 1, y - q(21), '#a0602a', q(3), q(3));
      }
      lineP(p, [a, b + 0.36, 15], [a + 0.5, b + 0.36, 15], '#5a5a62');
      for (let u = a; u <= a + 0.5; u += 0.1) lineP(p, [u, b + 0.36, 1], [u, b + 0.36, 15], '#5a5a62');
      break;
    }
    case 'skip': {
      const col = R() < 0.6 ? '#e4ae22' : '#2f5eaa';
      quad(p, [[a, b + 0.55, 0], [a + 1, b + 0.55, 0], [a + 1.1, b + 0.6, 6], [a - 0.1, b + 0.6, 6]], darken(col, 0.05));
      quad(p, [[a + 1, b + 0.55, 0], [a + 1, b, 0], [a + 1.1, b - 0.05, 6], [a + 1.1, b + 0.6, 6]], darken(col, 0.4));
      quad(p, [[a - 0.1, b - 0.05, 6], [a + 1.1, b - 0.05, 6], [a + 1.1, b + 0.6, 6], [a - 0.1, b + 0.6, 6]], '#2a2420');
      for (let i = 0; i < 14; i++) {
        const [x, y] = p.P(a + R() * 1.1, b + R() * 0.55, 6.5);
        px(p.c, x, y - q(3), ['#8a7a6a', '#6a5a4a', '#b8a080', '#5a4a42', '#c84a32'][Math.floor(R() * 5)], q(4 + Math.floor(R() * 4)), q(3));
      }
      lineP(p, [a - 0.1, b + 0.6, 6], [a + 1.1, b + 0.6, 6], lighten(col, 0.3), 2);
      break;
    }
    case 'bin': {
      const col = R() < 0.5 ? '#2a5a38' : '#3a3a42';
      for (let i = 0; i < Math.min(2, it.n); i++) {
        box(p, a + i * 0.34, b, 0, 0.3, 0.3, 6, darken(col, 0.1), col, darken(col, 0.4));
        box(p, a + i * 0.34 - 0.02, b - 0.02, 6, 0.34, 0.34, 0.8, lighten(col, 0.2), lighten(col, 0.05), darken(col, 0.3));
      }
      break;
    }
    case 'ibc': {
      box(p, a, b, 0, 0.42, 0.42, 1, '#3a3a40', '#2a2a30', '#202026');
      box(p, a + 0.02, b + 0.02, 1, 0.38, 0.38, 6, '#f4f2ea', '#dcdad0', '#a8a69c');
      for (let z = 2; z < 7; z += 1.6) lineP(p, [a + 0.02, b + 0.4, z], [a + 0.4, b + 0.4, z], '#8a8a90');
      break;
    }
    case 'bags': {
      for (let i = 0; i < Math.min(2, it.n); i++) {
        box(p, a + i * 0.46, b, 0, 0.42, 0.42, 1.2, WOOD[2], WOOD[1], WOOD[0]);
        box(p, a + i * 0.46 + 0.02, b + 0.02, 1.2, 0.38, 0.38, 5.4, '#f6f4ee', '#e0ddd4', '#aeaaa0');
        const [x, y] = p.P(a + i * 0.46 + 0.21, b + 0.21, 6.6);
        px(p.c, x - q(3), y - q(2), '#3a6aa8', q(6), q(2));
      }
      break;
    }
    case 'pipes': {
      // a stack of pipes on bearers along a
      const col = R() < 0.5 ? '#3a3a40' : '#8a8a90';
      box(p, a + 0.1, b, 0, 0.08, 0.5, 1, WOOD[1], WOOD[1], WOOD[0], false);
      box(p, a + 0.85, b, 0, 0.08, 0.5, 1, WOOD[1], WOOD[1], WOOD[0], false);
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 4 - row; i++) {
          const bb = b + 0.07 + i * 0.12 + row * 0.06;
          const z = 2 + row * 2.6;
          lineP(p, [a, bb, z], [a + 1, bb, z], darken(col, 0.3), q(4));
          lineP(p, [a, bb, z + 1], [a + 1, bb, z + 1], lighten(col, 0.3), q(1));
          const [ex, ey] = p.P(a + 1, bb, z);
          ell(p.c, ex, ey, 2.5 * S, 2.5 * S, '#141418');
          px(p.c, ex - 2, ey - 2, lighten(col, 0.4), 1, 1);
        }
      break;
    }
  }
}

const fac_roofs: PropArt = {
  draw(p, k) {
    const P = planOf(k);
    drawAlleys(p, P, variantOf(k));
    drawGroundFx(p, P);
    // back to front: buildings, racks and clutter by their front-most corner
    type It = { key: number; draw: () => void };
    const items: It[] = [];
    for (const B of P.blds) items.push({ key: B.a1 + B.b1, draw: () => drawBld(p, B) });
    for (const r of P.racks) items.push({ key: r.along === 'a' ? r.u1 + r.at + 0.3 : r.at + r.u1 - 0.2 + (r.u1 - r.u0 > 4 ? 0 : 0), draw: () => drawRack(p, r) });
    for (const q of P.items) items.push({ key: q.a + q.b + 0.6, draw: () => drawItem(p, q) });
    items.sort((m, n) => m.key - n.key);
    for (const it of items) it.draw();
  },
  anim(p, k) {
    // smoke from the chimney stacks, drifting to the right
    const P = planOf(k);
    const u = p.k / 4;
    let i = 0;
    for (const B of P.blds) {
      if (!B.chim) continue;
      const [ca, cb, ch] = B.chim;
      const rise = B.kind === 'flat' ? 0 : 0.6 * (B.kind === 'saw' ? 11 : Math.min(17, 5 + (B.kind === 'slateA' ? B.b1 - B.b0 : B.a1 - B.a0) * 2.8));
      const [x, y] = p.P(ca, cb, B.h + rise + ch + 1);
      i++;
      for (let j = 0; j < 6; j++) {
        const t = (k.t * 0.09 + j / 6 + i * 0.37) % 1;
        p.c.globalAlpha = 0.45 * (1 - t);
        ell(p.c, x + (t * 70 + Math.sin(t * 6 + j) * 5) * u, y - t * 60 * u, (6 + t * 18) * u, (4 + t * 10) * u, t < 0.3 ? '#c8c4c0' : '#e2dedb');
      }
    }
    p.c.globalAlpha = 1;
  },
  lights(k) {
    // lit loading bays and their lamps, and a few of the brightest windows
    const P = planOf(k);
    const out: PropLight[] = [];
    for (const B of P.blds) {
      if (B.bayF) out.push({ a: B.bayF[0], b: B.b1 + 0.1, z: 20, r: B.bayF[1] ? 1.8 : 1.2, color: '#ffcf8a', kind: 'lamp' });
      if (B.bayS) out.push({ a: B.a1 + 0.1, b: B.bayS[0], z: 20, r: B.bayS[1] ? 1.8 : 1.2, color: '#ffcf8a', kind: 'lamp' });
      for (let s = 0; s < B.n; s++) {
        out.push({ a: (B.a0 + B.a1) / 2, b: B.b1, z: 12 + s * 20, r: 1.1, color: '#ffd49a', kind: 'window' });
        if (B.b1 - B.b0 > 3) out.push({ a: B.a1, b: (B.b0 + B.b1) / 2, z: 12 + s * 20, r: 1.1, color: '#ffd49a', kind: 'window' });
      }
    }
    // a dozen per block is plenty: spread them evenly through the list
    if (out.length <= 12) return out;
    return Array.from({ length: 12 }, (_, i) => out[Math.floor(((i + 0.5) * out.length) / 12)]);
  },
};

export const FACTORY_ESTATE: Record<string, PropArt> = { fac_roofs };
export { acUnit, box as estateBox, cowl, drawItem, rooflight, type Item, type ItemKind };

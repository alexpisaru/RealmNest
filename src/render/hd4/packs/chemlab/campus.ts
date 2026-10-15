// Chemical Lab — the science-park buildings (1 z ≈ 10 cm; a storey ≈ 36 z).
//   lab_building  variants:
//     'a'  the chemistry building: a recessed glazed ground floor on white
//          columns, a curtain wall behind white vertical brise-soleil fins,
//          a flat roof with lab exhaust stacks, an air handling unit, PV rows
//          and sedum
//     'b'  the west wing: a white precast frame with recessed glazing and
//          horizontal larch louvres, a green roof with a terrace
//     'c'  a taller glass research tower (simplified, at the frame's edge)
//   lab_skyline  distant campus blocks in flat fills (fills the far corners)
// Visible faces are the +y front (b = d) and the +x side (a = w).
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp, rng } from '../../kit4';
import { front3, poly3, pq, pt, side3 } from '../../plane4';
import { lbox, mono } from '../util';
import { ANTH, CGLASS, coat, CONC, concMat, cyl, GALV, LARCH, larchMat, LEAF, P, planeText, STEEL, TEAL } from './lk';

type Pl = ReturnType<typeof front3>;

const white = concMat(CONC);
const finMat = coat(['#9aa0a0', '#b8bebd', '#d2d8d6', '#e6ebe9', '#f4f7f6', '#ffffff']);
const anth = coat(ANTH);

/**
 * Curtain-wall glass behind the fins: bays (bw px) and storeys (sh px), each bay a
 * room with its own blind, light and contents; diagonal reflections; the fins'
 * shadows fall to the right of each mullion.
 */
const curtain =
  (bw: number, sh: number, seed: number, light: 0 | 1): FaceTex =>
  (u, v, x, y) => {
    const bay = Math.floor(u / bw);
    const st = Math.floor(v / sh);
    const fu = u - bay * bw;
    const fv = v - st * sh;
    // mullion and transom lines, a lit edge on each, a slab shadow under each storey's head
    if (fu < 1.2) return ANTH[light ? 2 : 1];
    if (fu < 2.2) return light ? '#c8d4d6' : '#8a9a9e';
    if (Math.abs(fu - bw * 0.5) < 0.6) return ANTH[light ? 3 : 2];
    if (Math.abs(fv - sh * 0.36) < 0.8) return ANTH[light ? 3 : 2];
    if (Math.abs(fv - sh * 0.36 - 1.3) < 0.5) return light ? '#e8f2f2' : '#b4c4c6';
    if (fv > sh - 3) return light ? '#24323a' : '#1a262c';
    const r = hash(bay, st, seed);
    const r2 = (r * 7.31) % 1;
    let i = light ? 3 : 2;
    // the room behind: dark labs, lit offices, blinds half down
    if (r < 0.22 && fv > sh * (0.75 - r2 * 0.55)) {
      const b = (sh - fv) % 3 < 0.9;
      return b ? '#cfd8d4' : light ? '#f2f7f4' : '#dfe8e4';
    }
    if (r > 0.56 && fv < sh * 0.86) {
      // a warm lit room (the picture's yellow windows) with a shelf and a plant silhouette
      if (fv < sh * 0.2 && fu > bw * 0.3 && fu < bw * 0.7) return r > 0.8 ? '#6a7a4a' : '#b8a060';
      if (fv > sh * 0.7) return light ? '#f6e4a8' : '#ecd290';
      return ((x >> 1) + (y >> 1)) & 1 ? (light ? '#f4d888' : '#e8c870') : light ? '#efc765' : '#dcb458';
    }
    if (fv < sh * 0.3 && r2 < 0.4 && fu > bw * 0.2 && fu < bw * 0.85) i -= 1; // a bench or a desk inside
    // sky reflections: a broad diagonal band and a thin one
    const d = (u * 0.55 + v) % 150;
    if (d < 22) i += 2.4;
    else if (d < 28) i += 1.2;
    else if (d > 60 && d < 64) i += 1.6;
    // the fin's shadow
    if (fu < 7) i -= 1.2;
    if (bayer(x, y) > 0.96) i += 1;
    return at(CGLASS, i);
  };

/** Larch louvres: horizontal slats with shadow gaps between them. */
const louvre: Mat = (light) => (u, v, x, y) => {
  const s = v % 5;
  if (s < 1.2) return light ? '#6a4422' : '#583818';
  let i = (light ? 4.6 : 3.4) + (s > 4 ? 1 : 0);
  if (hash(Math.floor(u / 30), Math.floor(v / 5), 51) < 0.2) i -= 0.6;
  if (hash(x, y, 52) < 0.03) i -= 1;
  return at(LARCH, i);
};

/** A flat roof field: one fill and welded seams across it (cheap: it covers hundreds of tiles). */
function roofField(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, col: string, seam = 0, seamCol = '#9ea2a4') {
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], col);
  if (!seam) return;
  // welded membrane seams both ways: a dark lap with a lit lip beside it, and a faint
  // weathering blotch here and there
  for (let a = a0 + seam; a < a1 - 0.05; a += seam) {
    const [x0, y0] = p.P(a, b0, z);
    const [x1, y1] = p.P(a, b1, z);
    ln(p.c, x0, y0, x1, y1, seamCol);
    ln(p.c, x0 + 1, y0, x1 + 1, y1, '#f2f3f4');
  }
  for (let b = b0 + seam * 0.5; b < b1 - 0.05; b += seam * 0.5) {
    const [x0, y0] = p.P(a0, b, z);
    const [x1, y1] = p.P(a1, b, z);
    ln(p.c, x0, y0, x1, y1, seamCol);
  }
  for (let a = a0 + 0.6; a < a1 - 0.6; a += 1.7)
    for (let b = b0 + 0.6; b < b1 - 0.6; b += 1.3) {
      const h = hash(Math.round(a * 10), Math.round(b * 10), 77);
      if (h > 0.3) continue;
      const [x, y] = p.P(a, b, z);
      ell(p.c, x, y, 10 + h * 30, 5 + h * 14, '#c8cacc');
    }
}

/** A mushroom vent on a roof: a round cap on a short stem, its shadow to the lower right. */
function vent(p: PropPainter, a: number, b: number, z: number) {
  const [x, y] = P(p, a, b, z);
  ell(p.c, x + 5, y + 2, 7, 3, '#9a9ea2');
  px(p.c, x - 3, y - 8, '#8a9094', 6, 8);
  px(p.c, x - 3, y - 8, '#c8ccd0', 2, 8);
  ell(p.c, x, y - 9, 7, 3.5, '#6a7074');
  ell(p.c, x - 1, y - 10, 6, 3, '#d8dcdf');
  px(p.c, x - 4, y - 11, '#ffffff', 3, 1);
}

/** Gravel ballast: a pale fill with scattered pebbles. */
function gravelField(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number) {
  roofField(p, a0, b0, a1, b1, z, '#b4b0a8');
  for (let a = a0 + 0.05; a < a1; a += 0.09)
    for (let b = b0 + 0.05; b < b1; b += 0.09) {
      const h = hash(Math.round(a * 97), Math.round(b * 97), seed);
      if (h < 0.55) continue;
      const [x, y] = p.P(a, b, z);
      px(p.c, x, y, h > 0.85 ? '#d8d4cc' : '#8e8a84', h > 0.93 ? 2 : 1, 1);
    }
}

// ── green roofs, climbers, rooflights (the picture's lush campus) ──
const MEADOWROOF: Ramp = ['#2e4210', '#3e5612', '#526813', '#69841b', '#798c2b', '#849c30', '#9cb23e'];
const BLOOMS = ['#f4f6e4', '#edf2dd', '#f2d24a', '#e8c830', '#b07ad8', '#c8a8e8', '#e88ab0', '#f2a03a', '#ffffff'];

/**
 * A wildflower roof: a deep green base, grass tufts, and drifts of one or two
 * kinds of flower each (white, yellow, violet, pink), so it reads as planted beds.
 */
function meadowField(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, bloom = 1) {
  roofField(p, a0, b0, a1, b1, z, MEADOWROOF[2]);
  const Rn = rng(seed * 5 + 3);
  // mottled drifts of grass and leaf: big soft blotches, darker hollows, sunlit mounds
  for (let a = a0 + 0.1; a < a1 - 0.05; a += 0.22)
    for (let b = b0 + 0.1; b < b1 - 0.05; b += 0.22) {
      const n = noise2(a * 0.6 + seed, b * 0.6, seed + 1);
      const [x, y] = p.P(a + (Rn() - 0.5) * 0.2, b + (Rn() - 0.5) * 0.2, z);
      const t = Math.max(0, Math.min(6, Math.round(n * 7 - 0.5 + (Rn() - 0.5) * 1.6)));
      const col = MEADOWROOF[t];
      for (let j = 0; j < 7; j++) {
        const th = Rn() * Math.PI * 2;
        const d = Math.sqrt(Rn());
        p.c.fillStyle = j < 2 ? MEADOWROOF[Math.max(0, t - 2)] : col;
        p.c.fillRect(Math.round(x + Math.cos(th) * 8 * d), Math.round(y + Math.sin(th) * 4 * d + (j < 2 ? 2 : 0)), 3, 2);
      }
    }
  // cushions of perennials, lit from the upper left, flowering in drifts of one colour each
  const LEAFC = ['#1f3d10', '#2f5418', '#41701e', '#5a8a2a', '#76a63a', '#9cc458'];
  for (let a = a0 + 0.15; a < a1 - 0.1; a += 0.26)
    for (let b = b0 + 0.15; b < b1 - 0.1; b += 0.26) {
      const h = hash(Math.round(a * 97), Math.round(b * 97), seed + 3);
      if (h < 0.38) continue;
      const [x0, y0] = p.P(a + (Rn() - 0.5) * 0.2, b + (Rn() - 0.5) * 0.2, z);
      const x = Math.round(x0);
      const y = Math.round(y0);
      const rx = 7 + Rn() * 7;
      const ry = rx * 0.6;
      ell(p.c, x + 2, y + 2, rx, ry, LEAFC[0]);
      ell(p.c, x, y, rx, ry, LEAFC[2]);
      ell(p.c, x - rx * 0.2, y - ry * 0.25, rx * 0.7, ry * 0.62, LEAFC[3]);
      ell(p.c, x - rx * 0.35, y - ry * 0.45, rx * 0.35, ry * 0.3, LEAFC[4]);
      // drifts: patches of about two tiles flower in one colour, some stay green
      const da = Math.floor((a + noise2(a * 0.4, b * 0.4, seed) * 1.2) / 1.8);
      const db = Math.floor((b + noise2(b * 0.4, a * 0.4, seed + 2) * 1.2) / 1.8);
      const dk = hash(da, db, seed + 13);
      if (dk < 0.85 * bloom) {
        const col = BLOOMS[[0, 2, 4, 6, 5, 7][Math.floor(dk * 7) % 6]];
        const n = 4 + Math.floor(Rn() * 6);
        for (let j = 0; j < n; j++) px(p.c, x + (Rn() - 0.6) * rx * 1.4, y - ry * 0.3 + (Rn() - 0.6) * ry * 1.2, j % 4 ? col : '#ffffff', 3, 2);
      }
    }
  // grass tufts with a dark root and a lit tip between the cushions
  for (let a = a0 + 0.04; a < a1 - 0.03; a += 0.09)
    for (let b = b0 + 0.04; b < b1 - 0.03; b += 0.09) {
      const h = hash(Math.round(a * 131), Math.round(b * 131), seed);
      if (h > 0.2) continue;
      const [x, y] = p.P(a, b, z);
      px(p.c, x, y - 3, MEADOWROOF[6], 1, 3);
      px(p.c, x + 1, y, MEADOWROOF[0], 2, 1);
    }
}

const CLIMB: Ramp = ['#183b0c', '#244a12', '#2f5a18', '#41701e', '#558226', '#68943a', '#86ae4a', '#aac87a'];

/**
 * A climber trained up a façade: leaf clumps from z0 to z1 on the plane through (a, b),
 * spreading `wid` tiles along a (front planes) or along b (side planes), a few flowers.
 */
function climber(p: PropPainter, a: number, b: number, z0: number, z1: number, wid: number, seed: number, along: 'a' | 'b') {
  const Rn = rng(seed * 7 + 1);
  const masses: Mass[] = [];
  // a panel of leaf clumps on a grid of wires, ragged at the top and the sides
  const cols = Math.max(1, Math.round(wid / 0.42));
  for (let z = z0 + 2; z < z1; z += 2.2)
    for (let i = 0; i < cols; i++) {
      const top = z > z1 - 6 && Rn() < 0.5;
      if (top || ((i === 0 || i === cols - 1) && Rn() < 0.25)) continue;
      const off = ((i + 0.5) / cols - 0.5) * wid + (Rn() - 0.5) * 0.2;
      const [mx, my] = along === 'a' ? P(p, a + off, b, z + (Rn() - 0.5) * 1.5) : P(p, a, b + off, z + (Rn() - 0.5) * 1.5);
      masses.push({ x: mx, y: my, rx: 10 + Rn() * 5, ry: 8 + Rn() * 3, z: z + Rn() });
    }
  // trailing stems below the panel
  for (let i = 0; i < cols; i++) {
    const off = ((i + 0.5) / cols - 0.5) * wid;
    const [mx, my] = along === 'a' ? P(p, a + off, b, z0) : P(p, a, b + off, z0);
    masses.push({ x: mx, y: my, rx: 6, ry: 7 + Rn() * 4, z: z0 });
  }
  const xs = masses.map((m) => m.x);
  const ys = masses.map((m) => m.y);
  layer(p.c, (l) => foliage(l, masses, CLIMB, seed, { cell: 3, holes: 0.05, tilt: 0.3, bias: 0.15, dots: ['#f4f0d0', '#f2d24a', '#ffffff'], dotChance: 0.14, dotSize: 2 }), {
    outline: 0.5,
    rect: [Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30],
  });
}

/** A square glass rooflight: a white upstand and a four-sided glass pyramid, the sky in its lit panes. */
function skylight(p: PropPainter, a: number, b: number, s: number, z: number) {
  lbox(p, a, b, s, s, z, 2.2, { front: white, side: white, top: white, edge: CONC[0] });
  const zt = z + 2.2;
  const m: [number, number, number] = [a + s / 2, b + s / 2, zt + s * 5];
  const pane = (col0: string, col1: string) => (u: number, v: number) => ((u * 0.5 + v) % 18 < 3 ? col1 : col0);
  poly3(p, [[a, b, zt], [a + s, b, zt], m], pane(CGLASS[3], CGLASS[6]), 2);
  poly3(p, [[a, b, zt], [a, b + s, zt], m], pane(CGLASS[4], CGLASS[7]), 2);
  poly3(p, [[a, b + s, zt], [a + s, b + s, zt], m], pane('#5fb8c4', '#c8f0f2'), 1);
  poly3(p, [[a + s, b, zt], [a + s, b + s, zt], m], pane('#3a8a9a', '#8acfd6'), 0);
  const [tx, ty] = P(p, m[0], m[1], m[2]);
  for (const [qa, qb] of [[a, b + s], [a + s, b + s], [a + s, b]] as const) {
    const [qx, qy] = P(p, qa, qb, zt);
    ln(p.c, qx, qy, tx, ty, '#e8f0f0');
  }
}

/** A white rooftop condenser: a box with a louvred front and a big fan grille on top. */
function condenser(p: PropPainter, a: number, b: number, w: number, d: number, z: number) {
  const box = coat(['#9aa2a2', '#b8bfbf', '#d2d8d8', '#e4e9e8', '#f0f4f3', '#fbfcfc']);
  lbox(p, a, b, w, d, z, 6.4, { front: box, side: box, top: box, edge: '#7a8484' });
  const F = front3(p, b + d);
  for (let zz = z + 1; zz < z + 5.6; zz += 0.7) pq(p, F, a + 0.15, a + w - 0.15, zz, zz + 0.3, '#a8b0b0');
  for (let i = 0; i < Math.max(1, Math.round(w / 1.1)); i++) {
    const [x, y] = P(p, a + (i + 0.5) * (w / Math.max(1, Math.round(w / 1.1))), b + d / 2, z + 6.4);
    ell(p.c, x, y, 13, 6.5, '#8a9494');
    ell(p.c, x, y, 11, 5.2, '#3a4246');
    for (let r = 3; r < 11; r += 3) ell(p.c, x, y, r, r * 0.48, r % 2 ? '#58646a' : '#46525a');
  }
}

/** The department logo: a ring of six atoms, green and blue, joined by bonds (screen space). */
function moleculeLogo(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push([x + Math.cos(t) * r, y + Math.sin(t) * r]);
  }
  for (let i = 0; i < 6; i++) ln(c, pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], '#2a6a8a', 2);
  ln(c, pts[0][0], pts[0][1], x + r * 1.7, y + r * 0.5, '#2a6a8a', 2);
  pts.push([x + r * 1.7, y + r * 0.5]);
  pts.forEach(([ax, ay], i) => {
    const col = i % 2 ? ['#1f6aa8', '#3a8ad0', '#7ab8ec'] : ['#2a8a3a', '#46ae4e', '#9ad88a'];
    ell(c, ax, ay, r * 0.42, r * 0.42, col[0]);
    ell(c, ax - 1, ay - 1, r * 0.32, r * 0.32, col[1]);
    ell(c, ax - r * 0.14, ay - r * 0.16, r * 0.12, r * 0.12, col[2]);
  });
}

// ── rooftop plant ───────────────────────────────────────────
/** A lab exhaust fan: a grey housing on the roof and a tall stainless stack with a band. */
function exhaustStack(p: PropPainter, a: number, b: number, z: number, h: number) {
  // the fan housing at the foot, then the stack with a flared windband at the top
  lbox(p, a - 0.32, b - 0.32, 0.64, 0.64, z, 3.6, { front: coat(GALV), side: coat(GALV), top: coat(GALV), edge: GALV[0] });
  const [x, y] = P(p, a, b, z + 3.6);
  const H = h * 4;
  layer(p.c, (l) => {
    cyl(l, x, y, 10, H, STEEL, { ribs: [H * 0.34, H * 0.68], top: null });
    // the windband: a wider collar a little below the outlet
    cyl(l, x, y - H + 18, 14, 12, STEEL, { top: null });
    ell(l, x, y - H + 6, 14, 7, STEEL[2]);
    ell(l, x, y - H, 10, 5, STEEL[5]);
    ell(l, x, y - H, 8, 3.6, '#1e2226');
    // a warning band and a sampling port
    px(l, x - 10, y - H * 0.5, '#e8c040', 20, 2);
    px(l, x + 6, y - H * 0.3, '#3a3e44', 4, 3);
  }, { outline: 0.55, rect: [x - 20, y - H - 12, x + 20, y + 8] });
}

/** An air handling unit: a long louvred box with access doors and a duct into the roof. */
function ahu(p: PropPainter, a: number, b: number, w: number, d: number, z: number) {
  const box = coat(['#7e8486', '#989ea0', '#b2b8ba', '#c8cdcf', '#dadfe0', '#e8ecec']);
  lbox(p, a, b, w, d, z, 0.8, mono(anth, ANTH[0]));
  lbox(p, a + 0.05, b + 0.05, w - 0.1, d - 0.1, z + 0.8, 6, { front: box, side: box, top: box, edge: '#5e6466' });
  const F = front3(p, b + d - 0.05);
  for (let u = a + 0.3; u < a + w - 0.5; u += 0.9) {
    pq(p, F, u, u + 0.6, z + 1.6, z + 6.2, '#8a9092');
    for (let zz = z + 1.9; zz < z + 6; zz += 0.6) pq(p, F, u + 0.04, u + 0.56, zz, zz + 0.25, '#5a6062');
  }
  const S = side3(p, a + w - 0.05);
  pq(p, S, b + 0.2, b + d - 0.2, z + 1.4, z + 6.2, '#868c8e');
  // two fans on top
  for (const f of [0.3, 0.7]) {
    const [x, y] = P(p, a + w * f, b + d / 2, z + 6.8);
    ell(p.c, x, y, 13, 6.5, '#5a6062');
    ell(p.c, x, y, 11, 5.2, '#2a2e32');
    for (let i = 0; i < 4; i++) ln(p.c, x, y, x + Math.cos(i * 1.57 + f) * 10, y + Math.sin(i * 1.57 + f) * 5, '#8a9092');
  }
}

/** A row of PV panels tilted south: dark cells, a silver frame, legs. */
function pvRow(p: PropPainter, a0: number, a1: number, b: number, z: number) {
  const q = [p.P(a0, b + 0.9, z + 0.6), p.P(a1, b + 0.9, z + 0.6), p.P(a1, b, z + 3.2), p.P(a0, b, z + 3.2)];
  fillPoly(p.c, q, '#1e387a');
  // cells
  const n = Math.round((a1 - a0) * 3);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [x0, y0] = p.P(a0 + (a1 - a0) * t, b + 0.9, z + 0.6);
    const [x1, y1] = p.P(a0 + (a1 - a0) * t, b, z + 3.2);
    ln(p.c, x0, y0, x1, y1, '#3d548f');
  }
  for (const f of [0.25, 0.75]) {
    const [c0x, c0y] = p.P(a0, b + 0.9 - f * 0.9, z + 0.6 + f * 2.6);
    const [c1x, c1y] = p.P(a1, b + 0.9 - f * 0.9, z + 0.6 + f * 2.6);
    ln(p.c, c0x, c0y, c1x, c1y, '#2a4488');
  }
  for (let i = 0; i < n; i += 3) {
    const [gx, gy] = p.P(a0 + (a1 - a0) * ((i + 0.5) / n), b + 0.2, z + 2.7);
    px(p.c, gx, gy, '#c8d8ff', 3, 1);
  }
  const [m0x, m0y] = p.P(a0, b + 0.45, z + 1.9);
  const [m1x, m1y] = p.P(a1, b + 0.45, z + 1.9);
  ln(p.c, m0x, m0y, m1x, m1y, '#263f80');
  ln(p.c, q[0][0], q[0][1], q[1][0], q[1][1], '#c8d0d8');
  ln(p.c, q[3][0], q[3][1], q[2][0], q[2][1], '#7c98d0');
  for (let a = a0 + 0.2; a < a1; a += 1.6) {
    const [lx, ly] = p.P(a, b + 0.15, z);
    px(p.c, lx, ly - 10, '#9aa2aa', 1, 10);
  }
}

/** A parapet run as a thin box with a white coping. */
function parapet(p: PropPainter, a: number, b: number, w: number, d: number, z: number, h = 1.4) {
  lbox(p, a, b, w, d, z, h, { front: white, side: white, top: coat(['#a8a6a0', '#c4c2bc', '#dad8d2', '#ebe9e3', '#f6f4ee', '#ffffff']), edge: CONC[0] });
}

// ── the chemistry building ──────────────────────────────────
function bldA(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const GH = 40;
  const SH = 36;
  const NS = 3;
  const ZR = GH + NS * SH;
  const REC = 0.34;
  const bwpx = 0.8 * 71.6;
  const seed = k.seed;
  // ground floor: glazing recessed under the overhang, white columns, the entrance at the east end
  const GB = D - 1.1;
  const FG = front3(p, GB);
  // the lab occupies the ground floor up to x = 16 (16.3 tiles in) and its wall hides that part;
  // the recess is seen at an angle, so the glazing runs on a little further behind the wall's end
  const G0 = Math.min(W - 2, 16.3 - 1.6);
  pt(p, FG, G0, W - 1.1, 0.4, GH - 1.4, curtain(bwpx * 1.5, (GH - 2) * 4, seed + 5, 1), 1);
  const SG = side3(p, W - 1.1);
  pt(p, SG, 0, GB, 0.4, GH - 1.4, curtain(bwpx * 1.5, (GH - 2) * 4, seed + 6, 0), 0);
  // the soffit's shadow on the recessed glass
  pq(p, FG, G0, W - 1.1, GH - 6, GH - 1.4, 'rgba(30,24,40,0.35)');
  // the entrance: double sliding doors, a red-lettered sign on the fascia, a canopy
  const ea = W - 4.2;
  pq(p, FG, ea - 1.1, ea + 1.1, 0.4, 24, ANTH[2]);
  pt(p, FG, ea - 1.0, ea - 0.02, 0.6, 23, (u: number, v: number) => ((u * 0.6 + v) % 50 < 6 ? '#d8eef2' : v < 70 && v > 20 ? '#3a5a68' : '#2a4450'), 1);
  pt(p, FG, ea + 0.02, ea + 1.0, 0.6, 23, (u: number, v: number) => ((u * 0.6 + v) % 50 < 6 ? '#d8eef2' : v < 70 && v > 20 ? '#3a5a68' : '#2a4450'), 1);
  pq(p, FG, ea - 0.04, ea + 0.04, 0.6, 23, ANTH[4]);
  // white columns along the front and the side, under the overhang edge
  for (let a = 0.6; a < W - 0.4; a += 2.4) if (a > G0 - 0.4) lbox(p, a, D - 0.62, 0.32, 0.32, 0, GH - 1.5, { front: white, side: white, top: white, edge: CONC[0] });
  for (let b = 1.2; b < D - 0.8; b += 2.4) lbox(p, W - 0.62, b, 0.32, 0.32, 0, GH - 1.5, { front: white, side: white, top: white, edge: CONC[0] });
  // the overhang's edge beam
  lbox(p, 0, D - 1.1, W, 1.1, GH - 1.6, 1.6, { front: white, side: white, top: white, edge: CONC[0] });
  lbox(p, W - 1.1, 0, 1.1, D - 1.1, GH - 1.6, 1.6, { front: white, side: white, top: white, edge: CONC[0] });
  // the department's name on a teal sign box hung under the overhang's edge, over the entrance
  const teal = coat(TEAL);
  lbox(p, ea - 1.7, D - 0.3, 3.4, 0.24, GH - 5.6, 4.0, { front: teal, side: teal, top: teal, edge: TEAL[0] });
  const SF = front3(p, D - 0.06);
  pq(p, SF, ea - 1.7, ea + 1.7, GH - 2.0, GH - 1.6, TEAL[5]);
  planeText(p, SF, ea - 1.6, ea + 1.6, GH - 5.2, GH - 2.2, 'MOLECULAR SCIENCES', '#f4f8f6');
  // the upper storeys: glass behind white fins, white slab bands
  const F = front3(p, D - REC);
  const S = side3(p, W - REC);
  pt(p, F, 0, W - REC, GH, ZR, curtain(bwpx, SH * 4, seed, 1), 1);
  pt(p, S, 0, D - REC, GH, ZR, curtain(bwpx, SH * 4, seed + 1, 0), 0);
  for (let s = 0; s <= NS; s++) {
    const z = GH + s * SH;
    const z0 = s === 0 ? z : z - 1.2;
    const h = s === 0 ? 2.4 : s === NS ? 0 : 2.4;
    if (h) {
      lbox(p, 0, D - REC, W - REC, REC, z0, h, { front: white, side: white, top: white, edge: CONC[0] });
      lbox(p, W - REC, 0, REC, D, z0, h, { front: white, side: white, top: white, edge: CONC[0] });
    }
  }
  // vertical fins: the front, then the side (back to front)
  for (let a = 0.8; a < W - REC - 0.1; a += 0.8) lbox(p, a - 0.035, D - REC, 0.07, REC, GH + 1.2, ZR - GH - 1.2, { front: finMat, side: finMat, top: finMat, edge: '#8a9090' });
  for (let b = 0.8; b < D - REC; b += 0.8) lbox(p, W - REC, b - 0.035, REC, 0.07, GH + 1.2, ZR - GH - 1.2, { front: finMat, side: finMat, top: finMat, edge: '#8a9090' });
  // green walls: climbers trained up the front and the east side on steel cables
  climber(p, W * 0.3, D + 0.03, GH + 2, ZR - 3, 2.4, seed + 21, 'a');
  climber(p, W * 0.37, D + 0.03, GH + 10, ZR - 6, 1.6, seed + 22, 'a');
  climber(p, W + 0.03, D * 0.3, GH - 1, ZR - 4, 2.2, seed + 23, 'b');
  climber(p, W + 0.03, D * 0.62, GH + 6, ZR - 10, 1.6, seed + 24, 'b');
  // the department's logo and name on a white plaque over the top storey, near the east end
  const la0 = W - 7.4;
  const la1 = W - 1.6;
  const lz0 = GH + 2 * SH - 1.2;
  lbox(p, la0, D - REC, la1 - la0, REC, lz0, ZR - lz0, { front: white, side: white, top: white, edge: CONC[0] });
  const LF = front3(p, D);
  const [mx, my] = LF.F(la0 + 1.0, lz0 + 20);
  moleculeLogo(p.c, mx, my, 20);
  planeText(p, LF, la0 + 2.1, la1 - 0.1, lz0 + 10, lz0 + 26, 'CHEMISTRY', '#1d4f7a', 6, '#0e2a44');
  // the roof: a pale membrane, wildflower beds in compartments, walkways, the exhaust stacks,
  // a planted plant zone with white condensers, a glazed atrium rooflight and PV arrays
  roofField(p, 0, 0, W, D, ZR, '#d4d6d8', 2.4, '#bbbcbc');
  gravelField(p, 0.22, 0.22, W - 0.22, 0.7, ZR, seed + 3);
  const ga1 = W * 0.36;
  meadowField(p, 0.5, 0.8, ga1, D - 0.6, ZR + 0.3, seed + 4);
  // pale gravel paths between the beds, low white kerbs round them
  roofField(p, 0.5, D * 0.5 - 0.22, ga1, D * 0.5 + 0.22, ZR + 0.32, '#e2dccf');
  roofField(p, W * 0.17 - 0.2, 0.8, W * 0.17 + 0.2, D - 0.6, ZR + 0.32, '#e2dccf');
  for (const [a, b, w2, d2] of [[0.5, 0.8, ga1 - 0.5, 0.1], [0.5, D - 0.7, ga1 - 0.5, 0.1], [0.5, 0.8, 0.1, D - 1.4], [ga1 - 0.1, 0.8, 0.1, D - 1.4]] as const) parapet(p, a, b, w2, d2, ZR, 1.2);
  // walkway pavers from the stair core along the beds and out to the plant
  for (let b = 0.9; b < D - 0.8; b += 0.42) roofField(p, W * 0.37, b, W * 0.37 + 0.38, b + 0.36, ZR, '#eceae4');
  for (let a = W * 0.37; a < W * 0.64; a += 0.42) roofField(p, a, 3.6, a + 0.38, 3.96, ZR, '#eceae4');
  parapet(p, 0, 0, W, 0.22, ZR);
  parapet(p, 0, 0, 0.22, D, ZR);
  // shrubs and grasses tumbling over the beds' edges
  layer(p.c, (l) => {
    const Rb = rng(seed * 3 + 41);
    for (let i = 0; i < 14; i++) {
      const a = 0.9 + Rb() * (ga1 - 1.6);
      const b = i % 2 ? D - 1.3 - Rb() * 0.6 : 1.2 + Rb() * (D - 3);
      const [x, y] = P(p, a, b, ZR + 0.3);
      foliage(l, [{ x, y: y - 5, rx: 9 + Rb() * 5, ry: 6, z: 1 }, { x: x + 7, y: y - 3, rx: 6, ry: 4, z: 2 }], LEAF, seed + i * 3, { cell: 2.6, dots: BLOOMS, dotChance: 0.35, dotSize: 2 });
    }
  }, { outline: 0.5 });
  // the exhaust stack cluster on a galvanised platform: the fume hoods end up here
  const sa0 = W * 0.42;
  const grate: Mat = (light) => (u, v) => (light === 2 && (u % 6 < 1.4 || v % 6 < 1.4) ? GALV[1] : (at(GALV, light === 2 ? 4 : light ? 3 : 2) as string));
  lbox(p, sa0, 0.8, 4.4, 2.4, ZR, 1.2, { front: coat(GALV), side: coat(GALV), top: grate, edge: GALV[0] });
  for (let i = 0; i < 3; i++) exhaustStack(p, sa0 + 0.8 + i * 1.4, 1.5 + (i % 2) * 0.7, ZR + 1.2, 36 + (i % 2) * 6);
  // the stair core with a door
  lbox(p, W * 0.36 - 2.6, 0.7, 2.2, 2.2, ZR, 9, { front: white, side: white, top: coat(CONC), edge: CONC[0] });
  pq(p, front3(p, 2.9), W * 0.36 - 1.9, W * 0.36 - 1.2, ZR, ZR + 7, ANTH[2]);
  // the plant zone: a sedum-and-flower bed round white condensers, a low white kerb
  const pa0 = W * 0.66;
  const pa1 = W - 0.9;
  meadowField(p, pa0, 0.7, pa1, 4.9, ZR + 0.2, seed + 9, 0.6);
  parapet(p, pa0, 0.7, pa1 - pa0, 0.12, ZR, 1.4);
  parapet(p, pa0, 0.7, 0.12, 4.2, ZR, 1.4);
  condenser(p, pa0 + 0.6, 1.2, 2.2, 1.6, ZR);
  condenser(p, pa0 + 3.2, 1.0, 2.0, 1.5, ZR);
  condenser(p, pa0 + 3.0, 2.9, 2.4, 1.6, ZR);
  ahu(p, pa0 + 0.5, 3.0, 2.0, 1.4, ZR);
  parapet(p, pa0, 4.78, pa1 - pa0, 0.12, ZR, 1.4);
  parapet(p, pa1 - 0.12, 0.7, 0.12, 4.2, ZR, 1.4);
  // the atrium: a hipped glass rooflight over the central hall, bright teal
  const ra0 = W * 0.42;
  const ra1 = W * 0.62;
  const rb0 = D * 0.42;
  const rb1 = D * 0.7;
  const rbm = (rb0 + rb1) / 2;
  const TG = ['#1e5a66', '#2a7a88', '#3a96a4', '#5fb8c4', '#8ad4dc', '#c8f0f2'];
  lbox(p, ra0, rb0, ra1 - ra0, rb1 - rb0, ZR, 1.6, { front: white, side: white, top: white, edge: CONC[0] });
  const zr = ZR + 1.6;
  const ins = (rb1 - rb0) / 2;
  poly3(p, [[ra0, rb0, zr], [ra1, rb0, zr], [ra1 - ins, rbm, zr + 7], [ra0 + ins, rbm, zr + 7]], (u: number, v: number) => (u % 22 < 1.4 ? '#e8f0f0' : (u * 0.5 + v) % 52 < 5 ? TG[4] : TG[2]), 2);
  poly3(p, [[ra0, rb1, zr], [ra1, rb1, zr], [ra1 - ins, rbm, zr + 7], [ra0 + ins, rbm, zr + 7]], (u: number, v: number) => (u % 22 < 1.4 ? '#f4fafa' : (u * 0.5 + v) % 40 < 6 ? TG[5] : v > 16 ? TG[3] : TG[4]), 2);
  poly3(p, [[ra1, rb1, zr], [ra1, rb0, zr], [ra1 - ins, rbm, zr + 7]], (u: number) => (u % 14 < 1.2 ? '#e8f0f0' : TG[1]), 0);
  poly3(p, [[ra0, rb0, zr], [ra0, rb1, zr], [ra0 + ins, rbm, zr + 7]], (u: number) => (u % 14 < 1.2 ? '#e8f0f0' : TG[3]), 1);
  const [rx0, ry0] = P(p, ra0 + ins, rbm, zr + 7);
  const [rx1, ry1] = P(p, ra1 - ins, rbm, zr + 7);
  ln(p.c, rx0, ry0, rx1, ry1, '#f4fafa', 2);
  // roof drains, a cable tray from the PV arrays to the plant zone
  for (const [a, b] of [[W * 0.39, D * 0.3], [W * 0.63, D * 0.92], [W * 0.39, D * 0.86]] as const) {
    const [dx, dy] = P(p, a, b, ZR);
    ell(p.c, dx, dy, 6, 3, '#9a9ea2');
    ell(p.c, dx, dy, 4, 2, '#4a4e52');
  }
  for (let i = 0; i < 2; i++) {
    const [t0x, t0y] = P(p, W * 0.66 - 0.2, D - 1.2 - i * 0.12, ZR + 0.5);
    const [t1x, t1y] = P(p, W * 0.66 - 0.2, 5.0 - i * 0.12, ZR + 0.5);
    ln(p.c, t0x, t0y, t1x, t1y, i ? '#9aa0a4' : '#d4d8da', 2);
  }
  // fall-arrest posts along the front parapet
  for (let a = 1.2; a < W * 0.36; a += 1.8) {
    const [qx, qy] = P(p, a, D - 0.5, ZR);
    px(p.c, qx, qy - 9, '#e8c040', 2, 9);
    px(p.c, qx - 1, qy - 10, '#c89a28', 4, 2);
  }
  // mushroom vents and a planted strip along the front parapet between the beds and the PV
  for (const [a, b] of [[W * 0.4, 1.2], [W * 0.45, D * 0.36], [W * 0.58, D * 0.34], [W * 0.64, D * 0.5], [W * 0.4, D * 0.6], [W * 0.66, 5.4], [W * 0.92, 5.6], [W * 0.78, 5.4]] as const) vent(p, a, b, ZR);
  lbox(p, W * 0.38, D - 1.5, W * 0.24, 0.9, ZR, 2.2, { front: white, side: white, top: white, edge: CONC[0] });
  meadowField(p, W * 0.38 + 0.1, D - 1.4, W * 0.62 - 0.1, D - 0.7, ZR + 2.2, seed + 15);
  lbox(p, W * 0.47, 4.15, W * 0.15, 0.95, ZR, 2.2, { front: white, side: white, top: white, edge: CONC[0] });
  meadowField(p, W * 0.47 + 0.1, 4.25, W * 0.62 - 0.1, 5.0, ZR + 2.2, seed + 17);
  // PV arrays in rows over the front right of the roof
  for (let i = 0; i < 4; i++) pvRow(p, W * 0.66, W - 1.0, D - 1.7 - i * 1.5, ZR);
  parapet(p, 0, D - 0.22, W, 0.22, ZR);
  parapet(p, W - 0.22, 0, 0.22, D, ZR);
}

// ── the west wing ───────────────────────────────────────────
function bldB(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const GH = 40;
  const SH = 34;
  const NS = 2;
  const ZR = GH + NS * SH;
  const seed = k.seed;
  const F = front3(p, D - 0.3);
  const S = side3(p, W - 0.3);
  const bw = 2.5;
  // glazing set back behind the frame
  const glass = (light: 0 | 1, sd: number): FaceTex => curtain(bw * 71.6 * 0.5, SH * 4, sd, light);
  // its east face shows only south of the chemistry building (16.3 tiles from the front), and only
  // above the lab's wall except for the last two metres past the lab's front corner
  const SV0 = Math.max(0, D - 16.3);
  const SG0 = Math.max(0, D - 2.3);
  pt(p, F, 0, W - 0.3, 0.6, ZR, glass(1, seed + 11), 1);
  pt(p, S, SV0, D - 0.3, GH - 2, ZR, glass(0, seed + 12), 0);
  pt(p, S, SG0, D - 0.3, 0.6, GH - 2, glass(0, seed + 13), 0);
  // the ground floor: larch cladding panels between the glazing
  for (let a = 0.3; a < W - 1; a += bw * 2) pt(p, F, a + 0.3, a + 1.6, 0.6, GH - 2, larchMat(LARCH, 7), 1);
  // horizontal larch louvres in front of the upper floors, on brackets
  for (let s = 0; s < NS; s++) {
    const z0 = GH + s * SH + 6;
    const z1 = GH + (s + 1) * SH - 4;
    pt(p, front3(p, D - 0.12), 0.1, W - 0.3, z0, z1, louvre, 1);
    pt(p, side3(p, W - 0.12), SV0, D - 0.3, z0, z1, louvre, 0);
  }
  // the white precast frame: columns and slab edges
  for (let a = 0; a < W - 0.2; a += bw) lbox(p, a, D - 0.3, 0.3, 0.3, 0, ZR, { front: white, side: white, top: white, edge: CONC[0] });
  for (let b = 0; b < D - 0.2; b += bw) if (b > SV0 - 0.4) lbox(p, W - 0.3, b, 0.3, 0.3, 0, ZR, { front: white, side: white, top: white, edge: CONC[0] });
  for (let s = 1; s <= NS; s++) {
    const z = GH + (s - 1) * SH;
    lbox(p, 0, D - 0.3, W, 0.3, z - 1.6, 2.4, { front: white, side: white, top: white, edge: CONC[0] });
    lbox(p, W - 0.3, SV0, 0.3, D - SV0, z - 1.6, 2.4, { front: white, side: white, top: white, edge: CONC[0] });
  }
  lbox(p, W - 0.3, D - 0.3, 0.3, 0.3, 0, ZR, { front: white, side: white, top: white, edge: CONC[0] });
  // climbers trained up the columns on steel cables, front and east side, green with white flowers
  for (let a = bw; a < W - 0.5; a += bw) climber(p, a + 0.15, D + 0.02, 1, ZR - 4, 0.9, seed + Math.round(a * 7), 'a');
  for (let b = SV0 + 0.4 + ((D - SV0) % bw); b < D - 1; b += bw * 2) climber(p, W + 0.02, b + 0.15, b > D - 2.6 ? 1 : GH - 2, ZR - 5, 0.9, seed + Math.round(b * 11), 'b');
  // the green roof: a wildflower meadow round two glass rooflights, a stepping-stone path,
  // PV and condensers at the north end, and a larch terrace with a pergola at the south end
  roofField(p, 0, 0, W, D, ZR, '#d4d6d8', 2.4, '#bbbcbc');
  gravelField(p, 0.24, 0.24, W - 0.24, 3.3, ZR, seed + 5);
  meadowField(p, 0.5, 3.3, W - 0.5, D - 5.0, ZR + 0.3, seed + 6);
  parapet(p, 0, 0, W, 0.24, ZR, 1.6);
  parapet(p, 0, 0, 0.24, D, ZR, 1.6);
  // a low white kerb between the meadow and the terrace
  parapet(p, 0.5, D - 5.1, W - 1.0, 0.14, ZR, 1.8);
  pvRow(p, 1.0, W * 0.55, 0.8, ZR);
  pvRow(p, 1.0, W * 0.55, 2.0, ZR);
  condenser(p, W * 0.6, 0.9, 1.8, 1.4, ZR);
  condenser(p, W * 0.6 + 2.0, 0.9, 1.8, 1.4, ZR);
  const Rn = rng(seed * 3 + 1);
  skylight(p, W * 0.24, D * 0.52, 1.5, ZR);
  skylight(p, W * 0.62, D * 0.3, 1.5, ZR);
  // stepping stones running along the wing, a second line off to the side
  for (let b = 3.6; b < D - 5.4; b += 0.62) {
    const a = W * 0.46 + Math.sin(b * 0.4) * 0.5;
    roofField(p, a - 0.24, b, a + 0.24, b + 0.42, ZR + 0.35, '#eceae2');
    const [ex, ey] = P(p, a + 0.24, b + 0.42, ZR + 0.35);
    px(p.c, ex - 6, ey - 1, '#b8b6ae', 6, 1);
  }
  layer(p.c, (l) => {
    for (let i = 0; i < 26; i++) {
      const a = 0.9 + Rn() * (W - 1.8);
      const b = 3.8 + Rn() * (D - 9.2);
      const [x, y] = P(p, a, b, ZR + 0.3);
      const masses: Mass[] = [];
      for (let j = 0; j < 4; j++) masses.push({ x: x + (Rn() - 0.5) * 34, y: y - 5 + (Rn() - 0.5) * 12, rx: 10 + Rn() * 8, ry: 6 + Rn() * 4, z: j });
      foliage(l, masses, LEAF, seed + i, { cell: 2.6, bias: 0.1, dots: [BLOOMS[(i * 3) % BLOOMS.length], BLOOMS[(i * 5 + 2) % BLOOMS.length]], dotChance: 0.5, dotSize: 2 });
    }
  }, { outline: 0.5 });
  // a few grey stones in the meadow
  for (let i = 0; i < 4; i++) {
    const [x, y] = P(p, 1.2 + Rn() * (W - 2.4), 4 + Rn() * (D - 10), ZR + 0.3);
    ell(p.c, x, y - 2, 6, 3.5, '#8e9290');
    ell(p.c, x - 1, y - 3, 4, 2, '#b8bcba');
  }
  // a row of beehives and a little weather station
  for (let i = 0; i < 4; i++) {
    const a = 1.4 + i * 0.95;
    const b = 6.2;
    const hv = coat(['#a8a088', '#c4bc9e', '#dcd4b4', '#ece6c8', '#f6f2dc', '#fffcec']);
    lbox(p, a, b, 0.6, 0.6, ZR, 0.8, mono(coat(['#5a4a3a', '#6e5a46', '#826c54']), '#3a2e24'));
    lbox(p, a + 0.03, b + 0.03, 0.54, 0.54, ZR + 0.8, 2.8, { front: hv, side: hv, top: coat(['#6a4a30', '#7e5a3a', '#946c46', '#a87e52', '#bc905e']), edge: '#7a7058' });
    const [ex, ey] = P(p, a + 0.3, b + 0.57, ZR + 1.2);
    px(p.c, ex - 3, ey - 1, '#2a2420', 6, 1);
    // bees
    for (let j = 0; j < 4; j++) px(p.c, ex - 8 + hash(i, j, 3) * 18, ey - 10 - hash(j, i, 4) * 14, j % 2 ? '#e8b030' : '#2a2420', 1, 1);
  }
  const [wx, wy] = P(p, W - 2.2, 4.4, ZR);
  layer(p.c, (l) => {
    px(l, wx - 1, wy - 64, STEEL[3], 2, 64);
    px(l, wx - 10, wy - 64, STEEL[4], 20, 1);
    for (const dx of [-10, 10]) {
      ell(l, wx + dx, wy - 66, 2.5, 1.5, STEEL[5]);
    }
    fillPoly(l, [[wx, wy - 72], [wx + 9, wy - 69], [wx, wy - 66]], STEEL[4]);
    px(l, wx - 4, wy - 40, '#e8eaea', 8, 6);
    px(l, wx - 3, wy - 39, '#5ab0e8', 2, 1);
  }, { outline: 0.55, rect: [wx - 16, wy - 80, wx + 16, wy + 4] });
  // the terrace: larch decking with board lines, corten planters with grasses
  roofField(p, 0.6, D - 4.8, W - 0.6, D - 0.6, ZR + 0.2, LARCH[4]);
  for (let b = D - 4.8 + 0.14; b < D - 0.6; b += 0.14) {
    const [x0, y0] = P(p, 0.6, b, ZR + 0.2);
    const [x1, y1] = P(p, W - 0.6, b, ZR + 0.2);
    ln(p.c, x0, y0, x1, y1, hash(Math.round(b * 50), 1, seed) < 0.5 ? LARCH[3] : LARCH[2]);
  }
  // a timber pergola over the west end of the terrace, a climber up its corner post
  const pg0 = 0.9;
  const pg1 = Math.min(W * 0.42, 5);
  const pb0 = D - 4.5;
  const pb1 = D - 2.3;
  const tim = larchMat(LARCH, 5);
  const timber = { front: tim, side: tim, top: coat(LARCH), edge: LARCH[0] };
  for (const [a, b] of [[pg0, pb0], [pg1 - 0.16, pb0], [pg0, pb1 - 0.16], [pg1 - 0.16, pb1 - 0.16]] as const) lbox(p, a, b, 0.16, 0.16, ZR + 0.2, 22, timber);
  lbox(p, pg0 - 0.2, pb0, pg1 - pg0 + 0.4, 0.14, ZR + 21, 1.6, timber);
  lbox(p, pg0 - 0.2, pb1 - 0.14, pg1 - pg0 + 0.4, 0.14, ZR + 21, 1.6, timber);
  for (let a = pg0; a < pg1; a += 0.32) lbox(p, a, pb0 - 0.25, 0.09, pb1 - pb0 + 0.5, ZR + 22.6, 1.2, timber);
  climber(p, pg0 + 0.08, pb1, ZR + 1, ZR + 22, 0.7, seed + 77, 'a');
  // timber planters with shrubs and flowers along the terrace's edges, a potted olive
  const box = { front: larchMat(LARCH, 4), side: larchMat(LARCH, 4), top: coat(LARCH), edge: LARCH[0] };
  for (const [a, b, w2] of [[pg1 + 0.4, D - 4.7, W - pg1 - 1.4], [W * 0.55, D - 1.5, W * 0.4]] as const) {
    lbox(p, a, b, w2, 0.6, ZR + 0.2, 2.6, box);
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let t = 0.2; t < w2 - 0.1; t += 0.32) {
        const [gx, gy] = P(p, a + t, b + 0.3, ZR + 2.8);
        masses.push({ x: gx, y: gy - 8 - Rn() * 6, rx: 15 + Rn() * 7, ry: 11 + Rn() * 4, z: t });
      }
      foliage(l, masses, LEAF, seed + Math.round(a * 13), { cell: 2.6, holes: 0.06, bias: 0.25, dots: ['#f4f0e0', '#e88ab0', '#f2d24a'], dotChance: 0.35, dotSize: 2 });
    }, { outline: 0.5 });
  }
  // two deck loungers in teal canvas
  for (const [a, b] of [[W * 0.2, D - 2.2], [W * 0.72, D - 2.6]] as const) {
    const [lx, ly] = P(p, a, b, ZR + 0.2);
    layer(p.c, (l) => {
      fillPoly(l, [[lx - 14, ly + 1], [lx + 4, ly - 8], [lx + 12, ly - 4], [lx - 6, ly + 5]], LARCH[2]);
      fillPoly(l, [[lx - 14, ly - 2], [lx + 4, ly - 11], [lx + 10, ly - 8], [lx - 8, ly + 1]], TEAL[3]);
      fillPoly(l, [[lx + 4, ly - 11], [lx + 10, ly - 8], [lx + 12, ly - 20], [lx + 6, ly - 23]], TEAL[4]);
    }, { outline: 0.55 });
  }
  const [tx, ty] = P(p, W * 0.5, D - 2.6, ZR + 0.2);
  layer(p.c, (l) => {
    // a round table and four chairs in the umbrella's shade
    ell(l, tx + 6, ty + 3, 22, 9, 'rgba(42,26,42,0.25)');
    for (const [dx, dy] of [[-16, -2], [14, -4], [-4, 6], [4, -9]] as const) {
      px(l, tx + dx - 4, ty + dy - 10, ANTH[2], 8, 2);
      px(l, tx + dx - 4, ty + dy - 10, ANTH[0], 1, 10);
      px(l, tx + dx + 3, ty + dy - 10, ANTH[0], 1, 10);
      px(l, tx + dx + (dx < 0 ? -4 : 3), ty + dy - 18, ANTH[3], 2, 8);
    }
    px(l, tx - 1, ty - 14, ANTH[1], 2, 14);
    ell(l, tx, ty - 15, 11, 5, '#c8ccca');
    ell(l, tx, ty - 16, 11, 5, '#f2f4f2');
  }, { outline: 0.5, rect: [tx - 40, ty - 40, tx + 40, ty + 20] });
  layer(p.c, (l) => {
    ell(l, tx, ty - 26, 7, 3, '#f2f2ee');
    px(l, tx - 1, ty - 26, '#5a5e64', 2, 26);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      fillPoly(l, [[tx, ty - 58], [tx + Math.cos(a0) * 34, ty - 44 + Math.sin(a0) * 15], [tx + Math.cos(a1) * 34, ty - 44 + Math.sin(a1) * 15]], i % 2 ? '#e8e4da' : '#d6d0c4');
    }
  }, { outline: 0.55 });
  parapet(p, 0, D - 0.24, W, 0.24, ZR, 1.6);
  parapet(p, W - 0.24, 0, 0.24, D, ZR, 1.6);
  // a glass balustrade on the terrace edge
  p.c.globalAlpha = 0.35;
  pq(p, front3(p, D - 0.1), 0.4, W - 0.4, ZR + 1.6, ZR + 5.6, '#cfe8ee');
  p.c.globalAlpha = 1;
  pq(p, front3(p, D - 0.1), 0.4, W - 0.4, ZR + 5.4, ZR + 5.8, STEEL[4]);
}

// ── the glass tower (simplified: flat fills, it stands at the frame's edge) ──
function bldC(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const NS = 6;
  const SH = 34;
  const ZR = 40 + (NS - 1) * SH;
  const F = front3(p, D - 0.25);
  const S = side3(p, W - 0.25);
  const Rn = rng(k.seed * 5 + 3);
  // a glass tower with deep white slab edges: each pane one fill (cheap: it stands at the frame's edge)
  lbox(p, 0, 0, W, D, 0, 1, mono(white, CONC[0]));
  const pane = (pl: Pl, u0: number, u1: number, z0: number, z1: number, light: 0 | 1, bay: number, st: number) => {
    const r = hash(bay, st, k.seed);
    pq(p, pl, u0, u1, z0, z1, light ? CGLASS[3] : CGLASS[2]);
    // the reflection band slides across the façade, rooms lit or blinds down
    const rf = (bay * 0.7 + st * 0.4) % 4;
    if (rf < 0.8) pq(p, pl, u0, u1, z0 + (z1 - z0) * 0.3, z1, light ? CGLASS[5] : CGLASS[4]);
    if (r > 0.52) pq(p, pl, u0 + 0.05, u1 - 0.05, z0 + 1, z0 + (z1 - z0) * 0.86, r > 0.8 ? '#f4d888' : light ? '#efc765' : '#dcb458');
    else if (r < 0.22) pq(p, pl, u0, u1, z1 - (z1 - z0) * (0.25 + r), z1, light ? '#e8ecea' : '#c8cecc');
    pq(p, pl, u0, u0 + 0.04, z0, z1, ANTH[light ? 2 : 1]);
    pq(p, pl, u0 + 0.04, u0 + 0.07, z0, z1, light ? '#d8e2e2' : '#9aacae');
    pq(p, pl, (u0 + u1) / 2 - 0.015, (u0 + u1) / 2 + 0.015, z0, z1, ANTH[light ? 3 : 2]);
    pq(p, pl, u0, u1, z0 + (z1 - z0) * 0.3, z0 + (z1 - z0) * 0.3 + 0.5, ANTH[light ? 3 : 2]);
    pq(p, pl, u0, u1, z1 - 1.6, z1, light ? '#24323a' : '#1a262c');
  };
  const bw = 0.9;
  for (let s2 = 0; s2 < NS; s2++) {
    const z0 = s2 === 0 ? 1 : 40 + (s2 - 1) * SH;
    const z1 = s2 === 0 ? 38 : z0 + SH - 2.4;
    for (let a = 0, i = 0; a < W - 0.3; a += bw, i++) pane(F, a, Math.min(W - 0.25, a + bw), z0, z1, 1, i, s2);
    for (let b = 0, i = 0; b < D - 0.3; b += bw, i++) pane(S, b, Math.min(D - 0.25, b + bw), z0, z1, 0, i + 40, s2);
  }
  // the slab edges as white bands proud of the glass, the corner column
  for (let s2 = 1; s2 <= NS; s2++) {
    const z = 40 + (s2 - 1) * SH - 2.4;
    lbox(p, 0, D - 0.25, W - 0.25, 0.25, z, 2.4, { front: white, side: white, top: white, edge: CONC[0] });
    lbox(p, W - 0.25, 0, 0.25, D, z, 2.4, { front: white, side: white, top: white, edge: CONC[0] });
  }
  lbox(p, W - 0.4, D - 0.4, 0.4, 0.4, 0, ZR, { front: white, side: white, top: white, edge: CONC[0] });
  // green walls up the front and the side
  climber(p, W * 0.3, D + 0.03, 2, ZR - 14, 2.0, k.seed + 31, 'a');
  climber(p, W * 0.72, D + 0.03, 40, ZR - 4, 1.6, k.seed + 32, 'a');
  climber(p, W + 0.03, D * 0.45, 2, ZR - 30, 2.0, k.seed + 33, 'b');
  roofField(p, 0, 0, W, D, ZR, '#d4d6d8', 2.2, '#bbbcbc');
  parapet(p, 0, 0, W, 0.2, ZR, 1.2);
  parapet(p, 0, 0, 0.2, D, ZR, 1.2);
  meadowField(p, 0.6, D * 0.55, W * 0.6, D - 0.6, ZR + 0.3, k.seed + 41);
  parapet(p, 0.5, D * 0.55 - 0.1, W * 0.6 - 0.4, 0.1, ZR, 1.2);
  ahu(p, W * 0.25, D * 0.25, 4, 2, ZR);
  condenser(p, W * 0.66, D * 0.6, 2, 1.4, ZR);
  for (const [a, b] of [[W * 0.15, D * 0.2], [W * 0.62, D * 0.18], [W * 0.85, D * 0.75]] as const) vent(p, a, b, ZR);
  exhaustStack(p, W * 0.72, D * 0.3, ZR, 22);
  exhaustStack(p, W * 0.72 + 1.2, D * 0.3 + 0.5, ZR, 26);
  parapet(p, 0, D - 0.2, W, 0.2, ZR, 1.2);
  parapet(p, W - 0.2, 0, 0.2, D, ZR, 1.2);
  void Rn;
}

/** Lit windows at night: a scatter over the visible façades (front b = d, side a = w), storey by storey. */
function facadeLights(k: PropCtx, storeys: [number, number][], step: number, sideFrom: number, n: number, seed: number): PropLight[] {
  const W = k.w;
  const D = k.d;
  const all: PropLight[] = [];
  storeys.forEach(([z0, z1], si) => {
    for (let a = step * 0.6; a < W - 0.4; a += step) if (hash(Math.round(a * 10), si, seed) < 0.55) all.push({ a, b: D + 0.05, z: (z0 + z1) / 2, r: 1.3, color: '#ffd49a', kind: 'window' });
    for (let b = Math.max(sideFrom, step * 0.6); b < D - 0.4; b += step) if (hash(Math.round(b * 10), si + 9, seed) < 0.5) all.push({ a: W + 0.05, b, z: (z0 + z1) / 2, r: 1.3, color: '#ffd49a', kind: 'window' });
  });
  const out: PropLight[] = [];
  for (let i = 0; i < Math.min(n, all.length); i++) out.push(all[Math.floor(((i + 0.5) * all.length) / Math.min(n, all.length))]);
  return out;
}

const lab_building: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'a';
    if (v === 'b') bldB(p, k);
    else if (v === 'c') bldC(p, k);
    else bldA(p, k);
  },
  lights(k) {
    const v = k.variant ?? 'a';
    if (v === 'b') return facadeLights(k, [[6, 34], [42, 70], [76, 104]], 1.25, Math.max(0, k.d - 16.3), 16, 3);
    if (v === 'c') return facadeLights(k, [[4, 36], [42, 74], [76, 108], [110, 142], [144, 176], [178, 210]], 0.9, 0, 16, 5);
    // the chemistry building: its upper storeys, the lobby by the entrance (the lab hides the rest of the ground floor)
    const out = facadeLights(k, [[44, 74], [80, 110], [116, 146]], 1.6, 0, 16, 7);
    for (const a of [k.w - 6.2, k.w - 4.2, k.w - 2.2]) out.push({ a, b: k.d - 1.0, z: 14, r: 1.8, color: '#ffcf8a', kind: 'window' });
    return out;
  },
};

// ── distant blocks to the frame's edge (flat fills, cheap) ──
const lab_skyline: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 7 + 11);
    const W = k.w;
    const D = k.d;
    const blocks: [number, number, number, number, number, number][] = [];
    for (let a = 0; a < W - 1; a += 3.2 + Rn() * 2.4)
      for (let b = 0; b < D - 1; b += 3.2 + Rn() * 2.4) {
        const w = Math.min(W - a, 2.6 + Rn() * 3);
        const d = Math.min(D - b, 2.6 + Rn() * 3);
        if (Rn() < 0.22) {
          blocks.push([a, b, w, d, 0, 0]); // a copse
          continue;
        }
        blocks.push([a, b, w, d, 76 + Math.floor(Rn() * 4) * 34, Math.floor(Rn() * 3)]);
      }
    blocks.sort((m, n) => m[0] + m[1] - (n[0] + n[1]));
    for (const [a, b, w, d, h, kind] of blocks) {
      if (h === 0) {
        // a copse of distant trees between the buildings: flat lit and shaded blobs, a few pale stems
        const pts: [number, number, number][] = [];
        for (let i = 0; i < 8; i++) {
          const [x, y] = P(p, a + Rn() * w, b + Rn() * d, 0);
          pts.push([x, y, 26 + Rn() * 14]);
        }
        pts.sort((m, n) => m[1] - n[1]);
        for (const [x, y, r] of pts) {
          const top = y - 70 - r;
          px(p.c, x - 1, y - 70, '#d8d4cc', 3, 70);
          ell(p.c, x + 3, top + 4, r, r * 0.8, LEAF[2]);
          ell(p.c, x, top, r * 0.92, r * 0.74, LEAF[4]);
          ell(p.c, x - r * 0.3, top - r * 0.25, r * 0.5, r * 0.36, LEAF[6]);
        }
        continue;
      }
      const f0 = p.P(a, b + d, 0);
      const f1 = p.P(a + w, b + d, 0);
      const f2 = p.P(a + w, b + d, h);
      const f3 = p.P(a, b + d, h);
      const s1 = p.P(a + w, b, 0);
      const s2 = p.P(a + w, b, h);
      const glassy = kind === 1;
      fillPoly(p.c, [f0, f1, f2, f3], glassy ? CGLASS[3] : CONC[4]);
      fillPoly(p.c, [f1, s1, s2, f2], glassy ? CGLASS[1] : CONC[2]);
      const F = front3(p, b + d);
      const S = side3(p, a + w);
      if (!glassy) {
        pt(p, F, a, a + w, 0, h, white, 1);
        pt(p, S, b, b + d, 0, h, white, 0);
      }
      if (kind === 2) {
        meadowField(p, a, b, a + w, b + d, h, Math.round(a * 7 + b * 3));
        parapet(p, a, b + d - 0.15, w, 0.15, h, 1.2);
        parapet(p, a + w - 0.15, b, 0.15, d, h, 1.2);
      } else {
        roofField(p, a, b, a + w, b + d, h, '#d4d6d8', 1.2, '#bbbcbc');
        vent(p, a + w * 0.3, b + d * 0.3, h);
        vent(p, a + w * 0.7, b + d * 0.6, h);
      }
      for (let z = 12; z < h - 4; z += 34) {
        if (glassy) {
          for (let u = a + 0.1; u < a + w - 0.5; u += 0.6) if (Rn() < 0.35) pq(p, F, u, u + 0.5, z + 4, z + 28, Rn() < 0.5 ? '#efc765' : '#f4d888');
          for (let u = b + 0.1; u < b + d - 0.5; u += 0.6) if (Rn() < 0.3) pq(p, S, u, u + 0.5, z + 4, z + 28, '#dcb458');
          for (let u = a + 0.6; u < a + w - 0.1; u += 0.6) pq(p, F, u - 0.03, u + 0.03, z, z + 32, ANTH[3]);
          for (let u = b + 0.6; u < b + d - 0.1; u += 0.6) pq(p, S, u - 0.03, u + 0.03, z, z + 32, ANTH[2]);
          pq(p, F, a, a + w, z - 2, z, CONC[5]);
          pq(p, S, b, b + d, z - 2, z, CONC[3]);
        } else {
          pq(p, F, a + 0.2, a + w - 0.2, z + 6, z + 22, CGLASS[3]);
          pq(p, S, b + 0.2, b + d - 0.2, z + 6, z + 22, CGLASS[2]);
          for (let u = a + 0.2; u < a + w - 0.5; u += 0.7) if (Rn() < 0.4) pq(p, F, u + 0.08, u + 0.62, z + 6, z + 22, Rn() < 0.5 ? '#efc765' : '#f4d888');
          for (let u = b + 0.2; u < b + d - 0.5; u += 0.7) if (Rn() < 0.35) pq(p, S, u + 0.08, u + 0.62, z + 6, z + 22, '#dcb458');
          for (let u = a + 0.6; u < a + w - 0.3; u += 0.7) pq(p, F, u, u + 0.06, z + 6, z + 22, CONC[5]);
          for (let u = b + 0.6; u < b + d - 0.3; u += 0.7) pq(p, S, u, u + 0.06, z + 6, z + 22, CONC[3]);
          // sills: a lit lip over a dark drip line, the reveal's shadow on top
          pq(p, F, a + 0.2, a + w - 0.2, z + 5, z + 6, '#ffffff');
          pq(p, F, a + 0.2, a + w - 0.2, z + 4.4, z + 5, '#8a908c');
          pq(p, F, a + 0.2, a + w - 0.2, z + 20.6, z + 22, '#1c2a32');
          pq(p, S, b + 0.2, b + d - 0.2, z + 5, z + 6, '#e0e4e0');
          pq(p, S, b + 0.2, b + d - 0.2, z + 20.6, z + 22, '#16222a');
        }
      }
      pq(p, F, a, a + w, h - 1.6, h, CONC[5]);
      pq(p, S, b, b + d, h - 1.6, h, CONC[3]);
      if (Rn() < 0.6) {
        // stacks or plant on the roof
        const [x, y] = P(p, a + w * 0.6, b + d * 0.4, h);
        px(p.c, x - 3, y - 26, STEEL[3], 6, 26);
        px(p.c, x - 3, y - 26, STEEL[5], 2, 26);
        px(p.c, x + 8, y - 12, '#a8aeb0', 14, 12);
      }
    }
  },
};

export const CHEMLAB_CAMPUS: Record<string, PropArt> = { lab_building, lab_skyline };

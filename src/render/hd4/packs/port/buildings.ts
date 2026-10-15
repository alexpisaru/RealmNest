// Logistics Port — the buildings round the harbour (a storey ≈ 30–40 z).
//   prt_warehouse  variants: brick (a Hanseatic brick store with hoist gables,
//                  stacked loading doors and a copper roof), shed (a corrugated
//                  steel shed with roller doors), cold (a white cold store with
//                  dock shelters), saw (a brick workshop under a sawtooth roof)
//   prt_market     the fish market hall: brick arcade, awnings, a ridge lantern
//   prt_office     the harbour master's office with a signal mast
//   prt_gate       the terminal gate: a canopy over the lanes, booths, barriers
//   prt_skyline    distant warehouses, silos, tanks and cranes (flat shaded)
// Visible faces are the front (b = d, facing +y) and the side (a = w, +x).
import { darken } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, bayer, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, front3, type Plane, poly3, pq, pt, side, side3 } from '../../plane4';
import { lbox, mono } from '../util';
import { cladH, corr, gullStand, plate, shadowBand, stencil, text } from './kit';
import { BRICK, GALV, GLASS, MORTAR, P, RUST, STEEL } from './palette';
import { car } from './vehicles';

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };

const COPPER: Ramp = ['#1c3f2e', '#24523c', '#2e6649', '#377a57', '#428a64', '#559c74', '#74b28c'];
const SLATE: Ramp = ['#2e3442', '#3a4050', '#474e5e', '#555c6c', '#646b7c', '#757c8c'];
const SAND: Ramp = ['#9a8a6a', '#b2a07c', '#c8b690', '#dccaa4', '#eadab6', '#f4e8c8'];
const DOORG: Ramp = ['#14402a', '#1a5434', '#22663e', '#2c784a', '#388a56', '#4a9c66'];
const ZINC: Ramp = ['#4e5462', '#5e6472', '#6e7482', '#7e8492', '#8e94a2', '#a2a8b4'];

/** Brick in English bond: sooty courses, a few headers burnt darker (a precomputed 224×40 pattern), grit and damp per pixel. */
const BW = 224;
const BH = 40;
const BRICK_PAT = (() => {
  const t = new Float32Array(BW * BH);
  for (let v = 0; v < BH; v++)
    for (let u = 0; u < BW; u++) {
      const bh = 5;
      const row = Math.floor(v / bh);
      const header = row % 2 === 1;
      const bw = header ? 7 : 14;
      const off = header ? 3.5 : 0;
      const col = Math.floor((u + off) / bw);
      const fu = u + off - col * bw;
      const fv = v - row * bh;
      if (fv < 1 || fu < 1) {
        t[v * BW + u] = -9;
        continue;
      }
      let i = (hash(col, row, 51) - 0.5) * 1.6;
      if (header && hash(col, row, 52) < 0.25) i -= 1.2;
      if (fv > bh - 1.6) i += 0.5;
      t[v * BW + u] = i;
    }
  return t;
})();
const brick =
  (r: Ramp, mortar = MORTAR): Mat =>
  (light) => {
    const base = light === 0 ? 1.6 : 3;
    const mort = light === 0 ? '#5e5248' : mortar;
    return (u, v, x, y) => {
      const o = BRICK_PAT[((v | 0) % BH) * BW + ((u | 0) % BW)];
      if (o === -9) return mort;
      let i = base + o;
      if (hash(x, y, 53) < 0.06) i -= 0.8;
      if (v < 14 && bayer(x, y) * 14 > v) i -= 0.8;
      return at(r, i);
    };
  };

/** Slate or copper roofing in courses (v runs up the slope). */
const roofing =
  (r: Ramp, rowH = 5, sw = 9): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = row & 1 ? sw / 2 : 0;
    const col = Math.floor((u + off) / sw);
    let i = (light === 0 ? 1.6 : light === 2 ? 3.6 : 3) + (hash(col, row, 61) - 0.5) * 1.1;
    if (fv < 1.1) i -= 1.6;
    else if (fv > rowH - 1.4) i += 0.8;
    if ((u + off) % sw < 1) i -= 0.8;
    if (hash(x, y, 62) < 0.04) i -= 0.8;
    return at(r, i);
  };

/** A window with a white frame, small panes, the dark room behind, an arched or flat head. */
function win(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, o: { arch?: boolean; lit?: boolean; frame?: string; seed?: number } = {}) {
  const fr = o.frame ?? '#e8e4da';
  const light = pl.light;
  const dark = pl.light ? '#1a2a3e' : '#142234';
  const glassC = pl.light ? '#3a6890' : '#2c5274';
  if (o.arch) {
    const r = (u1 - u0) / 2;
    const pts: [number, number][] = [[u0 - 0.03, z0 - 0.4]];
    for (let j = 0; j <= 8; j++) {
      const t = Math.PI - (j / 8) * Math.PI;
      pts.push([(u0 + u1) / 2 + Math.cos(t) * (r + 0.03), z1 + Math.sin(t) * (r + 0.03) * 7]);
    }
    pts.push([u1 + 0.03, z0 - 0.4]);
    poly3(
      p,
      pts.map(([u, z]) => pl.at(u, z)),
      (_u: number, _v: number) => darken('#a89474', light ? 0 : 0.2),
      light,
    );
    const pts2: [number, number][] = [[u0, z0]];
    for (let j = 0; j <= 8; j++) {
      const t = Math.PI - (j / 8) * Math.PI;
      pts2.push([(u0 + u1) / 2 + Math.cos(t) * r, z1 + Math.sin(t) * r * 7]);
    }
    pts2.push([u1, z0]);
    poly3(
      p,
      pts2.map(([u, z]) => pl.at(u, z)),
      (u: number, v: number) => ((u * 0.8 + v) % 26 < 4 ? '#8aaab4' : o.lit && v < 14 ? '#e8c070' : v > 20 ? dark : glassC),
      light,
    );
  } else {
    pq(p, pl, u0 - 0.03, u1 + 0.03, z0 - 0.5, z1 + 0.5, fr);
    pt(
      p,
      pl,
      u0,
      u1,
      z0,
      z1,
      (u: number, v: number, x: number, y: number) => ((u * 0.8 + v) % 26 < 4 ? '#8aaab4' : o.lit && v < 14 && hash(x >> 1, y >> 1, 5) < 0.7 ? '#e8c070' : v > (z1 - z0) * 4 - 6 ? dark : glassC),
      light,
    );
  }
  // glazing bars
  const um = (u0 + u1) / 2;
  const [a, b] = [pl.F(um, z0), pl.F(um, z1)];
  ln(p.c, a[0], a[1], b[0], b[1], fr);
  const zm = (z0 + z1) / 2;
  const [c0, c1] = [pl.F(u0, zm), pl.F(u1, zm)];
  ln(p.c, c0[0], c0[1], c1[0], c1[1], fr);
  // the sill
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 1, z0, light ? SAND[4] : SAND[2]);
}

/** A loading door: planked leaves in a frame, painted green, iron hinges, a sill. */
function loadDoor(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, open = false) {
  const light = pl.light;
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 0.6, z1 + 0.8, SAND[light ? 4 : 2]);
  if (open) {
    pq(p, pl, u0, u1, z0, z1, '#141a1e');
    pq(p, pl, u0 + 0.05, u1 - 0.05, z0, z0 + 3, '#3a2e24');
    return;
  }
  pt(
    p,
    pl,
    u0,
    u1,
    z0,
    z1,
    (u: number, v: number, x: number, y: number) => {
      let i = (light ? 3 : 1.6) + (u % 7 < 1 ? -1 : 0);
      if (Math.abs(u - ((u1 - u0) * 71.5) / 2) < 1) i = 0;
      if (hash(x, y, 7) < 0.04) i -= 0.8;
      void v;
      return at(DOORG, i);
    },
    light,
  );
  for (const z of [z0 + (z1 - z0) * 0.22, z0 + (z1 - z0) * 0.78]) pq(p, pl, u0, u1, z, z + 0.4, '#1a1a1e');
}

/** A skylight let into a roof slope: a white frame, sky-blue glass with a glare, glazing bars (corners in 3-D, going round). */
function skylight(p: PropPainter, q: [number, number, number][]) {
  const P4 = q.map(([a, b, z]) => p.P(a, b, z));
  fillPoly(p.c, P4, '#e8ecee');
  const cx = (P4[0][0] + P4[1][0] + P4[2][0] + P4[3][0]) / 4;
  const cy = (P4[0][1] + P4[1][1] + P4[2][1] + P4[3][1]) / 4;
  const ins = P4.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.78] as [number, number]);
  fillPoly(p.c, ins, '#5aa0dc');
  fillPoly(p.c, [ins[0], [(ins[0][0] + ins[1][0]) / 2, (ins[0][1] + ins[1][1]) / 2], [(ins[2][0] + ins[3][0]) / 2, (ins[2][1] + ins[3][1]) / 2], ins[3]], '#8cc4ee');
  ln(p.c, (ins[0][0] + ins[1][0]) / 2, (ins[0][1] + ins[1][1]) / 2, (ins[2][0] + ins[3][0]) / 2, (ins[2][1] + ins[3][1]) / 2, '#e8ecee', 2);
  ln(p.c, ins[3][0] + 2, ins[3][1] + 1, ins[3][0] + (ins[2][0] - ins[3][0]) * 0.3, ins[3][1] + (ins[2][1] - ins[3][1]) * 0.3 + 1, '#d4ecfa', 2);
}

// ── the brick store ───────────────────────────────────────────
function speicher(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const GH = 38;
  const SH = 29;
  const n = 4 + (k.seed % 2);
  const ze = GH + (n - 1) * SH;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const b0 = 0.4;
  const b1 = D - 1.1;
  const F = front3(p, b1);
  const S = side3(p, a1);
  const Rn = rng(k.seed * 13 + 5);
  shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
  // the loading platform along the front (quay height + 1 m) with a canopy
  lbox(p, a0, b1, a1 - a0, 0.8, 0, 9, {
    front: plate(['#4e4c48', '#5e5c58', '#6e6c68', '#807e78', '#92908a', '#a4a29a']),
    side: plate(['#4e4c48', '#5e5c58', '#6e6c68', '#807e78', '#92908a', '#a4a29a']),
    top: plate(['#5a5650', '#6a665e', '#7a766e', '#8c8880', '#9e9a92', '#b0aca2']),
    edge: '#3e3c38',
  });
  const PF = front(p, b1 + 0.8);
  for (let a = a0 + 0.4; a < a1 - 0.2; a += 1.1) pq(p, PF, a, a + 0.22, 2, 7, '#18181c');
  // the walls: a granite plinth, then brick
  const br = brick(BRICK);
  lbox(p, a0, b0, a1 - a0, b1 - b0, 0, ze, { front: br, side: br, edge: BRICK[0] });
  pq(p, F, a0, a1, 0, 5, SAND[2]);
  pq(p, S, b0, b1, 0, 5, SAND[1]);
  // string courses at each floor, a corbelled cornice
  for (let s = 1; s < n; s++) {
    const z = GH + (s - 1) * SH;
    pq(p, F, a0, a1, z - 1.2, z, SAND[4]);
    pq(p, S, b0, b1, z - 1.2, z, SAND[2]);
  }
  pq(p, F, a0 - 0.05, a1 + 0.05, ze - 3, ze, SAND[4]);
  pq(p, F, a0 - 0.05, a1 + 0.05, ze - 3.6, ze - 3, BRICK[0]);
  for (let a = a0 + 0.1; a < a1 - 0.1; a += 0.25) pq(p, F, a, a + 0.1, ze - 4.6, ze - 3.6, BRICK[2]);
  pq(p, S, b0, b1, ze - 3, ze, SAND[2]);
  // bays: stacked loading doors in the middle of each, windows either side
  const nb = Math.max(2, Math.round((a1 - a0) / 2.8));
  const bw = (a1 - a0) / nb;
  for (let bi = 0; bi < nb; bi++) {
    const c = a0 + bw * (bi + 0.5);
    for (let s = 0; s < n; s++) {
      const z = s === 0 ? 9 : GH + (s - 1) * SH;
      const h = s === 0 ? 22 : 20;
      if (s === 0) {
        // a roller door at platform level
        pq(p, F, c - 0.62, c + 0.62, z, z + h, SAND[3]);
        pt(p, F, c - 0.56, c + 0.56, z, z + h - 1, (u: number, v: number) => at(P.blue, (v % 4 < 1 ? 3 : 4.6) + (u < 3 ? 0.6 : 0)), 1);
      } else loadDoor(p, F, c - 0.36, c + 0.36, z + 3, z + h, s === 1 && Rn() < 0.4);
      for (const dw of [-1, 1]) {
        const wc = c + dw * bw * 0.32;
        if (s === 0) win(p, F, wc - 0.22, wc + 0.22, 13, 26, { frame: '#d8d4ca', seed: bi });
        else win(p, F, wc - 0.2, wc + 0.2, z + 6, z + 19, { arch: true, lit: Rn() < 0.12, seed: bi * 7 + s });
      }
    }
  }
  // side windows
  const ns = Math.max(1, Math.round((b1 - b0) / 1.6));
  for (let s = 0; s < n; s++) {
    const z = s === 0 ? 12 : GH + (s - 1) * SH + 6;
    for (let i = 0; i < ns; i++) {
      const c = b0 + ((b1 - b0) * (i + 0.5)) / ns;
      win(p, S, c - 0.2, c + 0.2, z, z + 13, { arch: s > 0, seed: i * 3 + s });
    }
  }
  // the name across the facade
  const name = ['SPEICHER W', 'SPEICHER O', 'LAGERHAUS 3'][k.seed % 3];
  stencil(p, F, (a0 + a1) / 2 - name.length * 0.095, GH + SH - 4, name, '#ece4d4', 3);
  // the roof: a steep copper slope with the ridge along the front, a gable end over the side
  const zr = ze + Math.min(46, (b1 - b0) * 7);
  const bm = (b0 + b1) / 2;
  poly3(
    p,
    [
      [a0 - 0.15, b1 + 0.15, ze],
      [a1 + 0.15, b1 + 0.15, ze],
      [a1 + 0.15, bm, zr],
      [a0 - 0.15, bm, zr],
    ],
    roofing(COPPER, 5, 10),
    1,
  );
  poly3(
    p,
    [
      [a1, b1, ze],
      [a1, b0, ze],
      [a1, bm, zr],
    ],
    br,
    0,
    [
      [a1, b1, ze],
      [a1, b0, ze],
      [a1, b1, zr],
    ],
  );
  pq(p, S, b0, b1, ze - 0.4, ze, SAND[1]);
  const [rx0, ry0] = p.P(a0 - 0.15, bm, zr);
  const [rx1, ry1] = p.P(a1 + 0.15, bm, zr);
  ln(p.c, rx0, ry0, rx1, ry1, COPPER[6], 3);
  // a round window in the side gable
  const [ox, oy] = S.F(bm, ze + (zr - ze) * 0.35);
  ell(p.c, ox, oy, 7, 8, SAND[2]);
  ell(p.c, ox, oy, 5, 6, '#1e2a30');
  // hoist gables over each bay: a brick face rising through the roof, a beam with a block and tackle
  for (let bi = 0; bi < nb; bi++) {
    const c = a0 + bw * (bi + 0.5);
    const g0 = c - 0.55;
    const g1 = c + 0.55;
    const gz = ze + 30;
    // the gable's cheeks on the roof and its little roof
    poly3(
      p,
      [
        [g1, b1, ze],
        [g1, b1 - 1.2, ze + 8.6],
        [g1, b1 - 1.2, gz - 4],
        [g1, b1, gz - 4],
      ],
      br,
      0,
    );
    poly3(p, [F.at(g0, ze - 0.5), F.at(g1, ze - 0.5), F.at(g1, gz - 4), F.at(c, gz + 4), F.at(g0, gz - 4)], br, 1);
    poly3(
      p,
      [
        [g0 - 0.06, b1 + 0.08, gz - 4.2],
        [c, b1 + 0.08, gz + 4.2],
        [c, b1 - 1.2, gz + 4.2],
        [g0 - 0.06, b1 - 1.2, gz - 4.2],
      ],
      roofing(COPPER, 4, 8),
      1,
    );
    poly3(
      p,
      [
        [c, b1 + 0.08, gz + 4.2],
        [g1 + 0.06, b1 + 0.08, gz - 4.2],
        [g1 + 0.06, b1 - 1.2, gz - 4.2],
        [c, b1 - 1.2, gz + 4.2],
      ],
      roofing(COPPER, 4, 8),
      0,
    );
    loadDoor(p, F, c - 0.3, c + 0.3, ze + 2, ze + 18);
    // the hoist beam sticking out with its block
    const [hx, hy] = F.F(c, gz - 2);
    ln(p.c, hx, hy, hx - 10, hy + 6, '#3a2a20', 3);
    ln(p.c, hx - 10, hy + 6, hx - 10, hy + 26, '#2a2a30');
    px(p.c, hx - 12, hy + 6, '#4a4a52', 5, 4);
    px(p.c, hx - 11, hy + 26, '#4a4a52', 3, 3);
  }
  // a downpipe at the corner, gulls on the ridge
  const dp = front(p, b1 + 0.02);
  pq(p, dp, a1 - 0.08, a1 - 0.03, 5, ze - 2, ZINC[3]);
  for (let i = 0; i < 3; i++) {
    const ga = a0 + 1 + Rn() * (a1 - a0 - 2);
    const [gx, gy] = p.P(ga, bm, zr);
    gullStand(p.c, gx, gy, Rn() < 0.5 ? 1 : -1);
  }
}

// ── the corrugated shed ───────────────────────────────────────
function shed(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const H = 46 + (k.seed % 3) * 6;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const b0 = 0.2;
  const b1 = D - 0.4;
  const cols = [P.blue, P.sky, P.grey, P.green];
  const col = cols[k.seed % cols.length];
  shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
  const wall = corr(col, 8, 0.6, k.seed);
  lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: wall, side: wall, edge: col[0] });
  const F = front3(p, b1);
  const S = side3(p, a1);
  // a concrete upstand, the sign band, the roller doors with posts, a door
  pq(p, F, a0, a1, 0, 3.5, '#7a7872');
  pq(p, S, b0, b1, 0, 3.5, '#5e5c58');
  pq(p, F, a0, a1, H - 6, H - 1, '#e8e4da');
  const name = ['NORDLAND LOGISTIK', 'FREIGHT 24', 'BALTIC CARGO', 'HANSE SPEDITION'][k.seed % 4];
  stencil(p, F, (a0 + a1) / 2 - name.length * 0.06, H - 1.8, name, col[1], 2);
  const nd = Math.max(2, Math.floor((a1 - a0) / 2.6));
  const dw = (a1 - a0) / nd;
  for (let i = 0; i < nd; i++) {
    const c = a0 + dw * (i + 0.5);
    const open = (i + k.seed) % 3 === 1;
    pq(p, F, c - 0.78, c + 0.78, 0, 29, '#2a2c30');
    if (open) {
      pt(p, F, c - 0.72, c + 0.72, 0, 28, (u: number, v: number) => at(['#0c0c0e', '#141416', '#1c1c20', '#26262a'], 1.4 - v / 60 + (u % 20 < 2 ? 0.5 : 0)), 1);
      pt(p, F, c - 0.72, c + 0.72, 20, 28, (_u: number, v: number) => at(GALV, v % 3 < 1 ? 2 : 4), 1);
      // pallets inside, a light
      pq(p, F, c - 0.5, c - 0.1, 0, 6, '#8a6a46');
      pq(p, F, c + 0.1, c + 0.5, 0, 9, '#a07a4a');
      pq(p, F, c - 0.3, c + 0.3, 18.5, 19, '#f0e0b0');
    } else pt(p, F, c - 0.72, c + 0.72, 0, 28, (u: number, v: number) => at(GALV, (v % 4 < 1 ? 2 : 4) + (u < 3 ? 0.6 : 0) - (v < 3 ? 1 : 0)), 1);
    // bollards protecting the door jambs
    for (const s of [-0.84, 0.84]) lbox(p, c + s - 0.04, b1 + 0.02, 0.08, 0.08, 0, 4, mono(plate(P.yellow), P.yellow[0]));
    stencil(p, F, c - 0.06, 31.5, String(i + 1), '#e8e4da', 2);
  }
  // the roof: a shallow pitch, light grey with a rooflight strip, rust along the eaves
  const rise = Math.min(14, (b1 - b0) * 2.2);
  const bm = (b0 + b1) / 2;
  const roofM = corr(['#5a5e64', '#6c7076', '#7e8288', '#92969a', '#a6aaae', '#bcc0c2'], 6, 0.5, k.seed + 3);
  poly3(
    p,
    [
      [a0 - 0.12, b1 + 0.12, H],
      [a1 + 0.12, b1 + 0.12, H],
      [a1 + 0.12, bm, H + rise],
      [a0 - 0.12, bm, H + rise],
    ],
    roofM,
    2,
  );
  poly3(
    p,
    [
      [a1, b1, H],
      [a1, b0, H],
      [a1, bm, H + rise],
    ],
    wall,
    0,
    [
      [a1, b1, H],
      [a1, b0, H],
      [a1, b1, H + rise],
    ],
  );
  for (let a = a0 + 1; a < a1 - 0.8; a += 2.2)
    poly3(
      p,
      [
        [a, b1 - 0.4, H + rise * 0.15],
        [a + 0.9, b1 - 0.4, H + rise * 0.15],
        [a + 0.9, bm + 0.3, H + rise * 0.9],
        [a, bm + 0.3, H + rise * 0.9],
      ],
      (u: number, v: number) => ((u + v) % 14 < 2 ? '#a8c8d0' : '#6a8a94'),
      2,
    );
  // downpipes and a vent
  pq(p, front(p, b1 + 0.02), a0 + 0.1, a0 + 0.15, 0, H, ZINC[3]);
  pq(p, front(p, b1 + 0.02), a1 - 0.15, a1 - 0.1, 0, H, ZINC[2]);
}

// ── the cold store ────────────────────────────────────────────
function cold(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const H = 72;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const b0 = 0.3;
  const b1 = D - 1.2;
  shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
  const panel: Mat = (light) => (u, v, x, y) => {
    let i = light === 0 ? 2.6 : 4.2;
    if (u % 36 < 1) i -= 1.2;
    if (v % 24 < 0.8) i -= 0.6;
    if (v < 10 && bayer(x, y) * 10 > v) i -= 0.6;
    if (hash(x, y, 71) < 0.02) i -= 0.6;
    return at(P.white, i);
  };
  // the dock: a raised concrete deck with bumpers
  lbox(p, a0, b1, a1 - a0, 1.1, 0, 12, {
    front: plate(['#4e4c48', '#5e5c58', '#6e6c68', '#807e78', '#92908a', '#a4a29a']),
    side: plate(['#4e4c48', '#5e5c58', '#6e6c68', '#807e78', '#92908a', '#a4a29a']),
    top: plate(['#5a5650', '#6a665e', '#7a766e', '#8c8880', '#9e9a92', '#b0aca2']),
    edge: '#3e3c38',
  });
  lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: panel, side: panel, top: plate(ZINC), edge: '#6a6a6e' });
  const F = front3(p, b1);
  const S = side3(p, a1);
  pq(p, F, a0, a1, H - 15, H - 1, '#1a56b0');
  pq(p, F, a0, a1, H - 15, H - 14, '#0e3c80');
  stencil(p, F, (a0 + a1) / 2 - 1.8, H - 3.6, 'COLD STORE', '#ffffff', 6);
  pq(p, S, b0, b1, H - 15, H - 1, '#12428c');
  // dock doors with black shelters, red and green lights, bumpers on the dock face
  const nd = Math.max(2, Math.floor((a1 - a0) / 1.8));
  const dw = (a1 - a0) / nd;
  const DF = front(p, b1 + 1.1);
  for (let i = 0; i < nd; i++) {
    const c = a0 + dw * (i + 0.5);
    pq(p, F, c - 0.62, c + 0.62, 12, 36, '#16161a');
    pq(p, F, c - 0.5, c + 0.5, 13, 34, '#26282c');
    pt(p, F, c - 0.46, c + 0.46, 13, 33, (_u: number, v: number) => at(GALV, v % 4 < 1 ? 2.4 : 4.2), 1);
    const [lx, ly] = F.F(c + 0.7, 30);
    px(p.c, lx, ly, i % 2 ? '#3ac85a' : '#e8402a', 3, 3);
    for (const s of [-0.4, 0.4]) pq(p, DF, c + s - 0.08, c + s + 0.08, 6, 11, '#1a1a1e');
  }
  // the office at the east end: a glazed band, an entrance with a canopy, a snowflake on the sign
  const oa = a1 - 1.6;
  pq(p, F, oa, a1 - 0.1, 40, 52, '#2c4650');
  for (let u = oa + 0.25; u < a1 - 0.2; u += 0.32) pq(p, F, u, u + 0.04, 40, 52, '#d8dcdc');
  pq(p, F, oa, a1 - 0.1, 52, 53, '#e8eaea');
  pq(p, S, b0 + 0.3, b1 - 0.3, 40, 52, '#24404a');
  for (let u = b0 + 0.6; u < b1 - 0.3; u += 0.32) pq(p, S, u, u + 0.04, 40, 52, '#b8bcbc');
  const [sx0, sy0] = F.F(a0 + 0.35, H - 5.5);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI;
    ln(p.c, sx0 - Math.cos(ang) * 7, sy0 - Math.sin(ang) * 7, sx0 + Math.cos(ang) * 7, sy0 + Math.sin(ang) * 7, '#f4f0e6', 2);
  }
  pq(p, front(p, b1 + 0.02), a0 + 0.08, a0 + 0.14, 12, H - 2, ZINC[3]);
  pq(p, front(p, b1 + 0.02), oa - 0.1, oa - 0.04, 12, H - 2, ZINC[2]);
  // (second pass) the roof's membrane: seams, a lit parapet coping, stains, vents, hatches, a cable tray
  for (let a = a0 + 0.7; a < a1 - 0.2; a += 0.75) {
    const [x0, y0] = p.P(a, b0 + 0.05, H);
    const [x1, y1] = p.P(a, b1 - 0.05, H);
    ln(p.c, x0, y0, x1, y1, ZINC[0], 2);
    ln(p.c, x0 + 2, y0, x1 + 2, y1, '#c8ccd4', 2);
  }
  for (let b = b0 + 1.2; b < b1 - 0.2; b += 1.6) {
    const [x0, y0] = p.P(a0 + 0.05, b, H);
    const [x1, y1] = p.P(a1 - 0.05, b, H);
    ln(p.c, x0, y0, x1, y1, ZINC[0], 2);
  }
  {
    const [x0, y0] = p.P(a0, b1, H);
    const [x1, y1] = p.P(a1, b1, H);
    const [x2, y2] = p.P(a1, b0, H);
    ln(p.c, x0, y0 - 1, x1, y1 - 1, '#f4f6f8', 2);
    ln(p.c, x1, y1 - 1, x2, y2 - 1, '#c8ccd2', 2);
  }
  const Rr = rng(k.seed * 3 + 41);
  for (let i = 0; i < (a1 - a0) * (b1 - b0) * 0.5; i++) {
    const [sx, sy] = p.P(a0 + 0.3 + Rr() * (a1 - a0 - 0.6), b0 + 0.3 + Rr() * (b1 - b0 - 0.6), H);
    ell(p.c, sx, sy, 6 + Rr() * 14, 3 + Rr() * 6, Rr() < 0.6 ? ZINC[1] : ZINC[5]);
  }
  for (let i = 0; i < 6; i++) {
    const a = a0 + 0.6 + Rr() * (a1 - a0 - 1.2);
    const b = b0 + 2.4 + Rr() * Math.max(0.2, b1 - b0 - 3);
    if (Rr() < 0.5) {
      // a mushroom vent
      const [vx, vy] = p.P(a, b, H);
      ell(p.c, vx + 6, vy + 2, 14, 6, '#3a3e46');
      px(p.c, vx - 6, vy - 20, '#b8bec6', 12, 20);
      px(p.c, vx + 2, vy - 20, '#7a8088', 4, 20);
      ell(p.c, vx, vy - 22, 12, 5, '#f2f4f6');
      ell(p.c, vx + 2, vy - 21, 8, 3, '#c8ccd2');
    } else lbox(p, a, b, 0.9, 0.8, H, 6, { front: plate(GALV), side: plate(GALV), top: plate(['#8a929a', '#a2aab2', '#bac2ca', '#d0d6dc', '#e4e8ec', '#f4f6f8']), edge: GALV[0] });
  }
  {
    // the cable tray from the plant to the parapet
    const [x0, y0] = p.P(a0 + 1.7, b0 + 2, H + 1);
    const [x1, y1] = p.P(a0 + 1.7, b1 - 0.3, H + 1);
    ln(p.c, x0, y0, x1, y1, '#6a6e74', 3);
    ln(p.c, x0, y0 - 1, x1, y1 - 1, '#c4c8cc');
  }
  // refrigeration plant on the roof
  for (let i = 0; i < 3; i++) {
    const a = a0 + 1 + i * 2.2;
    if (a > a1 - 1.5) break;
    lbox(p, a, b0 + 0.8, 1.4, 1.2, H, 7, { front: plate(GALV), side: plate(GALV), top: plate(GALV), edge: GALV[0] });
    for (const da of [0.35, 1.05]) {
      const [fx, fy] = p.P(a + da, b0 + 1.4, H + 7);
      ell(p.c, fx, fy, 13, 6.5, '#e8ecee');
      ell(p.c, fx, fy, 11, 5.5, '#2a2e34');
      ell(p.c, fx, fy, 9, 4.5, '#14161a');
      ln(p.c, fx - 8, fy - 2, fx + 8, fy + 2, '#8a8e94', 2);
      ln(p.c, fx - 3, fy + 4, fx + 3, fy - 4, '#8a8e94', 2);
      ell(p.c, fx, fy, 2, 1, '#c8ccd0');
    }
  }
}

// ── the sawtooth workshop ─────────────────────────────────────
function saw(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const H = 34;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const b0 = 0.2;
  const b1 = D - 0.3;
  shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
  const br = brick(['#541e14', '#6e2a1c', '#883624', '#a0442e', '#b4563a', '#c66c4c']);
  lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: br, side: br, edge: BRICK[0] });
  const F = front3(p, b1);
  const S = side3(p, a1);
  // tall arched workshop windows, a big double door
  const nw = Math.max(2, Math.round((a1 - a0) / 1.4));
  for (let i = 0; i < nw; i++) {
    const c = a0 + ((a1 - a0) * (i + 0.5)) / nw;
    if (i === Math.floor(nw / 2)) {
      loadDoor(p, F, c - 0.5, c + 0.5, 0, 26, false);
      continue;
    }
    win(p, F, c - 0.32, c + 0.32, 8, 24, { arch: true, frame: '#d8d4ca', seed: i });
  }
  for (let i = 0; i < Math.round((b1 - b0) / 1.4); i++) {
    const c = b0 + 0.7 + i * 1.4;
    if (c > b1 - 0.4) break;
    win(p, S, c - 0.3, c + 0.3, 8, 24, { arch: true, seed: i + 9 });
  }
  pq(p, F, a0, a1, H - 2, H, SAND[3]);
  // the sawtooth: north lights facing the back, slopes facing the front
  const teeth = Math.max(2, Math.round((b1 - b0) / 1.6));
  const tw = (b1 - b0) / teeth;
  for (let t = 0; t < teeth; t++) {
    const bb = b0 + t * tw;
    const bf = bb + tw;
    poly3(
      p,
      [
        [a0, bf, H],
        [a1, bf, H],
        [a1, bb, H + 16],
        [a0, bb, H + 16],
      ],
      roofing(SLATE, 5, 9),
      1,
    );
    for (let u = a0 + 0.8 + (t % 2) * 1.1; u < a1 - 1; u += 2.2)
      skylight(p, [
        [u, bf - tw * 0.2, H + 3.2],
        [u + 0.7, bf - tw * 0.2, H + 3.2],
        [u + 0.7, bb + tw * 0.25, H + 12],
        [u, bb + tw * 0.25, H + 12],
      ]);
    poly3(
      p,
      [
        [a1, bf, H],
        [a1, bb, H],
        [a1, bb, H + 16],
      ],
      br,
      0,
    );
  }
  stencil(p, F, a0 + 0.3, H - 0.5, 'WERFT', SAND[5], 2);
}

const warehouse: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'brick';
    if (v === 'shed') return shed(p, k);
    if (v === 'cold') return cold(p, k);
    if (v === 'saw') return saw(p, k);
    return speicher(p, k);
  },
};

// ── the fish market hall ─────────────────────────────────────
const market: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const a0 = 0.1;
    const a1 = W - 0.1;
    const b0 = 0.1;
    const b1 = D - 0.2;
    const H = 44;
    shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
    const br = brick(['#5e2418', '#7a3020', '#943c28', '#aa4c34', '#bc5e40', '#cc7452']);
    lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: br, side: br, edge: BRICK[0] });
    const F = front3(p, b1);
    const S = side3(p, a1);
    pq(p, F, a0, a1, 0, 4, SAND[2]);
    pq(p, S, b0, b1, 0, 4, SAND[1]);
    // the arcade: big round arches, roller shutters half up, the stalls' glow inside
    const na = Math.max(3, Math.round((a1 - a0) / 2));
    const aw = (a1 - a0) / na;
    for (let i = 0; i < na; i++) {
      const c = a0 + aw * (i + 0.5);
      const hw = aw * 0.38;
      const pts: [number, number][] = [[c - hw, 0]];
      for (let j = 0; j <= 10; j++) {
        const t = Math.PI - (j / 10) * Math.PI;
        pts.push([c + Math.cos(t) * hw, 24 + Math.sin(t) * hw * 9]);
      }
      pts.push([c + hw, 0]);
      poly3(
        p,
        pts.map(([u, z]) => F.at(u, z)),
        (u: number, v: number, x: number, y: number) => {
          // the hall inside: shadowy, lamps hanging, the white-tiled back wall
          if (v > 40) return bayer(x, y) > 0.5 ? '#1a1416' : '#221a1c';
          if (v < 18) return u % 10 < 1 || v % 8 < 1 ? '#8a8e90' : '#c8ccc8';
          return '#2a2224';
        },
        1,
      );
      // the shutter rolled half down
      pt(p, F, c - hw, c + hw, 18, 24 + hw * 9 * 0.9, (_u: number, v: number) => at(GALV, v % 3 < 1 ? 1.6 : 3.6), 1);
      // the arch's sandstone voussoirs
      for (let j = 0; j <= 10; j++) {
        const t = Math.PI - (j / 10) * Math.PI;
        const [vx, vy] = F.F(c + Math.cos(t) * (hw + 0.04), 24 + Math.sin(t) * (hw + 0.04) * 9);
        px(p.c, vx - 2, vy - 2, j % 2 ? SAND[4] : SAND[3], 4, 4);
      }
    }
    // the name band and the clock in the gable
    pq(p, F, a0, a1, 34, 39, SAND[3]);
    pq(p, F, a0, a1, 39, 40, SAND[1]);
    stencil(p, F, (a0 + a1) / 2 - 0.85, 38.4, 'FISH MARKET', '#5a2a1e', 3);
    // side windows
    for (let i = 0; i < Math.round((b1 - b0) / 1.5); i++) {
      const c = b0 + 0.75 + i * 1.5;
      if (c > b1 - 0.5) break;
      win(p, S, c - 0.3, c + 0.3, 12, 30, { arch: true, seed: i });
    }
    // the roof: zinc, with a raised ridge lantern with louvres; a gable on the side end
    const bm = (b0 + b1) / 2;
    const zr = H + (b1 - b0) * 5;
    poly3(
      p,
      [
        [a0 - 0.15, b1 + 0.15, H],
        [a1 + 0.15, b1 + 0.15, H],
        [a1 + 0.15, bm, zr],
        [a0 - 0.15, bm, zr],
      ],
      roofing(ZINC, 6, 12),
      1,
    );
    // skylights down the front slope, between the eaves and the lantern
    for (let u = a0 + 0.9; u < a1 - 1.2; u += 2.1) {
      const bA = b1 - (b1 - bm) * 0.22;
      const bB = b1 - (b1 - bm) * 0.6;
      const zA = H + (zr - H) * 0.22;
      const zB = H + (zr - H) * 0.6;
      skylight(p, [
        [u, bA, zA],
        [u + 0.8, bA, zA],
        [u + 0.8, bB, zB],
        [u, bB, zB],
      ]);
    }
    poly3(
      p,
      [
        [a1, b1, H],
        [a1, b0, H],
        [a1, bm, zr],
      ],
      br,
      0,
      [
        [a1, b1, H],
        [a1, b0, H],
        [a1, b1, zr],
      ],
    );
    const [gx, gy] = S.F(bm, H + (zr - H) * 0.4);
    layer(
      p.c,
      (l) => {
        ell(l, gx, gy, 11, 12, SAND[3]);
        ell(l, gx, gy, 9, 10, '#f2ecdc');
        ln(l, gx, gy, gx, gy - 7, '#2a2a30', 2);
        ln(l, gx, gy, gx + 5, gy + 2, '#2a2a30', 2);
      },
      { rect: [gx - 13, gy - 14, gx + 13, gy + 14] },
    );
    lbox(p, a0 + 1, bm - 0.5, a1 - a0 - 2, 1.0, zr - 3, 9, {
      front: (light) => (u: number, v: number) => at(ZINC, (light ? 3 : 1.6) - (v % 3 < 1 ? 1.4 : 0) + (u % 30 < 1 ? -1 : 0)),
      side: plate(ZINC),
      top: roofing(ZINC, 6, 12),
      edge: ZINC[0],
    });
    poly3(
      p,
      [
        [a0 + 0.9, bm + 0.6, zr + 6],
        [a1 - 0.9, bm + 0.6, zr + 6],
        [a1 - 0.9, bm, zr + 10],
        [a0 + 0.9, bm, zr + 10],
      ],
      roofing(ZINC, 5, 10),
      1,
    );
    // gulls along the ridge, a weather vane fish
    const Rn = rng(k.seed + 5);
    for (let i = 0; i < 4; i++) {
      const [qx, qy] = p.P(a0 + 1.2 + Rn() * (a1 - a0 - 2.4), bm, zr + 10);
      gullStand(p.c, qx, qy, Rn() < 0.5 ? 1 : -1);
    }
    const [vx, vy] = p.P((a0 + a1) / 2, bm, zr + 10);
    ln(p.c, vx, vy, vx, vy - 26, '#2a2a30');
    fillPoly(
      p.c,
      [
        [vx - 9, vy - 28],
        [vx + 6, vy - 31],
        [vx + 10, vy - 28],
        [vx + 6, vy - 25],
      ],
      '#c89c42',
    );
    fillPoly(
      p.c,
      [
        [vx - 9, vy - 28],
        [vx - 13, vy - 32],
        [vx - 13, vy - 24],
      ],
      '#a87c32',
    );
    // the awnings: striped canvas on iron brackets over the stalls in front of each arch
    for (let i = 0; i < na; i++) {
      const c = a0 + aw * (i + 0.5);
      const hw = aw * 0.46;
      const stripes = i % 2 ? ['#2c5aa0', '#f2ece0'] : ['#c8382a', '#f2ece0'];
      const ns = 8;
      for (let s = 0; s < ns; s++) {
        const u0 = c - hw + (2 * hw * s) / ns;
        const u1 = c - hw + (2 * hw * (s + 1)) / ns;
        const q = [p.P(u0, b1, 31), p.P(u1, b1, 31), p.P(u1, b1 + 1.3, 25), p.P(u0, b1 + 1.3, 25)];
        fillPoly(p.c, q, stripes[s % 2]);
        const e0 = p.P(u0, b1 + 1.3, 25);
        const e1 = p.P(u1, b1 + 1.3, 25);
        fillPoly(p.c, [e0, e1, [e1[0], e1[1] + 6], [(e0[0] + e1[0]) / 2, e0[1] + 9], [e0[0], e0[1] + 6]], darken(stripes[s % 2], 0.15));
      }
    }
  },
};

// ── the harbour master's office ──────────────────────────────
const office: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const a0 = 0.15;
    const a1 = W - 0.15;
    const b0 = 0.15;
    const b1 = D - 0.4;
    const H = 62;
    shadowBand(p, a0, b0, a1, b1, 0.9, 0.28);
    const br = brick(['#5a2418', '#742f20', '#8e3c2a', '#a44c34', '#b85e42', '#c87454']);
    lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: br, side: br, edge: BRICK[0] });
    const F = front3(p, b1);
    const S = side3(p, a1);
    pq(p, F, a0, a1, 0, 5, SAND[3]);
    pq(p, S, b0, b1, 0, 5, SAND[2]);
    pq(p, F, a0, a1, 30, 31.5, SAND[4]);
    pq(p, S, b0, b1, 30, 31.5, SAND[2]);
    // a door with steps and a sign, windows, a balcony for watching the harbour
    const c = (a0 + a1) / 2;
    pq(p, F, c - 0.4, c + 0.4, 0, 22, SAND[4]);
    pq(p, F, c - 0.32, c + 0.32, 0, 20, '#1e3a5a');
    pt(p, F, c - 0.24, c + 0.24, 11, 18, (u: number, v: number) => ((u + v) % 14 < 2 ? '#8aaab4' : '#2c4650'), 1);
    pq(p, F, c - 0.6, c + 0.6, 23, 26, '#f4f0e6');
    stencil(p, F, c - 0.5, 25.4, 'HARBOUR', '#1e3a5a');
    for (const s of [-1, 1]) win(p, F, c + s * 0.95 - 0.25, c + s * 0.95 + 0.25, 9, 24, { frame: '#f2ece0' });
    for (let i = 0; i < 3; i++) win(p, F, a0 + 0.4 + i * ((a1 - a0 - 0.8) / 2) - 0.25, a0 + 0.4 + i * ((a1 - a0 - 0.8) / 2) + 0.25, 38, 54, { frame: '#f2ece0', lit: i === 1 });
    for (let i = 0; i < 2; i++) {
      const cc = b0 + 0.9 + i * 1.6;
      win(p, S, cc - 0.25, cc + 0.25, 9, 24);
      win(p, S, cc - 0.25, cc + 0.25, 38, 54);
    }
    lbox(p, a0 + 0.3, b1, a1 - a0 - 0.6, 0.45, 31.5, 1.2, mono(plate(SAND), SAND[0]));
    for (let a = a0 + 0.32; a <= a1 - 0.3; a += 0.12) {
      const [x0, y0] = p.P(a, b1 + 0.42, 32.7);
      px(p.c, x0, y0 - 12, '#1e1e24', 1, 12);
    }
    const [r0x, r0y] = p.P(a0 + 0.3, b1 + 0.42, 36);
    const [r1x, r1y] = p.P(a1 - 0.3, b1 + 0.42, 36);
    ln(p.c, r0x, r0y, r1x, r1y, '#1e1e24', 2);
    // a hipped slate roof, a chimney
    const zr = H + 22;
    const ins = Math.min((b1 - b0) / 2, 1.2);
    const bm = (b0 + b1) / 2;
    poly3(
      p,
      [
        [a0 - 0.12, b1 + 0.12, H],
        [a1 + 0.12, b1 + 0.12, H],
        [a1 + 0.12 - ins, bm, zr],
        [a0 - 0.12 + ins, bm, zr],
      ],
      roofing(SLATE),
      1,
    );
    poly3(
      p,
      [
        [a1 + 0.12, b1 + 0.12, H],
        [a1 + 0.12, b0 - 0.12, H],
        [a1 + 0.12 - ins, bm, zr],
      ],
      roofing(SLATE),
      0,
      [
        [a1 + 0.12, b1 + 0.12, H],
        [a1 + 0.12, b0 - 0.12, H],
        [a1 + 0.12 - ins, bm, zr],
      ],
    );
    lbox(p, a0 + 0.5, bm + 0.1, 0.32, 0.32, zr - 10, 18, { front: br, side: br, top: plate(STEEL), edge: BRICK[0] });
    // the signal mast with its yard and flags, a wind sock
    const [mx, my] = p.P(a1 - 0.6, bm, zr - 4);
    layer(
      p.c,
      (l) => {
        px(l, mx - 1, my - 90, '#e8e4da', 3, 90);
        px(l, mx - 1, my - 90, '#ffffff', 1, 90);
        px(l, mx - 18, my - 70, '#e8e4da', 36, 2);
        for (let i = 0; i < 4; i++) {
          const fx = mx - 16 + i * 4;
          const fy = my - 68 + i * 7;
          fillPoly(
            l,
            [
              [fx, fy],
              [fx + 8, fy + 1],
              [fx + 8, fy + 6],
              [fx, fy + 5],
            ],
            ['#d8402a', '#f2c43a', '#2c5aa0', '#f4f0e6'][i],
          );
        }
        ln(l, mx - 18, my - 69, mx - 16, my - 40, '#3a3a40');
        ln(l, mx + 18, my - 69, mx + 20, my - 50, '#3a3a40');
        fillPoly(
          l,
          [
            [mx + 17, my - 52],
            [mx + 26, my - 50],
            [mx + 26, my - 46],
            [mx + 17, my - 47],
          ],
          '#e8622a',
        );
        px(l, mx - 3, my - 94, '#c89c42', 6, 4);
      },
      { rect: [mx - 22, my - 98, mx + 30, my + 2] },
    );
    void k;
  },
};

// ── the terminal gate ────────────────────────────────────────
const gate: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    shadowBand(p, 0, 0, W, D, 0.4, 0.24);
    // booths between the lanes (lanes run along a), barrier arms, an OCR portal, a canopy over it all
    const nl = Math.max(2, Math.round(D / 1.6));
    const lw = D / nl;
    for (let i = 0; i <= nl; i++) {
      const b = i * lw;
      const islandB = Math.min(D - 0.4, Math.max(0.05, b - 0.2));
      lbox(p, 0.6, islandB, W - 1.2, 0.36, 0, 1.2, {
        front: plate(['#5e5c58', '#7a7872', '#92908a', '#a8a6a0', '#bcbab2', '#ceccc4']),
        side: plate(['#5e5c58', '#7a7872', '#92908a', '#a8a6a0', '#bcbab2', '#ceccc4']),
        top: plate(P.yellow),
        edge: '#4a4844',
      });
      if (i > 0 && i < nl) {
        lbox(p, 1.2, islandB + 0.02, 0.9, 0.32, 1.2, 18, { front: plate(P.white), side: plate(P.white), top: plate(P.grey), edge: P.white[0] });
        pt(p, front(p, islandB + 0.34), 1.28, 2.02, 9, 16.5, (u: number, v: number) => ((u + v) % 16 < 2 ? '#8aaab4' : '#2c4650'), 1);
        pt(p, side(p, 2.1), islandB + 0.06, islandB + 0.3, 9, 16.5, (u: number, v: number) => ((u + v) % 16 < 2 ? '#8aaab4' : '#243c46'), 0);
      }
    }
    // barrier arms across each lane, traffic lights
    for (let i = 0; i < nl; i++) {
      const b0 = i * lw + 0.2;
      const [x0, y0] = p.P(W - 0.8, b0, 6);
      const [x1, y1] = p.P(W - 0.8, b0 + lw - 0.4, 6);
      lbox(p, W - 0.86, b0 - 0.06, 0.12, 0.12, 1.2, 6, mono(plate(P.yellow), P.yellow[0]));
      for (let s = 0; s < 8; s++) {
        const t0 = s / 8;
        const t1 = (s + 1) / 8;
        ln(p.c, x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, s % 2 ? '#f4f0e6' : '#d8402a', 3);
      }
      const [tx, ty] = p.P(W - 0.5, b0, 0);
      px(p.c, tx - 1, ty - 44, '#2a2a30', 2, 44);
      px(p.c, tx - 3, ty - 56, '#1e1e24', 6, 13);
      px(p.c, tx - 1, ty - 54, i % 2 ? '#3a3a3a' : '#e8402a', 3, 3);
      px(p.c, tx - 1, ty - 49, i % 2 ? '#3ac85a' : '#3a3a3a', 3, 3);
    }
    // the canopy on four columns, its fascia with the gate's name
    for (const [a, b] of [
      [0.3, 0.1],
      [W - 0.4, 0.1],
      [0.3, D - 0.2],
      [W - 0.4, D - 0.2],
    ] as const)
      lbox(p, a, b, 0.1, 0.1, 0, 30, mono(plate(P.white), P.white[0]));
    lbox(p, 0, 0, W, D, 30, 2.4, { front: plate(P.white), side: plate(P.white), top: plate(['#6a6e74', '#7c8086', '#8e9296', '#a2a6aa', '#b6babc', '#cacdce']), edge: P.white[0] });
    pq(p, front(p, D), 0, W, 30.4, 32, '#2c5aa0');
    stencil(p, front(p, D), W / 2 - 0.36, 31.7, 'GATE 1', '#f4f0e6');
    pq(p, side(p, W), 0, D, 30.4, 32, '#1e4278');
    stencil(p, side(p, W), D * 0.7, 31.7, 'TERMINAL', '#f4f0e6');
    void k;
  },
};

// ── the industrial quarter behind the stores (flat shaded, crisp) ──
// Light grey sheds and offices with green, blue and grey roofs and blue
// window bands, cream oil tanks with blue ladders, steel silos, pipe racks,
// dark conifers and lawns between them (the reference's NE corner).
const HAZE = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const h = [0xb4, 0xc2, 0xcc];
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (h[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
// (second pass) the industrial quarter as crisp as the reference's: grey clad sheds with
// blue and green roofs, rooftop plant, windows, doors and signs, cream tanks with ladders
// and handrails, pipe racks on blue trestles, textured conifers, dark contact shadows
const SKY_WALLS = ['#a8b0bc', '#98a2b0', '#b8bec8', '#8e98a6', '#c8c4b8'];
const SKY_ROOFS = ['#2f6e52', '#3a62a8', '#7e8692', '#3d7d5f', '#4a72b8', '#2a6a4e'];
const SKY_SIGNS = ['#1f56b0', '#c8402e', '#2c7a4a', '#e8a822'];
const AC: Ramp = ['#7a8088', '#929aa2', '#aab2b8', '#c4cad0', '#dce0e4', '#f0f2f4'];
const HUT: Ramp = ['#5e6670', '#727a84', '#868e98', '#9aa2ac', '#b0b6be', '#c6ccd2'];

const skyline: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 7 + 11);
    const W = k.w;
    const D = k.d;
    const hz = 0.02;
    const tanks = k.variant === 'tanks';
    const H_ = (col: string, t = 0) => HAZE(col, hz + t);
    const c = p.c;
    // the yard under it all: concrete with slab joints and stains
    fillPoly(c, [p.P(0, D, 0), p.P(W, D, 0), p.P(W, 0, 0), p.P(0, 0, 0)], H_(tanks ? '#5a8a38' : '#9a9ea2'));
    for (let i = 0; i < W * D * (tanks ? 1.2 : 0.25); i++) {
      const [sx, sy] = p.P(Rn() * W, Rn() * D, 0);
      if (tanks) px(c, sx, sy, H_(Rn() < 0.5 ? '#78a84a' : '#3e6424'), 3 + Rn() * 6, 1);
      else ell(c, sx, sy, 6 + Rn() * 14, 3 + Rn() * 6, H_(Rn() < 0.5 ? '#868a8e' : '#b0b4b6'));
    }
    if (tanks)
      // gravel service lanes between the plots of the tank farm
      for (let a = 3.2; a < W; a += 3.6) fillPoly(c, [p.P(a, 0, 0), p.P(a + 0.5, 0, 0), p.P(a + 0.5, D, 0), p.P(a, D, 0)], H_('#a8a49a'));
    for (let a = 0; a <= W; a += 2) {
      const [x0, y0] = p.P(a, 0, 0);
      const [x1, y1] = p.P(a, D, 0);
      ln(c, x0, y0, x1, y1, H_('#74787e'));
    }
    for (let b = 0; b <= D; b += 2) {
      const [x0, y0] = p.P(0, b, 0);
      const [x1, y1] = p.P(W, b, 0);
      ln(c, x0, y0, x1, y1, H_('#74787e'));
    }
    type B = { a: number; b: number; w: number; d: number; h: number; kind: number; wall: string; roof: string; s: number };
    const items: B[] = [];
    const tree = (a: number, b: number, sc = 1) =>
      items.push({ a: Math.max(0, Math.min(W - 0.7, a)), b: Math.max(0, Math.min(D - 0.7, b)), w: 0.7, d: 0.7, h: (14 + Rn() * 8) * sc, kind: 3, wall: '', roof: '', s: Math.floor(Rn() * 9999) });
    if (tanks) {
      // the tank farm: big cream tanks on lawns in a tight grid, clumps of conifers, a few plant houses
      for (let a = 0.4; a < W - 2.6; a += 3.6)
        for (let b = D - 3.3; b > 0.2; b -= 3.6) {
          const r = Rn();
          const kind = r < 0.55 ? 1 : r < 0.65 ? 2 : r < 0.85 ? 0 : 3;
          const w = kind === 1 ? 2.6 + Rn() * 0.5 : kind === 2 ? 1.1 + Rn() * 0.3 : 2.2 + Rn() * 1;
          if (kind !== 3)
            items.push({
              a,
              b,
              w,
              d: kind === 0 ? 2 + Rn() * 1.2 : w,
              h: kind === 1 ? 30 + Rn() * 14 : kind === 2 ? 70 + Rn() * 30 : 30 + Rn() * 20,
              kind,
              wall: SKY_WALLS[Math.floor(Rn() * SKY_WALLS.length)],
              roof: SKY_ROOFS[Math.floor(Rn() * SKY_ROOFS.length)],
              s: Math.floor(Rn() * 9999),
            });
          const nt = kind === 3 ? 5 : 1 + Math.floor(Rn() * 3);
          for (let q = 0; q < nt; q++) tree(a + (kind === 3 ? Rn() * 2.6 : w + 0.2 + Rn() * 0.4), b + Rn() * 3, 0.9 + Rn() * 0.4);
        }
      // more conifers in the gaps along the lanes between the plots
      for (let q = 0; q < W * D * 0.05; q++) tree(Math.floor(Rn() * (W / 3.6)) * 3.6 + 3.1 + Rn() * 0.4, Rn() * D, 0.8 + Rn() * 0.5);
    }
    for (let a = 0.3; !tanks && a < W - 1.5; a += 2.2 + Rn() * 2.6)
      for (let b = 0.3; b < D - 1.5; b += 2.2 + Rn() * 2.6) {
        const r = Rn();
        const kind = r < 0.2 ? 1 : r < 0.3 ? 2 : r < 0.46 ? 3 : 0;
        const w = kind === 1 ? 1.7 + Rn() * 0.9 : kind === 2 ? 0.9 + Rn() * 0.4 : kind === 3 ? 0.8 : 2 + Rn() * 2.8;
        const d = kind === 0 ? 1.6 + Rn() * 2.4 : w;
        items.push({
          a,
          b,
          w: Math.min(w, W - a),
          d: Math.min(d, D - b),
          h: kind === 1 ? 26 + Rn() * 16 : kind === 2 ? 60 + Rn() * 40 : kind === 3 ? 16 + Rn() * 8 : 28 + Rn() * 50,
          kind,
          wall: SKY_WALLS[Math.floor(Rn() * SKY_WALLS.length)],
          roof: SKY_ROOFS[Math.floor(Rn() * SKY_ROOFS.length)],
          s: Math.floor(Rn() * 9999),
        });
        // a conifer or two beside many plots
        if (kind !== 3 && Rn() < 0.6) tree(a + Rn() * w, Math.min(D - 0.6, b + d + 0.3 + Rn() * 0.4), 0.9);
        if (kind !== 3 && Rn() < 0.7) items.push({ a: Math.min(W - 0.6, a + w + 0.2), b: b + Rn() * 1.2, w: 0.7, d: 0.7, h: 14 + Rn() * 8, kind: 3, wall: '', roof: '', s: Math.floor(Rn() * 9999) });
        if (kind === 0 && Rn() < 0.5) items.push({ a: a + Rn() * w, b: Math.min(D - 0.6, b + d + 0.35), w: 0.6, d: 0.6, h: 12 + Rn() * 6, kind: 3, wall: '', roof: '', s: Math.floor(Rn() * 9999) });
      }
    // pipe racks across the quarter: four pipes on blue trestles with cross beams
    for (let i = 0; i < 2; i++) {
      const b = D * (0.35 + i * 0.3);
      const [x0, y0] = p.P(0.3, b, 0);
      const [x1, y1] = p.P(W - 0.3, b, 0);
      for (let t = 0; t <= 1; t += 0.06) {
        const tx = x0 + (x1 - x0) * t;
        const ty = y0 + (y1 - y0) * t;
        ell(c, tx + 3, ty, 6, 2, H_('#5e6268'));
        px(c, tx - 5, ty - 46, H_('#2c5aa8'), 2, 46);
        px(c, tx + 4, ty - 44, H_('#1c3e7c'), 2, 44);
        px(c, tx - 5, ty - 47, H_('#4a7ac8'), 11, 2);
        px(c, tx - 5, ty - 30, H_('#2c5aa8'), 11, 2);
      }
      const pipes: [number, string, string, string, number][] = [
        [50, '#f0eadc', '#fffaf0', '#a8a294', 4],
        [55, '#9aa4ae', '#c8d0d8', '#5a626c', 3],
        [33, '#d8c070', '#f4dc8a', '#8a7430', 3],
        [37, '#3a6ac0', '#6a9ae8', '#1c3e7c', 2],
      ];
      for (const [z, col, hi, lo, w] of pipes) {
        ln(c, x0, y0 - z, x1, y1 - z, H_(col), w);
        ln(c, x0, y0 - z - 1, x1, y1 - z - 1, H_(hi));
        ln(c, x0, y0 - z + w, x1, y1 - z + w, H_(lo));
      }
    }
    // a red-and-white chimney
    const [hx, hy] = p.P(W * 0.6, D * 0.7, 0);
    px(c, hx - 6, hy - 300, H_('#d8d4cc'), 12, 300);
    px(c, hx + 2, hy - 300, H_('#aaa69e'), 4, 300);
    px(c, hx - 6, hy - 300, H_('#f2eee6'), 2, 300);
    for (let j = 0; j < 3; j++) px(c, hx - 6, hy - 300 + j * 24, H_('#d0362a'), 12, 12);
    px(c, hx - 8, hy - 304, H_('#3a3a40'), 16, 4);
    // parked cars and vans on the free yard (kind 4), clear of the plots
    const free = (a: number, b: number) => items.every((it) => it.kind === 3 || a + 1.4 < it.a - 0.3 || a > it.a + it.w + 0.3 || b + 0.7 < it.b - 0.3 || b > it.b + it.d + 0.3);
    for (let q = 0; q < W * D * 0.06; q++) {
      const a = Rn() * (W - 1);
      const b = Rn() * (D - 0.6);
      if (free(a, b)) items.push({ a, b, w: 1.1 + Rn() * 0.2, d: 0.6, h: 14, kind: 4, wall: '', roof: '', s: Math.floor(Rn() * 9999) });
    }
    items.sort((m, n) => m.a + m.w / 2 + m.b + m.d / 2 - (n.a + n.w / 2 + n.b + n.d / 2));
    for (const it of items) {
      const R2 = rng(it.s + 1);
      if (it.kind === 4) {
        const col = [P.red, P.blue, P.white, P.grey, P.navy, P.white, P.yellow][it.s % 7];
        car(p, it.a, it.b, it.w, it.d, col, it.s);
        continue;
      }
      if (it.kind === 3) {
        // a dark conifer: stacked tiers, lit on the left, needles speckled light and dark
        const [cx, cy] = p.P(it.a + it.w / 2, it.b + it.d / 2, 0);
        const Ht = it.h * 4;
        ell(c, cx + 8, cy + 1, 20, 8, H_('#3a4438'));
        px(c, cx - 2, cy - 14, H_('#5a3e2a'), 4, 14);
        for (let j = 0; j < 4; j++) {
          const r = 22 - j * 4.5;
          const y = cy - 12 - (j * (Ht - 16)) / 4;
          const th = (Ht - 16) / 2.6;
          fillPoly(
            c,
            [
              [cx - r, y],
              [cx + r, y],
              [cx, y - th],
            ],
            H_('#245236'),
          );
          fillPoly(
            c,
            [
              [cx - r, y],
              [cx, y],
              [cx, y - th],
            ],
            H_('#3a7a4a'),
          );
          px(c, cx - r + 1, y - 1, H_('#1a3a26'), r * 2 - 2, 2);
          for (let q = 0; q < r * 1.6; q++) {
            const fy = R2();
            const fx = (R2() - 0.5) * 2 * (1 - fy) * r;
            px(c, cx + fx, y - fy * th, H_(fx < 0 ? (R2() < 0.5 ? '#6aa66a' : '#4e8e56') : R2() < 0.5 ? '#163a26' : '#2e6040'), 2, 1);
          }
        }
        continue;
      }
      // the plot: a paved apron with a kerb round a building, a lawn round a tank
      const g0 = p.P(it.a - 0.25, it.b + it.d + 0.25, 0);
      const g1 = p.P(it.a + it.w + 0.25, it.b + it.d + 0.25, 0);
      const g2 = p.P(it.a + it.w + 0.25, it.b - 0.25, 0);
      const g3 = p.P(it.a - 0.25, it.b - 0.25, 0);
      fillPoly(c, [g0, g1, g2, g3], H_(it.kind === 0 ? '#b0b2b2' : '#5e8e3a'));
      ln(c, g0[0], g0[1], g1[0], g1[1], H_('#e2e2dc'), 2);
      ln(c, g1[0], g1[1], g2[0], g2[1], H_('#70746e'), 2);
      if (it.kind !== 0) {
        for (let q = 0; q < it.w * it.d * 60; q++) {
          const [lx, ly] = p.P(it.a - 0.2 + R2() * (it.w + 0.4), it.b - 0.2 + R2() * (it.d + 0.4), 0);
          px(c, lx, ly, H_(R2() < 0.5 ? '#78a84a' : '#466e2a'), 2, 1);
        }
      }
      if (it.kind === 1 || it.kind === 2) {
        // a cream oil tank (squat, a domed top, a caged blue ladder) or a steel silo (tall, a cone)
        const [cx, cy] = p.P(it.a + it.w / 2, it.b + it.d / 2, 0);
        const r = it.w * 32 * (it.kind === 1 ? 1.15 : 0.95);
        const H = it.h * 4;
        // its contact shadow on the ground
        ell(c, cx + r * 0.25, cy + r * 0.1, r * 1.12, r * 0.56, H_('#3e4440'));
        const col = it.kind === 1 ? ['#fbf8f2', '#e6e1d8', '#c4bfb6', '#9c978e'] : ['#e2e8ee', '#bcc4cc', '#949ea8', '#6e7882'];
        for (let i = -r; i < r; i++) {
          const t = (i + r) / (2 * r);
          const cc = t < 0.08 ? col[1] : t < 0.42 ? col[0] : t < 0.72 ? col[1] : t < 0.9 ? col[2] : col[3];
          const yb = Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.5;
          c.fillStyle = H_(cc);
          c.fillRect(Math.round(cx + i), Math.round(cy + yb - H), 1, Math.round(H));
          // a darker foot where it stands in its bund
          c.fillStyle = H_(col[3]);
          c.fillRect(Math.round(cx + i), Math.round(cy + yb - 3), 1, 3);
        }
        // plate seams (rings) following the curve
        const ring = (z: number, cc: string) => {
          for (let i = -r; i < r; i += 1) {
            const yb = Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.5;
            px(c, cx + i, cy + yb - z, cc, 1, 1);
          }
        };
        const nr = it.kind === 1 ? 4 : 6;
        for (let j = 1; j < nr; j++) ring((H * j) / nr, H_(col[2]));
        // vertical plate seams round the shell, a pipe leaving at the foot toward the lane
        for (let i = -r + r / 4; i < r; i += r / 4) {
          const yb = Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.5;
          px(c, cx + i, cy + yb - H, H_(i < 0 ? col[1] : col[3]), 1, Math.round(H));
        }
        if (tanks) {
          const [qx, qy] = p.P(it.a + it.w + 0.6, it.b + it.d / 2, 0);
          for (const [dz, pc, hl] of [[6, '#d8c070', '#f4dc8a'], [11, '#9aa4ae', '#d0d8de']] as const) {
            ln(c, cx + r * 0.6, cy - dz * 4 + r * 0.2, qx, qy - dz * 4, H_(pc), 3);
            ln(c, cx + r * 0.6, cy - dz * 4 + r * 0.2 - 1, qx, qy - dz * 4 - 1, H_(hl));
          }
          px(c, qx - 2, qy - 46, H_('#2c5aa8'), 3, 46);
        }
        if (it.kind === 1) {
          ell(c, cx, cy - H, r, r * 0.5, H_('#fdfbf6'));
          ell(c, cx + r * 0.22, cy - H + 2, r * 0.72, r * 0.34, H_('#ece8e0'));
          ell(c, cx - r * 0.3, cy - H - r * 0.12, r * 0.25, r * 0.1, H_('#ffffff'));
          // the handrail round the top: posts and a rail
          for (let i = -r; i <= r; i += r / 5) {
            const yb = Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.5;
            px(c, cx + i, cy + yb - H - 8, H_('#2c5aa8'), 1, 8);
          }
          for (let i = -r; i < r; i++) {
            const yb = Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.5;
            px(c, cx + i, cy + yb - H - 8, H_('#3a6ac0'), 1, 1);
          }
          // a caged ladder up the shaded flank, a vent on the roof, a pipe leaving at the foot
          const lx = cx + r * 0.55;
          px(c, lx, cy - H + 4, H_('#1c3e7c'), 2, H);
          px(c, lx + 7, cy - H + 6, H_('#2c5aa8'), 2, H - 2);
          for (let y = cy - H + 8; y < cy; y += 5) px(c, lx, y, H_('#4a7ac8'), 9, 1);
          for (let y = cy - H + 10; y < cy - 24; y += 12) ln(c, lx - 2, y, lx + 11, y + 3, H_('#2c5aa8'));
          px(c, cx - 6, cy - H - 10, H_('#9aa4ae'), 6, 8);
          px(c, cx - 6, cy - H - 10, H_('#d8dee2'), 6, 2);
          ln(c, cx - r * 0.8, cy + 2, cx - r * 1.4, cy + r * 0.3, H_('#d8c070'), 3);
          // a stencilled number
          text(c, cx - r * 0.5, cy - H * 0.55, `T${(it.s % 9) + 1}`, H_('#3a4a5a'));
        } else {
          fillPoly(
            c,
            [
              [cx - r, cy - H],
              [cx + r, cy - H],
              [cx, cy - H - r * 0.9],
            ],
            H_('#c8d0d8'),
          );
          fillPoly(
            c,
            [
              [cx, cy - H],
              [cx + r, cy - H],
              [cx, cy - H - r * 0.9],
            ],
            H_('#8a949e'),
          );
          ln(c, cx - r, cy - H, cx, cy - H - r * 0.9, H_('#eef2f4'));
          // a spiral stair band and the loading spout
          for (let j = 0; j < 6; j++) ln(c, cx - r, cy - H + j * (H / 6), cx + r, cy - H + j * (H / 6) + H / 12, H_('#5a6470'));
          px(c, cx - 2, cy - 30, H_('#4a5460'), 4, 30);
        }
        continue;
      }
      // a shed or an office block: clad walls, a coloured flat or pitched roof, windows, doors, a sign
      const f0 = p.P(it.a, it.b + it.d, 0);
      const f1 = p.P(it.a + it.w, it.b + it.d, 0);
      const s1 = p.P(it.a + it.w, it.b, 0);
      const H = it.h * 4;
      // the contact shadow cast toward +x
      fillPoly(c, [f1, s1, p.P(it.a + it.w + 0.7, it.b + 0.3, 0), p.P(it.a + it.w + 0.7, it.b + it.d + 0.2, 0)], H_('#5a5e62'));
      fillPoly(c, [f0, f1, [f1[0], f1[1] - H], [f0[0], f0[1] - H]], H_(it.wall));
      fillPoly(c, [f1, s1, [s1[0], s1[1] - H], [f1[0], f1[1] - H]], H_(darken(it.wall, 0.24)));
      const F = front(p, it.b + it.d);
      const S = side(p, it.a + it.w);
      // vertical cladding ribs
      const ribF = H_(darken(it.wall, 0.12));
      const ribS = H_(darken(it.wall, 0.34));
      for (let u = it.a + 0.08; u < it.a + it.w; u += 0.1) pq(p, F, u, u + 0.012, 0, it.h, ribF);
      for (let u = it.b + 0.08; u < it.b + it.d; u += 0.1) pq(p, S, u, u + 0.012, 0, it.h, ribS);
      // a plinth, a lit corner, the eaves line
      pq(p, F, it.a, it.a + it.w, 0, 2.4, H_('#6e7076'));
      pq(p, S, it.b, it.b + it.d, 0, 2.4, H_('#54565c'));
      ln(c, f1[0], f1[1], f1[0], f1[1] - H, H_('#eef0f2'));
      ln(c, f0[0], f0[1], f0[0], f0[1] - H, H_(darken(it.wall, 0.3)));
      // windows: a grid of framed panes, a few lit; bands of blue glazing on offices
      const office = it.h > 46;
      for (let z = 10; z < it.h - 8; z += office ? 11 : 16) {
        if (office) {
          pq(p, F, it.a + 0.18, it.a + it.w - 0.18, z, z + 5, H_('#e8ecee'));
          pq(p, F, it.a + 0.2, it.a + it.w - 0.2, z + 0.5, z + 4.5, H_('#2a5a8c'));
          pq(p, S, it.b + 0.18, it.b + it.d - 0.18, z, z + 5, H_('#a8b0b8'));
          pq(p, S, it.b + 0.2, it.b + it.d - 0.2, z + 0.5, z + 4.5, H_('#1c3e64'));
          for (let u = it.a + 0.5; u < it.a + it.w - 0.2; u += 0.5) pq(p, F, u, u + 0.03, z + 0.5, z + 4.5, H_('#dce2e8'));
          for (let u = it.a + 0.3; u < it.a + it.w - 0.3; u += 0.5) pq(p, F, u, u + 0.12, z + 3.2, z + 4.5, H_(R2() < 0.15 ? '#ffd49a' : '#6a9ac8'));
        } else {
          for (let u = it.a + 0.35; u < it.a + it.w - 0.35; u += 0.62) {
            pq(p, F, u - 0.02, u + 0.3, z - 0.4, z + 5.4, H_('#e4e8ea'));
            pq(p, F, u, u + 0.28, z, z + 5, H_(R2() < 0.12 ? '#e8c070' : '#24486e'));
            pq(p, F, u, u + 0.1, z + 3, z + 5, H_('#6a9ac8'));
          }
          for (let u = it.b + 0.35; u < it.b + it.d - 0.35; u += 0.62) {
            pq(p, S, u, u + 0.28, z, z + 5, H_('#1a3450'));
            pq(p, S, u - 0.02, u + 0.3, z - 0.4, z, H_('#9aa2aa'));
          }
        }
      }
      // a roller door with a blue lintel, a personnel door; a downpipe; a sign
      const dw = Math.min(1, it.w * 0.3);
      pq(p, F, it.a + 0.3, it.a + 0.3 + dw, 0, 8, H_('#3a4250'));
      pt(p, F, it.a + 0.34, it.a + 0.26 + dw, 0, 7.4, (_u: number, v: number) => H_(v % 4 < 1 ? '#5a6474' : '#7e8896'), 1);
      pq(p, F, it.a + 0.3, it.a + 0.3 + dw, 7.4, 8.4, H_('#2c5aa8'));
      pq(p, F, it.a + 0.3, it.a + 0.3 + dw, 0, 0.6, H_('#1a1c20'));
      const pd = it.a + 0.5 + dw;
      if (pd + 0.3 < it.a + it.w) {
        pq(p, F, pd, pd + 0.24, 0, 6, H_('#e8ecee'));
        pq(p, F, pd + 0.03, pd + 0.21, 0, 5.6, H_('#2c5aa8'));
      }
      pq(p, F, it.a + it.w - 0.12, it.a + it.w - 0.07, 0, it.h + 1, H_('#d8dce0'));
      pq(p, S, it.b + it.d * 0.4, it.b + it.d * 0.4 + 0.06, 0, it.h - 2, H_('#8a929a'));
      if (it.w > 2.6) {
        const sc = SKY_SIGNS[it.s % SKY_SIGNS.length];
        const su = it.a + it.w * 0.45;
        const sw = Math.min(1.6, it.w * 0.4);
        pq(p, F, su, su + sw, it.h - 7, it.h - 2.5, H_(sc));
        pq(p, F, su + 0.1, su + sw - 0.1, it.h - 5, it.h - 4.4, H_('#f4f4f0'));
      }
      const t0 = p.P(it.a, it.b, it.h);
      const t1 = p.P(it.a + it.w, it.b, it.h);
      if (it.h < 46) {
        // a pitched corrugated roof along a, the ridge at mid depth
        const bm = it.b + it.d / 2;
        const rz = it.h + Math.min(14, it.d * 5);
        const r0 = p.P(it.a, bm, rz);
        const r1 = p.P(it.a + it.w, bm, rz);
        fillPoly(c, [t0, t1, r1, r0], H_(darken(it.roof, 0.2)));
        fillPoly(c, [[f0[0], f0[1] - H], [f1[0], f1[1] - H], r1, r0], H_(it.roof));
        for (let a = it.a + 0.06; a < it.a + it.w; a += 0.12) {
          const e = p.P(a, it.b + it.d, it.h);
          const rr = p.P(a, bm, rz);
          ln(c, e[0], e[1], rr[0], rr[1], H_(darken(it.roof, 0.14)));
        }
        fillPoly(c, [[f1[0], f1[1] - H], [s1[0], s1[1] - H], r1], H_(darken(it.wall, 0.3)));
        ln(c, r0[0], r0[1], r1[0], r1[1], H_(darken(it.roof, -0.35)), 2);
        ln(c, f0[0], f0[1] - H + 1, f1[0], f1[1] - H + 1, H_('#1e2228'), 2);
        // a rooflight strip and a roof vent
        const q0 = p.P(it.a + it.w * 0.3, it.b + it.d - 0.3, it.h + 2);
        const q1 = p.P(it.a + it.w * 0.3, bm + 0.2, rz - 2);
        ln(c, q0[0], q0[1], q1[0], q1[1], H_('#a8d0e0'), 4);
        const [vx, vy] = p.P(it.a + it.w * 0.7, bm, rz);
        px(c, vx - 3, vy - 10, H_('#c8ccd2'), 6, 10);
        px(c, vx - 4, vy - 12, H_('#eef0f2'), 8, 2);
      } else {
        fillPoly(c, [[f0[0], f0[1] - H], [f1[0], f1[1] - H], t1, t0], H_(it.roof));
        ln(c, f0[0], f0[1] - H, f1[0], f1[1] - H, H_('#f4f6f8'), 2);
        ln(c, f1[0], f1[1] - H, t1[0], t1[1], H_(darken(it.roof, -0.2)), 2);
        // rooftop plant: AC boxes with fans, a stair hut
        const units = 1 + Math.floor(R2() * 3);
        for (let q = 0; q < units; q++) {
          const ua = it.a + 0.3 + R2() * Math.max(0.1, it.w - 1.1);
          const ub = it.b + 0.3 + R2() * Math.max(0.1, it.d - 1);
          lbox(p, ua, ub, 0.7, 0.5, it.h, 4, mono(plate(AC), '#3a3e44'));
          for (const fa of [0.2, 0.5]) {
            const [fx, fy] = p.P(ua + fa, ub + 0.25, it.h + 4);
            ell(c, fx, fy, 7, 3.5, H_('#3a3e44'));
            ell(c, fx, fy, 4, 2, H_('#6a7078'));
          }
        }
        if (it.w > 2.4) lbox(p, it.a + it.w - 0.9, it.b + 0.2, 0.6, 0.6, it.h, 9, mono(plate(HUT), '#30343a'));
      }
    }
  },
};

// ── night lights ────────────────────────────────────────────
const WARM = '#ffd49a';
const LAMP = '#ffe2b0';

warehouse.lights = (k) => {
  const W = k.w;
  const D = k.d;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const out: PropLight[] = [];
  const v = k.variant ?? 'brick';
  if (v === 'brick') {
    // the store's windows (as in speicher): a third lit, and a lamp over each ground-floor door
    const n = 4 + (k.seed % 2);
    const b1 = D - 1.1;
    const nb = Math.max(2, Math.round((a1 - a0) / 2.8));
    const bw = (a1 - a0) / nb;
    for (let bi = 0; bi < nb; bi++) {
      const c = a0 + bw * (bi + 0.5);
      out.push({ a: c, b: b1 + 0.8, z: 33, r: 2, color: LAMP, kind: 'lamp' });
      for (let s = 1; s < n; s++)
        for (const dw of [-1, 1]) if (hash(bi * 2 + dw, s, k.seed + 3) < 0.3) out.push({ a: c + dw * bw * 0.32, b: b1, z: 38 + (s - 1) * 29 + 12, r: 1.2, color: WARM, kind: 'window' });
    }
    const ns = Math.max(1, Math.round((b1 - 0.4) / 1.6));
    for (let s = 1; s < n; s++)
      for (let i = 0; i < ns; i++) if (hash(i, s, k.seed + 9) < 0.25) out.push({ a: a1, b: 0.4 + ((b1 - 0.4) * (i + 0.5)) / ns, z: 38 + (s - 1) * 29 + 12, r: 1.2, color: WARM, kind: 'window' });
  } else if (v === 'shed') {
    const b1 = D - 0.4;
    const nd = Math.max(2, Math.floor((a1 - a0) / 2.6));
    const dw = (a1 - a0) / nd;
    for (let i = 0; i < nd; i++) out.push({ a: a0 + dw * (i + 0.5), b: b1 + 0.1, z: 32, r: 2.2, color: LAMP, kind: 'lamp' });
  } else if (v === 'cold') {
    const b1 = D - 1.2;
    const nd = Math.max(2, Math.floor((a1 - a0) / 1.8));
    const dw = (a1 - a0) / nd;
    for (let i = 0; i < nd; i += 2) out.push({ a: a0 + dw * (i + 0.5), b: b1 + 1.1, z: 38, r: 2.2, color: '#eaf4ff', kind: 'lamp' });
    out.push({ a: a1 - 0.9, b: b1, z: 46, r: 1.6, color: WARM, kind: 'window' });
    out.push({ a: a1, b: (0.3 + b1) / 2, z: 46, r: 1.6, color: WARM, kind: 'window' });
  } else {
    const b1 = D - 0.3;
    const nw = Math.max(2, Math.round((a1 - a0) / 1.4));
    for (let i = 0; i < nw; i++) if (i % 2 === 0 && i !== Math.floor(nw / 2)) out.push({ a: a0 + ((a1 - a0) * (i + 0.5)) / nw, b: b1, z: 16, r: 1.3, color: WARM, kind: 'window' });
  }
  return out;
};

// the market's arcade glows behind its shutters, the lamps under the awnings
market.lights = (k) => {
  const a0 = 0.1;
  const a1 = k.w - 0.1;
  const b1 = k.d - 0.2;
  const na = Math.max(3, Math.round((a1 - a0) / 2));
  const aw = (a1 - a0) / na;
  const out: PropLight[] = [];
  for (let i = 0; i < na; i++) {
    out.push({ a: a0 + aw * (i + 0.5), b: b1, z: 12, r: 1.6, color: WARM, kind: 'window' });
    if (i % 2 === 0) out.push({ a: a0 + aw * (i + 0.5), b: b1 + 1, z: 24, r: 2.2, color: LAMP, kind: 'lamp' });
  }
  return out;
};

// the harbour master's office: the lit upper window, the door lamp, a side window
office.lights = (k) => {
  const a0 = 0.15;
  const a1 = k.w - 0.15;
  const b1 = k.d - 0.4;
  const c = (a0 + a1) / 2;
  return [
    { a: c, b: b1, z: 46, r: 1.3, color: WARM, kind: 'window' },
    { a: c + 0.95, b: b1, z: 16, r: 1.3, color: WARM, kind: 'window' },
    { a: c, b: b1 + 0.3, z: 24, r: 2, color: LAMP, kind: 'lamp' },
    { a: a1, b: 0.15 + 0.9, z: 46, r: 1.2, color: WARM, kind: 'window' },
  ];
};

// the gate canopy's floodlights and the booths
gate.lights = (k) => [
  { a: k.w * 0.3, b: k.d * 0.5, z: 30, r: 3, color: '#eaf4ff', kind: 'lamp' },
  { a: k.w * 0.75, b: k.d * 0.5, z: 30, r: 3, color: '#eaf4ff', kind: 'lamp' },
];

export const PORT_BUILDINGS: Record<string, PropArt> = { prt_warehouse: warehouse, prt_market: market, prt_office: office, prt_gate: gate, prt_skyline: skyline };

export { brick, roofing, win, loadDoor, COPPER, SLATE, SAND, ZINC };
export { GLASS, RUST, cladH, text };

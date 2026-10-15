// Creative Studio — the back walls of a converted boathouse: whitewashed
// vertical shiplap over a hand-painted coral dado with a wavy top edge, a
// pine skirting, a slim pine rail and an exposed wall plate; the cut top
// shows boards, studs and insulation, the open ends the teal weatherboard.
// Wall props: big teal-framed studio windows, the paper sweep backdrop, the
// moodboard, a porthole door, the asset cubbies, a screen-printed poster,
// and the studio's own decor: a neon, a fish surfboard, a pegboard, a plant
// shelf, a sketch line, a rattan sun mirror and the mug shelf.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, noise2, px, type Ramp } from '../../kit4';
import { beam, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { ALU, BEECH, CORAL, CREAM, darken, GEAR, LEAF, lighten, PINE, pine, PLY, plyEdge, plyFace, shiplap, SKY, TEAL, WALLW } from './kit';
import { pot, pothos } from './lounge';

/** 1 z = 10 cm next to a 1.75 m person: a 4 m boathouse wall. */
const H = 40;
const T = 0.3;

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl => (side === 'ne' ? front3(p, 0) : side3(p, 0));
/** A point d tiles out from the wall into the room. */
const out3 = (p: PropPainter, side: 'ne' | 'nw', u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));

/** The coral dado: shiplap in coral, its top a hand-painted wave. */
const dado =
  (light: 0 | 1 | 2, seed: number): FaceTex =>
  (u, v, x, y) => {
    const edge = 31 + Math.sin(u * 0.043 + seed) * 5 + Math.sin(u * 0.121 + seed * 2) * 1.6;
    if (v > edge) return null;
    const b = Math.floor(u / 13);
    const fu = u - b * 13;
    let i = (light ? 3.6 : 2.2) + (hash(b, 5, 31) - 0.5) * 0.6;
    if (fu < 1) i -= 1.5;
    else if (fu < 2) i += 0.6;
    if (v > edge - 1.6) i += 1.2;
    if (noise2(u * 0.06, v * 0.08, 32) > 0.7 && bayer(x, y) > 0.55) i -= 0.6;
    return at(CORAL, i);
  };

function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  pt(p, pl, 0, len, 0, H, shiplap(WALLW), light);
  pt(p, pl, 0, len, 1.4, 12, dado(light, side === 'ne' ? 0 : 3), light);
  // paint splashes low on the wall behind the easels (NW, y 8…11) and by the photo set (NE)
  pt(p, pl, 0, len, 1.4, 16, (u: number, v: number, x: number, y: number) => {
    const U = u / 71.6;
    const zone = side === 'nw' ? U > 7.6 && U < 11.2 : U > 4.2 && U < 4.9;
    if (!zone) return null;
    const cx = Math.floor(u / 9);
    const cy = Math.floor(v / 7);
    const h = hash(cx, cy, side === 'nw' ? 41 : 42);
    if (h > 0.16) return null;
    const dx = u - (cx * 9 + 4.5);
    const dy = v - (cy * 7 + 3.5);
    const r = 1 + hash(cx, cy, 43) * 2.6;
    if (dx * dx + dy * dy * 1.6 > r * r) return null;
    void x;
    void y;
    return ['#2a8a86', '#e8b03e', '#5a7ac8', '#f2f0e8', '#3a3036'][Math.floor(h * 31) % 5];
  }, light);
  // pine skirting with a lit top lip
  pt(p, pl, 0, len, 0, 1.4, (u: number, v: number) => at(PINE, (light ? 3 : 1.6) + (v > 4 ? 1 : 0) + (u % 97 < 1 ? -1.2 : 0)), light);
  // a slim pine rail and the exposed wall plate up top
  pq(p, pl, 0, len, 29.6, 29.9, darken(WALLW[1], 0.12));
  pt(p, pl, 0, len, 29.9, 30.8, (_u: number, v: number) => at(PINE, (light ? 3.4 : 2) + (v > 2.4 ? 1 : 0)), light);
  pq(p, pl, 0, len, 37.2, 37.6, darken(WALLW[0], 0.25));
  pt(p, pl, 0, len, 37.6, H, pine(PINE), light);
  // the cut top: shiplap skin, studs and wool insulation, the teal weatherboard outside
  const top: FaceTex = (u, v, x, y) => {
    if (v < 2.6) return WALLW[5];
    if (v > 18) return v > 20 ? TEAL[4] : TEAL[2];
    const stud = u % 43 < 6;
    if (stud) return at(PINE, 3 + (u % 43 < 1 ? -1 : 0));
    return hash(x >> 1, y >> 1, 44) < 0.3 ? '#e8cf86' : '#f2dc9a';
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], top, 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], top, 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The open end of a wall: the boathouse's teal weatherboard and a white corner board. */
const endCap: Mat = (light, w) => (u, v) => {
  if (u > w - 3) return CREAM[light ? 5 : 3];
  if (u < 2) return WALLW[light ? 5 : 3];
  const row = Math.floor(v / 9);
  const fv = v - row * 9;
  return at(TEAL, (light ? 3.6 : 2) + (fv < 1.2 ? -2 : fv > 7.4 ? 0.8 : 0));
};

// ── wall props ──────────────────────────────────────────────
/** The view out: sky with a cloud, painted beach houses with gables, a palm. */
const view =
  (seed: number): FaceTex =>
  (u, v, x, y) => {
    const sky = SKY;
    let col = sky[Math.max(3, Math.min(6, Math.floor(6.4 - v / 30 + (bayer(x, y) - 0.5) * 0.7)))];
    const cl = Math.hypot((u - 40 - seed * 23) / 2.4, v - 74);
    if (cl < 9 + noise2(u * 0.2, v * 0.2, seed) * 4) col = cl < 6 ? '#ffffff' : '#eef6fa';
    // the houses across the lane: a gable per 30 px, each a colour
    const hx = Math.floor((u + seed * 17) / 30);
    const fx = (u + seed * 17) - hx * 30;
    const roofTop = 46 + hash(hx, 1, seed) * 10;
    const eave = roofTop - 12;
    const gable = eave + (15 - Math.abs(fx - 15)) * 0.8;
    const cols = ['#e88a6a', '#7ac7bb', '#f2da74', '#a8c4ec', '#f0a6c0', '#f6f0e4'];
    if (v < Math.min(gable, roofTop)) {
      col = cols[Math.floor(hash(hx, 2, seed) * cols.length)];
      if (v > eave - 1 && v < gable) col = hash(hx, 3, seed) < 0.5 ? '#c8503a' : '#5a6a7a';
      else if (v < eave - 4 && v > 10 && (Math.floor(fx / 7) % 2 === 1) && Math.floor(v / 9) % 2 === 1) col = '#3a5068';
      else if (v % 4 < 1) col = darken(col, 0.12);
    }
    // a palm crown leaning in from the side
    const px0 = u - 12 - seed * 9;
    const d = Math.hypot(px0 / 1.5, v - 66);
    const ang = Math.atan2(v - 66, px0);
    if (d < 18 && Math.abs(Math.sin(ang * 5)) > 0.45) col = d < 10 && px0 > 0 ? '#2e6832' : '#52983e';
    if (Math.abs(px0 - (66 - v) * 0.15) < 1.4 && v < 66) col = '#7a5a3a';
    return col;
  };

/** A big teal-framed studio window: a grid of panes, a deep pine sill, a canvas blind. */
function studioWindow(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, z0: number, z1: number, seed: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  // the reveal: a band of shadow round the opening, then the frame and the glass
  pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 0.6, z1 + 0.6, darken(WALLW[light ? 3 : 1], 0.3));
  pq(p, pl, u0 - 0.03, u1 + 0.03, z0 - 0.3, z1 + 0.3, CREAM[light ? 5 : 3]);
  pt(p, pl, u0 + 0.05, u1 - 0.05, z0 + 0.7, z1 - 0.7, view(seed), light);
  p.c.globalAlpha = 0.3;
  pt(p, pl, u0 + 0.05, u1 - 0.05, z0 + 0.7, z1 - 0.7, (u: number, v: number) => ((u * 0.8 + v) % 46 < 5 || (u * 0.8 + v) % 46 > 43 ? '#ffffff' : null), light);
  p.c.globalAlpha = 1;
  // the frame: teal outer frame, mullions and transoms
  const fr: Ramp = TEAL;
  beam(p, pl, u0, z0, u1, z0, 0.9, fr);
  beam(p, pl, u0, z1, u1, z1, 0.9, fr);
  beam(p, pl, u0 + 0.02, z0, u0 + 0.02, z1, 0.8, fr);
  beam(p, pl, u1 - 0.02, z0, u1 - 0.02, z1, 0.8, fr);
  const nc = Math.max(2, Math.round((u1 - u0) / 0.62));
  for (let i = 1; i < nc; i++) beam(p, pl, u0 + ((u1 - u0) * i) / nc, z0, u0 + ((u1 - u0) * i) / nc, z1, 0.45, fr);
  for (const f of [0.34, 0.68]) beam(p, pl, u0, z0 + (z1 - z0) * f, u1, z0 + (z1 - z0) * f, 0.45, fr);
  // a canvas roller blind, half down over one bay
  const bi = Math.floor(hash(seed, 1, 9) * nc);
  const ba = u0 + ((u1 - u0) * bi) / nc + 0.04;
  const bb = u0 + ((u1 - u0) * (bi + 1)) / nc - 0.04;
  pt(p, pl, ba, bb, z0 + (z1 - z0) * 0.45, z1 - 0.4, (u: number, v: number) => at(['#b8a88c', '#cdbda0', '#ddd0b6', '#ebe0ca', '#f5ecdc'], (light ? 3 : 2) + (v < 2 ? -1.4 : 0) + ((u + v * 0.2) % 9 < 1 ? -0.4 : 0)), light);
  pq(p, pl, ba + (bb - ba) * 0.45, ba + (bb - ba) * 0.55, z0 + (z1 - z0) * 0.45 - 1.4, z0 + (z1 - z0) * 0.45, '#8a7a5a');
  // the roller at the head of every bay
  beam(p, pl, u0 + 0.05, z1 - 0.3, u1 - 0.05, z1 - 0.3, 0.6, ['#a89878', '#bcac8c', '#cfc0a0', '#ddd0b4', '#ebe0c8', '#f6eedc']);
  // the deep pine sill: its top band and front edge, and things on it
  const s0 = out3(p, side, u0 - 0.1, 0, z0 - 0.2);
  const s1 = out3(p, side, u1 + 0.1, 0, z0 - 0.2);
  const s2 = out3(p, side, u1 + 0.1, 0.3, z0 - 0.2);
  const s3 = out3(p, side, u0 - 0.1, 0.3, z0 - 0.2);
  fillPoly(p.c, [s0, s1, s2, s3], PINE[light ? 5 : 4]);
  const e2 = out3(p, side, u1 + 0.1, 0.3, z0 - 1.4);
  const e3 = out3(p, side, u0 - 0.1, 0.3, z0 - 1.4);
  fillPoly(p.c, [s3, s2, e2, e3], PINE[light ? 3 : 2]);
  layer(p.c, (l) => {
    // a jar of brushes, a little cactus, a row of shells, a glass float
    const [jx, jy] = out3(p, side, u0 + 0.3, 0.15, z0 - 0.2);
    px(l, jx - 4, jy - 9, '#bcd8e2', 8, 9);
    for (let i = 0; i < 4; i++) ln(l, jx - 2 + i, jy - 9, jx - 4 + i * 2.4, jy - 18, ['#c8382a', '#3a3036', '#e8b03e', '#2a5a8a'][i]);
    const [cx, cy] = out3(p, side, u0 + 0.75, 0.15, z0 - 0.2);
    px(l, cx - 5, cy - 7, '#c86a4a', 10, 7);
    px(l, cx - 5, cy - 7, '#e08a64', 2, 7);
    for (let j = 0; j < 12; j++) px(l, cx - 2, cy - 8 - j, j % 3 === 0 ? '#f2f0d8' : '#3e8050', 4, 1);
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = out3(p, side, u1 - 0.9 + i * 0.12, 0.15, z0 - 0.2);
      ell(l, sx, sy - 2, 3, 2, ['#f6d8c8', '#fbf6ee', '#e8b090', '#f2e6d6'][i]);
      px(l, sx - 1, sy - 3, '#ffffff');
    }
    const [gx, gy] = out3(p, side, u1 - 0.3, 0.15, z0 - 0.2);
    ell(l, gx, gy - 6, 6, 6, '#7ab8b0');
    ell(l, gx - 2, gy - 8, 2, 2, '#e4f6f2');
    for (let i = -5; i <= 5; i += 3) px(l, gx + i, gy - 6 + (i % 2), '#8a6a4a', 1, 1);
  });
}

const window: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    studioWindow(p, side, a0 + 0.22, a0 + w - 0.22, 9.5, 33, k.seed * 7 + 2);
  },
};

/** Seamless paper on two stands: the roll, the hang, the sweep onto the floor. */
const backdrop: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const paper: Ramp = ['#c8a07a', '#d8b08a', '#e6c29a', '#f0d0a8', '#f7dcb6', '#fce6c6'];
    // stored rolls above on brackets: teal, grey, coral
    for (const [z, col] of [[36.4, TEAL], [34.2, ['#5a5a62', '#6e6e78', '#86868e', '#a0a0a8', '#babac0', '#d2d2d6']], [32, CORAL]] as const) {
      beam(p, pl, u0 + 0.12, z, u1 - 0.12, z, 1.1, col as Ramp);
      for (const u of [u0 + 0.2, u1 - 0.2]) pq(p, pl, u - 0.03, u + 0.03, z - 1.4, z + 0.4, GEAR[2]);
    }
    // the hanging sheet: lighter in the middle where the softboxes hit it
    pt(p, pl, u0 + 0.2, u1 - 0.2, 0, 29.4, (u: number, v: number, x: number, y: number) => {
      const U = u / ((u1 - u0 - 0.4) * 71.6);
      const c = 1 - Math.abs(U - 0.5) * 2;
      let i = (light ? 3 : 2) + c * 1.8 - (v < 10 ? (10 - v) * 0.06 : 0);
      if (hash(x >> 2, y >> 3, 51) < 0.02) i -= 0.6;
      i += (bayer(x, y) - 0.5) * 0.6;
      return at(paper, i);
    }, light);
    // the roll core on its crossbar, clamps, the stands with sandbags
    beam(p, pl, u0 + 0.15, 29.8, u1 - 0.15, 29.8, 1.3, paper);
    beam(p, pl, u0, 31, u1, 31, 0.4, GEAR);
    for (const u of [u0 + 0.36, u1 - 0.36]) {
      pq(p, pl, u - 0.04, u + 0.04, 29, 31.4, CORAL[2]);
      pq(p, pl, u - 0.02, u + 0.02, 30.6, 31.2, CORAL[4]);
    }
    for (const u of [u0, u1]) {
      pq(p, pl, u - 0.025, u + 0.025, 0, 31.6, GEAR[light ? 3 : 2]);
      pq(p, pl, u - 0.025, u - 0.012, 0, 31.6, GEAR[5]);
      const [bx, by] = out3(p, side, u, 0.14, 0);
      fillPoly(p.c, [[bx - 9, by - 2], [bx + 9, by - 2], [bx + 10, by + 4], [bx - 10, by + 4]], '#b8432e');
      px(p.c, bx - 9, by - 2, '#d86448', 18, 2);
      ln(p.c, bx - 12, by + 6, bx + 12, by - 6, GEAR[2], 2);
    }
    // the cove where the sheet curves onto the floor
    for (let i = 0; i < 6; i++) {
      const d0 = i * 0.06;
      const z = 1.6 * (1 - i / 6) ** 2;
      const a = out3(p, side, u0 + 0.2, d0, z);
      const b = out3(p, side, u1 - 0.2, d0, z);
      const c2 = out3(p, side, u1 - 0.2, d0 + 0.06, 1.6 * (1 - (i + 1) / 6) ** 2);
      const d = out3(p, side, u0 + 0.2, d0 + 0.06, 1.6 * (1 - (i + 1) / 6) ** 2);
      fillPoly(p.c, [a, b, c2, d], paper[i < 2 ? 3 : 4]);
    }
    void k;
  },
};

/** A plane-rotated card (u in tiles, z in z units; angle in radians). */
function card(p: PropPainter, pl: Pl, u: number, z: number, w: number, h: number, ang: number, col: string) {
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  const pts: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([du, dz]) => {
    const U = du * 16;
    const ru = (U * co - dz * si) / 16;
    const rz = U * si + dz * co;
    return pl.F(u + ru, z + rz);
  });
  fillPoly(p.c, pts, col);
}

const moodboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.14;
    const u1 = k.wp.at + k.wp.w - 0.14;
    const z0 = 11;
    const z1 = 31;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(60,40,40,0.22)');
    pt(p, pl, u0, u1, z0, z1, (u: number, v: number) => at(PINE, (light ? 3.4 : 2) + (u % 61 < 1 ? -1 : 0) + (v % 47 < 1 ? -0.6 : 0)), light);
    pt(p, pl, u0 + 0.06, u1 - 0.06, z0 + 0.8, z1 - 0.8, (_u: number, _v: number, x: number, y: number) => at(['#b8b4ac', '#cac6be', '#dad6ce', '#e6e2da', '#f0ece6'], (light ? 3 : 2) + (hash(x, y, 61) < 0.15 ? -1 : 0)), light);
    const L = u1 - u0;
    const Rn = (i: number, s: number) => hash(i, s, k.seed + 17);
    // the title strip
    card(p, pl, u0 + L * 0.5, z1 - 2.2, L * 0.5, 2, 0.02, '#1e2a3a');
    for (let i = 0; i < 9; i++) card(p, pl, u0 + L * 0.3 + i * L * 0.05, z1 - 2.2, L * 0.03, 0.8, 0, '#f2ece0');
    // polaroids: white frames, little photos of sea, sunsets and people
    const photo = ['#3aa0b4', '#f2a868', '#e88aa8', '#7ab858', '#2a5a7a', '#e8b03e'];
    for (let i = 0; i < 7; i++) {
      const u = u0 + 0.22 + (i % 4) * (L - 0.44) / 3 + (Rn(i, 1) - 0.5) * 0.12;
      const z = z0 + 4 + Math.floor(i / 4) * 7.5 + Rn(i, 2) * 1.5;
      const ang = (Rn(i, 3) - 0.5) * 0.4;
      card(p, pl, u + 0.02, z - 0.3, 0.3, 4.6, ang, 'rgba(40,30,30,0.2)');
      card(p, pl, u, z, 0.3, 4.6, ang, '#fbf8f2');
      card(p, pl, u, z + 0.5, 0.24, 3, ang, photo[i % photo.length]);
      card(p, pl, u, z + 1.2, 0.24, 1.4, ang, lighten(photo[(i + 2) % photo.length], 0.2));
    }
    // the brand palette: a row of chips
    const chips = ['#e06a4a', '#f0a6c0', '#e8b03e', '#2a8a86', '#1e2a3a', '#f2ece0'];
    chips.forEach((col, i) => {
      card(p, pl, u0 + L * 0.58 + i * 0.13, z0 + 2.4, 0.11, 2.6, 0, col);
      card(p, pl, u0 + L * 0.58 + i * 0.13, z0 + 1.5, 0.11, 0.6, 0, '#fbf8f2');
    });
    // a big sketch of the summer mascot: a sun over waves, pencil on cartridge paper
    const su = u0 + L * 0.74;
    const sz = z0 + 10;
    card(p, pl, su, sz, 0.62, 8.6, 0.05, '#fbf8f0');
    const [cx, cy] = pl.F(su, sz + 1.2);
    for (let a = 0; a < 26; a++) {
      const t = (a / 26) * Math.PI * 2;
      px(p.c, cx + Math.cos(t) * 9, cy + Math.sin(t) * 9, '#4a4248');
    }
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      ln(p.c, cx + Math.cos(t) * 11, cy + Math.sin(t) * 11, cx + Math.cos(t) * 15, cy + Math.sin(t) * 15, '#4a4248');
    }
    ell(p.c, cx, cy, 6, 6, '#f2c86a');
    for (let i = -12; i < 12; i += 2) px(p.c, cx + i, cy + 17 + Math.round(Math.sin(i * 0.6) * 2), '#3a7ab0');
    // fabric swatches, sticky notes, washi tape, red string
    const sw = [['#e06a4a', '#f6eedc'], ['#2a8a86', '#f2ece0'], ['#e8b03e', '#fbf6ec']];
    sw.forEach(([a, b2], i) => {
      const u = u0 + 0.2 + i * 0.26;
      card(p, pl, u, z0 + 2.6, 0.22, 3.2, (i - 1) * 0.08, a);
      for (let j = 0; j < 3; j++) card(p, pl, u, z0 + 1.6 + j * 1, 0.22, 0.4, (i - 1) * 0.08, b2);
    });
    const notes = ['#f6d860', '#9fe3b8', '#f2a0c0'];
    for (let i = 0; i < 4; i++) card(p, pl, u0 + L * (0.4 + i * 0.08), z0 + 6 + (i % 2) * 2.5, 0.16, 2.4, (Rn(i, 9) - 0.5) * 0.3, notes[i % 3]);
    const pins: [number, number][] = [[u0 + 0.22, z0 + 6.6], [u0 + L * 0.48, z0 + 8.4], [su - 0.1, sz + 3.6], [u0 + L * 0.58 + 0.3, z0 + 3.8]];
    for (let i = 0; i + 1 < pins.length; i++) {
      const [x0, y0] = pl.F(pins[i][0], pins[i][1]);
      const [x1, y1] = pl.F(pins[i + 1][0], pins[i + 1][1]);
      ln(p.c, x0, y0, x1, y1, '#c8302a');
    }
    for (const [u, z] of pins) {
      const [x, y] = pl.F(u, z);
      px(p.c, x - 1, y - 1, '#e8402a', 3, 3);
      px(p.c, x - 1, y - 1, '#ff9a80', 1, 1);
    }
    card(p, pl, u0 + 0.4, z1 - 4, 0.36, 0.9, -0.3, '#f0a6c0');
    card(p, pl, u1 - 0.3, z0 + 1.2, 0.36, 0.9, 0.25, '#7ac7bb');
  },
};

/** A teal plank door with a brass porthole, a hanging sign and a coir mat. */
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const Z = 22.4;
    // the white architrave and a fanlight with the studio's number
    pq(p, pl, u0 - 0.1, u1 + 0.1, 0, Z + 3.6, CREAM[light ? 5 : 3]);
    pq(p, pl, u0 - 0.1, u1 + 0.1, Z + 3.4, Z + 3.6, CREAM[1]);
    pt(p, pl, u0, u1, Z + 0.4, Z + 3, (u: number, v: number) => ((u * 0.8 + v) % 26 < 4 ? '#c4e0f2' : '#5e8aa8'), light);
    // the planks
    pt(p, pl, u0, u1, 0, Z, (u: number, v: number, x: number, y: number) => {
      const b = Math.floor(u / 10);
      const fu = u - b * 10;
      let i = (light ? 3.4 : 2) + (hash(b, 1, 71) - 0.5) * 0.6;
      if (fu < 1) i -= 1.6;
      if (fu < 2) i += 0.6;
      if (v < 3) i -= 0.8;
      if (noise2(u * 0.1, v * 0.05, 72) > 0.72 && bayer(x, y) > 0.5) i += 0.6;
      return at(TEAL, i);
    }, light);
    // ledges and a Z brace in white
    for (const z of [3, 19]) beam(p, pl, u0 + 0.02, z, u1 - 0.02, z, 0.7, CREAM);
    // the porthole: brass rim, glass with a reflection, rivets
    const [cx, cy] = pl.F((u0 + u1) / 2, 15);
    ell(p.c, cx, cy, 13, 14, '#7a5a22');
    ell(p.c, cx, cy, 12, 13, '#c89a42');
    ell(p.c, cx - 1, cy - 1, 11, 12, '#e8c46a');
    ell(p.c, cx, cy, 9, 10, '#2e4a5a');
    ell(p.c, cx, cy + 2, 7, 6, '#4a6e80');
    ln(p.c, cx - 6, cy - 2, cx - 1, cy - 7, '#c4e0f2');
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      px(p.c, cx + Math.cos(t) * 11, cy + Math.sin(t) * 12, '#5a4218');
    }
    // the handle, a little shingle sign on a cord
    const [hx, hy] = pl.F(u1 - 0.14, 9.5);
    px(p.c, hx - 1, hy - 4, '#7a5a22', 3, 8);
    px(p.c, hx - 1, hy - 4, '#f2d27a', 1, 8);
    const [sx, sy] = pl.F((u0 + u1) / 2, 7);
    ln(p.c, sx - 6, sy - 6, sx, sy - 12, '#e8dcc0');
    ln(p.c, sx + 6, sy - 6, sx, sy - 12, '#e8dcc0');
    fillPoly(p.c, [[sx - 9, sy - 6], [sx + 9, sy - 6], [sx + 9, sy + 2], [sx - 9, sy + 2]], '#f6eedc');
    for (let i = 0; i < 4; i++) px(p.c, sx - 6 + i * 4, sy - 3, '#e06a4a', 2, 3);
    // the coir mat on the floor in front
    const m0 = out3(p, side, u0, 0.05, 0.05);
    const m1 = out3(p, side, u1, 0.05, 0.05);
    const m2 = out3(p, side, u1, 0.55, 0.05);
    const m3 = out3(p, side, u0, 0.55, 0.05);
    fillPoly(p.c, [m0, m1, m2, m3], '#8a6a3a');
    const n0 = out3(p, side, u0 + 0.05, 0.1, 0.05);
    const n1 = out3(p, side, u1 - 0.05, 0.1, 0.05);
    const n2 = out3(p, side, u1 - 0.05, 0.5, 0.05);
    const n3 = out3(p, side, u0 + 0.05, 0.5, 0.05);
    fillPoly(p.c, [n0, n1, n2, n3], '#b08c52');
    for (let i = 0; i < 6; i++) {
      const a = out3(p, side, u0 + 0.12 + i * 0.1, 0.18, 0.05);
      const b = out3(p, side, u0 + 0.12 + i * 0.1, 0.42, 0.05);
      ln(p.c, a[0], a[1], b[0], b[1], '#9a7842');
    }
  },
  anim(p, side, k) {
    // a shell wind chime by the door, swaying in the draught
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.92, 30);
    const u = p.k / 4;
    ln(p.c, x, y, x, y + 3 * u, '#c8b490');
    for (let i = 0; i < 4; i++) {
      const sw = Math.sin(k.t * 1.7 + i * 0.9) * 2 * u;
      const lx = x - 4 * u + i * 3 * u;
      ln(p.c, lx, y + 3 * u, lx + sw, y + (10 + i * 2) * u, '#c8b490');
      px(p.c, lx + sw - u, y + (10 + i * 2) * u, ['#fbf6ee', '#f6d8c8', '#e8c0a0', '#fbf6ee'][i], Math.max(1, 3 * u), Math.max(1, 2 * u));
    }
  },
};

/** The asset wall: plywood cubbies full of props for shoots. */
const assetwall: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const z0 = 8;
    const z1 = 33;
    const cols = 4;
    const rows = 4;
    const D = 0.32;
    const cw = (u1 - u0) / cols;
    const rh = (z1 - z0) / rows;
    // the back panel and its shadow
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.8, z1 - 0.8, 'rgba(60,40,40,0.2)');
    pt(p, pl, u0, u1, z0, z1, plyFace(['#5e4630', '#7a5c3e', '#957250', '#ad8a62', '#c2a076', '#d4b48a', '#e2c8a0']), light);
    const P3 = (u: number, d: number, z: number) => out3(p, side, u, d, z);
    const ply = PLY;
    const Rn = (i: number, s: number) => hash(i, s, k.seed + 23);
    const items: ((l: CanvasRenderingContext2D, x: number, y: number, i: number) => void)[] = [
      (l, x, y, i) => {
        // a bud vase with a dried stem
        const col = ['#e06a4a', '#2a8a86', '#f2ece0', '#e8b03e'][i % 4];
        ell(l, x, y - 6, 5, 6, col);
        ell(l, x - 2, y - 8, 2, 2, lighten(col, 0.3));
        px(l, x - 1, y - 14, col, 3, 3);
        ln(l, x, y - 14, x + 3, y - 26, '#a88a5a');
        for (let j = 0; j < 4; j++) px(l, x + 1 + j * 0.6, y - 18 - j * 2, '#d8b878', 2, 1);
      },
      (l, x, y, i) => {
        // a stack of coloured card
        for (let j = 0; j < 5; j++) px(l, x - 10, y - 2 - j * 2, ['#e06a4a', '#f0a6c0', '#e8b03e', '#7ac7bb', '#f6f0e4'][(j + i) % 5], 20, 2);
      },
      (l, x, y) => {
        // a vintage film camera
        px(l, x - 9, y - 9, '#2a2a30', 18, 9);
        px(l, x - 9, y - 9, '#c8ccd2', 18, 3);
        ell(l, x + 1, y - 4, 4, 4, '#1a1a20');
        ell(l, x, y - 5, 2, 2, '#6a8aa8');
        px(l, x - 7, y - 11, '#c8ccd2', 4, 2);
      },
      (l, x, y, i) => {
        // a little trailing plant in a cup
        pot(l, x, y, 5, 7, 'stripe', i);
        foliage(l, [{ x, y: y - 10, rx: 7, ry: 5, z: 1 }], LEAF, i + 5, { cell: 2.2 });
        for (let j = 0; j < 3; j++) for (let q = 0; q < 6 + j * 3; q++) px(l, x - 5 + j * 4, y - 6 + q, LEAF[3 + (q & 1)]);
      },
      (l, x, y) => {
        // seashells and a starfish
        ell(l, x - 5, y - 3, 4, 3, '#f6d8c8');
        for (let j = -3; j <= 3; j += 2) ln(l, x - 5, y - 1, x - 5 + j, y - 5, '#e0b4a0');
        fillPoly(l, [[x + 6, y - 9], [x + 7, y - 4], [x + 12, y - 4], [x + 8, y - 1], [x + 9, y + 3], [x + 6, y], [x + 3, y + 3], [x + 4, y - 1], [x, y - 4], [x + 5, y - 4]], '#e8804a');
      },
      (l, x, y) => {
        // books standing, one leaning
        for (let j = 0; j < 5; j++) px(l, x - 9 + j * 3, y - 12 - (j % 2) * 2, ['#2a5a7a', '#e06a4a', '#f2ece0', '#3a3036', '#e8b03e'][j], 3, 12 + (j % 2) * 2);
        ln(l, x + 7, y, x + 11, y - 12, '#2a8a86', 3);
      },
      (l, x, y) => {
        // a glass bottle and a mini disco ball
        px(l, x - 7, y - 12, '#7ab8a8', 5, 12);
        px(l, x - 6, y - 15, '#7ab8a8', 3, 3);
        px(l, x - 7, y - 12, '#c4ece2', 1, 12);
        ell(l, x + 4, y - 5, 5, 5, '#a8b0bc');
        for (let j = 0; j < 6; j++) px(l, x + 1 + (j % 3) * 2, y - 8 + Math.floor(j / 3) * 3, j % 2 ? '#ffffff' : '#6a7280');
      },
      (l, x, y, i) => {
        // rolls of fabric
        for (let j = 0; j < 3; j++) {
          const col = ['#e06a4a', '#7ac7bb', '#f2da74', '#3a5a9a'][(i + j) % 4];
          ell(l, x - 8 + j * 7, y - 4, 4, 4, darken(col, 0.2));
          ell(l, x - 8 + j * 7, y - 4, 3, 3, col);
          ell(l, x - 8 + j * 7, y - 4, 1, 1, '#f6f0e4');
        }
      },
      (l, x, y) => {
        // a ceramic jug
        fillPoly(l, [[x - 6, y], [x + 6, y], [x + 7, y - 9], [x + 4, y - 16], [x - 4, y - 16], [x - 7, y - 9]], '#f2ece0');
        fillPoly(l, [[x - 6, y], [x - 2, y], [x - 2, y - 16], [x - 4, y - 16], [x - 7, y - 9]], '#ffffff');
        px(l, x - 6, y - 8, '#2a5a9a', 13, 2);
        ln(l, x + 7, y - 12, x + 10, y - 7, '#e8e2d6', 2);
      },
      (l, x, y) => {
        // spray cans
        for (let j = 0; j < 3; j++) {
          const col = ['#f0a6c0', '#e8b03e', '#2a8a86'][j];
          px(l, x - 8 + j * 6, y - 12, col, 5, 12);
          px(l, x - 8 + j * 6, y - 12, lighten(col, 0.3), 1, 12);
          px(l, x - 7 + j * 6, y - 14, ALU[4], 3, 2);
        }
      },
    ];
    for (let r = 0; r < rows; r++)
      for (let cI = 0; cI < cols; cI++) {
        const ua = u0 + cI * cw;
        const za = z0 + r * rh;
        // the cubby's shelf top (seen from above) and its front edge
        const a = P3(ua, 0, za + 0.5);
        const b = P3(ua + cw, 0, za + 0.5);
        const c = P3(ua + cw, D, za + 0.5);
        const d = P3(ua, D, za + 0.5);
        fillPoly(p.c, [a, b, c, d], ply[light ? 5 : 4]);
        const e = P3(ua + cw, D, za);
        const f = P3(ua, D, za);
        fillPoly(p.c, [d, c, e, f], ply[light ? 3 : 2]);
        for (let i = 0; i < 3; i++) {
          const g = P3(ua, D, za + i * 0.2);
          const h = P3(ua + cw, D, za + i * 0.2);
          ln(p.c, g[0], g[1], h[0], h[1], i % 2 ? ply[1] : ply[4]);
        }
        // an item in the cubby
        const [x, y] = P3(ua + cw / 2, D * 0.5, za + 0.5);
        const it = Math.floor(Rn(r * 7 + cI, 4) * items.length);
        layer(p.c, (l) => items[it](l, x, y, r * cols + cI), { outline: 0.55, rect: [x - 20, y - 34, x + 20, y + 6] });
      }
    // the top board and the dividers (their lit faces)
    for (let cI = 0; cI <= cols; cI++) {
      const u = u0 + cI * cw;
      for (let r = 0; r < rows; r++) {
        const za = z0 + r * rh + 0.5;
        const zb = z0 + (r + 1) * rh;
        const a = P3(u, 0, za);
        const b = P3(u, D, za);
        const c = P3(u, D, zb);
        const d = P3(u, 0, zb);
        fillPoly(p.c, [a, b, c, d], ply[light ? 2 : 3]);
        ln(p.c, b[0], b[1], c[0], c[1], ply[5]);
      }
    }
    const ta = P3(u0, 0, z1 + 0.6);
    const tb = P3(u1, 0, z1 + 0.6);
    const tc = P3(u1, D, z1 + 0.6);
    const td = P3(u0, D, z1 + 0.6);
    fillPoly(p.c, [ta, tb, tc, td], ply[5]);
    const te = P3(u1, D, z1);
    const tf = P3(u0, D, z1);
    fillPoly(p.c, [td, tc, te, tf], ply[3]);
    void plyEdge;
  },
};

/** A screen-printed surf poster taped up with washi tape. */
const poster: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const col = k.wp.color ?? '#5b8def';
    const u0 = k.wp.at + 0.16;
    const u1 = k.wp.at + 0.84;
    const z0 = 13;
    const z1 = 29;
    pq(p, pl, u0 + 0.04, u1 + 0.04, z0 - 0.5, z1 - 0.5, 'rgba(60,40,40,0.2)');
    pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => {
      const W = (u1 - u0) * 71.6;
      const Hh = (z1 - z0) * 4;
      const U = u / W;
      const V = v / Hh;
      if (U < 0.05 || U > 0.95 || V < 0.04 || V > 0.96) return '#f6f0e4';
      // a sun, a big curling wave, text lines
      const s = Math.hypot((U - 0.66) * 1.2, V - 0.76);
      if (s < 0.12) return '#f2902a';
      const wave = 0.42 + Math.sin(U * 5.5 + 0.6) * 0.1;
      const curl = Math.hypot(U - 0.32, V - 0.5);
      if ((V < wave && V > 0.18) || (curl < 0.14 && curl > 0.07 && U < 0.42)) return (Math.floor(u / 2) + Math.floor(v / 2)) % 5 === 0 ? lighten(col, 0.6) : '#f6f0e4';
      if (V < 0.14 && V > 0.06 && U > 0.15 && U < 0.85 && Math.floor(u / 3) % 3 !== 2) return '#f6f0e4';
      void x;
      void y;
      return col;
    }, pl.light);
    // washi tape at the corners, a curling corner
    for (const [u, z, c] of [[u0, z1, '#f0a6c0'], [u1, z1, '#f2da74'], [u0, z0, '#7ac7bb']] as const) {
      const [x, y] = pl.F(u, z);
      fillPoly(p.c, [[x - 6, y - 3], [x + 5, y - 6], [x + 7, y - 1], [x - 4, y + 2]], c);
    }
    const [cx, cy] = pl.F(u1, z0);
    fillPoly(p.c, [[cx, cy], [cx - 8, cy - 2], [cx - 2, cy - 8]], '#fbf8f0');
  },
};

/** A neon on clear acrylic: a pink wave and a little yellow sun. */
const NEON_PATH: [number, number][] = [];
for (let i = 0; i <= 20; i++) NEON_PATH.push([0.12 + (i / 20) * 0.7, 24.5 + Math.sin((i / 20) * Math.PI * 2.4) * 1.8]);
const neon: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at;
    pq(p, pl, u0 + 0.06, u0 + 0.94, 20, 30.4, 'rgba(230,240,245,0.35)');
    for (const [u, z] of [[0.1, 29.6], [0.9, 29.6], [0.1, 20.6], [0.9, 20.6]] as const) {
      const [x, y] = pl.F(u0 + u, z);
      px(p.c, x - 1, y - 1, ALU[4], 2, 2);
    }
    for (let i = 0; i + 1 < NEON_PATH.length; i++) {
      const [x0, y0] = pl.F(u0 + NEON_PATH[i][0], NEON_PATH[i][1]);
      const [x1, y1] = pl.F(u0 + NEON_PATH[i + 1][0], NEON_PATH[i + 1][1]);
      ln(p.c, x0, y0 + 1, x1, y1 + 1, '#6a2a48', 2);
    }
    const [sx, sy] = pl.F(u0 + 0.72, 27.6);
    ell(p.c, sx, sy + 1, 5, 5, '#6a5a20');
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at;
    const u = p.k / 4;
    const flick = Math.sin(k.t * 17 + k.seed) > 0.97 ? 0.4 : 1;
    p.c.globalAlpha = 0.16 * flick;
    const [gx, gy] = pl.F(u0 + 0.5, 25);
    ell(p.c, gx, gy, 46 * u, 26 * u, '#ff6aa8');
    p.c.globalAlpha = 1;
    for (let i = 0; i + 1 < NEON_PATH.length; i++) {
      const [x0, y0] = pl.F(u0 + NEON_PATH[i][0], NEON_PATH[i][1]);
      const [x1, y1] = pl.F(u0 + NEON_PATH[i + 1][0], NEON_PATH[i + 1][1]);
      ln(p.c, x0, y0, x1, y1, flick < 1 ? '#c85a88' : '#ff9ac8', Math.max(1, Math.round(2 * u)));
      ln(p.c, x0, y0, x1, y1, '#ffe8f2', 1);
    }
    const [sx, sy] = pl.F(u0 + 0.72, 27.6);
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      px(p.c, sx + Math.cos(t) * 5 * u, sy + Math.sin(t) * 5 * u, '#ffe27a', Math.max(1, u), Math.max(1, u));
    }
  },
};

/** A fish surfboard on two pine pegs. */
const surfboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const uc = k.wp.at + 0.5;
    const z0 = 9;
    const z1 = 30;
    const cols = [['#e06a4a', '#f6eedc'], ['#7ac7bb', '#f6eedc'], ['#f2da74', '#2a5a7a']][k.seed % 3];
    for (let z = z0; z <= z1; z += 0.25) {
      const t = (z - z0) / (z1 - z0);
      const half = 0.2 * Math.sqrt(Math.max(0, Math.sin(Math.min(1, t * 1.08 + 0.04) * Math.PI))) * (t < 0.08 ? 0.75 : 1);
      if (half < 0.01) continue;
      const [x0, y0] = pl.F(uc - half, z);
      const [x1] = pl.F(uc + half, z);
      const swallow = t < 0.06 && Math.abs(0) < 1;
      const col = t > 0.52 && t < 0.58 ? cols[1] : t < 0.52 ? cols[0] : cols[1];
      px(p.c, Math.min(x0, x1), y0, col, Math.max(1, Math.abs(x1 - x0)), 2);
      px(p.c, Math.min(x0, x1), y0, lighten(col, 0.3), 2, 2);
      px(p.c, Math.max(x0, x1) - 2, y0, darken(col, 0.18), 2, 2);
      void swallow;
    }
    // the stringer and a fin's shadow, the pegs
    const [sx0, sy0] = pl.F(uc, z0 + 1);
    const [sx1, sy1] = pl.F(uc, z1 - 1);
    ln(p.c, sx0, sy0, sx1, sy1, '#a8784a');
    for (const z of [14, 25]) {
      const [x, y] = pl.F(uc + 0.26, z);
      px(p.c, x - 2, y - 2, BEECH[2], 5, 4);
      px(p.c, x - 2, y - 2, BEECH[4], 5, 1);
    }
  },
};

/** A pegboard of tools. */
const pegboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + 0.88;
    const z0 = 12;
    const z1 = 26;
    pq(p, pl, u0 + 0.04, u1 + 0.04, z0 - 0.5, z1 - 0.5, 'rgba(60,40,40,0.2)');
    pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => {
      if (u % 7 < 1.4 && v % 6 < 1.4 && u > 3 && v > 3) return '#3a2a20';
      return at(['#a07a52', '#b48c62', '#c49e72', '#d2ae82', '#dfbe94'], (light ? 3 : 2) + (hash(x, y, 81) < 0.08 ? -1 : 0));
    }, light);
    const F = (u: number, z: number) => pl.F(u0 + u * (u1 - u0), z);
    // scissors
    const [sx, sy] = F(0.2, 23);
    ln(p.c, sx, sy, sx + 2, sy + 12, ALU[4], 2);
    ln(p.c, sx + 4, sy, sx + 2, sy + 12, ALU[3], 2);
    ell(p.c, sx - 1, sy + 13, 3, 3, '#e06a4a');
    ell(p.c, sx + 5, sy + 13, 3, 3, '#e06a4a');
    // a steel rule, tape rolls, brushes, a cutter
    const [rx, ry] = F(0.42, 24);
    px(p.c, rx - 1, ry, ALU[5], 3, 30);
    for (let i = 0; i < 10; i++) px(p.c, rx - 1, ry + 2 + i * 3, GEAR[3], 2, 1);
    for (const [u, col] of [[0.62, '#f0a6c0'], [0.84, '#e8b03e']] as const) {
      const [tx, ty] = F(u, 22.4);
      ell(p.c, tx, ty, 5, 5, col);
      ell(p.c, tx, ty, 2.4, 2.4, '#8a6a3a');
    }
    for (let i = 0; i < 3; i++) {
      const [bx, by] = F(0.58 + i * 0.12, 18.6);
      ln(p.c, bx, by, bx, by + 12, BEECH[3], 2);
      px(p.c, bx - 1, by + 12, ALU[4], 3, 2);
      px(p.c, bx - 1, by + 14, ['#3a3036', '#e06a4a', '#2a8a86'][i], 3, 4);
    }
    const [cx, cy] = F(0.24, 16);
    px(p.c, cx - 1, cy, '#e8b03e', 3, 10);
    px(p.c, cx, cy - 3, ALU[5], 1, 3);
    void k;
  },
};

/** A pine shelf on brackets: a big trailing pothos, a jug, a little framed photo. */
const plantShelf: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + 0.92;
    const z = 21;
    const a = out3(p, side, u0, 0, z);
    const b = out3(p, side, u1, 0, z);
    const c = out3(p, side, u1, 0.3, z);
    const d = out3(p, side, u0, 0.3, z);
    // brackets under the shelf
    for (const u of [u0 + 0.16, u1 - 0.16]) {
      const q0 = out3(p, side, u, 0, z - 0.4);
      const q1 = out3(p, side, u, 0.24, z - 0.4);
      const q2 = out3(p, side, u, 0, z - 5);
      fillPoly(p.c, [q0, q1, q2], PINE[light ? 2 : 3]);
    }
    fillPoly(p.c, [a, b, c, d], PINE[5]);
    const e = out3(p, side, u1, 0.3, z - 1);
    const f = out3(p, side, u0, 0.3, z - 1);
    fillPoly(p.c, [d, c, e, f], PINE[3]);
    layer(p.c, (l) => {
      const [jx, jy] = out3(p, side, u0 + 0.2, 0.15, z);
      fillPoly(l, [[jx - 5, jy], [jx + 5, jy], [jx + 6, jy - 7], [jx + 3, jy - 13], [jx - 3, jy - 13], [jx - 6, jy - 7]], '#e8b03e');
      fillPoly(l, [[jx - 5, jy], [jx - 2, jy], [jx - 2, jy - 13], [jx - 3, jy - 13], [jx - 6, jy - 7]], '#f6d070');
      const [fx, fy] = out3(p, side, u0 + 0.46, 0.08, z);
      fillPoly(l, [[fx - 5, fy], [fx + 5, fy - 2], [fx + 5, fy - 14], [fx - 5, fy - 12]], '#2a2a30');
      fillPoly(l, [[fx - 4, fy - 1], [fx + 4, fy - 3], [fx + 4, fy - 13], [fx - 4, fy - 11]], '#7ab8d0');
      fillPoly(l, [[fx - 4, fy - 1], [fx + 4, fy - 3], [fx + 4, fy - 6], [fx - 4, fy - 4]], '#e8c890');
      const [px0, py0] = out3(p, side, u1 - 0.2, 0.15, z);
      const top = pot(l, px0, py0, 7, 9, 'stripe', k.seed);
      pothos(l, px0, top, k.seed + 3);
    }, { outline: 0.6 });
  },
};

/** A wire with binder-clipped sketches and prints. */
const sketches: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.06;
    const u1 = k.wp.at + 0.94;
    const z = 27;
    const [x0, y0] = pl.F(u0, z);
    const [x1, y1] = pl.F(u1, z);
    ln(p.c, x0, y0, x1, y1, '#8a8e96');
    px(p.c, x0 - 1, y0 - 1, ALU[4], 3, 3);
    px(p.c, x1 - 1, y1 - 1, ALU[4], 3, 3);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const u = u0 + 0.14 + i * ((u1 - u0 - 0.28) / (n - 1));
      const sag = Math.sin(((i + 0.5) / n) * Math.PI) * 0.5;
      const w = 0.2;
      const h = 7 + (i % 2) * 2;
      const zz = z - sag;
      pq(p, pl, u - w / 2 + 0.02, u + w / 2 + 0.02, zz - h - 0.4, zz - 0.4, 'rgba(60,40,40,0.18)');
      pq(p, pl, u - w / 2, u + w / 2, zz - h, zz, i === 1 ? '#fbf3e0' : '#f8f6f0');
      const [cx, cy] = pl.F(u, zz - h * 0.45);
      if (i === 0) {
        for (let a = 0; a < 18; a++) px(p.c, cx + Math.cos((a / 18) * Math.PI * 2) * 5, cy + Math.sin((a / 18) * Math.PI * 2) * 6, '#3a3036');
        px(p.c, cx - 2, cy - 1, '#3a3036', 1, 1);
        px(p.c, cx + 2, cy - 1, '#3a3036', 1, 1);
        ln(p.c, cx - 2, cy + 3, cx + 2, cy + 3, '#e06a4a');
      } else if (i === 1) {
        ell(p.c, cx, cy, 6, 4, '#7ac7bb');
        ln(p.c, cx - 8, cy + 6, cx + 8, cy + 2, '#2a5a8a');
        ln(p.c, cx - 6, cy + 9, cx + 5, cy + 6, '#2a5a8a');
      } else {
        for (let j = 0; j < 4; j++) ln(p.c, cx - 6, cy - 6 + j * 4, cx + 5, cy - 8 + j * 4, j % 2 ? '#e06a4a' : '#3a3036');
      }
      const [bx, by] = pl.F(u, zz);
      px(p.c, bx - 2, by - 1, GEAR[2], 5, 3);
      px(p.c, bx - 1, by - 4, ALU[4], 1, 3);
      px(p.c, bx + 1, by - 4, ALU[4], 1, 3);
    }
    void k;
  },
};

/** A round mirror in a rattan sunburst frame. */
const mirror: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [cx, cy] = pl.F(k.wp.at + 0.5, 23);
    const RT = ['#5a3c22', '#7a5430', '#9a6e40', '#b88a54', '#d0a46a', '#e4be86'];
    layer(p.c, (l) => {
      for (let i = 0; i < 28; i++) {
        const t = (i / 28) * Math.PI * 2;
        const r1 = i % 2 ? 26 : 22;
        ln(l, cx + Math.cos(t) * 13, cy + Math.sin(t) * 14, cx + Math.cos(t) * r1, cy + Math.sin(t) * (r1 + 1), RT[i % 3 === 0 ? 4 : 2], 2);
      }
      ell(l, cx, cy, 15, 16, RT[1]);
      ell(l, cx, cy, 14, 15, RT[3]);
      ell(l, cx, cy, 11, 12, '#b8c4c8');
      ell(l, cx + 1, cy + 2, 9, 9, '#d6c4b0');
      ell(l, cx - 3, cy - 4, 6, 5, '#eef4f4');
      ln(l, cx - 7, cy + 2, cx + 1, cy - 8, '#ffffff');
    }, { outline: 0.55 });
    void k;
  },
};

/** The mug shelf over the coffee bar: hooks of mugs, jars, a chalk menu. */
const mugShelf: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.15;
    const u1 = k.wp.at + k.wp.w - 0.15;
    // the chalkboard menu
    pq(p, pl, u0 + 0.3, u1 - 0.3, 25.5, 33, PINE[light ? 3 : 2]);
    pq(p, pl, u0 + 0.36, u1 - 0.36, 26.1, 32.4, '#2a302c');
    const L = u1 - u0 - 0.84;
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = pl.F(u0 + 0.46, 31 - i * 1.4);
      const [x1, y1] = pl.F(u0 + 0.46 + L * (0.5 + hash(i, 1, 5) * 0.35), 31 - i * 1.4);
      ln(p.c, x0, y0, x1, y1, i === 0 ? '#f2c86a' : '#f2efe6');
      const [px1, py1] = pl.F(u1 - 0.5, 31 - i * 1.4);
      px(p.c, px1 - 2, py1, '#f2efe6', 3, 1);
    }
    // the shelf
    const z = 19;
    const a = out3(p, side, u0, 0, z);
    const b = out3(p, side, u1, 0, z);
    const c = out3(p, side, u1, 0.28, z);
    const d = out3(p, side, u0, 0.28, z);
    fillPoly(p.c, [a, b, c, d], PINE[5]);
    const e = out3(p, side, u1, 0.28, z - 1);
    const f = out3(p, side, u0, 0.28, z - 1);
    fillPoly(p.c, [d, c, e, f], PINE[3]);
    layer(p.c, (l) => {
      // jars of beans and tea on top
      for (let i = 0; i < 4; i++) {
        const [x, y] = out3(p, side, u0 + 0.2 + i * 0.22, 0.14, z);
        px(l, x - 5, y - 11, '#d8eaee', 10, 11);
        px(l, x - 4, y - 8, ['#5a3420', '#c8a050', '#2a4a2a', '#e8d8b0'][i], 8, 7);
        px(l, x - 5, y - 13, ['#e06a4a', '#2a8a86', '#e8b03e', '#3a3036'][i], 10, 2);
        px(l, x - 5, y - 11, '#f2fbfd', 1, 10);
      }
      // mugs hung on hooks under the shelf
      for (let i = 0; i < 5; i++) {
        const [x, y] = out3(p, side, u0 + 0.16 + i * 0.2, 0.2, z - 1);
        const col = ['#e06a4a', '#f2ece0', '#2a8a86', '#e8b03e', '#f0a6c0'][i];
        px(l, x, y, ALU[2], 1, 4);
        px(l, x - 1, y + 3, ALU[2], 3, 1);
        px(l, x - 4, y + 5, col, 8, 7);
        px(l, x - 4, y + 5, lighten(col, 0.25), 1, 7);
        px(l, x + 4, y + 6, darken(col, 0.2), 2, 4);
        px(l, x - 4, y + 11, darken(col, 0.3), 8, 1);
      }
    }, { outline: 0.6 });
    // fairy lights along the shelf
    for (let i = 0; i < 9; i++) {
      const u = u0 + (i / 8) * (u1 - u0);
      const [x, y] = out3(p, side, u, 0.3, z - 1.4 - Math.sin((i / 8) * Math.PI) * 1.2);
      px(p.c, x, y, '#ffe8a0', 2, 2);
    }
  },
  anim(p, side, k) {
    const u0 = k.wp.at + 0.15;
    const u1 = k.wp.at + k.wp.w - 0.15;
    const u = p.k / 4;
    for (let i = 0; i < 9; i++) {
      if (Math.sin(k.t * 2 + i * 1.3) < 0.3) continue;
      const uu = u0 + (i / 8) * (u1 - u0);
      const [x, y] = out3(p, side, uu, 0.3, 19 - 1.4 - Math.sin((i / 8) * Math.PI) * 1.2);
      p.c.globalAlpha = 0.3;
      ell(p.c, x + u, y + u, 4 * u, 4 * u, '#ffe8a0');
      p.c.globalAlpha = 1;
    }
  },
};

export const STUDIO_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: { window, backdrop, moodboard, door, assetwall, poster, neon, surfboard, pegboard, plantShelf, sketches, mirror, mugShelf },
};

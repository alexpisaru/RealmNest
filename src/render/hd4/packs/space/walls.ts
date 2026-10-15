// Space — the module's back walls. Gunmetal kick plates, a band of riveted rack
// fronts, an amber handrail, quilted pads between structural ribs, a glowing
// light strip and the utility run of pipes and cable trays under the ceiling.
// The cut top shows the hull's layers: padding, gold insulation foil, the
// aluminium pressure shell and the white debris shield.
// Wall props: panoramic star windows (one looking down on the planet), a systems
// panel, the airlock hatch, and the crew's own clutter — stowage bags, an air vent
// with ribbons, wall screens, a patch board, a valve panel, the emergency kit and
// an EVA suit hanging by the airlock.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp } from '../../kit4';
import { beam, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import { lbox } from '../util';
import type { WallArt4, WallPack } from '../types';
import { ALU, AMBER, CYAN, flat, GOLD, GREEN, grille, GUN, PAD, plating, quilt, RED, SCREEN, shield, tone, WHITE } from './common';

// 1 z = 10 cm: a 4 m module ceiling next to a 1.75 m crew member
const H = 40;
const T = 0.3;

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl => (side === 'ne' ? front3(p, 0) : side3(p, 0));
/** a point standing d tiles out of the wall into the room */
const P3 = (p: PropPainter, side: 'ne' | 'nw', u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));

/** A box standing out of the wall: u along the wall, d out into the room. */
function wbox(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, d0: number, d1: number, z0: number, z1: number, m: { face?: Mat; end?: Mat; top?: Mat; edge?: string }) {
  if (side === 'ne') lbox(p, u0, d0, u1 - u0, d1 - d0, z0, z1 - z0, { front: m.face, side: m.end, top: m.top, edge: m.edge });
  else lbox(p, d0, u0, d1 - d0, u1 - u0, z0, z1 - z0, { front: m.end, side: m.face, top: m.top, edge: m.edge });
}

/** Textured rectangle on the wall with global coordinates (u in tiles, z) passed to the texture. */
function paint(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, f: (U: number, Z: number, x: number, y: number) => string | null) {
  const a = pl.F(u0, z0);
  const b = pl.F(u1, z0);
  const lu = Math.hypot(b[0] - a[0], b[1] - a[1]);
  pt(p, pl, u0, u1, z0, z1, ((u: number, v: number, x: number, y: number) => f(u0 + (u / lu) * (u1 - u0), z0 + v / 4, x, y)) as FaceTex, pl.light);
}

// ── the bare wall ────────────────────────────────────────────
/** Rack fronts: one-tile panels, Dzus fasteners in the corners, small labels. */
/** warm off-white rack fronts (the module's equipment racks) */
const RACK: Ramp = ['#3a4250', '#4c5664', '#5e6878', '#727d8e', '#8a94a4', '#a6aebb', '#c4cad4'];
const rackFront: Mat = (light, _w, h) => (u, v, x, y) => {
  const pw = 71.55 / 2;
  const fu = u % pw;
  const col = Math.floor(u / pw);
  let i = (light ? 3.2 : 2.1) + (hash(col, 3, 81) - 0.5) * 0.6;
  if (fu < 1.2) return at(RACK, i - 2.2);
  if (fu < 2.4) i += 0.8;
  if (v > h - 1.5) i += 0.7;
  if (v < 1.2) i -= 1;
  // quarter-turn fasteners
  const cu = Math.min(fu - 4, pw - 4 - fu);
  const cv = Math.min(v - 4, h - 4 - v);
  if (Math.abs(cu) < 1.2 && Math.abs(cv) < 1.2) return at(RACK, i + (cu + cv < 0 ? 1.5 : -1.5));
  // a label plate on some panels
  if (hash(col, 4, 82) < 0.55 && fu > pw * 0.3 && fu < pw * 0.7 && v > h * 0.62 && v < h * 0.62 + 4) return v > h * 0.62 + 2.6 ? '#f2f4f6' : (Math.floor(fu) % 3 === 0 ? '#3a3f52' : '#e4e8ee');
  if (noise2(u * 0.03, v * 0.6, 83) > 0.66) i -= 0.5;
  if (hash(x, y, 84) < 0.02) i -= 0.8;
  return at(RACK, i);
};

function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  // kick plate with a floor light strip
  pt(p, pl, 0, len, 0, 1.7, flat(GUN), light);
  paint(p, pl, 0, len, 0.45, 0.85, (U) => (U * 6 - Math.floor(U * 6) < 0.55 ? CYAN[5] : CYAN[2]));
  // the rack fronts
  pt(p, pl, 0, len, 1.7, 10.2, rackFront, light);
  pq(p, pl, 0, len, 10.2, 10.8, at(GUN, light ? 1 : 0));
  // quilted pads
  pt(p, pl, 0, len, 10.8, 29, quilt(PAD, 13), light);
  // the light strip: a diffuser with a bright core
  pq(p, pl, 0, len, 28.6, 29.2, at(GUN, light ? 3 : 2));
  paint(p, pl, 0, len, 29.2, 31, (_U, Z) => (Z < 29.6 || Z > 30.6 ? '#9fd8e4' : '#eefcff'));
  pq(p, pl, 0, len, 31, 31.4, at(GUN, light ? 3 : 2));
  // utility run: a cable tray and three pipes
  pt(p, pl, 0, len, 31.4, 36.6, plating(GUN, 40, 10, 5), light);
  // the ceiling trim
  pt(p, pl, 0, len, 36.6, H, (u: number, v: number) => (v > 13 ? at(GUN, light ? 5 : 4) : v < 1.2 ? at(GUN, 0) : Math.abs((u % 9) - 4.5) < 0.8 && Math.abs(v - 7) < 0.8 ? at(GUN, 6) : at(GUN, light ? 3 : 2)), light);
  // pipes standing a little out of the wall, with brackets
  for (const [z, r] of [[32.6, AMBER], [34.2, CYAN], [35.6, ALU]] as const) beam(p, pl, 0, z, len, z, 0.55, r);
  for (let u = 0.6; u < len; u += 1.5) {
    pq(p, pl, u - 0.04, u + 0.04, 31.8, 36.4, at(GUN, light ? 4 : 3));
    pq(p, pl, u + 0.04, u + 0.06, 31.8, 36.4, at(GUN, 0));
  }
  // structural ribs every two tiles, standing proud: lit flank, body, shade flank, bolt heads
  for (let u = 2; u < len; u += 2) {
    pq(p, pl, u - 0.1, u + 0.1, 1.7, 36.6, at(GUN, light ? 3 : 2));
    pq(p, pl, u - 0.1, u - 0.07, 1.7, 36.6, at(GUN, light ? 5 : 4));
    pq(p, pl, u + 0.07, u + 0.1, 1.7, 36.6, at(GUN, 0));
    pq(p, pl, u + 0.1, u + 0.14, 1.7, 36.6, 'rgba(20,16,30,0.3)');
    for (let z = 4; z < 36; z += 4) {
      const [bx, by] = pl.F(u, z);
      px(p.c, bx - 1, by - 1, at(GUN, 6), 2, 2);
      px(p.c, bx, by, at(GUN, 1));
    }
  }
  // the handrail: amber, on brackets every 1.5 tiles
  for (let u = 0.5; u < len; u += 1.5) {
    const [a0, b0] = P3(p, side, u, 0, 11.4);
    const [a1, b1] = P3(p, side, u, 0.1, 11.4);
    ln(p.c, a0, b0, a1, b1, GUN[4], 3);
  }
  const r0 = P3(p, side, 0, 0.1, 11.4);
  const r1 = P3(p, side, len, 0.1, 11.4);
  ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, AMBER[light ? 5 : 4], 2);
  ln(p.c, r0[0], r0[1] + 1, r1[0], r1[1] + 1, AMBER[light ? 2 : 1], 2);
  // the cut top: padding, gold foil, the pressure shell, the white shield
  const top: FaceTex = (_u, v) => {
    const t = v / (T * 57.2);
    if (t < 0.2) return WHITE[5];
    if (t < 0.45) return ALU[4];
    if (t < 0.8) return hash(Math.floor(_u / 2), Math.floor(v), 85) < 0.3 ? GOLD[5] : GOLD[4];
    return PAD[5];
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], top, 2, [[-T, -T, H], [len, -T, H], [-T, 0, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], top, 2, [[-T, 0, H], [-T, len, H], [0, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The open end of a cut wall: the layers in section. */
const endCap: Mat = (light, w) => (u, v, x, y) => {
  const t = u / w;
  if (v < 1.7 * 4) return at(GUN, light ? 3 : 2);
  if (t < 0.18) return at(PAD, light ? 4 : 3);
  if (t < 0.5) return at(GOLD, (light ? 4 : 3) + (hash(x >> 1, y, 86) < 0.3 ? 1 : 0));
  if (t < 0.75) return at(ALU, light ? 4 : 3);
  return at(WHITE, light ? 5 : 4);
};

// ── the view through the windows ─────────────────────────────
const sky = ['#050c12', '#08141c', '#0c1c26', '#122630'];
/** Deep space: stars, a faint galactic band, nebula dust; seeded per wall. */
function starView(U: number, Z: number, x: number, y: number, seed: number): string {
  const X = U * 71.55 + seed * 311;
  const Y = Z * 4;
  const band = Math.abs((Y - X * 0.35 - 40 - seed * 9) / 60);
  const dense = Math.max(0, 1 - band);
  const h = hash(x, y, 91 + seed);
  if (h < 0.004 + dense * 0.012) return h < 0.0015 ? '#ffffff' : h < 0.003 ? '#c4ccf0' : '#7a86b0';
  const cx = Math.floor(X / 14);
  const cy = Math.floor(Y / 14);
  if (hash(cx, cy, 92) < 0.12) {
    const sx = cx * 14 + 3 + Math.floor(hash(cx, cy, 93) * 8);
    const sy = cy * 14 + 3 + Math.floor(hash(cx, cy, 94) * 8);
    const dx = Math.round(X - sx);
    const dy = Math.round(Y - sy);
    if (dx === 0 && dy === 0) return '#ffffff';
    if (Math.abs(dx) + Math.abs(dy) === 1) return '#8a96c0';
  }
  const n = noise2(X / 60, Y / 40, 95);
  if (n * (0.6 + dense) > 0.75) return bayer(x, y) > 0.5 ? '#251a44' : '#1a2a3a';
  return sky[Math.min(3, Math.floor(dense * 2.2 + bayer(x, y) * 0.9))];
}

/** Looking down at the planet: ocean and clouds below a curved limb, a blue glow, stars above. */
function planetView(U: number, Z: number, x: number, y: number, u0: number, u1: number): string {
  const um = (u0 + u1) / 2;
  const X = (U - um) * 71.55;
  // the limb: a wide arc, highest in the middle of the window
  const limb = 22 + (X * X) / 2600;
  const dz = limb - Z * 4 + 40;
  const d = bayer(x, y);
  if (dz < -6) return starView(U, Z, x, y, 7);
  if (dz < -1) return d < (dz + 6) / 5 ? '#4a98da' : '#174a8a';
  if (dz < 2) return '#b4e0fc';
  if (dz < 5) return '#7cc0f0';
  // the surface, compressed toward the limb
  const depth = Math.sqrt(Math.max(0, dz)) * 9;
  const sx = X * 0.06;
  const sy = depth * 0.12;
  const cloud = noise2(sx * 0.8 + 3, sy * 2.2, 96) * 0.6 + noise2(sx * 2.4, sy * 5, 97) * 0.4;
  const land = noise2(sx * 0.5 + 11, sy * 0.9 + 2, 98) * 0.7 + noise2(sx * 1.6, sy * 2.4, 99) * 0.3;
  const haze = dz < 14 && d * 14 > dz;
  if (haze) return '#4a98da';
  if (cloud > 0.6) return cloud > 0.68 ? '#f2f5fa' : d > 0.4 ? '#dce2ec' : '#98a4ba';
  if (land > 0.6) return land > 0.66 ? '#74864a' : d > 0.5 ? '#56703a' : '#94985a';
  return ['#143268', '#1a4080', '#225096', '#2c62aa'][Math.min(3, Math.floor((1 - dz / 120) * 3 + d * 0.8))];
}

// ── wall props ───────────────────────────────────────────────
/** One pane of an observation window: housing, rounded frame, glass with the view and reflections. */
function pane(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, z0: number, z1: number, view: (U: number, Z: number, x: number, y: number) => string, shutter: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  const rc = 0.16; // corner radius in tiles (and ×10 in z)
  const rounded = (a0: number, a1: number, b0: number, b1: number, r: number) => {
    const pts: [number, number][] = [];
    const corner = (cu: number, cz: number, s: number) => {
      for (let i = 0; i <= 4; i++) {
        const t = s + (i / 4) * (Math.PI / 2);
        pts.push([cu + Math.cos(t) * r, cz + Math.sin(t) * r * 10]);
      }
    };
    corner(a1 - r, b0 + r * 10, -Math.PI / 2);
    corner(a1 - r, b1 - r * 10, 0);
    corner(a0 + r, b1 - r * 10, Math.PI / 2);
    corner(a0 + r, b0 + r * 10, Math.PI);
    return pts.map(([u, z]) => pl.at(u, z));
  };
  // housing (dark), the bright frame, a shadowed reveal, the glass
  poly3(p, rounded(u0 - 0.12, u1 + 0.12, z0 - 1.4, z1 + 1.4, rc + 0.08), (_u: number, _v: number, x: number, y: number) => at(GUN, (light ? 3 : 2) + (hash(x, y, 101) < 0.04 ? -1 : 0)), light);
  // the frame: a lit cyan bezel (the reference's glowing screens-and-windows look)
  poly3(p, rounded(u0 - 0.05, u1 + 0.05, z0 - 0.6, z1 + 0.6, rc + 0.03), (_u: number, v: number) => at(CYAN, (light ? 4 : 3) + (v > 4 ? 0 : -1)), light);
  poly3(p, rounded(u0, u1, z0, z1, rc), (_u: number, _v: number) => at(GUN, 0), light);
  const glass = rounded(u0 + 0.03, u1 - 0.03, z0 + 0.3, z1 - 0.3, rc - 0.02);
  const a = pl.F(u0, z0);
  const b = pl.F(u1, z0);
  const lu = Math.hypot(b[0] - a[0], b[1] - a[1]);
  poly3(p, glass, ((u: number, v: number, x: number, y: number) => view(u0 + (u / lu) * (u1 - u0), z0 + v / 4, x, y)) as FaceTex, light, [pl.at(u0, z0), pl.at(u1, z0), pl.at(u0, z1)]);
  // the debris shutter, partly lowered, its slats lit from above
  if (shutter > 0) {
    const zs = z1 - 0.3 - shutter;
    poly3(p, rounded(u0 + 0.03, u1 - 0.03, zs, z1 - 0.3, 0.04), (_u: number, v: number) => at(WHITE, (light ? 3 : 2) + ((v % 6) < 1.2 ? -1.5 : (v % 6) > 4.5 ? 0.8 : 0)), light);
    pq(p, pl, u0 + 0.03, u1 - 0.03, zs - 0.3, zs, at(GUN, 1));
  }
  // reflections: two pale diagonals across the glass
  p.c.globalAlpha = 0.22;
  poly3(p, glass, (u: number, v: number) => ((u * 0.9 + v) % 46 < 5 || (u * 0.9 + v) % 46 > 43 ? '#e8f4ff' : null), light);
  p.c.globalAlpha = 1;
  // bolts round the frame
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const uu = u0 - 0.085 + (u1 - u0 + 0.17) * (i < 4 ? t * 2 : (t - 0.5) * 2);
    for (const z of [z0 - 1, z1 + 1]) {
      const [bx, by] = pl.F(Math.min(u1 + 0.05, Math.max(u0 - 0.05, uu)), z);
      px(p.c, bx, by, at(ALU, 6));
    }
  }
}

const starwindow: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    const planet = k.wp.variant === 'planet';
    const pl = planeOf(p, side);
    const n = Math.max(1, Math.round(w / 1.7));
    const span = w / n;
    const z0 = 9.2;
    const z1 = 27.6;
    const view = planet ? (U: number, Z: number, x: number, y: number) => planetView(U, Z, x, y, a0, a0 + w) : (U: number, Z: number, x: number, y: number) => starView(U, Z, x, y, k.seed);
    // a common sill: padded edge, an instrument shelf
    wbox(p, side, a0 + 0.05, a0 + w - 0.05, 0, 0.28, 7.2, 8.2, { face: flat(GUN), end: flat(GUN), top: quilt(PAD, 9), edge: GUN[0] });
    for (let i = 0; i < n; i++) {
      const c0 = a0 + span * i + 0.16;
      const c1 = a0 + span * (i + 1) - 0.16;
      pane(p, side, c0, c1, z0, z1, view, !planet && i === n - 1 ? 3.2 : planet && i === 0 ? 1.6 : 0);
    }
    // labels over the window
    const [lx, ly] = pl.F(a0 + w / 2, z1 + 2.4);
    px(p.c, lx - 14, ly - 2, '#0c1018', 28, 5);
    for (let i = 0; i < 6; i++) px(p.c, lx - 12 + i * 4, ly - 1, i === 0 ? CYAN[5] : '#c8d0dc', 3, 3);
    // on the sill: a camera with a long lens (planet) or a little potted succulent and a tablet
    if (planet) {
      const [cx, cy] = P3(p, side, a0 + w * 0.62, 0.15, 8.2);
      layer(p.c, (l) => {
        px(l, cx - 8, cy - 9, '#1a1c22', 14, 9);
        px(l, cx - 8, cy - 9, '#3a3e48', 14, 2);
        px(l, cx - 3, cy - 12, '#2a2c34', 6, 3);
        ell(l, cx + 9, cy - 5, 5, 4, '#1a1c22');
        px(l, cx + 7, cy - 8, '#2a2c34', 10, 6);
        ell(l, cx + 17, cy - 5, 4, 4, '#3a4a6a');
        px(l, cx + 16, cy - 7, '#8aa8d8', 2, 2);
        px(l, cx - 6, cy - 7, RED[4], 2, 1);
      }, { rect: [cx - 12, cy - 16, cx + 24, cy + 2] });
      const [tx, ty] = P3(p, side, a0 + w * 0.25, 0.14, 8.2);
      layer(p.c, (l) => {
        fillPoly(l, [[tx - 9, ty - 1], [tx + 3, ty - 6], [tx + 10, ty - 3], [tx - 2, ty + 2]], '#20242e');
        fillPoly(l, [[tx - 7, ty - 1], [tx + 3, ty - 5], [tx + 8, ty - 3], [tx - 2, ty + 1]], '#3a6aa0');
      }, { rect: [tx - 12, ty - 8, tx + 12, ty + 4] });
    } else {
      const [sx, sy] = P3(p, side, a0 + 0.45 + (k.seed % 2) * (w - 0.9), 0.14, 8.2);
      layer(p.c, (l) => {
        px(l, sx - 5, sy - 7, '#d8dce4', 10, 7);
        px(l, sx - 5, sy - 7, '#f2f4f8', 2, 7);
        const m: Mass[] = [{ x: sx - 3, y: sy - 10, rx: 4, ry: 3, z: 0 }, { x: sx + 3, y: sy - 11, rx: 4, ry: 3, z: 1 }, { x: sx, y: sy - 13, rx: 3.5, ry: 3, z: 2 }];
        foliage(l, m, ['#1e3a2e', '#28503a', '#346846', '#428052', '#549a62', '#6cb276', '#8ccc90'], k.seed + 4, { cell: 2.2 });
      }, { rect: [sx - 10, sy - 20, sx + 10, sy + 2] });
    }
  },
  anim(p, side, k) {
    // a glint of a passing satellite or a slow meteor in one pane, now and then
    const { at: a0, w } = k.wp;
    const pl = planeOf(p, side);
    const cyc = (k.t * 0.05 + k.seed * 0.37) % 1;
    if (cyc > 0.25) return;
    const t = cyc / 0.25;
    const u = a0 + 0.3 + t * (w - 0.6);
    const z = 26 - t * 6 - (k.wp.variant === 'planet' ? 3 : 0);
    const [x, y] = pl.F(u, z);
    const s = p.k / 4;
    p.c.globalAlpha = 0.9;
    px(p.c, x, y, '#ffffff', Math.max(1, s), Math.max(1, s));
    p.c.globalAlpha = 0.4;
    px(p.c, x - 2 * s, y - s, '#c4ccf0', Math.max(1, s), Math.max(1, s));
    p.c.globalAlpha = 1;
  },
};

/** The systems panel: breakers with status lights, a station schematic, a red guarded button, a checklist. */
const wallpanel: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const z0 = 11.6;
    const z1 = 26.6;
    // the housing stands a little out of the wall
    wbox(p, side, u0, u1, 0, 0.12, z0, z1, { face: flat(GUN), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    const F = side === 'ne' ? front3(p, 0.12) : side3(p, 0.12);
    pq(p, F, u0 + 0.05, u1 - 0.05, z0 + 0.5, z1 - 0.5, at(GUN, light ? 1 : 0));
    // the schematic screen in the middle
    const sw = Math.min(1.1, (u1 - u0) * 0.45);
    const sc0 = (u0 + u1) / 2 - sw / 2;
    pq(p, F, sc0 - 0.04, sc0 + sw + 0.04, z0 + 6.8, z1 - 1.2, at(GUN, 3));
    pq(p, F, sc0, sc0 + sw, z0 + 7.2, z1 - 1.6, SCREEN);
    // station schematic: modules as boxes joined by a truss line
    const L = (ua: number, za: number, ub: number, zb: number, col: string) => {
      const [x0, y0] = F.F(ua, za);
      const [x1, y1] = F.F(ub, zb);
      ln(p.c, x0, y0, x1, y1, col);
    };
    const zc = (z0 + 7.2 + z1 - 1.6) / 2;
    L(sc0 + 0.08, zc, sc0 + sw - 0.08, zc, CYAN[3]);
    for (let i = 0; i < 4; i++) {
      const uu = sc0 + 0.14 + i * (sw - 0.28) / 3;
      pq(p, F, uu - 0.05, uu + 0.05, zc - 0.8, zc + 0.8, i === 2 ? AMBER[4] : CYAN[4]);
    }
    pq(p, F, sc0 + 0.06, sc0 + 0.22, zc + 2, zc + 3, CYAN[2]);
    pq(p, F, sc0 + sw - 0.22, sc0 + sw - 0.06, zc - 3, zc - 2, CYAN[2]);
    // rows of breakers either side
    for (const [ua, ub] of [[u0 + 0.12, sc0 - 0.1], [sc0 + sw + 0.1, u1 - 0.12]] as const) {
      if (ub - ua < 0.15) continue;
      const n = Math.max(1, Math.floor((ub - ua) / 0.11));
      for (let r = 0; r < 4; r++) {
        const z = z0 + 2 + r * 3.1;
        for (let i = 0; i < n; i++) {
          const uu = ua + i * ((ub - ua) / n);
          pq(p, F, uu, uu + 0.07, z, z + 1.8, at(GUN, 4));
          pq(p, F, uu + 0.015, uu + 0.055, z + 0.9, z + 1.6, '#d8dce4');
          const [lx, ly] = F.F(uu + 0.035, z + 2.4);
          px(p.c, lx, ly, hash(i, r, k.seed) < 0.15 ? AMBER[5] : GREEN[4]);
        }
      }
    }
    // the red guarded button and a checklist on velcro
    const [bx, by] = F.F(sc0 + sw * 0.5, z0 + 3.2);
    layer(p.c, (l) => {
      px(l, bx - 6, by - 6, '#e8c020', 12, 10);
      px(l, bx - 6, by - 6, '#1a1a20', 12, 1);
      ell(l, bx, by - 1, 3.5, 3, RED[3]);
      px(l, bx - 1, by - 3, RED[6], 2, 1);
      px(l, bx - 5, by - 9, '#d8e8f0', 10, 3);
    }, { rect: [bx - 8, by - 12, bx + 8, by + 6] });
    const [cx, cy] = F.F(u1 - 0.18, z0 + 0.6);
    layer(p.c, (l) => {
      fillPoly(l, [[cx - 7, cy - 22], [cx + 5, cy - 25], [cx + 6, cy - 3], [cx - 6, cy]], '#f4f0e4');
      for (let i = 0; i < 6; i++) ln(l, cx - 5, cy - 19 + i * 3, cx + 4, cy - 21 + i * 3, '#8a90a0');
      px(l, cx - 2, cy - 26, '#3a3e48', 4, 3);
      ln(l, cx + 6, cy - 6, cx + 9, cy + 6, '#2a6ab8');
    }, { rect: [cx - 10, cy - 30, cx + 12, cy + 8] });
    void light;
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const F = side === 'ne' ? front3(p, 0.12) : side3(p, 0.12);
    const sw = Math.min(1.1, (u1 - u0) * 0.45);
    const sc0 = (u0 + u1) / 2 - sw / 2;
    // a sweep line over the schematic and a blinking alarm
    const t = (k.t * 0.4 + k.seed * 0.1) % 1;
    const s = Math.max(1, Math.round(p.k / 4));
    const [x0, y0] = F.F(sc0 + 0.02 + t * (sw - 0.04), 11.6 + 7.4);
    const [, y1] = F.F(sc0 + 0.02 + t * (sw - 0.04), 26.6 - 1.8);
    p.c.globalAlpha = 0.5;
    px(p.c, x0, y1, CYAN[5], s, Math.max(1, y0 - y1));
    p.c.globalAlpha = 1;
    if (Math.sin(k.t * 4 + k.seed) > 0.2) {
      const [ax, ay] = F.F(sc0 + 0.14 + 2 * (sw - 0.28) / 3, 19.2);
      px(p.c, ax - s, ay - s, AMBER[6], 2 * s, 2 * s);
    }
    void pl;
  },
};

/** The airlock hatch: a hazard-striped collar, the rounded door with a porthole, latches, status light. */
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const light = pl.light;
    const u0 = k.wp.at;
    const u1 = k.wp.at + k.wp.w;
    const um = (u0 + u1) / 2;
    const hw = (u1 - u0) / 2;
    const oct = (r: number, z0: number, z1: number, cut: number) => [pl.at(um - r + cut, z0), pl.at(um + r - cut, z0), pl.at(um + r, z0 + cut * 10), pl.at(um + r, z1 - cut * 10), pl.at(um + r - cut, z1), pl.at(um - r + cut, z1), pl.at(um - r, z1 - cut * 10), pl.at(um - r, z0 + cut * 10)];
    // collar: hazard stripes on a dark frame
    poly3(p, oct(hw - 0.02, 0, 24, 0.2), (u: number, v: number) => ((u + v) % 12 < 6 ? at(AMBER, light ? 4 : 3) : '#1c1e26'), light);
    poly3(p, oct(hw - 0.12, 0.4, 22.6, 0.16), (_u: number, _v: number, x: number, y: number) => at(GUN, (light ? 2 : 1) + (hash(x, y, 111) < 0.05 ? 1 : 0)), light);
    // the door leaf
    poly3(p, oct(hw - 0.17, 1, 22, 0.13), plating(ALU, 18, 14, 7), light);
    // the porthole
    const [hx, hy] = pl.F(um, 15.5);
    const s = p.k / 4;
    layer(p.c, (l) => {
      ell(l, hx, hy, 10 * s, 12 * s, GUN[1]);
      ell(l, hx, hy, 8 * s, 10 * s, ALU[5]);
      ell(l, hx, hy, 6.5 * s, 8.5 * s, '#121a26');
      ell(l, hx - 2 * s, hy - 3 * s, 2.5 * s, 3 * s, '#3a5a78');
      px(l, hx - 3 * s, hy - 5 * s, '#a8c8e8', 2, 2);
    }, { rect: [hx - 14 * s, hy - 16 * s, hx + 14 * s, hy + 16 * s] });
    // latch dogs round the edge and the lever handle
    for (const z of [3, 8, 13, 18]) {
      for (const uu of [um - hw + 0.24, um + hw - 0.24]) {
        const [lx, ly] = pl.F(uu, z);
        px(p.c, lx - 2, ly - 1, GUN[2], 4, 3);
        px(p.c, lx - 2, ly - 1, ALU[6], 4, 1);
      }
    }
    const [gx, gy] = pl.F(um + hw * 0.35, 9.5);
    layer(p.c, (l) => {
      px(l, gx - 2, gy - 3, GUN[1], 5, 6);
      ln(l, gx, gy, gx - 12 * s, gy + 3 * s, AMBER[3], 2);
      px(l, gx - 13 * s, gy + 2 * s, AMBER[5], 3, 3);
    }, { rect: [gx - 18 * s, gy - 6, gx + 6, gy + 8 * s] });
    // the stencil above and a pressure gauge on the frame
    const [sx, sy] = pl.F(um, 25.6);
    px(p.c, sx - 13, sy - 3, '#1c1e26', 26, 6);
    for (let i = 0; i < 7; i++) px(p.c, sx - 11 + i * 3, sy - 2, '#e8ecf2', 2, 4);
    const [px0, py0] = pl.F(um - hw + 0.08, 12);
    layer(p.c, (l) => {
      ell(l, px0, py0, 4, 4, GUN[1]);
      ell(l, px0, py0, 3, 3, '#f2f4f6');
      ln(l, px0, py0, px0 + 2, py0 - 2, RED[3]);
    }, { rect: [px0 - 6, py0 - 6, px0 + 6, py0 + 6] });
  },
  anim(p, side, k) {
    // status lamp over the hatch: green, with a slow pulse
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + k.wp.w / 2, 23.4);
    const s = Math.max(1, Math.round(p.k / 4));
    const on = Math.sin(k.t * 2) > -0.6;
    px(p.c, x - 3 * s, y - s, on ? GREEN[5] : GREEN[2], 6 * s, 2 * s);
    if (on) {
      p.c.globalAlpha = 0.25;
      px(p.c, x - 5 * s, y - 3 * s, GREEN[6], 10 * s, 6 * s);
      p.c.globalAlpha = 1;
    }
  },
};

// ── the crew's clutter on the walls ──────────────────────────
/** Soft stowage bags (beige Nomex with velcro tags) strapped on with orange bungees. */
const stowage: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const NOMEX: Ramp = ['#6a6250', '#857c66', '#a0967e', '#b8ae94', '#ccc3aa', '#ddd6c0', '#ebe6d4'];
    const BLUE: Ramp = ['#1e2a48', '#2a3a62', '#384c7c', '#4a6094', '#5e76aa', '#7690c0', '#94acd4'];
    const bags: [number, number, number, number, number, Ramp][] = [
      [u0, u0 + (u1 - u0) * 0.55, 0.02, 0.34, 12.5, NOMEX],
      [u0 + (u1 - u0) * 0.5, u1, 0.02, 0.3, 12.2, k.seed % 2 ? BLUE : NOMEX],
      [u0 + 0.06, u0 + (u1 - u0) * 0.7, 0.02, 0.28, 19.6, NOMEX],
    ];
    const soft: Mat = (light, w, h) => {
      const q = quilt(NOMEX, 40)(light, w, h);
      return (u, v, x, y) => (u < 1.5 || v < 1.5 || u > w - 1.5 || v > h - 1.5 ? null : q(u, v, x, y));
    };
    for (const [a, b, d0, d1, z, r] of bags) {
      const zh = z + 6 + (r === NOMEX ? 0.6 : 0);
      wbox(p, side, a, b, d0, d1, z, zh, { face: soft, end: tone(r, -0.4), top: tone(r, 0.6), edge: r[0] });
      // a label with a barcode, a velcro tag, the handle strap
      const F = side === 'ne' ? front3(p, d1) : side3(p, d1);
      pq(p, F, a + 0.08, a + 0.3, z + 2.6, z + 4.4, '#f6f4ec');
      for (let i = 0; i < 6; i++) pq(p, F, a + 0.1 + i * 0.03, a + 0.11 + i * 0.03, z + 2.9, z + 3.7, '#2a2a30');
      pq(p, F, b - 0.3, b - 0.12, z + 3.8, z + 4.6, '#c8bfa6');
      pq(p, F, (a + b) / 2 - 0.12, (a + b) / 2 + 0.12, zh - 0.9, zh - 0.4, at(r, 1));
    }
    // two bungee cords across, hooked to the wall
    for (const z of [15.4, 22.6]) {
      const [x0, y0] = P3(p, side, u0 - 0.05, 0.36, z);
      const [x1, y1] = P3(p, side, u1 + 0.05, 0.36, z - 1.2);
      ln(p.c, x0, y0, x1, y1, AMBER[4], 2);
      ln(p.c, x0, y0 + 2, x1, y1 + 2, AMBER[2], 1);
      px(p.c, x0 - 2, y0 - 1, GUN[5], 3, 4);
      px(p.c, x1, y1 - 1, GUN[5], 3, 4);
    }
  },
};

/** An air vent with ribbons in the draught, a fire extinguisher in its bracket below. */
const vent: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const um = k.wp.at + k.wp.w / 2;
    wbox(p, side, um - 0.34, um + 0.34, 0, 0.06, 20.5, 27, { face: grille(ALU, 3), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    // the extinguisher: red cylinder, black hose and nozzle, a bracket strap
    const [x, y] = P3(p, side, um, 0.16, 11.4);
    layer(p.c, (l) => {
      px(l, x - 5, y - 30, RED[3], 10, 30);
      px(l, x - 5, y - 30, RED[5], 3, 30);
      px(l, x + 3, y - 30, RED[1], 2, 30);
      ell(l, x, y - 30, 5, 2.5, RED[4]);
      px(l, x - 2, y - 36, GUN[2], 5, 6);
      px(l, x - 6, y - 37, GUN[4], 9, 2);
      ln(l, x + 3, y - 34, x + 9, y - 20, '#1a1a20', 2);
      px(l, x - 6, y - 21, GUN[5], 12, 2);
      px(l, x - 3, y - 16, '#f2f4f6', 6, 4);
    }, { rect: [x - 10, y - 40, x + 12, y + 2] });
    void pl;
  },
  anim(p, side, k) {
    // ribbons streaming from the grille
    const um = k.wp.at + k.wp.w / 2;
    const s = p.k / 4;
    const cols = ['#e04a3c', '#f2c43a', '#46b456', '#5ec3e6'];
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = P3(p, side, um - 0.24 + i * 0.16, 0.08, 20.6);
      for (let j = 0; j < 9; j++) {
        const sway = Math.sin(k.t * 7 + i * 1.7 + j * 0.6) * (j * 0.35) * s;
        px(p.c, x0 + sway + (side === 'ne' ? -j * 0.4 * s : j * 0.4 * s), y0 + j * 1.6 * s, cols[i], Math.max(1, Math.round(s)), Math.max(1, Math.round(2 * s)));
      }
    }
  },
};

/** A wall screen on an arm: the orbit's ground track over a world map, the mission clock. */
const screen: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    // the arm from a wall plate, then the screen standing off the wall
    wbox(p, side, um - 0.08, um + 0.08, 0, 0.04, 17, 19.5, { face: flat(GUN), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    wbox(p, side, um - 0.03, um + 0.03, 0.04, 0.3, 17.8, 18.6, { face: tone(ALU), end: tone(ALU), top: tone(ALU, 1), edge: GUN[1] });
    wbox(p, side, um - 0.42, um + 0.42, 0.3, 0.36, 14.2, 22.8, { face: flat(GUN), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    const F = side === 'ne' ? front3(p, 0.36) : side3(p, 0.36);
    pq(p, F, um - 0.38, um + 0.38, 14.8, 22.2, SCREEN);
    // the map: continents in dull teal on navy
    const a = F.F(um - 0.38, 14.8);
    const b = F.F(um + 0.38, 14.8);
    const lu = Math.hypot(b[0] - a[0], b[1] - a[1]);
    pt(p, F, um - 0.36, um + 0.36, 15.2, 21.8, ((u: number, v: number) => {
      const n = noise2(u * 0.12 + k.seed, v * 0.2, 121);
      if (Math.abs(v - 13 - Math.sin((u / lu) * Math.PI * 2 + k.seed) * 8) < 0.7) return '#f2c43a';
      return n > 0.58 ? '#2a6a6a' : '#0e2238';
    }) as FaceTex, F.light);
    pq(p, F, um - 0.36, um - 0.06, 21, 21.8, '#0a1018');
    for (let i = 0; i < 5; i++) pq(p, F, um - 0.34 + i * 0.05, um - 0.31 + i * 0.05, 21.2, 21.6, CYAN[5]);
  },
  anim(p, side, k) {
    // the station's position blinking on its track
    const um = k.wp.at + k.wp.w / 2;
    const F = side === 'ne' ? front3(p, 0.36) : side3(p, 0.36);
    const t = (k.t * 0.02 + k.seed * 0.3) % 1;
    const u = um - 0.36 + t * 0.72;
    const z = 15.2 + (13 + Math.sin(t * Math.PI * 2 + k.seed) * 8) / 4;
    const [x, y] = F.F(u, z);
    const s = Math.max(1, Math.round(p.k / 4));
    if (Math.sin(k.t * 6) > -0.3) px(p.c, x - s, y - s, '#ffffff', 2 * s, 2 * s);
  },
};

/** Mission patches, family photos, a child's drawing, a plush toy floating on its string. */
const patches: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const light = pl.light;
    pq(p, pl, u0 + 0.04, u1 + 0.04, 14.4, 26.4, 'rgba(20,16,30,0.25)');
    pq(p, pl, u0, u1, 14.8, 26.8, at(GUN, light ? 3 : 2));
    pt(p, pl, u0 + 0.04, u1 - 0.04, 15.2, 26.4, (_u, _v, x, y) => at(['#2a2e48', '#323856', '#3a4062', '#42486e'], 1.6 + (hash(x, y, 131) - 0.5) * 1.4), light);
    const cols = [['#e8c040', '#2a4a8a', '#c83a3a'], ['#f2f4f6', '#3a7a5a', '#e8a33a'], ['#c83a3a', '#f2f4f6', '#2a4a8a'], ['#2a4a8a', '#e8c040', '#f2f4f6']];
    // patches: round and shield shapes with a border and a motif
    const spots: [number, number][] = [[0.22, 23.6], [0.55, 24.2], [0.36, 19.8], [0.7, 20.4], [0.2, 16.8]];
    spots.forEach(([fu, z], i) => {
      const [x, y] = pl.F(u0 + (u1 - u0) * fu, z);
      const c = cols[(i + k.seed) % cols.length];
      layer(p.c, (l) => {
        if (i % 2) {
          fillPoly(l, [[x - 6, y - 6], [x + 6, y - 6], [x + 6, y + 1], [x, y + 7], [x - 6, y + 1]], c[0]);
          fillPoly(l, [[x - 4, y - 4], [x + 4, y - 4], [x + 4, y], [x, y + 5], [x - 4, y]], c[1]);
          px(l, x - 1, y - 3, c[2], 2, 5);
        } else {
          ell(l, x, y, 7, 7, c[0]);
          ell(l, x, y, 5, 5, c[1]);
          ell(l, x + 1, y - 1, 2, 2, c[2]);
          px(l, x - 4, y + 2, '#f2f4f6', 8, 1);
        }
      }, { rect: [x - 9, y - 9, x + 9, y + 9] });
    });
    // two photos and a crayon drawing
    pq(p, pl, u1 - 0.32, u1 - 0.08, 15.8, 19, '#fbfbf6');
    pq(p, pl, u1 - 0.3, u1 - 0.1, 16.6, 18.8, '#6a9ac2');
    pq(p, pl, u1 - 0.3, u1 - 0.1, 16.6, 17.4, '#5a8a4a');
    pq(p, pl, u0 + 0.42, u0 + 0.62, 15.6, 18.2, '#fbfbf6');
    pq(p, pl, u0 + 0.44, u0 + 0.6, 16.2, 18, '#e8b88a');
    const [dx, dy] = pl.F(u0 + 0.53, 17.2);
    px(p.c, dx - 1, dy - 2, '#5a3a2a', 3, 3);
  },
  anim(p, side, k) {
    // a little plush astronaut floating on its string (the zero-g indicator)
    const pl = planeOf(p, side);
    const [hx, hy] = pl.F(k.wp.at + k.wp.w - 0.24, 26.8);
    const s = p.k / 4;
    const bob = Math.sin(k.t * 0.9 + k.seed) * 3 * s;
    const sway = Math.cos(k.t * 0.7 + k.seed) * 3 * s;
    const x = hx + sway;
    const y = hy + 16 * s + bob;
    ln(p.c, hx, hy, x, y - 5 * s, '#c8c8d0');
    p.c.fillStyle = '#f2f4f6';
    p.c.fillRect(Math.round(x - 3 * s), Math.round(y - 5 * s), Math.round(6 * s), Math.round(8 * s));
    p.c.fillStyle = '#e8a33a';
    p.c.fillRect(Math.round(x - 2 * s), Math.round(y - 4 * s), Math.round(4 * s), Math.round(2 * s));
    p.c.fillStyle = '#d8dce4';
    p.c.fillRect(Math.round(x - 4 * s), Math.round(y - 2 * s), Math.round(8 * s), Math.round(2 * s));
  },
};

/** A valve panel: vertical pipes with coloured handwheels, gauges, a cable bundle with ties. */
const pipes: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const um = k.wp.at + k.wp.w / 2;
    const light = pl.light;
    wbox(p, side, um - 0.38, um + 0.38, 0, 0.04, 6, 30, { face: plating(GUN, 24, 30, 9), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    const F = side === 'ne' ? front3(p, 0.04) : side3(p, 0.04);
    const cols: Ramp[] = [CYAN, ALU, AMBER];
    cols.forEach((r, i) => {
      const u = um - 0.22 + i * 0.22;
      beam(p, F, u, 2, u, 31.4, 0.7, r);
      // a handwheel and a flange
      const z = 12 + i * 4.5 + (k.seed % 3);
      const [x, y] = F.F(u, z);
      layer(p.c, (l) => {
        ell(l, x, y, 6, 6, i === 1 ? RED[2] : r[1]);
        ell(l, x, y, 4, 4, '#1a1c24');
        ln(l, x - 5, y, x + 5, y, i === 1 ? RED[4] : r[4]);
        ln(l, x, y - 5, x, y + 5, i === 1 ? RED[4] : r[4]);
        ell(l, x, y, 1.5, 1.5, ALU[5]);
      }, { rect: [x - 8, y - 8, x + 8, y + 8] });
      pq(p, F, u - 0.08, u + 0.08, 5 + i * 0.5, 5.6 + i * 0.5, at(GUN, 5));
    });
    // gauges and a label
    for (const [du, z] of [[-0.11, 25], [0.11, 23.4]] as const) {
      const [x, y] = F.F(um + du, z);
      layer(p.c, (l) => {
        ell(l, x, y, 4.5, 4.5, GUN[1]);
        ell(l, x, y, 3.5, 3.5, '#f4f6f8');
        ln(l, x, y, x + 2, y - 2, RED[3]);
      }, { rect: [x - 6, y - 6, x + 6, y + 6] });
    }
    pq(p, F, um - 0.3, um + 0.1, 28, 29.2, '#f2f4f6');
    pq(p, F, um - 0.28, um - 0.18, 28.3, 28.9, AMBER[3]);
    // a cable bundle down the side, zip-tied
    const [x0, y0] = P3(p, side, um + 0.42, 0.06, 31);
    const [x1, y1] = P3(p, side, um + 0.42, 0.06, 1.8);
    for (let i = 0; i < 3; i++) ln(p.c, x0 + i, y0, x1 + i, y1, ['#2a2c34', '#3a5a9a', '#8a2a2a'][i]);
    for (let z = 4; z < 30; z += 5) {
      const [tx, ty] = P3(p, side, um + 0.42, 0.06, z);
      px(p.c, tx - 1, ty, '#e8ecf2', 5, 1);
    }
    void light;
  },
};

/** The emergency kit by the airlock: first aid, breathing masks, a portable O2 bottle, a torch. */
const kit: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    wbox(p, side, um - 0.36, um + 0.36, 0, 0.18, 15, 24, { face: flat(['#3a0e12', '#5a161a', '#7e2024', '#a82c2c', '#c83a36', '#e05a4c', '#f08a7a']), end: flat(RED), top: flat(RED), edge: RED[0] });
    const F = side === 'ne' ? front3(p, 0.18) : side3(p, 0.18);
    pq(p, F, um - 0.08, um + 0.08, 17, 22, '#f6f4ee');
    pq(p, F, um - 0.24, um + 0.24, 18.7, 20.3, '#f6f4ee');
    pq(p, F, um - 0.3, um + 0.3, 23, 23.6, '#f6f4ee');
    // below: a clear box of masks and the yellow O2 bottle with its mask
    wbox(p, side, um - 0.36, um + 0.02, 0, 0.16, 8.6, 13.4, { face: flat(['#3a4250', '#4a5464', '#5a6678', '#6c788c', '#8a96a8', '#a8b4c4', '#c8d0dc']), end: flat(ALU), top: flat(ALU), edge: GUN[1] });
    const [x, y] = P3(p, side, um + 0.2, 0.12, 8.4);
    layer(p.c, (l) => {
      px(l, x - 4, y - 22, '#e8c020', 8, 20);
      px(l, x - 4, y - 22, '#f8e070', 2, 20);
      ell(l, x, y - 22, 4, 2, '#f8e070');
      px(l, x - 2, y - 26, GUN[3], 4, 4);
      ln(l, x + 2, y - 24, x + 7, y - 14, '#2a2c34', 1);
      ell(l, x + 7, y - 12, 3, 3, '#5a9ac8');
      px(l, x - 5, y - 4, GUN[5], 10, 2);
    }, { rect: [x - 8, y - 30, x + 12, y + 2] });
    const [mx, my] = P3(p, side, um - 0.17, 0.16, 10.2);
    for (let i = 0; i < 3; i++) ell(p.c, mx - 5 + i * 5, my - 4, 2, 2.5, '#e8f0f4');
    // a torch on velcro
    const [tx, ty] = P3(p, side, um - 0.3, 0.06, 26);
    px(p.c, tx - 1, ty - 8, '#2a2c34', 3, 9);
    px(p.c, tx - 2, ty - 10, GUN[5], 5, 3);
  },
};

/** An EVA suit on its wall mount by the airlock: helmet with a gold visor, arms hanging, the backpack. */
const suit: WallArt4 = {
  draw(p, side, k) {
    const um = k.wp.at + k.wp.w / 2;
    // the mount: a plate and a bar out of the wall
    wbox(p, side, um - 0.3, um + 0.3, 0, 0.05, 19, 31, { face: plating(GUN, 22, 22, 11), end: flat(GUN), top: flat(GUN), edge: GUN[0] });
    // the backpack (PLSS) against the mount, then the suit hanging in front of it
    wbox(p, side, um - 0.26, um + 0.26, 0.05, 0.24, 17, 28, { face: shield(WHITE, 12, 14), end: tone(WHITE, -0.6), top: tone(WHITE, 0.6), edge: WHITE[0] });
    const [x, y0] = P3(p, side, um, 0.34, 0);
    const s = p.k / 4;
    const S = (v: number) => Math.round(v * s);
    const y = y0 - S(26);
    const W: Ramp = WHITE;
    // the hanger: a bar out of the mount and a hook into the suit's neck ring
    const [hx, hy] = P3(p, side, um, 0.05, 31.4);
    const [ex, ey] = P3(p, side, um, 0.34, 31.4);
    ln(p.c, hx, hy, ex, ey, GUN[4], 3);
    ln(p.c, ex, ey, ex, ey + S(4), ALU[5], 2);
    layer(p.c, (l) => {
      // legs hanging, boots
      for (const dx of [-6, 5]) {
        px(l, x + S(dx) - S(4), y - S(44), W[4], S(8), S(26));
        px(l, x + S(dx) - S(4), y - S(44), W[5], S(3), S(26));
        px(l, x + S(dx) - S(4), y - S(32), W[2], S(8), S(2));
        px(l, x + S(dx) - S(5), y - S(19), '#8a93a8', S(10), S(6));
      }
      // torso with the chest control module, an amber stripe on the arm, the US-style flag patch
      px(l, x - S(11), y - S(76), W[4], S(22), S(34));
      px(l, x - S(11), y - S(76), W[6], S(5), S(34));
      px(l, x + S(7), y - S(76), W[2], S(4), S(34));
      px(l, x - S(7), y - S(60), '#c8ccd4', S(14), S(9));
      px(l, x - S(6), y - S(58), '#3a3e48', S(4), S(2));
      px(l, x - S(1), y - S(58), RED[4], S(2), S(2));
      px(l, x + S(2), y - S(58), GREEN[4], S(2), S(2));
      px(l, x - S(13), y - S(46), '#5a6378', S(26), S(4));
      // arms hanging at the sides, gloves
      for (const dx of [-15, 12]) {
        px(l, x + S(dx), y - S(74), W[3], S(5), S(28));
        px(l, x + S(dx), y - S(74), W[5], S(2), S(28));
        px(l, x + S(dx), y - S(68), AMBER[4], S(5), S(2));
        px(l, x + S(dx) - S(1), y - S(47), '#d7dce6', S(7), S(6));
      }
      // the helmet: white shell, gold visor with a reflection, lights
      ell(l, x, y - S(84), S(10), S(10), W[5]);
      ell(l, x + S(1), y - S(82), S(8), S(7), GOLD[3]);
      ell(l, x - S(1), y - S(84), S(5), S(4), GOLD[5]);
      px(l, x - S(4), y - S(87), GOLD[6], S(3), S(2));
      px(l, x - S(10), y - S(88), '#e8ecf2', S(3), S(3));
      px(l, x + S(8), y - S(88), '#e8ecf2', S(3), S(3));
    }, { rect: [x - S(24), y - S(100), x + S(24), y + 2] });
  },
};

export const SPACE_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: {
    starwindow,
    wallpanel,
    door,
    spc_stowage: stowage,
    spc_vent: vent,
    spc_screen: screen,
    spc_patches: patches,
    spc_pipes: pipes,
    spc_kit: kit,
    spc_suit: suit,
  },
};


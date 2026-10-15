// Space — the station's big structures round the module (1 z ≈ 10 cm, 1 tile = 1 m).
//   spc_edge      the hull deck's cut edge dropping into the void (rot 0: south, rot 1: east),
//                 laid in segments of ≤ 6 tiles that share one sprite
//   spc_module    pressurised modules lying on cradles: hab (lit windows), lab (gold
//                 blankets), cargo (hazard band, berthing ring), node (side and top ports);
//                 variant 'kind:part' with part s (far end) / m / e (near cap) / whole, so long
//                 modules are cut into ≤ 4 m segments that depth-sort cleanly
//   spc_adapter   a short docking adapter between two modules
//   spc_truss     a square lattice truss with a gold cable tray, bare over the void
//   spc_mount     where a truss leaves the deck: an insulated column with braces and a beacon
//   spc_solar     a solar array wing: a gimbal drum, two cell blankets tilted to the sun, a
//                 mast, blanket boxes (variant 'r': root at the far end)
//   spc_radiator  a white ceramic radiator panel tilted on a mast from a rotary joint
//   spc_dish      a big comms dish on a turret
//   spc_tower     a lattice comms tower with antennas, a small dish and a beacon
//   spc_arm       the station's robotic arm, reaching over the apron
//   spc_shuttle   the docked shuttle: fuselage, nose with cockpit windows, delta wings, fin,
//                 engine bells, navigation lights
//   spc_tunnel    the docking tunnel from the shuttle's nose to a docking mast on the apron
//   spc_thruster  an RCS thruster quad on the deck's corner
import { type FaceTex, type Mat, texPara } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { at, bayer, ell, hash, layer, ln, px, type Ramp } from '../../kit4';
import { front, poly3, pq, pt } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { ALU, AMBER, ball, bell, CYAN, cyl, cylPoint, flat, foil, GOLD, GREEN, GUN, halo, HULL, led, plating, RAD, RED, TILE, tone, WHITE } from './common';

const s4 = (p: PropPainter) => p.k / 4;
/** blued steel of the berthing rings and adapters */
const NAVY: Ramp = ['#141c30', '#1c2a48', '#2a3c62', '#3e5480', '#5a729e', '#8a9cc0', '#c0cce0'];
/** A line between two prop-local 3D points. */
function L3(p: PropPainter, a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, col: string, w = 2) {
  const [x0, y0] = p.P(a0, b0, z0);
  const [x1, y1] = p.P(a1, b1, z1);
  ln(p.c, x0, y0, x1, y1, col, w);
}

// ── the deck's cut edge ──────────────────────────────────────
const EDGE_D = 16;
const edgeFace: Mat = (light, _w, h) => (u, v, x, y) => {
  // v is up from the bottom of the face (h = EDGE_D·4 px)
  const z = (v / h) * EDGE_D - EDGE_D; // −16 … 0
  const b = light ? 3 : 2;
  if (z > -0.7) return at(HULL, b + 3);
  if (z > -1.1) return at(HULL, 0);
  if (z > -2.6) {
    // a recessed channel carrying a conduit
    if (z > -2 && z < -1.5) return at(AMBER, light ? 3 : 2);
    return at(GUN, 1);
  }
  if (z < -14.8) return at(HULL, b - 2);
  if (z < -13.4) {
    if (u % 143 > 70 && u % 143 < 74) return (Math.floor(u / 143) & 1) === 0 ? RED[5] : AMBER[5];
    return at(HULL, b - 1);
  }
  // panels: one tile wide, rivets along the seams, now and then a vent or an RCS port
  const pw = 71.55;
  const col = Math.floor(u / pw);
  const fu = u - col * pw;
  if (fu < 1.2) return at(HULL, 0);
  if (fu < 2.4) return at(HULL, b + 1);
  // a lit amber lamp box in every second panel
  if ((col & 1) === 0) {
    const lu = Math.abs(fu - 36);
    const lz = Math.abs(z + 8);
    if (lu < 13 && lz < 3.6) {
      if (lu > 10.5 || lz > 2.9) return at(GUN, 0);
      if (lu > 8.5 || lz > 2.2) return '#e59733';
      return lu < 4 && lz < 1.1 ? '#fef7d0' : '#fbd262';
    }
    // the glow on the plating round it
    if (lu < 18 && lz < 5.4 && bayer(x, y) < 0.45) return '#8d5a13';
  }
  if (Math.abs(z + 8) < 0.25) return at(HULL, b - 1.5);
  if ((z > -3.4 && z < -3) || (z > -13.2 && z < -12.8)) return Math.abs((fu % 6) - 3) < 0.8 ? at(HULL, b + 2) : at(HULL, b - 0.5);
  const kind = hash(col, 1, 401);
  if (kind < 0.18 && fu > 18 && fu < 54 && z > -11.6 && z < -4.4) return (z * 2) % 1 < 0.45 ? at(GUN, 0) : at(HULL, b);
  if (kind > 0.88 && Math.hypot(fu - 36, (z + 8) * 4) < 9) return Math.hypot(fu - 36, (z + 8) * 4) < 6 ? at(GUN, 0) : at(ALU, b + 1);
  let i = b + (hash(col, 2, 402) - 0.5) * 0.8;
  if (hash(x, y, 403) < 0.03) i -= 1;
  return at(HULL, i);
};

const spc_edge: PropArt = {
  draw(p, k) {
    const F = front(p, 0);
    pt(p, F, 0, k.w, -EDGE_D, 0, edgeFace, F.light);
    // the face's lower rim and a soft dark underside line
    pq(p, F, 0, k.w, -EDGE_D - 0.4, -EDGE_D, GUN[0]);
  },
  lights: (k) => {
    const out: PropLight[] = [];
    for (let a = 0; a < k.w; a++) if ((a & 1) === 0) out.push({ a: a + 0.5, b: 0, z: -8, r: 1.1, color: '#f1bd3c', kind: 'window' });
    return out;
  },
};

// ── pressurised modules ──────────────────────────────────────
/**
 * A module segment along local a. variant 'kind:part' — kind hab | lab | cargo | node,
 * part s (start: far end closed), m (middle), e (end: the near cap), whole (default).
 */
const spc_module: PropArt = {
  draw(p, k) {
    const [kind, part = 'whole'] = (k.variant ?? 'hab').split(':');
    const W = k.w;
    const D = k.d;
    const r = D / 2 - 0.12;
    const bc = D / 2;
    const zc = 2.4 + r * 10;
    // world metres along the axis (continuous across segments): +x for rot 0, −y for rot 1
    const gOf = (t: number) => (p.rot === 0 ? p.x + t : -(p.y + W - t));
    const far = p.rot === 0 ? 0.06 : W - 0.06;
    footShadow(p, 0.1, 0.2, W - 0.1, D - 0.1, 14, 0.36);
    // cradles: saddles under the hull
    for (const a of [Math.min(1, W / 2 - 0.2), Math.max(W - 1.2, W / 2 + 0.2)]) {
      lbox(p, a - 0.18, bc - r * 0.8, 0.36, r * 1.6, 0, 3.2, { front: plating(GUN, 14, 12, 21), side: plating(GUN, 14, 12, 22), top: tone(GUN, 1), edge: GUN[0] });
    }
    const MLI = kind === 'lab';
    const body: Ramp = WHITE;
    const capEnd = part === 'e' || part === 'whole';
    cyl(p, 0, bc, zc, W, bc, zc, r, {
      ramp: body,
      spec: 0.5,
      cap: capEnd ? ALU : false,
      tex: (t, ang, x, y) => {
        const g = gOf(t) + 1000;
        const deg = ((ang * 180) / Math.PI + 360) % 360;
        // ring seams every 1.6 m, panel seams every 30°
        if (Math.abs((g % 1.6) - 0.8) > 0.75) return -2.4;
        if (Math.abs((deg % 30) - 15) > 14.2) return -1.2;
        // the lab's gold insulation bands, the hab's window row facing the camera
        if (MLI && Math.abs((g % 3.2) - 1.6) < 0.5) return at(GOLD, 3 + (hash(x >> 1, y, 405) < 0.3 ? 2 : 0) + (deg > 90 && deg < 270 ? -1 : 0));
        if (kind === 'hab' && deg > 12 && deg < 50 && Math.abs((g % 1.6) - 0.8) < 0.34) {
          const wu = Math.abs((g % 1.6) - 0.8);
          if (deg < 15.5 || deg > 46.5 || wu > 0.29) return GUN[1];
          if (deg < 18 || wu > 0.25) return '#e59733';
          return wu < 0.12 && deg > 26 && deg < 38 ? '#fef7d0' : deg > 34 ? '#fbd262' : '#f1bd3c';
        }
        // the warm spill of the window round its frame
        if (kind === 'hab' && deg > 9 && deg < 54 && Math.abs((g % 1.6) - 0.8) < 0.4 && bayer(x, y) < 0.3) return '#f1bd3c';
        // EVA handrails: amber lines along the hull
        if (Math.abs(deg - 70) < 2.2 || Math.abs(deg - 340) < 2.2) return Math.abs((g % 0.8) - 0.4) < 0.05 ? GUN[2] : AMBER[deg > 300 ? 3 : 5];
        // a cargo module's hazard band near its berthing end
        if (kind === 'cargo' && g % 6 < 0.5) return Math.floor((deg + g * 20) / 15) % 2 ? AMBER[4] : GUN[1];
        // the ring seam's raised lip catches the light
        if (Math.abs((g % 1.6) - 0.8) > 0.72) return 1.2;
        // amber running lights along the upper flank, one per metre and a half
        if (Math.abs(deg - 58) < 3.2 && Math.abs((g % 1.6) - 0.8) < 0.07) return Math.abs(deg - 58) < 1.6 ? '#fef7d0' : '#f1bd3c';
        // finer panel seams: half-rings and 15° stringers
        if (Math.abs((g % 0.8) - 0.4) > 0.382) return -1.7;
        if (Math.abs((g % 0.8) - 0.4) > 0.36) return 0.8;
        if (Math.abs((deg % 20) - 10) > 9.3) return -1.4;
        // greebles: bolted covers, a few dark access plates
        const pg = hash(Math.floor(g / 0.8), Math.floor(deg / 20), 406);
        const fu = (g % 0.8) / 0.8;
        const fv = (deg % 20) / 20;
        if (pg < 0.14 && fu > 0.2 && fu < 0.8 && fv > 0.22 && fv < 0.78) return fu < 0.26 || fv > 0.72 ? 1.1 : fu > 0.74 || fv < 0.28 ? -1.6 : pg < 0.05 ? -2.2 : -0.5;
        // bolt heads in the panel corners, faint staining
        if (Math.abs((g % 1.6) - 0.8) > 0.68 && Math.abs((deg % 30) - 15) > 12) return -0.8;
        return hash(x, y, 404) < 0.03 ? -0.6 : 0;
      },
      capTex: (rr, ang) => {
        // the berthing ring (steel blue): bolt circle, a hatch with a handle
        if (rr > 0.86) return rr > 0.95 ? NAVY[1] : NAVY[4];
        if (rr > 0.8) return Math.abs(((ang / (Math.PI * 2)) * 16 + 16) % 1 - 0.5) < 0.18 ? 1.6 : -0.6;
        if (rr > 0.55) return 0;
        if (rr > 0.5) return -1.6;
        if (Math.abs(Math.sin(ang)) < 0.12 && rr < 0.36) return AMBER[4];
        return -0.4;
      },
    });
    // the far end's closing ring (start segments): a darker band
    if (part === 's') {
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const [x, y] = cylPoint(p, 0, bc, zc, W, bc, zc, r, far, ang);
        px(p.c, x, y, GUN[2], 2, 2);
      }
    }
    // node: two side ports facing the camera
    if (kind === 'node') {
      cyl(p, W / 2, bc, zc, W / 2, D - 0.02, zc, r * 0.55, { ramp: ALU, cap: ALU, spec: 0.6, capTex: (rr) => (rr > 0.8 ? 0.5 : rr > 0.7 ? -1.4 : rr < 0.3 ? -0.6 : 0) });
      cyl(p, W / 2, bc, zc, W / 2, bc, zc + r * 10 + 4, r * 0.5, { ramp: ALU, cap: ALU, spec: 0.6, capTex: (rr) => (rr > 0.8 ? 0.6 : rr > 0.7 ? -1.4 : 0) });
    }
    // a name plate and a flag near the start
    if (part === 's' || part === 'whole') {
      const [nx, ny] = cylPoint(p, 0, bc, zc, W, bc, zc, r, p.rot === 0 ? 0.9 : W - 0.9, (30 * Math.PI) / 180);
      layer(p.c, (l) => {
        px(l, nx - 10, ny - 4, '#1c2030', 20, 7);
        for (let i = 0; i < 5; i++) px(l, nx - 8 + i * 3, ny - 3, i === 0 ? CYAN[5] : '#e8ecf2', 2, 5);
        px(l, nx + 14, ny - 6, '#f2f4f6', 9, 6);
        px(l, nx + 14, ny - 6, '#2a4a8a', 4, 3);
        px(l, nx + 18, ny - 4, RED[4], 5, 1);
      }, { rect: [nx - 14, ny - 10, nx + 26, ny + 6] });
    }
    // a floodlight and a camera on the hull's top
    const [lx, ly] = cylPoint(p, 0, bc, zc, W, bc, zc, r, W * 0.6, Math.PI / 2 - 0.3);
    layer(p.c, (l) => {
      px(l, lx - 1, ly - 7, GUN[3], 3, 7);
      px(l, lx - 4, ly - 11, GUN[2], 8, 5);
      px(l, lx - 3, ly - 10, '#fff4d0', 5, 3);
    }, { rect: [lx - 6, ly - 14, lx + 6, ly + 2] });
  },
  lights: (k) => {
    const [kind] = (k.variant ?? 'hab').split(':');
    if (kind !== 'hab') return [];
    const r = k.d / 2 - 0.12;
    const zc = 2.4 + r * 10;
    const out: PropLight[] = [];
    // one window every 1.6 m along the axis (positions approximate the world-continuous pattern)
    for (let t = 0.8; t < k.w; t += 1.6) out.push({ a: t, b: k.d / 2 + r * 0.87, z: zc + r * 5, r: 1.4, color: '#fbd262', kind: 'window' });
    return out;
  },
};

/** A short docking adapter between two modules: a narrow ring with a bellows. */
const spc_adapter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const r = Math.min(1.1, D / 2 - 0.4);
    const bc = D / 2;
    const zc = 2.4 + (D / 2 - 0.12) * 10;
    cyl(p, 0, bc, zc, W, bc, zc, r, {
      ramp: NAVY,
      spec: 0.8,
      cap: false,
      tex: (t) => (Math.abs(((t * 6) % 1) - 0.5) < 0.18 ? -1.4 : 0),
    });
    cyl(p, W * 0.4, bc, zc, W * 0.6, bc, zc, r + 0.12, { ramp: NAVY, spec: 0.5, cap: false, tex: (_t, ang) => (Math.abs(((ang / (Math.PI * 2)) * 12 + 12) % 1 - 0.5) < 0.14 ? 2 : 0) });
    void k;
  },
};

// ── trusses ──────────────────────────────────────────────────
/** A square lattice truss along local a: variant 'pylon' stands it on legs over the deck. */
const spc_truss: PropArt = {
  draw(p, k) {
    const W = k.w;
    const z0 = 8;
    const z1 = 17;
    const b0 = 0.06;
    const b1 = 0.94;
    const legs = k.variant === 'pylon';
    if (legs) {
      for (let a = 0.5; a < W; a += 3) {
        footShadow(p, a - 0.3, 0.2, a + 0.3, 0.8, 8, 0.3);
        lbox(p, a - 0.22, 0.3, 0.44, 0.4, 0, 0.8, mono(flat(GUN), GUN[0]));
        for (const b of [0.36, 0.64]) L3(p, a, b, 0.8, a, b, z0, GUN[4], 3);
        L3(p, a, 0.36, 0.8, a, 0.64, z0, GUN[3], 2);
      }
    }
    const back = ALU[2];
    const mid = ALU[4];
    const fr = ALU[6];
    // back face, bottom, top, front: longerons and bays with diagonals (thick members, a
    // dark underside to each so the lattice reads as steel, not wire)
    L3(p, 0, b0, z0, W, b0, z0, back, 2);
    L3(p, 0, b0, z1, W, b0, z1, back, 2);
    for (let a = 0; a <= W + 1e-6; a += 1) {
      L3(p, a, b0, z0, a, b0, z1, back, 2);
      if (a < W) L3(p, a, b0, z0, a + 1, b0, z1, ALU[1], 2);
      L3(p, a, b0, z0, a, b1, z0, back, 2);
      if (a < W) L3(p, a, b0, z0, a + 1, b1, z0, ALU[1], 1);
    }
    L3(p, 0, b1, z0 - 0.3, W, b1, z0 - 0.3, GUN[2], 2);
    L3(p, 0, b1, z0, W, b1, z0, mid, 2);
    // the utility tray along the top: a gold-wrapped cable bundle
    for (let a = 0; a <= W + 1e-6; a += 1) {
      L3(p, a, b0, z1, a, b1, z1, mid, 2);
      if (a < W) L3(p, a, b0, z1, a + 1, b1, z1, mid, 2);
    }
    const [t0x, t0y] = p.P(0, 0.5, z1 + 0.4);
    const [t1x, t1y] = p.P(W, 0.5, z1 + 0.4);
    ln(p.c, t0x, t0y, t1x, t1y, AMBER[4], 3);
    ln(p.c, t0x, t0y + 3, t1x, t1y + 3, GOLD[2], 1);
    L3(p, 0, b0, z1, W, b0, z1, mid, 2);
    for (let a = 0; a <= W + 1e-6; a += 1) {
      L3(p, a + 0.04, b1, z0, a + 0.04, b1, z1, GUN[3], 2);
      L3(p, a, b1, z0, a, b1, z1, fr, 3);
      if (a < W) {
        const up = Math.floor(a) % 2 === 0;
        L3(p, a, b1, up ? z0 : z1, a + 1, b1, up ? z1 : z0, ALU[4], 2);
      }
    }
    L3(p, 0, b1, z1 - 0.3, W, b1, z1 - 0.3, GUN[3], 2);
    L3(p, 0, b1, z1, W, b1, z1, ALU[6], 3);
    L3(p, 0, b1, z0, W, b1, z0, fr, 3);
    // node boxes at the bay corners, a light now and then
    for (let a = 0; a <= W + 1e-6; a += 1) {
      for (const [b, z] of [[b1, z1], [b1, z0]] as const) {
        const [x, y] = p.P(a, b, z);
        px(p.c, x - 1, y - 1, ALU[6], 3, 3);
      }
      if (Math.round(a) % 2 === 1) {
        // an amber lamp hanging under the bay, its glow dithered round it
        const [x, y] = p.P(a, 0.5, z0);
        const [, y2] = p.P(a, 0.5, z0 - 4.6);
        px(p.c, x, y, GUN[3], 1, y2 - y);
        halo(p.c, x, y2 + 1, 14, 11, AMBER[5], 0.45);
        px(p.c, x - 3, y2 - 2, AMBER[3], 6, 6);
        px(p.c, x - 2, y2 - 1, AMBER[5], 4, 4);
        px(p.c, x - 1, y2, AMBER[6], 2, 2);
      }
    }
  },
  lights: (k) => {
    const out: PropLight[] = [];
    for (let a = 1; a < k.w; a += 2) out.push({ a, b: 0.5, z: 3.4, r: 1, color: '#f1bd3c', kind: 'lamp' });
    return out;
  },
};

// ── solar array wings ────────────────────────────────────────
/** A painter whose local a runs the other way (a → w − a); faces keep their world light. */
function flipA(p: PropPainter, W: number): PropPainter {
  const q = Object.create(p) as PropPainter;
  (q as unknown as { P: PropPainter['P'] }).P = (a: number, b: number, z = 0) => p.P(W - a, b, z);
  (q as unknown as { W: PropPainter['W'] }).W = (a: number, b: number) => p.W(W - a, b);
  return q;
}
/**
 * A solar wing along local a: a beta gimbal at a = 0 on the truss, a mast down the
 * middle, two blankets of cells tilted toward the sun (high at b = 0, low at b = d),
 * thin blanket boxes at both ends.
 */
const SOL: Ramp = ['#0b1a5c', '#132472', '#1b3086', '#243c98', '#2e4aa8', '#3c5ab6', '#5674c8', '#7c96dc'];
/** The wings' cells: small dark-gridded cells, a lighter frame every four, a sheen band, glints. */
const wingCells: FaceTex = (u, v, x, y) => {
  const cw = 7;
  const fu = u % cw;
  const fv = v % cw;
  const cu = Math.floor(u / cw);
  const cv = Math.floor(v / cw);
  if ((fu < 1 && cu % 4 === 0) || (fv < 1 && cv % 4 === 0)) return (cu + cv) % 3 === 0 ? '#b8c8f0' : '#8ea4dc';
  if (fu < 1 || fv < 1) return '#101c58';
  let i = 3.4 + (hash(cu, cv, 63) - 0.5) * 1.1;
  const sh = (u * 0.55 + v) % 150;
  if (sh < 22) i += sh < 8 ? 2.2 : 1.2;
  if (fu < 2 || fv < 2) i += 0.6;
  if (hash(x, y, 64) < 0.012) return '#dce6ff';
  return at(SOL, i);
};
const spc_solar: PropArt = {
  draw(p0, k) {
    const W = k.w;
    const D = k.d;
    // variant 'r': the root (gimbal) at a = w instead of a = 0
    const p = k.variant === 'r' ? flipA(p0, W) : p0;
    const zb = 12;
    const tilt = 3.4; // z per tile across the blanket
    const z = (b: number) => zb + (D - b) * tilt;
    const zm = z(D / 2) + 0.4;
    // the gimbal: a short drum on the truss and a yoke out to the mast
    cyl(p, 0, D / 2, zb, 0.55, D / 2, zb, 0.36, { ramp: ALU, spec: 0.7, cap: ALU, tex: (t) => (Math.abs(t - 0.28) < 0.04 ? -1.4 : 0) });
    L3(p, 0.5, D / 2, zb, 0.95, D / 2, zm, ALU[4], 3);
    const [gx, gy] = p.P(0.3, D / 2 + 0.36, zb + 1);
    led(p.c, gx, gy, AMBER, 2);
    // two blankets with a gap for the mast
    const blank = (b0: number, b1: number) => {
      const a0 = 1.05;
      const a1 = W - 0.22;
      // a parallelogram: textured straight (no polygon test needed)
      const O = p.P(a0, b1, z(b1));
      const A = p.P(a1, b1, z(b1));
      const B = p.P(a0, b0, z(b0));
      const U: [number, number] = [A[0] - O[0], A[1] - O[1]];
      const V: [number, number] = [B[0] - O[0], B[1] - O[1]];
      texPara(p.c, O, U, V, wingCells);
      // the blanket's frame: gold edges, tension wires, a hinge line every two metres
      L3(p, a0, b1, z(b1), a1, b1, z(b1), AMBER[4], 2);
      L3(p, a0, b1, z(b1) - 0.5, a1, b1, z(b1) - 0.5, '#f4f2ec', 2);
      L3(p, a0, b0, z(b0), a1, b0, z(b0), '#e8eef8', 2);
      L3(p, a1, b0, z(b0), a1, b1, z(b1), '#f4f2ec', 2);
      // gold corner lamps
      for (const [a, b] of [[a1, b0], [a1, b1], [a0, b1]] as const) {
        const [cx, cy] = p.P(a, b, z(b));
        halo(p.c, cx, cy, 9, 7, AMBER[5], 0.5);
        px(p.c, cx - 2, cy - 2, AMBER[6], 4, 4);
      }
      for (let a = a0 + 2; a < a1 - 0.5; a += 2) L3(p, a, b0, z(b0), a, b1, z(b1), '#878caf', 1);
    };
    blank(0.08, D / 2 - 0.1);
    blank(D / 2 + 0.1, D - 0.08);
    // the mast: a slender lattice down the middle
    L3(p, 0.95, D / 2, zm, W - 0.1, D / 2, zm, ALU[5], 2);
    for (let a = 1.1; a < W - 0.2; a += 0.5) L3(p, a, D / 2 - 0.07, zm - 0.3, a + 0.5, D / 2 + 0.07, zm - 0.3, ALU[3], 1);
    // thin blanket boxes across both ends
    for (const a of [0.85, W - 0.24]) {
      const q: [number, number, number][] = [[a, D - 0.06, z(D - 0.06)], [a + 0.18, D - 0.06, z(D - 0.06)], [a + 0.18, 0.06, z(0.06)], [a, 0.06, z(0.06)]];
      poly3(p, q, (_u: number, v: number) => (v % 12 < 1 ? ALU[2] : ALU[5]), 2);
      L3(p, a + 0.18, D - 0.06, z(D - 0.06), a + 0.18, D - 0.06, z(D - 0.06) - 1.4, ALU[2], 2);
      L3(p, a, D - 0.06, z(D - 0.06) - 1.4, a + 0.18, D - 0.06, z(D - 0.06) - 1.4, ALU[1], 1);
    }
  },
};

// ── radiators ────────────────────────────────────────────────
/**
 * A deployed radiator: a long white ceramic panel tilted steeply on a mast from a
 * rotary joint, coolant tubes running across it, panel joints, a manifold along
 * its low edge.
 */
const spc_radiator: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const bc = D / 2;
    footShadow(p, 0.1, bc - 0.45, 1.1, bc + 0.45, 10, 0.34);
    lbox(p, 0.12, bc - 0.42, 0.76, 0.84, 0, 2.2, { front: plating(GUN, 14, 10, 41), side: plating(GUN, 14, 10, 42), top: plating(GUN, 12, 12, 43), edge: GUN[0] });
    cyl(p, 0.5, bc, 2.2, 0.5, bc, 12.6, 0.15, { ramp: ALU, cap: false, spec: 0.7, tex: (t) => (Math.abs(((t * 10) % 3) - 1.5) < 0.15 ? -1.2 : 0) });
    L3(p, 0.5, bc, 12.4, 0.95, bc, 12.8, ALU[4], 3);
    // the panel: high at b = 0.1, low at b = d − 0.1
    const tilt = 7;
    const zl = 11.6;
    const z = (b: number) => zl + (D - 0.1 - b) * tilt;
    const a0 = 0.9;
    const a1 = W - 0.1;
    const O = p.P(a0, D - 0.1, z(D - 0.1));
    const A = p.P(a1, D - 0.1, z(D - 0.1));
    const B = p.P(a0, 0.1, z(0.1));
    const U: [number, number] = [A[0] - O[0], A[1] - O[1]];
    const V: [number, number] = [B[0] - O[0], B[1] - O[1]];
    const lu = Math.hypot(U[0], U[1]);
    const lv = Math.hypot(V[0], V[1]);
    texPara(p.c, O, U, V, (u: number, v: number, x: number, y: number) => {
      let i = 4.6;
      if (u < 2 || u > lu - 2 || v < 2 || v > lv - 2) i = 2.4;
      else if ((u % (lu / Math.max(1, Math.round((a1 - a0) / 1.2)))) < 1.2) i = 3;
      else if (u % 5 < 1) i = 3.8;
      if ((u * 0.4 + v) % 48 < 5) i += 0.8;
      if (bayer(x, y) > 0.93) i -= 0.5;
      return at(RAD, i);
    });
    // the panel's thickness along its low edge, the manifold and the coolant lines
    L3(p, a0, D - 0.1, z(D - 0.1) - 0.5, a1, D - 0.1, z(D - 0.1) - 0.5, RAD[1], 2);
    L3(p, a0, D - 0.05, z(D - 0.1) - 0.9, a1, D - 0.05, z(D - 0.1) - 0.9, GOLD[3], 2);
    L3(p, 0.62, bc + 0.12, 2.2, 0.62, bc + 0.12, 12.4, GOLD[4], 2);
    L3(p, a1, D - 0.1, z(D - 0.1), a1, 0.1, z(0.1), RAD[2], 2);
  },
};

// ── antennas, dishes, the comms tower ────────────────────────
/** A big parabolic dish on a turret, looking up and to the left. */
const spc_dish: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 26, 0.34);
    cyl(p, cx, cb, 0, cx, cb, 1.2, 0.7, { ramp: GUN, cap: GUN, spec: 0.3 });
    cyl(p, cx, cb, 1.2, cx, cb, 12, 0.28, { ramp: ALU, cap: ALU, spec: 0.6, tex: (t) => (Math.abs((t * 10) % 3 - 1.5) < 0.12 ? -1.4 : 0) });
    // the yoke
    for (const s of [-1, 1]) L3(p, cx, cb + s * 0.3, 12, cx - 0.1, cb + s * 0.55, 18, GUN[4], 3);
    // the dish: a tilted ellipse, concave — dark at its upper lip, bright toward the lower right
    const [dx, dy] = p.P(cx - 0.15, cb, 21);
    const R0 = 70 * s4(p) * (W / 2.4);
    const ang = -0.5;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rx = R0;
    const ry = R0 * 0.62;
    layer(p.c, (l) => {
      // the back of the dish (rim thickness) then the bowl
      for (let j = Math.floor(-rx - 4); j <= rx + 4; j++)
        for (let i = Math.floor(-rx - 4); i <= rx + 4; i++) {
          const u = (i * ca + j * sa) / rx;
          const v = (-i * sa + j * ca) / ry;
          const d2 = u * u + v * v;
          const ub = (i * ca + (j - 5) * sa) / rx;
          const vb = (-i * sa + (j - 5) * ca) / ry;
          if (d2 <= 1) {
            // concave bowl: light falls on the far (upper-left) inner wall
            let t = 3.4 + (u * 0.9 + v * 1.4) * 1.2;
            if (Math.abs(Math.sqrt(d2) - 0.66) < 0.02 || Math.abs(Math.sqrt(d2) - 0.33) < 0.025) t -= 0.8;
            if (Math.abs(Math.atan2(v, u) % (Math.PI / 4)) < 0.03) t -= 0.6;
            if (d2 > 0.93) t = 5.6;
            const ti = t + (bayer(dx + i, dy + j) - 0.5) * 0.8;
            px(l, dx + i, dy + j, WHITE[ti < 0 ? 0 : ti > 6 ? 6 : Math.round(ti)]);
          } else if (ub * ub + vb * vb <= 1) px(l, dx + i, dy + j, GUN[2]);
        }
      // the feed horn on three struts
      const fx = dx + ca * 0 + 6;
      const fy = dy - R0 * 0.55;
      for (const [ex, ey] of [[-rx * 0.8 * ca, -rx * 0.8 * sa], [rx * 0.8 * ca, rx * 0.8 * sa], [0, ry * 0.85]] as const) ln(l, dx + ex, dy + ey, fx, fy, ALU[4], 1);
      ell(l, fx, fy, 4, 4, GUN[2]);
      ell(l, fx - 1, fy - 1, 2, 2, ALU[5]);
    }, { rect: [dx - rx - 8, dy - rx - 30, dx + rx + 8, dy + rx + 12] });
    void k;
  },
  anim(p, k) {
    // a red warning lamp on the feed blinks
    const W = k.w;
    const [dx, dy] = p.P(W / 2 - 0.15, k.d / 2, 21);
    const R0 = 70 * s4(p) * (W / 2.4);
    if (Math.sin(k.t * 2.2 + k.seed) > 0.6) {
      const s = Math.max(1, Math.round(s4(p)));
      px(p.c, dx + 6 * s4(p) - s, dy - R0 * 0.55 - 6 * s4(p), RED[6], 2 * s, 2 * s);
    }
  },
};

/** A lattice comms tower: whips, a small dish, a beacon on top. */
const spc_tower: PropArt = {
  draw(p, k) {
    const H = 64;
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 30, 0.34);
    lbox(p, 0.1, 0.1, 0.8, 0.8, 0, 1.2, { front: plating(GUN, 14, 10, 51), side: plating(GUN, 14, 10, 52), top: tone(GUN, 1), edge: GUN[0] });
    // three legs tapering up, braced
    const legs: [number, number][] = [[0.22, 0.24], [0.8, 0.3], [0.5, 0.82]];
    const top: [number, number] = [0.5, 0.48];
    const at3 = (l: [number, number], f: number): [number, number, number] => [l[0] + (top[0] - l[0]) * f * 0.8, l[1] + (top[1] - l[1]) * f * 0.8, 1.2 + (H - 1.2) * f];
    legs.forEach((l) => {
      const A = at3(l, 0);
      const B = at3(l, 1);
      L3(p, A[0], A[1], A[2], B[0], B[1], B[2], l[1] > 0.6 ? ALU[5] : ALU[3], 2);
    });
    for (let f = 0; f < 1; f += 0.125) {
      for (let i = 0; i < 3; i++) {
        const A = at3(legs[i], f);
        const B = at3(legs[(i + 1) % 3], f + 0.0625);
        L3(p, A[0], A[1], A[2], B[0], B[1], B[2], ALU[2], 1);
        const C = at3(legs[(i + 1) % 3], f);
        L3(p, A[0], A[1], A[2], C[0], C[1], C[2], ALU[3], 1);
      }
    }
    // whips, a crossarm with antennas, a small dish
    const [tx, ty] = p.P(0.5, 0.48, H);
    const s = s4(p);
    layer(p.c, (l) => {
      ln(l, tx, ty, tx, ty - 46 * s, ALU[5], 1);
      ln(l, tx - 14 * s, ty + 4 * s, tx + 14 * s, ty - 4 * s, GUN[4], 2);
      for (const dx of [-12, -4, 6, 13]) ln(l, tx + dx * s, ty - dx * 0.3 * s, tx + dx * s, ty - dx * 0.3 * s - 18 * s, ALU[4], 1);
      ell(l, tx + 10 * s, ty + 26 * s, 9 * s, 7 * s, WHITE[3]);
      ell(l, tx + 9 * s, ty + 25 * s, 7 * s, 5 * s, WHITE[5]);
      px(l, tx + 7 * s, ty + 24 * s, GUN[2], 3, 3);
    }, { rect: [tx - 20 * s, ty - 50 * s, tx + 22 * s, ty + 36 * s] });
    void k;
  },
  anim(p, k) {
    const [tx, ty] = p.P(0.5, 0.48, 64);
    const s = s4(p);
    const on = Math.sin(k.t * 3 + k.seed) > 0.4;
    const S = Math.max(1, Math.round(s));
    px(p.c, tx - S, ty - 48 * s, on ? RED[6] : RED[2], 2 * S, 2 * S);
    if (on) {
      p.c.globalAlpha = 0.3;
      px(p.c, tx - 3 * S, ty - 50 * s, RED[5], 6 * S, 6 * S);
      p.c.globalAlpha = 1;
    }
  },
};

// ── the robotic arm ──────────────────────────────────────────
const spc_arm: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W * 0.4;
    const cb = D * 0.6;
    footShadow(p, 0.2, 0.3, W - 0.2, D - 0.1, 30, 0.34);
    // the base: a grapple fixture on the deck, a turret
    lbox(p, cx - 0.5, cb - 0.5, 1, 1, 0, 1, { front: plating(GUN, 14, 10, 61), side: plating(GUN, 14, 10, 62), top: plating(GUN, 16, 16, 63), edge: GUN[0] });
    cyl(p, cx, cb, 1, cx, cb, 5, 0.32, { ramp: WHITE, cap: GUN, spec: 0.6, tex: (t) => (Math.abs(t - 0.2) < 0.03 ? -1.5 : 0) });
    // shoulder, upper boom, elbow, lower boom, wrist, end effector holding a cargo box
    const S: [number, number, number] = [cx, cb, 6];
    const E: [number, number, number] = [cx + 1.6, cb - 1.2, 44];
    const Wr: [number, number, number] = [cx + 3.4, cb + 0.1, 22];
    ball(p, S[0], S[1], S[2], 0.42, 0.42, 0.42, { ramp: GUN, spec: 0.6 });
    cyl(p, S[0], S[1], S[2], E[0], E[1], E[2], 0.22, { ramp: WHITE, spec: 0.7, cap: false, tex: (t) => (Math.abs(((t * 1.3) % 1) - 0.5) < 0.03 ? -1.2 : t > 0.3 && t < 0.42 ? AMBER[4] : 0) });
    ball(p, E[0], E[1], E[2], 0.36, 0.36, 0.36, { ramp: GUN, spec: 0.6 });
    cyl(p, E[0], E[1], E[2], Wr[0], Wr[1], Wr[2], 0.18, { ramp: WHITE, spec: 0.7, cap: false, tex: (t) => (Math.abs(((t * 1.3) % 1) - 0.5) < 0.03 ? -1.2 : 0) });
    ball(p, Wr[0], Wr[1], Wr[2], 0.3, 0.3, 0.3, { ramp: GUN, spec: 0.6 });
    cyl(p, Wr[0], Wr[1], Wr[2], Wr[0], Wr[1], Wr[2] - 4, 0.24, { ramp: ALU, cap: ALU, spec: 0.6 });
    // a camera with a lamp on the elbow
    const [ex, ey] = p.P(E[0], E[1] + 0.3, E[2]);
    px(p.c, ex - 3, ey - 3, GUN[1], 6, 4);
    px(p.c, ex + 2, ey - 2, '#fff4d0', 2, 2);
    void k;
  },
};

// ── the docked shuttle ───────────────────────────────────────
/** The shuttle lies along local a with its nose at a = w, docked by the nose. */
const spc_shuttle: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const bc = D / 2;
    const r = D * 0.25;
    const zc = 4 + r * 10;
    const aT = 1.2;
    const aN = W - 2;
    const body: Ramp = ['#5a606e', '#7a808e', '#9ca2ae', '#bec3cc', '#dadde3', '#eef0f3', '#fbfcfd'];
    // the far wing, the engines behind the tail, the fuselage, the nose, the fin, the near wing
    const zw = zc - r * 10 * 0.5;
    const wing = (sd: 1 | -1) => {
      const bR = bc + sd * r * 0.85;
      const bT = bc + sd * (bc - 0.06);
      const pts: [number, number, number][] = [[aT + 0.2, bR, zw], [aN - 0.6, bR, zw], [aT + 2.1, bT, zw], [aT + 0.2, bT, zw]];
      poly3(p, pts, ((u: number, v: number, x: number, y: number) => {
        if (u < 8) return u < 2.5 ? body[3] : Math.floor(v / 6) % 2 ? body[4] : body[5];
        return hash(x, y, 501) < 0.03 ? body[4] : body[5];
      }) as FaceTex, 2, [[aT + 0.2, bR, zw], [aN - 0.6, bR, zw], [aT + 0.2, bT, zw]]);
      // the leading edge in black tiles, the elevon line, the wing tip
      L3(p, aN - 0.6, bR, zw, aT + 2.1, bT, zw, TILE[2], 4);
      L3(p, aT + 0.75, bR, zw, aT + 0.75, bT, zw, body[2], 1);
      L3(p, aT + 2.1, bT, zw, aT + 0.2, bT, zw, body[2], 2);
    };
    wing(-1);
    for (const [b, z] of [[bc - r * 0.42, zc - r * 2.6], [bc + r * 0.42, zc - r * 2.6], [bc, zc + r * 4]] as const) {
      bell(p, aT + 0.1, b, z, aT - 0.75, b, z, 0.16, r * 0.34, { ramp: GUN, mouth: '#140e12' });
    }
    cyl(p, aT, bc, zc, aN, bc, zc, r, {
      ramp: body,
      spec: 0.6,
      cap: false,
      tex: (t, ang, x, y) => {
        const deg = ((ang * 180) / Math.PI + 360) % 360;
        // black belly tiles, payload bay doors on top, an amber livery stripe, the name, a flag
        if (deg > 200 && deg < 340) return at(TILE, 3 + (hash(x >> 1, y >> 1, 502) < 0.3 ? 1 : 0));
        if (Math.abs(deg - 90) < 1.4) return body[1];
        if (Math.abs(deg - 58) < 1.2 || Math.abs(deg - 122) < 1.2) return body[2];
        if (deg > 60 && deg < 120 && Math.abs(((t * 10) % 9) - 4.5) < 0.18) return body[2];
        if (deg > 4 && deg < 13) return AMBER[deg < 8.5 ? 5 : 3];
        if (deg > 17 && deg < 30 && t > 1.2 && t < 3.4) return Math.floor(t * 9) % 3 === 2 ? 0 : '#2a3a6a';
        if (deg > 17 && deg < 30 && t > 3.7 && t < 4.2) return Math.floor(deg / 4) % 2 ? RED[4] : '#f2f4f6';
        if (deg > 16 && deg < 32 && t > 0.3 && t < 0.9) return (Math.floor(t * 12) + Math.floor(deg / 3)) % 2 ? '#2a3a6a' : 0;
        return Math.abs(((t * 10) % 9) - 4.5) < 0.12 ? -1 : 0;
      },
    });
    // the nose: a stretched half-ellipsoid with the wrap-round cockpit windows and the black tip
    ball(p, aN, bc, zc, W - aN - 0.2, r, r, {
      ramp: body,
      spec: 0.7,
      tex: (ns, nt, nw, x, y) => {
        if (ns < 0) return null;
        if (ns > 0.88) return TILE[2 + (bayer(x, y) > 0.6 ? 1 : 0)];
        if (nw < -0.35) return at(TILE, 3);
        if (nw > 0.4 && nw < 0.74 && ns > 0.18 && ns < 0.62 && Math.abs(nt) < 0.64) {
          if (Math.abs(((nt + 0.64) / 0.32) % 1 - 0.5) > 0.43) return body[1];
          return (x + y) % 9 < 2 ? '#a8c8e8' : '#1a2a3e';
        }
        if (nw > 0.34 && nw < 0.8 && ns > 0.14 && ns < 0.66 && Math.abs(nt) < 0.7) return body[2];
        return 0;
      },
    });
    // the docking port on the nose tip (the tunnel's ring clamps onto it)
    cyl(p, W - 0.24, bc, zc, W, bc, zc, r * 0.42, { ramp: ALU, cap: ALU, spec: 0.6, capTex: (rr) => (rr > 0.8 ? 0.6 : rr > 0.7 ? -1.6 : -0.3) });
    // the tail fin with its rudder line and a flag
    const zt = zc + r * 10 - 1;
    const fin: [number, number, number][] = [[aT - 0.1, bc, zt], [aT + 2.6, bc, zt], [aT + 1.0, bc, zt + 14], [aT + 0.2, bc, zt + 14]];
    poly3(p, fin, ((u: number, v: number) => (u < 3 || v > 52 ? TILE[3] : v < 5 ? body[3] : Math.abs(u - 12) < 1.2 ? body[2] : body[5])) as FaceTex, 1, [fin[0], fin[1], fin[3]]);
    const [fx, fy] = p.P(aT + 1.0, bc, zt + 8);
    px(p.c, fx - 5, fy - 4, '#2a4a8a', 8, 5);
    px(p.c, fx - 5, fy + 1, RED[4], 8, 1);
    wing(1);
    // RCS clusters by the nose, an OMS pod bulge either side of the fin
    for (const sd of [-1, 1]) {
      const [rx, ry] = p.P(aN + 0.3, bc + sd * r * 0.8, zc + r * 4);
      px(p.c, rx - 1, ry - 1, GUN[1], 3, 2);
      ball(p, aT + 0.7, bc + sd * r * 0.62, zc + r * 6.4, 0.75, 0.26, 0.24, { ramp: body, spec: 0.5 });
    }
    void k;
  },
  anim(p, k) {
    // navigation lights on the wing tips (red to port, green to starboard), a white strobe on the fin
    const D = k.d;
    const r = D * 0.25;
    const zc = 4 + r * 10;
    const s = Math.max(1, Math.round(s4(p)));
    const [lx, ly] = p.P(1.4, 0.08, zc - r * 5);
    const [rx, ry] = p.P(1.4, D - 0.08, zc - r * 5);
    px(p.c, lx - s, ly - s, RED[6], 2 * s, 2 * s);
    px(p.c, rx - s, ry - s, GREEN[6], 2 * s, 2 * s);
    if (Math.sin(k.t * 5) > 0.85) {
      const [sx, sy] = p.P(1.4, D / 2, zc + r * 10 + 13);
      px(p.c, sx - s, sy - s, '#ffffff', 2 * s, 2 * s);
    }
  },
};

/** The docking tunnel: a bellows from the shuttle's nose to a docking mast on the apron (along local a). */
const spc_tunnel: PropArt = {
  draw(p, k) {
    const W = k.w;
    const bc = k.d / 2;
    const zc = 4 + k.d * 0.25 * 10;
    // the bellows and its clamp ring at the shuttle's end
    cyl(p, 0, bc, zc, W - 0.8, bc, zc, 0.5, { ramp: WHITE, spec: 0.6, cap: false, tex: (t) => (Math.abs(((t * 5) % 1) - 0.5) < 0.16 ? -1.6 : 0) });
    cyl(p, 0, bc, zc, 0.22, bc, zc, 0.62, { ramp: GUN, spec: 0.5, cap: false, tex: (_t, ang) => (Math.abs(((ang / (Math.PI * 2)) * 10 + 10) % 1 - 0.5) < 0.16 ? 2 : 0) });
    // the docking mast on the deck: a dark tower with a hazard band and a status lamp
    const a0 = W - 0.85;
    footShadow(p, a0, bc - 0.6, W - 0.05, bc + 0.6, 16, 0.36);
    lbox(p, a0, bc - 0.55, 0.8, 1.1, 0, zc + 6.5, { front: plating(ALU, 16, 18, 81), side: plating(ALU, 14, 18, 82), top: plating(ALU, 12, 12, 83), edge: GUN[1] });
    const F = front(p, bc + 0.55);
    pq(p, F, a0 + 0.04, W - 0.09, 2, 3.4, AMBER[4]);
    for (let i = 0; i < 4; i++) pq(p, F, a0 + 0.1 + i * 0.2, a0 + 0.2 + i * 0.2, 2, 3.4, '#1c1e26');
    pq(p, F, a0 + 0.2, a0 + 0.6, zc + 3.6, zc + 4.6, '#e8ecf2');
    lbox(p, a0 - 0.1, bc - 0.65, 1.0, 1.3, zc + 6.5, 0.8, { front: flat(ALU), side: flat(ALU), top: tone(ALU, 1), edge: GUN[1] });
    const [lx, ly] = p.P(a0 + 0.4, bc + 0.6, zc + 2);
    led(p.c, lx, ly, GREEN, 3);
  },
};

// ── thrusters and truss mounts ───────────────────────────────
/** An RCS quad on the deck's corner: a scorched housing, flared bells up and to the sides. */
const spc_thruster: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    footShadow(p, 0.3, 0.3, W - 0.3, D - 0.3, 14, 0.36);
    lbox(p, cx - 0.55, cb - 0.55, 1.1, 1.1, 0, 1.6, { front: plating(GUN, 14, 10, 71), side: plating(GUN, 14, 10, 72), top: plating(GUN, 12, 12, 73), edge: GUN[0] });
    lbox(p, cx - 0.36, cb - 0.36, 0.72, 0.72, 1.6, 7.4, { front: foil(GOLD), side: foil(GOLD), top: plating(GUN, 12, 12, 74), edge: GOLD[0] });
    // the bells: up, out to +a and out to +b
    bell(p, cx, cb, 9, cx, cb, 12.6, 0.12, 0.3, { ramp: GUN, mouth: '#140e12' });
    bell(p, cx + 0.34, cb, 5.6, cx + 0.95, cb, 5.6, 0.1, 0.24, { ramp: GUN, mouth: '#140e12' });
    bell(p, cx, cb + 0.34, 5.6, cx, cb + 0.95, 5.6, 0.1, 0.24, { ramp: GUN, mouth: '#140e12' });
    const [lx, ly] = p.P(cx - 0.36, cb + 0.37, 8.2);
    led(p.c, lx, ly, AMBER, 2);
    void k;
  },
  anim(p, k) {
    // now and then a short puff from the side bell
    const cyc = (k.t * 0.3 + k.seed * 0.17) % 1;
    if (cyc > 0.08) return;
    const [x, y] = p.P(k.w / 2 + 1.1, k.d / 2, 5.6);
    const s = s4(p);
    p.c.globalAlpha = 0.5 * (1 - cyc / 0.08);
    ell(p.c, x + 8 * s, y + 4 * s, 10 * s, 6 * s, '#e8f2ff');
    p.c.globalAlpha = 1;
  },
};

/** Where a truss leaves the deck: an insulated column with braces, the truss bolts onto its cap. */
const spc_mount: PropArt = {
  draw(p, k) {
    footShadow(p, 0.05, 0.05, 0.95, 0.95, 18, 0.38);
    lbox(p, 0.06, 0.06, 0.88, 0.88, 0, 1.2, { front: plating(GUN, 14, 6, 91), side: plating(GUN, 14, 6, 92), top: plating(GUN, 14, 14, 93), edge: GUN[0] });
    for (const [a, b] of [[0.14, 0.86], [0.86, 0.86], [0.86, 0.14]] as const) L3(p, a, b, 1.2, 0.5, 0.5, 12, GUN[4], 2);
    lbox(p, 0.24, 0.24, 0.52, 0.52, 1.2, 15.4, { front: foil(GOLD), side: foil(GOLD), top: tone(GUN, 1), edge: GOLD[0] });
    lbox(p, 0.04, 0.04, 0.92, 0.92, 16.6, 1.4, { front: plating(ALU, 16, 6, 94), side: plating(ALU, 16, 6, 95), top: plating(ALU, 16, 16, 96), edge: GUN[1] });
    // a handrail up the column and a label
    const F = front(p, 0.76);
    pq(p, F, 0.3, 0.7, 12, 13, '#e8ecf2');
    pq(p, F, 0.32, 0.4, 12.2, 12.8, AMBER[4]);
    const [x0, y0] = p.P(0.62, 0.78, 3);
    const [, y1] = p.P(0.62, 0.78, 15);
    px(p.c, x0, y1, AMBER[4], 2, y0 - y1);
    void k;
  },
  anim(p, k) {
    const [x, y] = p.P(0.5, 0.5, 18.2);
    const s = Math.max(1, Math.round(s4(p)));
    if (Math.sin(k.t * 2 + k.seed * 2.1) > 0.5) {
      px(p.c, x - s, y - 2 * s, RED[6], 2 * s, 2 * s);
      p.c.globalAlpha = 0.3;
      px(p.c, x - 3 * s, y - 4 * s, RED[5], 6 * s, 6 * s);
      p.c.globalAlpha = 1;
    }
  },
};

export const SPACE_STATION: Record<string, PropArt> = {
  spc_edge,
  spc_module,
  spc_adapter,
  spc_truss,
  spc_solar,
  spc_radiator,
  spc_dish,
  spc_tower,
  spc_arm,
  spc_shuttle,
  spc_tunnel,
  spc_thruster,
  spc_mount,
};

export { L3, s4 };

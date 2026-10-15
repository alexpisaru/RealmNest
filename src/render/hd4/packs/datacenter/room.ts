// Data Center — the data hall's furniture at 128×64 (1 z ≈ 10 cm; a person is ~17.5 z).
// Black 42U rack rows (perforated and glass doors, LEDs alive, a ladder tray of
// colour-coded cable on top), a downflow cooling unit breathing cold air, the
// open-frame network core spilling patch cords, two NOC consoles, a service
// trolley, a birch coffee nook with a drinks fridge, a bench with a sheepskin,
// potted plants, and the hall's ribbed cladding cut low for the front walls.
import { darken, lighten, mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { parseColor } from '../../../hd/soft';
import { bayer, contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng, soft } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { brushed, grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { at, label, meshDoor, ribbed, snowTop, unit } from './kit';
import { ANTH, CAB, CABLES, CLAD, GALV, LED, PANEL, PLY, RACK, RED, SNOW, STEEL, YEL } from './palette';

const rackPaint = paint(RACK);
const steelPaint = paint(STEEL);
const galvPaint = brushed(GALV, 0.65);

// ── rack rows ───────────────────────────────────────────────
const RZ = 20.4;
const RB0 = 0.06;
const RB1 = 0.94;
const RACKS = 6;
type DoorKind = 'mesh' | 'glass' | 'solid';
const rackW = (W: number) => (W - 0.08) / RACKS;
const doorKind = (seed: number, i: number): DoorKind => {
  const h = hash(seed, i, 71);
  return h < 0.58 ? 'mesh' : h < 0.9 ? 'glass' : 'solid';
};
/** Row letters by placement order (the hall's rows A, C, B, D). */
const rowName = (seed: number) => ['A', 'C', 'B', 'D'][(seed - 1) % 4] ?? 'E';

/** Glass door: tinted, servers behind it clearly (silver and black fronts, drive bays), a reflection. */
const glassDoor: Mat = (light, w) => (u, v) => {
  if (u < 1.5 || u > w - 1.5 || v < 1.5) return at(RACK, light ? 3 : 2);
  const band = Math.floor(v / 4);
  const f = v - band * 4;
  const kind = hash(band, Math.floor(w), 77);
  let col: string;
  if (kind < 0.18) col = at(RACK, 1); // blanking panel
  else if (kind < 0.55) col = f > 3.1 ? '#8a96a4' : f < 0.8 ? '#2a3038' : u % 3.2 < 1 ? '#3e4652' : '#68727e'; // silver server with drive bays
  else col = f > 3.1 ? '#3a424e' : f < 0.8 ? '#0c0e12' : u % 5 < 1 ? '#1a1e26' : '#232a33'; // black server
  if ((u * 0.7 + v) % 70 < 7) col = mix(col, '#c8e0f0', 0.28);
  return mix(col, '#0a1420', 0.25);
};

/** An open rack: servers in silver and black, their drive bays and handles, no glass. */
const openRack: Mat = (light, w) => (u, v) => {
  if (u < 1.2 || u > w - 1.2) return at(RACK, light ? 2 : 1);
  const band = Math.floor(v / 4);
  const f = v - band * 4;
  const kind = hash(band, 3, 79);
  if (kind < 0.15) return at(RACK, 1);
  if (kind < 0.6) return f > 3.1 ? '#a6b0bc' : f < 0.8 ? '#2a3038' : u % 3.2 < 1 ? '#4a525e' : '#7a8490';
  return f > 3.1 ? '#46505c' : f < 0.8 ? '#0c0e12' : u % 5 < 1 ? '#1a1e26' : '#2a313b';
};

/** Solid door of a power rack: vertical vent slots top and bottom. */
const solidDoor: Mat = (light, w, h) => (u, v) => {
  let i = light ? 3 : 2.2;
  if ((v < 16 || v > h - 16) && u % 4 < 1.6 && u > 4 && u < w - 4) i -= 1.6;
  if (u < 1.4) i += 0.8;
  return at(RACK, i);
};

const servers: PropArt = {
  draw(p, k) {
    const W = k.w;
    const rw = rackW(W);
    footShadow(p, 0.04, RB0, W - 0.04, RB1, RZ, 0.3);
    // the row as one carcass: a black plinth, the racks, the end panel
    lbox(p, 0.04, RB0, W - 0.08, RB1 - RB0, 0, RZ, {
      front: rackPaint,
      side: (light) => (u, v, x, y) => {
        // the end panel: smooth black steel, a seam, a dull sheen low down
        let i = light ? 3 : 2.1;
        if (u % 34 < 1) i -= 1;
        if (v > 8 && v < 12) i += 0.4;
        if (hash(x, y, 81) < 0.02) i += 0.8;
        return at(RACK, i);
      },
      top: (light) => (u, v) => {
        // the rack roofs: a seam per rack, a vent grille, a brush grommet
        const ru = u % (rw * 71.55);
        let i = light === 2 ? 4 : 3;
        if (ru < 1.2) return at(RACK, 1);
        if (v > 30 && v < 46 && ru > 6 && ru < rw * 71.55 - 6 && Math.floor(u) % 3 === 0) i -= 2;
        if (v > 8 && v < 16 && Math.abs(ru - rw * 35.8) < 9) return at(RACK, 0);
        return at(RACK, i);
      },
      edge: RACK[0],
    });
    const F = front(p, RB1);
    const S = side(p, W - 0.04);
    for (let i = 0; i < RACKS; i++) {
      const a0 = 0.04 + i * rw;
      const a1 = a0 + rw;
      const kind = doorKind(k.seed, i);
      const open = rowName(k.seed) === 'D' && i === RACKS - 1;
      // the frame round the door, the door, its top strip with the label
      pq(p, F, a0, a1, 0, RZ, RACK[1]);
      pq(p, F, a0 + 0.012, a1 - 0.012, 0.15, 0.6, RACK[3]);
      if (open) {
        // the fault: this rack's door stands open, servers and patch cords laid bare
        pt(p, F, a0 + 0.035, a1 - 0.025, 0.8, RZ - 1.3, openRack, F.light);
        layer(p.c, (l) => {
          for (let j = 0; j < 9; j++) {
            const z = 2.4 + j * 1.9;
            const [x0, y0] = F.F(a0 + 0.12, z);
            const [x1, y1] = F.F(a1 - 0.1, z - 0.6);
            curve(l, x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 5, x1, y1, CABLES[[1, 1, 0, 2, 1, 3, 1, 4, 1][j]]);
          }
        }, { outline: false });
      } else pt(p, F, a0 + 0.035, a1 - 0.025, 0.8, RZ - 1.3, kind === 'mesh' ? meshDoor : kind === 'glass' ? glassDoor : solidDoor, F.light);
      pq(p, F, a0 + 0.035, a1 - 0.025, RZ - 1.25, RZ - 0.35, '#0c1016');
      pq(p, F, a0 + 0.06, a0 + 0.3, RZ - 1.05, RZ - 0.55, '#e8ecf0');
      label(p, F, a0 + 0.08, RZ - 0.62, `${rowName(k.seed)}0${i + 1}`, '#1a1e24');
      // a swing handle with its lock
      pq(p, F, a1 - 0.08, a1 - 0.05, 8.4, 12.6, '#9aa4ae');
      pq(p, F, a1 - 0.08, a1 - 0.065, 8.4, 12.6, '#d8dee4');
      pq(p, F, a1 - 0.085, a1 - 0.045, 9.6, 10.2, '#4a525c');
      // a velcro tag and an asset sticker on some doors
      if (hash(k.seed, i, 73) < 0.4) pq(p, F, a0 + 0.1, a0 + 0.2, 4, 4.8, ['#f2c230', '#3a86e0', '#d8402e'][i % 3]);
      if (hash(k.seed, i, 74) < 0.5) pq(p, F, a0 + 0.07, a0 + 0.17, 14, 14.6, '#f4f6f8');
    }
    if (rowName(k.seed) === 'D') {
      // the open door, swung out on its left hinge: its plain inside faces us
      const a0 = 0.04 + (RACKS - 1) * rw + 0.035;
      const tip: [number, number] = [a0 - 0.16, RB1 + 0.58];
      poly3(p, [[a0, RB1 + 0.01, 0.8], [tip[0], tip[1], 0.8], [tip[0], tip[1], RZ - 1.3], [a0, RB1 + 0.01, RZ - 1.3]], (u: number, v: number) => (u < 2 || v < 2 || v > 70 ? RACK[2] : u % 9 < 1 ? RACK[1] : RACK[3]), 0);
      const [hx, hy] = p.P(tip[0] + 0.02, tip[1] - 0.06, 10.5);
      px(p.c, hx, hy - 8, '#9aa4ae', 2, 14);
    }
    // the end panel: the row sign, an aisle sensor with its little screen, the cold-aisle arrow
    pq(p, S, RB1 - 0.62, RB1 - 0.1, 15.6, 19.2, '#1e4a8a');
    pq(p, S, RB1 - 0.6, RB1 - 0.12, 15.8, 19, '#2a62b0');
    label(p, S, RB1 - 0.28, 18.6, rowName(k.seed), '#f4f6f8', -1, 2);
    pq(p, S, RB1 - 0.5, RB1 - 0.24, 11.2, 13, '#1a1e24');
    pq(p, S, RB1 - 0.47, RB1 - 0.27, 11.5, 12.7, '#0e2a1e');
    pq(p, S, RB1 - 0.34, RB1 - 0.06, 6, 7.2, '#2a8ad8');
    label(p, S, RB1 - 0.08, 7, '>', '#e8f2ff', -1);
    // the ladder tray on top of the row: posts, two rails, a bundle of blue, a yellow fibre runner beside it
    const TZ = RZ + 2.6;
    for (const a of [0.35, W / 2, W - 0.35]) lbox(p, a - 0.025, 0.46, 0.05, 0.05, RZ, TZ - RZ, mono(galvPaint, GALV[0]));
    // the cables dropping from the tray into each rack (behind the near rail)
    layer(p.c, (l) => {
      for (let i = 0; i < RACKS; i++) {
        const a = 0.04 + (i + 0.5) * rw;
        for (let j = 0; j < 4; j++) {
          const [x0, y0] = p.P(a - 0.1 + j * 0.06, 0.5, TZ);
          const [x1, y1] = p.P(a - 0.12 + j * 0.07, 0.42, RZ + 0.1);
          curve(l, x0, y0, x0 + 4 + j, (y0 + y1) / 2, x1, y1, j === 3 ? CABLES[2] : CABLES[1]);
        }
      }
    }, { outline: false });
    lbox(p, 0.12, 0.34, W - 0.24, 0.3, TZ + 0.15, 0.45, {
      front: (light) => (u, v) => at(['#16325a', '#1e4478', '#2a5a9a', '#3a74bc', '#5a92d4'], (light ? 2.6 : 1.8) + (v > 1.4 ? 1 : 0) + (u % 7 < 1 ? -0.7 : 0)),
      side: (light) => () => at(['#16325a', '#1e4478', '#2a5a9a', '#3a74bc'], light ? 2 : 1),
      top: () => (_u, v) => {
        const lane = Math.floor(v / 2.2);
        return ['#3a74bc', '#2a5a9a', '#5a92d4', '#3a74bc', '#d8402e', '#3a74bc', '#3cb45a', '#2a5a9a'][lane % 8] + '';
      },
      edge: '#10284a',
    });
    // the ladder's rails and rungs
    lbox(p, 0.1, 0.3, W - 0.2, 0.04, TZ, 0.7, mono(galvPaint, GALV[0]));
    lbox(p, 0.1, 0.66, W - 0.2, 0.04, TZ, 0.7, mono(galvPaint, GALV[0]));
    lbox(p, 0.12, 0.74, W - 0.24, 0.14, TZ + 0.2, 0.55, {
      front: (light) => (_u, v) => (v > 1.8 ? '#f8d860' : light ? '#e8b628' : '#c09420'),
      side: () => () => '#a8821c',
      top: () => (_u, v) => (v > 4 ? '#f8d860' : '#d8a824'),
      edge: '#6a5010',
    });
  },
  anim(p, k) {
    const W = k.w;
    const rw = rackW(W);
    const F = front(p, RB1);
    const s = unit(p);
    const t = k.t;
    for (let i = 0; i < RACKS; i++) {
      const a0 = 0.04 + i * rw;
      const kind = doorKind(k.seed, i);
      // the status strip at the door's top: green, one rack in the fault row blinking amber
      const fault = rowName(k.seed) === 'D' && i === 3;
      const [sx, sy] = F.F(a0 + rw - 0.2, RZ - 0.75);
      px(p.c, sx, sy, fault ? (Math.sin(t * 6) > 0 ? LED.amber : LED.amberDim) : LED.green, 2 * s, s);
      if (kind === 'solid') {
        const [qx, qy] = F.F(a0 + rw * 0.5, 10);
        px(p.c, qx, qy, LED.blue, s, s);
        continue;
      }
      // a column of server LEDs: power steady, activity flickering, the odd amber
      for (let r = 0; r < 17; r++) {
        const z = 1.7 + r * 1.0;
        const h = hash(i, r, k.seed);
        if (kind === 'mesh' && h > 0.75) continue;
        const [x, y] = F.F(a0 + 0.1 + (h > 0.5 ? 0.04 : 0), z);
        const act = Math.sin(t * (6 + h * 9) + h * 40) + Math.sin(t * 13.7 + r) * 0.6 > 0.2;
        px(p.c, x, y, h < 0.04 ? LED.amber : LED.green, s, s);
        if (act) px(p.c, x + 2 * s, y + s, h > 0.6 ? LED.blue : LED.green, s, s);
        if (kind === 'glass' && h < 0.5) {
          const [x2, y2] = F.F(a0 + rw - 0.16, z);
          if (Math.sin(t * 9 + h * 31 + r) > 0) px(p.c, x2, y2, LED.blue, s, s);
        }
      }
    }
  },
};

// ── the downflow cooling unit ───────────────────────────────
const cooling: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 21;
    footShadow(p, 0.05, 0.12, W - 0.05, 0.92, Z, 0.28);
    const cab = paint(CAB);
    // the cabinet, its louvred kick plate, three doors; the return-air hood on top
    lbox(p, 0.05, 0.12, W - 0.1, 0.8, 0, Z, { front: cab, side: cab, top: cab, edge: CAB[0] });
    const F = front(p, 0.92);
    const S = side(p, W - 0.05);
    pt(p, F, 0.06, W - 0.06, 0.3, 2.2, (_u: number, v: number) => (v % 3 < 1 ? '#3a4048' : '#8a929c'), F.light);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a0 = 0.08 + ((W - 0.16) * i) / n;
      const a1 = 0.08 + ((W - 0.16) * (i + 1)) / n - 0.02;
      pq(p, F, a0, a1, 2.5, Z - 0.6, darken(CAB[3], 0.18));
      pq(p, F, a0 + 0.015, a1, 2.6, Z - 0.6, CAB[F.light ? 4 : 3]);
      pq(p, F, a0 + 0.015, a0 + 0.03, 2.6, Z - 0.6, CAB[6]);
      // a recessed latch
      pq(p, F, a1 - 0.07, a1 - 0.04, 10, 12.4, '#4a525c');
    }
    // the control panel on the left door: a dark screen, the LED row, a keypad
    pq(p, F, 0.16, 0.6, 13.4, 16.4, '#2a3038');
    pq(p, F, 0.18, 0.58, 13.7, 16.1, '#0a1a2a');
    for (let i = 0; i < 4; i++) pq(p, F, 0.2 + i * 0.07, 0.24 + i * 0.07, 12.2, 12.8, '#5a6068');
    // the maker's band, a warning triangle, a service tag on a cable tie
    pq(p, F, 0.08, W - 0.08, Z - 2, Z - 1.4, '#2a62b0');
    const [wx, wy] = F.F(W - 0.34, 15.4);
    fillPoly(p.c, [[wx, wy - 5], [wx - 5, wy + 4], [wx + 5, wy + 4]], '#1e1e22');
    fillPoly(p.c, [[wx, wy - 3], [wx - 3, wy + 3], [wx + 3, wy + 3]], YEL[4]);
    px(p.c, wx, wy - 1, '#1e1e22', 1, 3);
    pq(p, F, 0.84, 0.98, 8.4, 10.6, '#f2e8b8');
    pq(p, F, 0.86, 0.96, 9.8, 10.2, '#5a5040');
    // the side: a big service label and the pipe gland near the floor
    pq(p, S, 0.5, 0.82, 12, 15, '#f4f6f8');
    for (let i = 0; i < 4; i++) pq(p, S, 0.53, 0.79 - i * 0.04, 12.4 + i * 0.6, 12.7 + i * 0.6, '#5a6470');
    pq(p, S, 0.3, 0.44, 1, 3, '#2a3038');
    // the return-air hood with its louvred grille facing the room
    lbox(p, 0.1, 0.16, W - 0.2, 0.72, Z, 6.4, { front: paint(CAB), side: paint(CAB), top: (light) => (u, v) => (u % 6 < 2 && v > 4 && v < 40 ? '#3a4048' : at(CAB, light === 2 ? 5 : 4)), edge: CAB[0] });
    const H2 = front(p, 0.88);
    pt(p, H2, 0.16, W - 0.16, Z + 0.6, Z + 5.8, (_u: number, v: number) => (v % 3.2 < 1.2 ? '#2a3038' : v % 3.2 < 2 ? '#7a828c' : '#c6cbd0'), H2.light);
  },
  anim(p, k) {
    const F = front(p, 0.92);
    const s = unit(p);
    const t = k.t;
    // the screen: supply temperature, a fan bar breathing
    const [x, y] = F.F(0.22, 15.6);
    const temp = (18 + Math.sin(t * 0.3) * 0.4).toFixed(1);
    if (s === 1) for (let i = 0; i < temp.length; i++) {
      const ch = temp[i];
      if (ch === '.') px(p.c, x + i * 5 + 1, y + 6, '#62e6f0', 1, 1);
      else for (let j = 0; j < 5; j++) if ((parseInt(ch, 10) + j) % 3 !== 0) px(p.c, x + i * 5, y + j + 2, '#62e6f0', 3, 1);
    }
    else px(p.c, x, y + 2, '#62e6f0', 8, 2);
    const fan = Math.round((0.5 + 0.5 * Math.sin(t * 0.8)) * 6);
    for (let i = 0; i < 6; i++) {
      const [bx, by] = F.F(0.3 + i * 0.04, 14.2);
      px(p.c, bx, by, i < fan ? '#3cb45a' : '#123018', s, s);
    }
    const [lx, ly] = F.F(0.52, 12.5);
    px(p.c, lx, ly, Math.sin(t * 2) > -0.6 ? LED.green : LED.greenDim, 2 * s, s);
    // cold air spilling out across the floor
    p.c.globalAlpha = 0.14;
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.25 + i / 4) % 1;
      const [cx, cy] = p.P(0.3 + i * 0.45, 0.95 + ph * 0.9, 0.4);
      ell(p.c, cx, cy, (10 + ph * 18) * s, (3 + ph * 4) * s, '#d8f0ff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── the network core: an open-frame rack spilling patch cords ──
const netcab: PropArt = {
  draw(p, k) {
    const Z = 21.4;
    footShadow(p, 0.08, 0.1, 0.92, 0.9, Z, 0.28);
    // a solid side panel toward the room's back, the open front: posts, cable managers, patch panels, switches
    lbox(p, 0.1, 0.12, 0.8, 0.78, 0, 0.6, mono(rackPaint, RACK[0]));
    lbox(p, 0.1, 0.12, 0.8, 0.05, 0.6, Z - 0.6, mono(rackPaint, RACK[0]));
    lbox(p, 0.1, 0.12, 0.8, 0.78, Z - 0.6, 0.6, mono(rackPaint, RACK[0]));
    const F = front(p, 0.86);
    // equipment between the posts: patch panels (grey, rows of ports) and switches (black)
    for (let r = 0; r < 12; r++) {
      const z = 1.6 + r * 1.55;
      const sw = r % 3 === 1;
      lbox(p, 0.2, 0.2, 0.6, 0.64, z, 1.2, {
        front: (light) => (u, v) => {
          if (sw) return u % 4 < 2 && v > 1.6 && v < 3.4 ? '#06080a' : at(RACK, light ? 3 : 2);
          return u % 3 < 1.5 && v > 1.2 && v < 3.6 ? '#2a3038' : light ? '#a8b0b8' : '#8a929a';
        },
        side: mono(rackPaint).side,
        top: mono(rackPaint).top,
        edge: RACK[0],
      });
    }
    // the posts and the vertical cable managers with their fingers
    for (const a of [0.1, 0.8]) {
      lbox(p, a, 0.72, 0.1, 0.16, 0.6, Z - 1.2, {
        front: (light) => (_u, v) => (v % 6 < 2 ? '#06080a' : at(RACK, light ? 3 : 2)),
        side: mono(rackPaint).side,
        top: mono(rackPaint).top,
        edge: RACK[0],
      });
    }
    // patch cords: dense loops in colour bundles falling into the managers
    layer(p.c, (l) => {
      const Rn = rng(k.seed * 11 + 3);
      for (let r = 0; r < 12; r++) {
        const z = 1.6 + r * 1.55 + 0.6;
        const col = CABLES[r % 3 === 1 ? 1 : [0, 2, 3, 4, 1, 5][r % 6]];
        for (let j = 0; j < 7; j++) {
          const a = 0.24 + j * 0.08 + Rn() * 0.02;
          const [x0, y0] = F.F(a, z);
          const side2 = a < 0.5 ? 0.16 : 0.84;
          const [x1, y1] = F.F(side2, z - 1.2 - Rn() * 1.5);
          curve(l, x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 4 + Rn() * 4, x1, y1, Rn() < 0.75 ? col : CABLES[Math.floor(Rn() * 6)]);
        }
      }
      // the bundles running down the managers
      for (const a of [0.15, 0.85])
        for (let j = 0; j < 3; j++) {
          const [x0, y0] = F.F(a - 0.03 + j * 0.03, Z - 1.2);
          const [x1, y1] = F.F(a - 0.03 + j * 0.03, 0.8);
          ln(l, x0, y0, x1, y1, CABLES[[1, 0, 2][j]], 2);
        }
    }, { outline: false });
    // a brush grommet in the floor tile beside it, the trunk of blue cable rising out of it into the core
    const [gx, gy] = p.P(0.82, 1.08, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[gx - 12, gy], [gx, gy - 6], [gx + 12, gy], [gx, gy + 6]], '#121418');
      for (let i = -9; i <= 9; i += 2) px(l, gx + i, gy - 1 + Math.abs(i) * 0.15, '#3a3e46', 1, 2);
      for (let j = 0; j < 5; j++) curve(l, gx - 4 + j * 2, gy, gx - 8 + j * 2, gy - 10, gx - 14 + j * 2, gy - 14, j === 2 ? CABLES[0] : CABLES[1], 2);
    }, { rect: [gx - 18, gy - 18, gx + 14, gy + 8] });
    // the core's label
    pq(p, F, 0.3, 0.7, Z - 0.5, Z + 0.4, '#e8ecf0');
    label(p, F, 0.33, Z + 0.25, 'CORE', '#1a1e24');
  },
  anim(p, k) {
    const F = front(p, 0.86);
    const s = unit(p);
    for (let r = 0; r < 12; r++) {
      if (r % 3 !== 1) continue;
      const z = 1.6 + r * 1.55 + 0.95;
      for (let j = 0; j < 10; j++) {
        const on = Math.sin(k.t * (8 + j * 1.7) + j * 3.1 + r) > -0.3;
        const [x, y] = F.F(0.24 + j * 0.055, z);
        px(p.c, x, y, on ? (j % 4 === 3 ? LED.amber : LED.green) : '#0e2416', s, s);
      }
    }
  },
};

// ── the NOC consoles ────────────────────────────────────────
/** A racing-style operator chair in charcoal with teal bolsters and a headrest, turned toward the screens. */
function opChair(p: PropPainter, a: number, b: number, seed: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 7, y + 2, 15, 5, 0.26);
  const teal = ['#14504a', '#1e6a62', '#2a8a7e', '#3aa898'];
  layer(p.c, (l) => {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + seed;
      const ex = x + Math.cos(ang) * 12;
      const ey = y + Math.sin(ang) * 5;
      ln(l, x, y - 3, ex, ey - 2, '#3a3e46', 2);
      px(l, ex - 1, ey - 2, '#16181c', 3, 3);
    }
    px(l, x - 1, y - 17, '#2a2e34', 3, 14);
    px(l, x, y - 17, '#6a707a', 1, 14);
    // the seat with raised side bolsters
    fillPoly(l, [[x - 13, y - 18], [x + 11, y - 23], [x + 13, y - 19], [x - 11, y - 14]], '#22252b');
    fillPoly(l, [[x - 13, y - 19], [x - 9, y - 20], [x - 8, y - 16], [x - 12, y - 15]], teal[2]);
    fillPoly(l, [[x + 8, y - 24], [x + 12, y - 25], [x + 13, y - 21], [x + 9, y - 20]], teal[1]);
    fillPoly(l, [[x - 8, y - 19], [x + 8, y - 22], [x + 9, y - 20], [x - 7, y - 17]], '#30343c');
    // the tall back: bolstered sides, a headrest with its cut-outs, teal piping
    fillPoly(l, [[x - 10, y - 21], [x + 9, y - 25], [x + 10, y - 52], [x - 9, y - 48]], '#1c1f24');
    fillPoly(l, [[x - 10, y - 21], [x - 6, y - 22], [x - 5, y - 49], [x - 9, y - 48]], teal[2]);
    fillPoly(l, [[x + 6, y - 24], [x + 9, y - 25], [x + 10, y - 52], [x + 7, y - 51]], teal[0]);
    fillPoly(l, [[x - 5, y - 23], [x + 5, y - 25], [x + 6, y - 46], [x - 4, y - 44]], '#2a2e35');
    for (let j = 0; j < 4; j++) ln(l, x - 4, y - 27 - j * 4, x + 5, y - 29 - j * 4, '#22252b');
    px(l, x - 3, y - 42, '#0e1012', 2, 3);
    px(l, x + 3, y - 43, '#0e1012', 2, 3);
    fillPoly(l, [[x - 5, y - 37], [x + 5, y - 39], [x + 5, y - 36], [x - 5, y - 34]], '#3a3e46');
    // the armrests
    for (const sgn of [-1, 1]) {
      ln(l, x + sgn * 12, y - 19 - (sgn > 0 ? 4 : 0), x + sgn * 12, y - 27 - (sgn > 0 ? 4 : 0), '#3a3e46', 2);
      px(l, x + sgn * 12 - 3, y - 28 - (sgn > 0 ? 4 : 0), '#16181c', 7, 2);
    }
  }, { rect: [x - 20, y - 60, x + 22, y + 6] });
}

/** A monitor on an arm, facing the room; the picture comes from anim. */
function screenBox(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number) {
  lbox(p, a0, b - 0.03, a1 - a0, 0.03, z0, z1 - z0, { front: paint(ANTH), side: paint(ANTH), top: paint(ANTH), edge: ANTH[0] });
  pq(p, front(p, b), a0 + 0.02, a1 - 0.02, z0 + 0.35, z1 - 0.25, '#0a0e14');
}

/** Live dashboards: a latency graph, a stack of service tiles, a log tail. */
function dashboard(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number, t: number, seed: number, kind: number) {
  const F = front(p, b);
  const w = a1 - a0;
  if (kind === 0) {
    pq(p, F, a0, a1, z0, z1, '#0c1620');
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 10; i++) {
      const u = a0 + (w * i) / 10;
      const v = 0.5 + 0.3 * Math.sin(i * 1.1 + t * 1.3 + seed) + 0.12 * Math.sin(i * 2.9 - t * 2);
      const q = F.F(u, z0 + 0.3 + v * (z1 - z0 - 0.6));
      if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#5cf08a');
      prev = q;
    }
    pq(p, F, a0 + 0.03, a0 + w * 0.3, z1 - 0.7, z1 - 0.35, '#3a5a72');
  } else if (kind === 1) {
    pq(p, F, a0, a1, z0, z1, '#101820');
    for (let i = 0; i < 6; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      const bad = (Math.floor(t * 0.4 + seed) % 6) === i && Math.sin(t * 5) > 0;
      pq(p, F, a0 + 0.03 + c * (w / 3), a0 + (c + 1) * (w / 3) - 0.02, z0 + 0.3 + r * ((z1 - z0) / 2), z0 + (r + 1) * ((z1 - z0) / 2) - 0.2, bad ? '#c8402a' : i === 4 ? '#c88a2a' : '#2a8a5a');
    }
  } else {
    pq(p, F, a0, a1, z0, z1, '#0a0e12');
    const off = (t * 1.5 + seed) % 1;
    for (let i = 0; i < 6; i++) {
      const z = z0 + 0.3 + ((i + off) / 6) * (z1 - z0 - 0.6);
      const len = 0.25 + hash(i + Math.floor(t * 1.5 + seed), 3, seed) * 0.6;
      const col = hash(i + Math.floor(t * 1.5 + seed), 5, seed) < 0.15 ? '#ffb43a' : '#8ad8a0';
      const [x0, y0] = F.F(a0 + 0.04, z);
      const [x1, y1] = F.F(a0 + 0.04 + len * (w - 0.08), z);
      ln(p.c, x0, y0, x1, y1, col);
    }
  }
}

const desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7.4;
    footShadow(p, 0.12, 0.12, W - 0.12, 0.9, 8, 0.24);
    const leg = brushed(STEEL, 0.6);
    // steel T-legs on long feet, a cable tray and a perforated modesty panel
    for (const a of [0.2, W - 0.28]) {
      lbox(p, a - 0.02, 0.16, 0.12, 0.7, 0, 0.45, mono(leg, STEEL[0]));
      lbox(p, a, 0.44, 0.08, 0.1, 0.45, Z - 0.95, mono(leg, STEEL[0]));
    }
    lbox(p, 0.26, 0.16, W - 0.52, 0.04, 3.4, 3.4, {
      front: (light) => (u, v) => (u % 4 < 1.6 && v % 4 < 1.6 ? '#14161a' : at(ANTH, light ? 3 : 2)),
      side: paint(ANTH),
      top: paint(ANTH),
      edge: ANTH[0],
    });
    // a workstation tower on the floor under the right end, its blue power light
    lbox(p, W - 0.62, 0.3, 0.22, 0.46, 0, 4.6, { front: paint(RACK), side: brushed(RACK), top: paint(RACK), edge: RACK[0] });
    pq(p, front(p, 0.76), W - 0.58, W - 0.44, 3.8, 4.2, '#4aa8ff');
    // the top: anthracite linoleum with a pale bullnose edge band
    const lino: Mat = (light) => (u, v, x, y) => at(ANTH, (light === 2 ? 4.2 : light ? 3 : 2) + (hash(x, y, 91) < 0.05 ? -0.6 : 0) + ((u + v * 2) % 40 < 1 ? 0.3 : 0));
    lbox(p, 0.1, 0.12, W - 0.2, 0.76, Z - 0.5, 0.5, { front: (light) => (_u, v) => (v > 1.2 ? '#c8ccd0' : light ? '#9aa0a8' : '#7a8088'), side: () => () => '#8a9098', top: lino, edge: ANTH[0] });
    const tz = Z;
    // the dual monitor arm: a pole at the back, two screens
    lbox(p, W / 2 - 0.04, 0.16, 0.08, 0.08, tz, 5.6, mono(leg, STEEL[0]));
    lbox(p, 0.4, 0.2, W - 0.8, 0.05, tz + 4.4, 0.3, mono(leg, STEEL[0]));
    screenBox(p, 0.2, 0.97, 0.3, tz + 1.4, tz + 5.6);
    screenBox(p, 1.03, W - 0.2, 0.3, tz + 1.4, tz + 5.6);
    // sticky notes on a bezel
    const F = front(p, 0.3);
    pq(p, F, 0.24, 0.32, tz + 4.6, tz + 5.3, '#f6d860');
    pq(p, F, W - 0.3, W - 0.22, tz + 1.7, tz + 2.4, '#9fe3b8');
    // keyboard (backlit), mouse, headset, a desk phone, a mug, a notebook, a can, a rubber duck on one
    const [kx, ky] = anchor(p, W / 2 - 0.1, 0.62, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[kx - 20, ky + 2], [kx + 4, ky - 10], [kx + 20, ky - 2], [kx - 4, ky + 10]], '#16181c');
      fillPoly(l, [[kx - 18, ky + 2], [kx + 4, ky - 9], [kx + 18, ky - 2], [kx - 4, ky + 9]], '#25282e');
      for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) px(l, kx - 14 + j * 3.4 + i * 2, ky + 3 - i * 2 - j * 1.6, (i + j) % 7 === 0 ? '#3aa898' : '#3a3e46', 2, 1);
      ell(l, kx + 25, ky - 3, 3, 2, '#2a2e34');
      px(l, kx + 24, ky - 4, '#5a6068', 1, 1);
      // the notebook with a pen, a can of energy drink
      fillPoly(l, [[kx - 38, ky - 6], [kx - 26, ky - 12], [kx - 15, ky - 7], [kx - 27, ky - 1]], '#1e3a5a');
      fillPoly(l, [[kx - 36, ky - 6], [kx - 26, ky - 11], [kx - 17, ky - 7], [kx - 27, ky - 2]], '#eef0f2');
      for (let i = 0; i < 3; i++) ln(l, kx - 32 + i * 2, ky - 6 - i, kx - 24 + i * 2, ky - 10 - i, '#9aa4b0');
      ln(l, kx - 30, ky - 3, kx - 21, ky - 8, '#c83a2a');
    }, { rect: [kx - 44, ky - 16, kx + 32, ky + 12] });
    const [mx, my] = anchor(p, W - 0.28, 0.66, tz);
    const mug = ['#3aa898', '#e8eaee', '#d8402e'][k.seed % 3];
    layer(p.c, (l) => {
      px(l, mx - 4, my - 9, mug, 8, 9);
      px(l, mx - 4, my - 9, lighten(mug, 0.3), 2, 9);
      px(l, mx + 4, my - 7, darken(mug, 0.2), 3, 5);
      ell(l, mx, my - 9, 4, 1.5, '#3a2418');
      // the can
      px(l, mx - 14, my - 14, '#b8c0c8', 6, 11);
      px(l, mx - 14, my - 10, '#3cb45a', 6, 4);
      px(l, mx - 14, my - 14, '#e8eef4', 1, 11);
      ell(l, mx - 11, my - 14, 3, 1, '#d8dee4');
    }, { rect: [mx - 18, my - 18, mx + 9, my + 2] });
    // the headset on its hook at the left end, the phone beside it
    const [hx, hy] = anchor(p, 0.24, 0.66, tz);
    layer(p.c, (l) => {
      curve(l, hx - 6, hy - 2, hx - 1, hy - 14, hx + 5, hy - 3, '#2a2e34', 2);
      ell(l, hx - 6, hy - 2, 3, 3, '#16181c');
      ell(l, hx + 5, hy - 3, 3, 3, '#16181c');
      ln(l, hx - 6, hy, hx + 1, hy + 4, '#3a3e46');
    }, { rect: [hx - 10, hy - 18, hx + 10, hy + 6] });
    const [px0, py0] = anchor(p, 0.62, 0.62, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[px0 - 9, py0], [px0, py0 - 5], [px0 + 9, py0], [px0, py0 + 5]], '#2a2e34');
      fillPoly(l, [[px0 - 7, py0 - 1], [px0 - 1, py0 - 4], [px0 + 2, py0 - 2], [px0 - 4, py0 + 1]], '#7ab0a0');
      px(l, px0 - 10, py0 - 6, '#3a3e46', 8, 4);
    }, { rect: [px0 - 12, py0 - 10, px0 + 11, py0 + 7] });
    if (k.seed % 2 === 0) {
      // the debugging duck
      const [dx, dy] = anchor(p, 1.02, 0.42, tz);
      layer(p.c, (l) => {
        ell(l, dx, dy - 3, 5, 3.5, '#f2c230');
        ell(l, dx + 3, dy - 7, 3, 3, '#f2c230');
        px(l, dx + 5, dy - 7, '#ee8a2a', 3, 1);
        px(l, dx + 3, dy - 8, '#1a1418');
        px(l, dx - 3, dy - 5, '#fae07a', 3, 1);
      }, { rect: [dx - 7, dy - 12, dx + 10, dy + 2] });
    }
    // the chair, rolled back a little
    opChair(p, W * 0.5 + 0.2, 1.16, k.seed * 0.8);
  },
  anim(p, k) {
    const tz = 7.4;
    const kind = k.seed % 3;
    dashboard(p, 0.24, 0.93, 0.3, tz + 1.85, tz + 5.25, k.t, k.seed, kind);
    dashboard(p, 1.07, k.w - 0.24, 0.3, tz + 1.85, tz + 5.25, k.t, k.seed + 3, (kind + 1) % 3);
  },
};

// ── the service trolley ─────────────────────────────────────
const cart: PropArt = {
  draw(p, k) {
    footShadow(p, 0.18, 0.22, 0.86, 0.8, 9, 0.24);
    const frame = paint(['#3a4250', '#4a5464', '#5c6878', '#707e90', '#8696a8', '#9eaebe']);
    // four tube posts on castors, two shelves with lips, a push handle in blue
    for (const [a, b] of [[0.2, 0.26], [0.76, 0.26], [0.2, 0.72], [0.76, 0.72]] as const) {
      lbox(p, a, b, 0.04, 0.04, 0.8, 8.4, mono(frame, '#2a303a'));
      const [cx, cy] = anchor(p, a + 0.02, b + 0.02, 0.4);
      ell(p.c, cx, cy, 3, 2.4, '#16181c');
      px(p.c, cx - 1, cy - 1, '#5a6068', 2, 1);
    }
    for (const z of [2.4, 8.3]) {
      lbox(p, 0.18, 0.24, 0.64, 0.54, z, 0.4, { front: frame, side: frame, top: steelPaint, edge: '#2a303a' });
      lbox(p, 0.18, 0.74, 0.64, 0.04, z + 0.4, 0.5, mono(frame, '#2a303a'));
    }
    lbox(p, 0.16, 0.3, 0.04, 0.42, 9.6, 0.5, mono(paint(['#16325a', '#1e4478', '#2a5a9a', '#3a74bc', '#5a92d4', '#7aaee4']), '#10284a'));
    for (const b of [0.32, 0.68]) lbox(p, 0.17, b, 0.03, 0.03, 8.7, 1.0, mono(frame, '#2a303a'));
    // the top shelf: an open laptop on a console cable, a label printer, a parts box, a cable tester
    const tz = 8.7;
    lbox(p, 0.3, 0.42, 0.36, 0.26, tz, 0.25, mono(paint(RACK), RACK[0]));
    lbox(p, 0.3, 0.4, 0.36, 0.03, tz + 0.25, 2.7, mono(paint(RACK), RACK[0]));
    pq(p, front(p, 0.43), 0.32, 0.64, tz + 0.5, tz + 2.8, '#0a1410');
    const [lx, ly] = anchor(p, 0.48, 0.56, tz + 0.25);
    ln(p.c, lx + 10, ly - 1, lx + 22, ly + 6, '#4aa8ff');
    lbox(p, 0.66, 0.5, 0.12, 0.16, tz, 1.2, { front: paint(CAB), side: paint(CAB), top: paint(['#1e1e22', '#2a2a30', '#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76']), edge: CAB[0] });
    pq(p, front(p, 0.66), 0.67, 0.77, tz + 0.4, tz + 0.8, '#f4f6f8');
    const [bx, by] = anchor(p, 0.3, 0.32, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 8, by - 2], [bx + 2, by - 7], [bx + 10, by - 3], [bx, by + 2]], '#c8ccd0');
      for (let i = 0; i < 4; i++) px(l, bx - 4 + i * 3, by - 3 - i * 1.2, ['#d8402e', '#f2c230', '#3a86e0', '#3cb45a'][i], 2, 1);
      // the yellow cable tester
      fillPoly(l, [[bx + 14, by - 9], [bx + 19, by - 11], [bx + 21, by - 4], [bx + 16, by - 2]], '#f2c230');
      px(l, bx + 16, by - 8, '#2a3a2a', 3, 2);
    }, { rect: [bx - 10, by - 14, bx + 24, by + 4] });
    // the bottom shelf: a red toolbox, cable spools, a spare PSU in an anti-static bag
    const sz = 2.8;
    lbox(p, 0.24, 0.32, 0.36, 0.3, sz, 1.6, { front: paint(RED), side: paint(RED), top: paint(RED), edge: RED[0] });
    pq(p, front(p, 0.62), 0.26, 0.58, sz + 0.9, sz + 1.1, RED[1]);
    lbox(p, 0.36, 0.42, 0.12, 0.06, sz + 1.6, 0.4, mono(steelPaint, STEEL[0]));
    const [sx, sy] = anchor(p, 0.7, 0.42, sz);
    layer(p.c, (l) => {
      for (const [dx, col] of [[0, '#3a86e0'], [-3, '#f2c230']] as const) {
        ell(l, sx + dx, sy - 6, 5, 6, darken(col, 0.3));
        ell(l, sx + dx - 1, sy - 6, 4, 5, col);
        ell(l, sx + dx - 1, sy - 6, 1.5, 2, '#2a2a30');
      }
    }, { rect: [sx - 10, sy - 14, sx + 7, sy + 2] });
    const [gx, gy] = anchor(p, 0.6, 0.66, sz);
    layer(p.c, (l) => {
      fillPoly(l, [[gx - 8, gy - 1], [gx + 1, gy - 5], [gx + 9, gy - 1], [gx, gy + 3]], '#c88aa0');
      fillPoly(l, [[gx - 7, gy - 3], [gx + 1, gy - 7], [gx + 8, gy - 3], [gx, gy + 1]], '#e0a8bc');
    }, { rect: [gx - 10, gy - 9, gx + 11, gy + 5] });
    void k;
  },
  anim(p, k) {
    // the console terminal scrolling on the laptop
    const F = front(p, 0.43);
    const tz = 8.7;
    const off = (k.t * 2) % 1;
    for (let i = 0; i < 4; i++) {
      const z = tz + 0.7 + ((i + off) / 4) * 1.9;
      const len = 0.08 + hash(i + Math.floor(k.t * 2), 1, 7) * 0.2;
      const [x0, y0] = F.F(0.34, z);
      const [x1, y1] = F.F(0.34 + len, z);
      ln(p.c, x0, y0, x1, y1, '#5cf08a');
    }
  },
};

// ── the coffee nook ─────────────────────────────────────────
const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.04, 0.1, W - 0.04, 0.92, 9, 0.24);
    const birch = grain(PLY, 'v');
    // birch-ply cabinets with finger-pull slots, a recessed dark plinth, a glass-door drinks fridge
    lbox(p, 0.08, 0.14, W - 0.16, 0.72, 0, 0.7, mono(paint(ANTH), ANTH[0]));
    lbox(p, 0.04, 0.1, W - 0.08, 0.8, 0.7, Z - 1.3, { front: birch, side: birch, top: birch, edge: PLY[0] });
    const F = front(p, 0.9);
    for (let i = 0; i < 2; i++) {
      const a0 = 0.08 + i * 0.6;
      pq(p, F, a0 + 0.56, a0 + 0.58, 0.8, Z - 1.4, darken(PLY[2], 0.3));
      pq(p, F, a0 + 0.08, a0 + 0.48, Z - 2.2, Z - 1.9, darken(PLY[1], 0.4));
    }
    // the fridge: a steel frame, glass, cans lit in rows
    pq(p, F, 1.26, W - 0.08, 0.9, Z - 1.5, '#4a525c');
    pt(p, F, 1.3, W - 0.12, 1.1, Z - 1.7, (u: number, v: number) => {
      const shelf = v % 9;
      if (shelf < 1) return '#8a96a4';
      const can = Math.floor(u / 5);
      const f = u % 5;
      if (shelf > 7.4 || f > 3.8) return '#cfe6f4';
      const col = ['#3cb45a', '#d8402e', '#b8c0c8', '#3a86e0', '#f2c230'][(can + Math.floor(v / 9)) % 5];
      return f < 1 ? lighten(col, 0.3) : col;
    }, F.light);
    pq(p, F, 1.3, 1.34, 2, Z - 2.4, '#d8dee4');
    // the worktop: white solid surface with a rounded lit edge
    lbox(p, 0.02, 0.06, W - 0.04, 0.86, Z - 0.6, 0.6, { front: (light) => (_u, v) => (v > 1.3 ? '#f6f7f8' : light ? '#d8dcdf' : '#b8bcc0'), side: () => () => '#c4c8cc', top: (light) => (u, v, x, y) => (hash(x, y, 101) < 0.04 ? '#dfe3e6' : light === 2 ? '#f0f2f4' : '#e2e5e8') + ((u + v) < -1 ? '' : ''), edge: '#8a9098' });
    const tz = Z;
    // the bean-to-cup machine: black body, a chrome front, its blue screen, the spout and a cup
    const BLK: Ramp = ['#141418', '#1e1e24', '#2a2a32', '#383842', '#4a4a56', '#62626e'];
    lbox(p, 0.14, 0.2, 0.46, 0.5, tz, 4.6, { front: brushed(BLK), side: paint(BLK), top: paint(BLK), edge: '#0a0a0c' });
    // the bean hopper with its smoked lid, the brushed front panel, a drip tray
    lbox(p, 0.2, 0.24, 0.24, 0.24, tz + 4.6, 0.9, { front: paint(BLK), side: paint(BLK), top: (light) => () => (light === 2 ? '#5a4a3a' : '#3a2e24'), edge: '#0a0a0c' });
    const M = front(p, 0.7);
    pq(p, M, 0.16, 0.58, tz + 2.6, tz + 4.4, '#9aa0a8');
    pq(p, M, 0.16, 0.58, tz + 4.2, tz + 4.4, '#d8dce0');
    pq(p, M, 0.22, 0.42, tz + 3, tz + 4, '#0e2238');
    pq(p, M, 0.46, 0.52, tz + 3.2, tz + 3.6, '#2a2a30');
    pq(p, M, 0.46, 0.52, tz + 3.7, tz + 4, '#2a2a30');
    pq(p, M, 0.26, 0.48, tz + 1.9, tz + 2.4, '#3a3a42');
    lbox(p, 0.2, 0.66, 0.34, 0.1, tz, 0.4, mono(brushed(STEEL), STEEL[0]));
    const [cx, cy] = M.F(0.37, tz + 0.4);
    px(p.c, cx - 3, cy - 6, '#f6f4f0', 6, 6);
    px(p.c, cx - 3, cy - 6, '#ffffff', 2, 6);
    // a stack of cups, the cinnamon buns under a glass dome, a kettle, a mug tree, a succulent
    for (let i = 0; i < 2; i++) {
      const [ux, uy] = anchor(p, 0.72 + i * 0.13, 0.36, tz);
      px(p.c, ux - 3, uy - 12, '#f4f2ee', 6, 12);
      px(p.c, ux - 3, uy - 12, '#ffffff', 2, 12);
      for (let j = 0; j < 4; j++) px(p.c, ux - 3, uy - 3 - j * 3, '#d8d4cc', 6, 1);
    }
    const [dx, dy] = anchor(p, 1.12, 0.52, tz);
    layer(p.c, (l) => {
      ell(l, dx, dy - 1, 11, 4.5, '#c8ccd0');
      for (let i = 0; i < 5; i++) {
        const bx = dx - 6 + (i % 3) * 6;
        const by = dy - 4 - Math.floor(i / 3) * 4;
        ell(l, bx, by, 4, 2.6, '#a8642a');
        ell(l, bx - 1, by - 1, 3, 1.6, '#c8843e');
        px(l, bx - 2, by - 1, '#e8d0a0', 2, 1);
      }
      // the dome: a pale outline and a glint
      for (let a = 0; a < 26; a++) {
        const ang = Math.PI + (a / 25) * Math.PI;
        px(l, dx + Math.cos(ang) * 11, dy - 2 + Math.sin(ang) * 13, 'rgba(220,240,250,0.65)');
      }
      px(l, dx - 5, dy - 12, '#ffffff', 2, 3);
      px(l, dx - 1, dy - 17, '#9aa4ae', 2, 2);
    }, { outline: false, rect: [dx - 14, dy - 20, dx + 14, dy + 5] });
    const [kx, ky] = anchor(p, 1.52, 0.34, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[kx - 6, ky], [kx + 6, ky], [kx + 5, ky - 12], [kx - 5, ky - 12]], '#9aa4ae');
      px(l, kx - 6, ky - 12, '#c8d0d8', 3, 12);
      px(l, kx + 5, ky - 10, '#3a3e46', 3, 6);
      px(l, kx - 3, ky - 14, '#2a2e34', 6, 2);
      // the mug tree
      px(l, kx + 14, ky - 18, '#6a5a44', 2, 18);
      for (const [mx, my, c] of [[9, -15, '#3aa898'], [17, -13, '#d8402e'], [10, -9, '#f2c230']] as const) {
        px(l, kx + mx, ky + my, c, 5, 5);
        px(l, kx + mx, ky + my, lighten(c, 0.3), 1, 5);
      }
    }, { rect: [kx - 9, ky - 22, kx + 26, ky + 3] });
    const [sx, sy] = anchor(p, W - 0.2, 0.72, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[sx - 5, sy - 7], [sx + 5, sy - 7], [sx + 4, sy], [sx - 4, sy]], '#e8e4dc');
      for (let i = 0; i < 6; i++) {
        const a = -1.2 + i * 0.48;
        ell(l, sx + Math.sin(a) * 4, sy - 9 - Math.cos(a) * 3, 2, 3, ['#5a8a6a', '#7aa888', '#4a7a5a'][i % 3]);
      }
    }, { rect: [sx - 9, sy - 15, sx + 9, sy + 2] });
    void k;
  },
  anim(p, k) {
    // steam from a fresh cup, the machine's screen pulsing
    const [x, y] = anchor(p, 0.37, 0.7, 9.4);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.5 + i / 3) % 1;
      p.c.globalAlpha = 0.3 * (1 - t);
      ell(p.c, x + Math.sin(t * 6 + i) * 2 * u, y - t * 18 * u, (1.5 + t * 3) * u, (1.5 + t * 2) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
    const M = front(p, 0.7);
    const [sx, sy] = M.F(0.28, 9 + 4.2);
    px(p.c, sx, sy, Math.sin(k.t * 1.5) > 0 ? '#62e6f0' : '#3a86e0', Math.max(1, Math.round(4 * u)), Math.max(1, Math.round(u)));
  },
};

// ── the bench: birch slats on black steel, a sheepskin and a folded blanket ──
const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.24, W - 0.08, 0.78, 5, 0.24);
    const blk = paint(['#141418', '#1c1c22', '#26262e', '#30303a', '#3c3c46', '#4a4a56']);
    for (const a of [0.16, W - 0.22]) {
      lbox(p, a, 0.28, 0.06, 0.46, 0, 0.3, mono(blk, '#0a0a0c'));
      lbox(p, a, 0.28, 0.06, 0.06, 0.3, 3.9, mono(blk, '#0a0a0c'));
      lbox(p, a, 0.68, 0.06, 0.06, 0.3, 3.9, mono(blk, '#0a0a0c'));
    }
    const slat = grain(PLY);
    for (let i = 0; i < 5; i++) lbox(p, 0.08, 0.27 + i * 0.1, W - 0.16, 0.08, 4.1, 0.45, { front: slat, side: slat, top: slat, edge: PLY[1] });
    // the sheepskin: a creamy fluffy mass, curly locks
    const [sx, sy] = anchor(p, 0.55, 0.5, 4.6);
    layer(p.c, (l) => {
      const m: Mass[] = [];
      for (let i = 0; i < 7; i++) m.push({ x: sx - 14 + i * 4.5 + (i % 2) * 2, y: sy - 3 + (i % 3), rx: 7, ry: 5, z: i });
      foliage(l, m, ['#8a7e6a', '#a89a82', '#c4b69c', '#dacdb4', '#ebe2cc', '#f6f0e2', '#fffaf0'], k.seed + 2, { cell: 2.2, tilt: 0.3 });
    }, { rect: [sx - 24, sy - 12, sx + 24, sy + 8] });
    // the folded grey wool blanket with a stripe
    const [bx, by] = anchor(p, W - 0.5, 0.5, 4.6);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 14, by], [bx, by - 7], [bx + 14, by], [bx, by + 7]], '#6a707a');
      fillPoly(l, [[bx - 14, by - 3], [bx, by - 10], [bx + 14, by - 3], [bx, by + 4]], '#8a909a');
      fillPoly(l, [[bx - 14, by - 3], [bx, by + 4], [bx, by + 7], [bx - 14, by]], '#5a606a');
      ln(l, bx - 9, by - 1, bx + 5, by - 8, '#c8443a');
      ln(l, bx - 14, by - 1.5, bx, by + 5.5, '#c8443a');
    }, { rect: [bx - 16, by - 12, bx + 16, by + 9] });
  },
};

// ── potted plants: a little spruce with fairy lights, a zz plant ──
function pottedPlant(p: PropPainter, k: PropCtx) {
  const spruce = k.seed % 2 === 1;
  const [x, y] = anchor(p, 0.5, 0.5, 0);
  contactShadow(p.c, x + 8, y + 3, 17, 6, 0.26);
  const Rn = rng(k.seed * 9 + 4);
  layer(p.c, (l) => {
    if (spruce) {
      // a galvanised bucket
      for (let j = 0; j < 16; j++) {
        const w = 11 - j * 0.12;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, GALV[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.8 ? 3 : 2]);
        }
      }
      px(l, x - 11, y - 17, GALV[6], 22, 2);
      for (const z of [4, 11]) px(l, x - 11, y - z, GALV[1], 22, 1);
      // the spruce: tiers of drooping branches
      for (let t = 0; t < 6; t++) {
        const ty = y - 18 - t * 9;
        const tw = 17 - t * 2.6;
        for (let j = 0; j < 10; j++) {
          const r = j / 9;
          const w2 = tw * (0.3 + r * 0.7);
          for (let i = -w2; i < w2; i++) {
            const lit = i < -w2 * 0.2 ? 4 : i < w2 * 0.4 ? 3 : 2;
            px(l, x + i, ty - 9 + j, ['#0c1a1c', '#122424', '#18302c', '#203c34', '#2a4a3e', '#365a48'][lit - (j > 7 ? 1 : 0)]);
          }
        }
      }
      px(l, x - 1, y - 76, '#203c34', 2, 6);
    } else {
      // a matte black pot, glossy zz leaflets on arching stems
      for (let j = 0; j < 15; j++) {
        const w = 10 - j * 0.15;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, ['#1a1a1e', '#24242a', '#2e2e36', '#3a3a44'][t < 0.3 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0]);
        }
      }
      px(l, x - 10, y - 16, '#4a4a54', 20, 2);
      for (let s = 0; s < 8; s++) {
        const a = -1.1 + s * 0.31 + (Rn() - 0.5) * 0.2;
        const len = 28 + Rn() * 22;
        const ex = x + Math.sin(a) * len * 0.8;
        const ey = y - 16 - Math.cos(a) * len;
        curve(l, x, y - 16, x + Math.sin(a) * len * 0.3, y - 16 - len * 0.6, ex, ey, '#3a5a2a', 1);
        for (let i = 2; i < 9; i++) {
          const t = i / 9;
          const lx = x + (ex - x) * t + Math.sin(a) * 2;
          const ly = y - 16 + (ey - y + 16) * t;
          for (const sgn of [-1, 1]) {
            ell(l, lx + sgn * 3, ly, 2.6, 1.6, '#1e3a22');
            px(l, lx + sgn * 3 - 1, ly - 1, '#4a7a4a', 2, 1);
          }
        }
      }
    }
  }, { rect: [x - 30, y - 80, x + 30, y + 4] });
}
const plant: PropArt = {
  draw: pottedPlant,
  anim(p, k) {
    if (k.seed % 2 !== 1) return;
    // the fairy lights twinkling on the little spruce
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const u = p.k / 4;
    for (let i = 0; i < 14; i++) {
      const t = i / 14;
      const ty = y - (20 + t * 50) * u;
      const tx = x + Math.sin(t * 19) * (15 - t * 12) * u;
      if (Math.sin(k.t * 3 + i * 1.7) > -0.2) px(p.c, tx, ty, i % 3 === 0 ? '#ffd890' : '#fff4d0', Math.max(1, Math.round(u * 2)), Math.max(1, Math.round(u * 2)));
    }
  },
};

// ── the front walls: the hall's ribbed cladding, cut low ─────
const LZ = 7.2;
const LT = 0.3;
const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    // the east wall (rot 1) also wraps the corner so the two cut walls meet cleanly
    const a0 = p.rot === 1 ? -LT : 0;
    const len = W - a0;
    const cut: Mat = () => (u, v) => {
      // the panel in section: the white liner, yellow mineral wool, the ribbed outer skin
      if (v > 18.5) return PANEL[5];
      if (v < 3.2) return at(CLAD, 3 + (u % 13 < 4.4 ? 0.8 : 0));
      if (v < 5.6 && u % 13 < 4.4) return at(CLAD, 4);
      return hash(Math.floor(u), Math.floor(v), 111) < 0.18 ? '#a89a74' : Math.floor(u * 0.5 + v) % 4 === 0 ? '#d2c6a2' : '#c2b590';
    };
    // a concrete plinth, then the ribbed cladding, the cut top
    lbox(p, a0, 0, len, LT + 0.04, 0, 1.4, mono(paint(['#5a6068', '#6a7078', '#7a8088', '#8a9098', '#9aa0a8', '#aab0b8']), '#3a4048'));
    lbox(p, a0, 0, len, LT, 1.4, LZ - 1.4, { front: ribbed(CLAD, 13), side: ribbed(CLAD, 13), top: cut, edge: CLAD[0] });
    // the base flashing over the plinth: a galvanised drip
    lbox(p, a0, LT, len, 0.03, 1.3, 0.4, mono(brushed(GALV), GALV[0]));
    // snow drifted against the foot of the wall outside, deeper in the corner and in hollows
    driftLine(p, a0 + 0.05, W - 0.05, LT + 0.12, 0, 7, k.seed);
    if (p.rot === 1) driftLine(p, -LT - 0.1, 0.9, LT + 0.22, 0, 10, k.seed + 5);
  },
};

const SNOW_PK = SNOW.map((c) => (parseColor(c) | 0xff000000) >>> 0);
const SPARK_PK = (parseColor('#ffffff') | 0xff000000) >>> 0;

/**
 * Soft snow volumes: rounded masses drawn back to front, each pixel shaded by the
 * mass's own normal (lit from the upper left, blue in the shade), a faint grain and
 * the odd glint, quantised into the snow ramp with ordered dithering. Written
 * straight into the CPU layer (snow is everywhere on this site).
 */
export function snowMasses(c: CanvasRenderingContext2D, masses: Mass[], seed: number, flat = false) {
  const sc = soft(c);
  // drifts (flat) are lit as one long ridge: mostly by height, hardly by the side of each lump
  const kx = flat ? 0.16 : 0.5;
  const sorted = [...masses].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const N = SNOW.length;
  let wx0 = Infinity;
  let wy0 = Infinity;
  let wx1 = -Infinity;
  let wy1 = -Infinity;
  for (const m of sorted) {
    const r = Math.ceil(m.ry) + 1;
    for (let dy = -r; dy <= r; dy++) {
      const yy = Math.round(m.y) + dy;
      const ny = (yy + 0.5 - m.y) / m.ry;
      if (ny <= -1 || ny >= 1) continue;
      const hw = m.rx * Math.sqrt(1 - ny * ny);
      const x0 = Math.round(m.x - hw);
      const x1 = Math.round(m.x + hw);
      for (let x = x0; x < x1; x++) {
        const nx = (x + 0.5 - m.x) / m.rx;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const h = hash(x, yy, seed);
        let v = (-nx * kx - ny * 0.72 + nz * 0.62) * 0.62 + 0.42 + (h - 0.5) * 0.08;
        if (ny > 0.55) v -= (ny - 0.55) * 0.5;
        const t = v * (N - 1) + (bayer(x, yy) - 0.5) * 0.8;
        const tone = t <= 0 ? 0 : t >= N - 1 ? N - 1 : Math.round(t);
        const col = tone >= N - 2 && h > 0.985 ? SPARK_PK : SNOW_PK[tone];
        if (sc) {
          const xx = x - sc.ox;
          const yb = yy - sc.oy;
          if (xx < 0 || yb < 0 || xx >= sc.width || yb >= sc.height) continue;
          sc.data[yb * sc.width + xx] = col;
          if (xx < wx0) wx0 = xx;
          if (xx > wx1) wx1 = xx;
          if (yb < wy0) wy0 = yb;
          if (yb > wy1) wy1 = yb;
        } else {
          c.fillStyle = tone >= N - 2 && h > 0.985 ? '#ffffff' : SNOW[tone];
          c.fillRect(x, yy, 1, 1);
        }
      }
    }
  }
  if (sc && wx1 >= wx0) sc.touch(wx0, wy0, wx1 + 1, wy1 + 1);
}

/**
 * A continuous drift along a line on the ground (local a0→a1 at depth b, height z):
 * a silhouette strip whose top edge swells and dips, shaded in bands from a lit crest
 * to a blue foot, the sun-facing flanks of each mound a step brighter. h in z units.
 */
export function driftLine(p: PropPainter, a0: number, a1: number, b: number, z: number, h: number, seed: number, alongB = false, ends = true) {
  const P = (a: number) => (alongB ? p.P(b, a, z) : p.P(a, b, z));
  const Wd = (a: number) => (alongB ? p.W(b, a) : p.W(a, b));
  const [x0, y0] = P(a0);
  const [x1, y1] = P(a1);
  if (Math.abs(x1 - x0) < 2) return;
  // the swell follows world position, so drifts drawn by neighbouring props join up
  const [wx0, wy0] = Wd(a0);
  const [wx1, wy1] = Wd(a1);
  const ph1 = hash(seed, 1, 5) * 0.4;
  const heightAt = (t: number) => {
    const wx = wx0 + (wx1 - wx0) * t;
    const wy = wy0 + (wy1 - wy0) * t;
    const u = wx * 0.83 + wy * 0.61;
    const swell = 0.5 + 0.32 * Math.sin(u * 1.3 + ph1) + 0.18 * Math.sin(u * 3.1 + 1.7);
    const taper = ends ? Math.min(1, t / 0.05, (1 - t) / 0.05) : 1;
    return h * 4 * (0.3 + 0.7 * swell) * Math.max(0, taper);
  };
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  const top = Math.min(y0, y1) - h * 4 - 4;
  const bot = Math.max(y0, y1) + 6;
  layer(p.c, (l) => {
    let prevH = heightAt((Math.floor(lo) - x0) / (x1 - x0));
    for (let x = Math.floor(lo); x <= hi; x++) {
      const t = (x - x0) / (x1 - x0);
      if (t < 0 || t > 1) continue;
      const H = heightAt(t);
      const slope = H - prevH;
      prevH = H;
      if (H < 1.5) continue;
      const yb = y0 + (y1 - y0) * t;
      const yt = Math.round(yb - H);
      const yf = Math.round(yb + 2 + H * 0.12);
      const span = Math.max(1, yf - yt);
      // a flank facing the light (rising toward screen right means it faces left) is a step brighter
      const face = (x1 > x0 ? slope : -slope) > 0.05 ? 0.6 : (x1 > x0 ? slope : -slope) < -0.05 ? -0.4 : 0;
      let runStart = yt;
      let runCol = '';
      for (let y = yt; y <= yf + 1; y++) {
        let col = '';
        if (y <= yf) {
          const f = (y - yt) / span;
          let tone = f < 0.1 ? 6 : f < 0.45 ? 5 + face * 0.5 : f < 0.8 ? 4 + face : 3;
          if (f > 0.4 && f < 0.5 && bayer(x, y) > 0.5) tone -= 0.6;
          if (f > 0.75 && f < 0.85 && bayer(x, y) > 0.5) tone -= 0.6;
          col = at(SNOW, tone);
          if (f < 0.4 && hash(x, y, seed) > 0.992) col = '#ffffff';
        }
        if (col !== runCol) {
          if (runCol) {
            l.fillStyle = runCol;
            l.fillRect(x, runStart, 1, y - runStart);
          }
          runCol = col;
          runStart = y;
        }
      }
    }
  }, { outline: 0.34, rect: [lo - 4, top - 4, hi + 4, bot + 4] });
}

/**
 * A slab of snow lying on a flat top (local a0..a1 × b0..b1 at height z): its soft
 * top, a rounded lip over the visible front and end edges, a couple of low lumps.
 * Thickness `th` in z units. Faces follow the prop's rotation (lit +y, shaded +x).
 */
export function snowSlab(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, th = 1.4) {
  const o = 0.035;
  const B1 = b1 + o;
  const endA = p.rot === 0 ? a1 + o : a0 - o;
  const A0 = p.rot === 0 ? a0 : a0 - o;
  const A1 = p.rot === 0 ? a1 + o : a1;
  const zt = z + th;
  const zb = z + th * 0.15;
  const P = (a: number, b: number, zz: number) => p.P(a, b, zz);
  const pts = [P(A0, b0, zt), P(A1, b0, zt), P(A1, B1, zt), P(A0, B1, zt), P(A0, B1, zb), P(A1, B1, zb), P(endA, b0, zb)];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const frontLit = p.rot === 0;
  layer(p.c, (l) => {
    // the lip on the front edge and on the visible end, then the top
    fillPoly(l, [P(A0, B1, zb), P(A1, B1, zb), P(A1, B1, zt), P(A0, B1, zt)], frontLit ? SNOW[4] : SNOW[3]);
    fillPoly(l, [P(endA, b0, zb), P(endA, B1, zb), P(endA, B1, zt), P(endA, b0, zt)], frontLit ? SNOW[3] : SNOW[4]);
    fillPoly(l, [P(A0, b0, zt), P(A1, b0, zt), P(A1, B1, zt), P(A0, B1, zt)], SNOW[5]);
    // the rounded front-top edge catching the light, a bright band near the back
    const [fx0, fy0] = P(A0, B1, zt);
    const [fx1, fy1] = P(A1, B1, zt);
    ln(l, fx0, fy0, fx1, fy1, SNOW[6]);
    const [bx0, by0] = P(A0 + 0.04, b0 + 0.06, zt);
    const [bx1, by1] = P(A1 - 0.04, b0 + 0.06, zt);
    ln(l, bx0, by0 + 1, bx1, by1 + 1, SNOW[6]);
    // crystal dents and a few low lumps
    const Rn = rng(seed * 19 + 3);
    for (let i = 0; i < (a1 - a0) * (b1 - b0) * 30; i++) {
      const [x, y] = P(A0 + Rn() * (A1 - A0), b0 + Rn() * (B1 - b0), zt);
      px(l, x, y, SNOW[4]);
    }
  }, { outline: 0.36, rect: [Math.min(...xs) - 16, Math.min(...ys) - 10, Math.max(...xs) + 16, Math.max(...ys) + 6] });
}

/** snowMasses in its own outlined layer, bounded to the masses (cheap inside big sprites). */
export function snowLayer(c: CanvasRenderingContext2D, masses: Mass[], seed: number, outline = 0.4, flat = false) {
  if (!masses.length) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of masses) {
    x0 = Math.min(x0, m.x - m.rx - 12);
    x1 = Math.max(x1, m.x + m.rx + 12);
    y0 = Math.min(y0, m.y - m.ry - 12);
    y1 = Math.max(y1, m.y + m.ry + 12);
  }
  layer(c, (l) => snowMasses(l, masses, seed, flat), { outline, rect: [x0, y0, x1, y1] });
}

// ── lived-in details of the hall ────────────────────────────
const dc_ups: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 18;
    footShadow(p, 0.04, 0.1, W - 0.04, 0.74, Z, 0.26);
    const body = paint(['#22262c', '#2c3138', '#373d45', '#444b54', '#535b65', '#646d78']);
    lbox(p, 0.04, 0.12, W - 0.08, 0.62, 0, Z, { front: body, side: body, top: body, edge: '#0e1012' });
    const F = front(p, 0.74);
    for (let i = 0; i < 2; i++) {
      const a0 = 0.06 + i * ((W - 0.12) / 2);
      const a1 = a0 + (W - 0.12) / 2 - 0.02;
      pq(p, F, a0, a0 + 0.012, 0.4, Z - 0.3, '#0a0b0d');
      // a vent grille low, the display panel high, the module bay seams
      pt(p, F, a0 + 0.06, a1 - 0.06, 1, 4.4, (_u: number, v: number) => (v % 2.5 < 1 ? '#0e1012' : '#3a4048'), F.light);
      for (let r = 0; r < 4; r++) pq(p, F, a0 + 0.05, a1 - 0.05, 5.6 + r * 2.4, 5.7 + r * 2.4, '#0e1012');
      pq(p, F, a0 + 0.14, a1 - 0.14, 13, 16.2, '#2a3038');
      pq(p, F, a0 + 0.17, a1 - 0.17, 13.4, 15.8, '#0c2440');
      label(p, F, a0 + 0.14, 12.4, `UPS-${i + 1}`, '#b8c0c8');
    }
    pq(p, F, 0.06, W - 0.06, Z - 0.6, Z - 0.3, '#3aa898');
    void k;
  },
  anim(p, k) {
    const F = front(p, 0.74);
    const s = unit(p);
    const W = k.w;
    for (let i = 0; i < 2; i++) {
      const a0 = 0.06 + i * ((W - 0.12) / 2);
      // a load bar and a battery icon on the screen, a green LED row
      const load = 0.55 + 0.15 * Math.sin(k.t * 0.5 + i * 2);
      const [x0, y0] = F.F(a0 + 0.2, 14.2);
      const [x1, y1] = F.F(a0 + 0.2 + 0.5 * load, 14.2);
      ln(p.c, x0, y0, x1, y1, '#5cf08a', s);
      const [bx, by] = F.F(a0 + 0.22, 15.4);
      px(p.c, bx, by, '#62e6f0', 6 * s, 2 * s);
      for (let j = 0; j < 4; j++) {
        const [lx, ly] = F.F(a0 + 0.2 + j * 0.06, 11);
        px(p.c, lx, ly, j < 3 || Math.sin(k.t * 2 + i) > 0 ? LED.green : LED.greenDim, s, s);
      }
    }
  },
};

const dc_tapelib: PropArt = {
  draw(p, k) {
    const Z = 20;
    footShadow(p, 0.08, 0.12, 0.92, 0.9, Z, 0.26);
    const body = paint(['#1e2228', '#262b32', '#30363e', '#3b424b', '#474f59', '#555e69']);
    lbox(p, 0.1, 0.14, 0.8, 0.76, 0, Z, { front: body, side: body, top: body, edge: '#0e1012' });
    const F = front(p, 0.9);
    // the big window onto the tape magazines: rows of cartridges with coloured labels
    pq(p, F, 0.16, 0.84, 5.4, 18, '#0e1218');
    pt(p, F, 0.18, 0.82, 5.6, 17.8, (u: number, v: number) => {
      const row = Math.floor(v / 6);
      const f = v % 6;
      if (f < 1) return '#2a3038';
      const cart = Math.floor(u / 3);
      if (u % 3 < 0.8) return '#0a0c10';
      if (f > 4) return ['#e8eaee', '#f2c230', '#3a86e0', '#d8402e', '#3cb45a'][(cart * 7 + row * 3) % 5];
      return '#1a1e26';
    }, F.light);
    pq(p, F, 0.2, 0.5, 2, 3.6, '#2a3038');
    pq(p, F, 0.22, 0.48, 2.2, 3.4, '#0c2440');
    // the import/export mail slot
    pq(p, F, 0.6, 0.8, 2.4, 3.2, '#0a0c10');
    void k;
  },
  anim(p, k) {
    // the picker robot riding up and down behind the glass
    const F = front(p, 0.9);
    const z = 6.6 + (0.5 + 0.5 * Math.sin(k.t * 0.7)) * 9.6;
    const u = 0.22 + (0.5 + 0.5 * Math.sin(k.t * 0.31)) * 0.48;
    pq(p, F, u, u + 0.12, z, z + 1.2, '#8a96a2');
    pq(p, F, u + 0.02, u + 0.05, z + 0.3, z + 0.6, LED.green);
  },
};

const dc_cylinders: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.8, 18, 0.26);
    // three red suppression cylinders strapped to a wall frame, a manifold rising up the wall
    const [x, y] = anchor(p, 0.5, 0.42, 0);
    layer(p.c, (l) => {
      for (let c = 0; c < 3; c++) {
        const cx = x - 14 + c * 14;
        const cy = y + c * 1;
        for (let j = 0; j < 62; j++) {
          const w = j > 56 ? 6 - (j - 56) * 0.9 : 6;
          for (let i = -w; i < w; i++) {
            const t = (i + w) / (2 * w);
            px(l, cx + i, cy - j, RED[t < 0.22 ? 5 : t < 0.5 ? 4 : t < 0.8 ? 3 : 2]);
          }
        }
        px(l, cx - 6, cy - 40, '#f4f2ee', 12, 7);
        px(l, cx - 5, cy - 38, '#3a3a40', 10, 1);
        px(l, cx - 5, cy - 36, '#3a3a40', 7, 1);
        // the valve head, a gauge, the flexible hose to the manifold
        px(l, cx - 3, cy - 68, '#8a929c', 6, 6);
        ell(l, cx + 4, cy - 66, 3, 3, '#e8eaee');
        px(l, cx + 4, cy - 67, '#c83a2a', 1, 2);
        curve(l, cx, cy - 68, cx + 2, cy - 76, cx + 6, cy - 80, '#2a2e34', 2);
      }
      // the straps, then the manifold pipe: back to the wall, then up it to the cut top of the wall
      for (const z of [18, 44]) ln(l, x - 21, y - z, x + 21, y - z + 2, '#3a3e46', 2);
      const [mx0, my0] = p.P(0.22, 0.42, 20.2);
      const [mx1, my1] = p.P(0.86, 0.42, 20.2);
      const [wx, wy] = p.P(0.86, 0.03, 20.2);
      const [tx, ty] = p.P(0.86, 0.03, 42);
      ln(l, mx0, my0, mx1, my1, '#a62c26', 3);
      ln(l, mx1, my1, wx, wy, '#a62c26', 3);
      px(l, tx - 1, ty, '#a62c26', 3, wy - ty + 1);
      px(l, tx - 1, ty, '#c63c30', 1, wy - ty + 1);
      for (let z = 24; z < 42; z += 6) {
        const [cx, cy] = p.P(0.86, 0.03, z);
        px(l, cx - 3, cy, '#5a6068', 7, 2);
      }
    }, { rect: [x - 30, y - 180, x + 60, y + 6] });
    void k;
  },
};

const dc_boxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.9, 0.88, 8, 0.24);
    const kraft = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => {
      const KR: Ramp = ['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70', '#e6c48c'];
      let i = light === 2 ? 4 : light ? 3 : 2;
      if (u % 3 < 0.7) i -= 0.4;
      if (hash(x, y, 4) < 0.04) i -= 0.6;
      if (Math.abs(v - 5) < 0.8 && light === 2) return '#c8b088';
      return at(KR, i);
    };
    // a pallet, two long server boxes and a small one, one opened with its foam showing
    lbox(p, 0.1, 0.12, 0.8, 0.76, 0, 0.9, { front: (light) => (u) => (u % 14 < 6 ? '#3a2a1a' : light ? '#b89a6a' : '#9a7e54'), side: (light) => (u) => (u % 14 < 6 ? '#3a2a1a' : light ? '#a88a5e' : '#8a6e48'), top: grain(['#6a5232', '#86683e', '#a2824e', '#bc9a60', '#d0b072', '#e2c488']), edge: '#4a3820' });
    lbox(p, 0.14, 0.18, 0.72, 0.62, 0.9, 2.6, { front: kraft, side: kraft, top: kraft, edge: '#5a3e22' });
    lbox(p, 0.18, 0.24, 0.64, 0.5, 3.5, 2.4, { front: kraft, side: kraft, top: kraft, edge: '#5a3e22' });
    const F = front(p, 0.8);
    pq(p, F, 0.3, 0.6, 1.6, 2.8, '#f4f6f8');
    pq(p, F, 0.33, 0.56, 2.1, 2.3, '#2a3038');
    // the top box opened: flaps folded back, the pink anti-static bag and white foam inside
    const [ox, oy] = anchor(p, 0.5, 0.49, 5.9);
    layer(p.c, (l) => {
      fillPoly(l, [[ox - 18, oy], [ox, oy - 9], [ox + 18, oy], [ox, oy + 9]], '#e8e8ea');
      fillPoly(l, [[ox - 10, oy], [ox, oy - 5], [ox + 10, oy], [ox, oy + 5]], '#d890a8');
      fillPoly(l, [[ox - 18, oy], [ox - 24, oy - 8], [ox - 6, oy - 17], [ox, oy - 9]], '#c29458');
      fillPoly(l, [[ox + 18, oy], [ox + 26, oy - 6], [ox + 8, oy - 15], [ox, oy - 9]], '#a87a46');
    }, { rect: [ox - 26, oy - 19, ox + 28, oy + 11] });
    void k;
  },
};

const dc_floorhole: PropArt = {
  draw(p, k) {
    // a lifted floor panel: the void beneath with its cable baskets, the panel leaning by, the suction lifter
    const c = p.c;
    const q = (a: number, b: number, z = 0) => p.P(a, b, z);
    const h0 = [q(0.25, 0.25), q(0.75, 0.25), q(0.75, 0.75), q(0.25, 0.75)];
    fillPoly(c, h0, '#06080c');
    // the void: pedestals, a yellow fibre basket and a blue cable basket under the floor
    const deep = (a: number, b: number) => p.P(a, b, -3);
    fillPoly(c, [deep(0.27, 0.45), deep(0.73, 0.45), deep(0.73, 0.55), deep(0.27, 0.55)], '#c09420');
    fillPoly(c, [deep(0.27, 0.6), deep(0.73, 0.6), deep(0.73, 0.68), deep(0.27, 0.68)], '#2a5a9a');
    for (const [a, b] of [[0.27, 0.27], [0.73, 0.27]] as const) {
      const [x, y] = q(a, b);
      px(c, x - 1, y, '#5a6068', 2, 10);
    }
    // the cut edges of the hole: the panel thickness lit on the far sides
    ln(c, h0[0][0], h0[0][1], h0[1][0], h0[1][1], '#8a929e', 2);
    ln(c, h0[0][0], h0[0][1], h0[3][0], h0[3][1], '#6a727e', 2);
    // the panel standing on edge against the hole, the suction lifter on top of it
    const P = [q(0.3, 0.86, 0), q(0.8, 0.86, 0), q(0.8, 0.82, 5.6), q(0.3, 0.82, 5.6)];
    fillPoly(c, P, '#9aa2ac');
    fillPoly(c, [q(0.3, 0.86, 5.4), q(0.8, 0.86, 5.4), q(0.8, 0.82, 5.6), q(0.3, 0.82, 5.6)], '#c4c9cf');
    ln(c, P[0][0], P[0][1], P[1][0], P[1][1], '#2a2e34');
    const [lx, ly] = q(0.55, 0.92, 0);
    layer(c, (l) => {
      ell(l, lx - 8, ly, 5, 2.5, '#2a2e34');
      ell(l, lx + 8, ly + 1, 5, 2.5, '#2a2e34');
      ln(l, lx - 8, ly - 2, lx - 6, ly - 8, '#9aa4ae', 2);
      ln(l, lx + 8, ly - 1, lx + 6, ly - 7, '#9aa4ae', 2);
      ln(l, lx - 6, ly - 8, lx + 6, ly - 7, '#f2c230', 3);
    }, { rect: [lx - 14, ly - 12, lx + 14, ly + 5] });
    void k;
  },
};

const dc_cone: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 5, y + 2, 9, 3, 0.24);
    layer(p.c, (l) => {
      fillPoly(l, [[x - 9, y - 2], [x, y - 6], [x + 9, y - 2], [x, y + 2]], '#1e1e22');
      for (let j = 0; j < 26; j++) {
        const w = 7 - j * 0.24;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          const band = j > 9 && j < 15;
          px(l, x + i, y - 3 - j, band ? (t < 0.5 ? '#f4f6f8' : '#c8ccd0') : YEL[t < 0.3 ? 5 : t < 0.65 ? 4 : 3]);
        }
      }
    }, { rect: [x - 12, y - 32, x + 12, y + 4] });
    void k;
  },
};

const dc_ladder: PropArt = {
  draw(p, k) {
    // an aluminium step ladder folded and leaning on the wall behind it
    const [x, y] = anchor(p, 0.6, 0.5, 0);
    contactShadow(p.c, x + 4, y + 2, 12, 4, 0.24);
    layer(p.c, (l) => {
      const top: [number, number] = [x - 18, y - 92];
      for (const dx of [-7, 7]) {
        ln(l, x + dx, y, top[0] + dx * 0.8, top[1], '#c8d0d8', 2);
        ln(l, x + dx + 1, y, top[0] + dx * 0.8 + 1, top[1], '#8a929c', 1);
      }
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const cx = x + (top[0] - x) * t;
        const cy = y + (top[1] - y) * t;
        ln(l, cx - 7 * (1 - t * 0.2), cy, cx + 7 * (1 - t * 0.2), cy, '#a8b0b8', 2);
      }
      px(l, top[0] - 7, top[1] - 3, '#f2c230', 13, 4);
    }, { rect: [x - 30, y - 100, x + 12, y + 4] });
    void k;
  },
};

const dc_whiteboard: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.38, 0.88, 0.62, 18, 0.22);
    const frame = brushed(STEEL);
    for (const a of [0.14, 0.82]) {
      lbox(p, a, 0.32, 0.04, 0.36, 0, 0.3, mono(frame, STEEL[0]));
      lbox(p, a, 0.48, 0.04, 0.04, 0.3, 20, mono(frame, STEEL[0]));
    }
    lbox(p, 0.12, 0.47, 0.76, 0.03, 8.4, 11, { front: (light) => (u, v) => (u < 1.5 || v < 1.5 || v > 42 ? at(STEEL, light ? 4 : 3) : (u * 0.6 + v) % 46 < 3 ? '#ffffff' : '#f2f4f5'), side: frame, top: frame, edge: STEEL[0] });
    const F = front(p, 0.5);
    // the incident timeline: times in a column, arrows, a network sketch, a red ring round the faulty switch
    const L = (a: number, z: number, b: number, z2: number, col: string) => {
      const [x0, y0] = F.F(a, z);
      const [x1, y1] = F.F(b, z2);
      ln(p.c, x0, y0, x1, y1, col);
    };
    for (let i = 0; i < 5; i++) {
      label(p, F, 0.17, 18.4 - i * 1.7, ['02:14', '02:31', '02:40', '03:05', '03:12'][i], '#2a5aa8');
      L(0.42, 17.8 - i * 1.7, 0.42 + 0.08 + hash(i, 1, k.seed) * 0.2, 17.8 - i * 1.7, '#3a3e46');
    }
    for (const [a, z] of [[0.62, 13.6], [0.74, 11.4], [0.52, 11.2]] as const) {
      pq(p, F, a - 0.04, a + 0.04, z - 0.4, z + 0.4, '#3a3e46');
      L(0.62, 13.6, a, z, '#3a3e46');
    }
    const [rx, ry] = F.F(0.74, 11.4);
    for (let a = 0; a < 16; a++) px(p.c, rx + Math.cos((a / 16) * Math.PI * 2) * 5, ry + Math.sin((a / 16) * Math.PI * 2) * 4, '#c8302a');
    pq(p, F, 0.6, 0.72, 16.4, 17.6, '#f6d860');
    pq(p, F, 0.2, 0.8, 8.6, 8.9, '#8a929c');
    void k;
  },
};

const dc_lift: PropArt = {
  draw(p, k) {
    // a server lift: a yellow mast on a castored base, the forks raised with a 2U server on them
    footShadow(p, 0.2, 0.25, 0.8, 0.8, 14, 0.24);
    const yel = paint(YEL);
    lbox(p, 0.22, 0.28, 0.56, 0.5, 0.6, 1.2, mono(yel, YEL[0]));
    for (const [a, b] of [[0.26, 0.32], [0.7, 0.32], [0.26, 0.72], [0.7, 0.72]] as const) {
      const [cx, cy] = anchor(p, a, b, 0.4);
      ell(p.c, cx, cy, 3, 2.4, '#16181c');
    }
    lbox(p, 0.3, 0.32, 0.12, 0.12, 1.8, 15, { front: brushed(STEEL), side: brushed(STEEL), top: paint(STEEL), edge: STEEL[0] });
    lbox(p, 0.3, 0.28, 0.12, 0.04, 14.4, 2.4, mono(yel, YEL[0]));
    // the forks and the server riding on them, a winch handle
    lbox(p, 0.42, 0.38, 0.4, 0.06, 9, 0.3, mono(steelPaint, STEEL[0]));
    lbox(p, 0.42, 0.58, 0.4, 0.06, 9, 0.3, mono(steelPaint, STEEL[0]));
    lbox(p, 0.42, 0.34, 0.42, 0.36, 9.3, 0.9, { front: (light) => (u) => (u % 3 < 1 ? '#3e4652' : light ? '#8a96a4' : '#68727e'), side: paint(RACK), top: paint(['#2a3038', '#3a424e', '#4a5462', '#5a6676', '#6a788a', '#7a8a9e']), edge: RACK[0] });
    const [hx, hy] = anchor(p, 0.36, 0.42, 12);
    ln(p.c, hx, hy, hx - 6, hy - 3, '#2a2e34', 2);
    void k;
  },
};

const dc_spools: PropArt = {
  draw(p, k) {
    // a crate with cable reels and coils of patch cord, a roll of velcro on top
    footShadow(p, 0.15, 0.2, 0.85, 0.85, 8, 0.24);
    const ply = grain(PLY);
    lbox(p, 0.18, 0.24, 0.62, 0.52, 0, 3.6, { front: ply, side: ply, top: paint(['#3a2e22', '#4a3c2c', '#5a4a38', '#6a5844', '#7a6650', '#8a745c']), edge: PLY[0] });
    const [x, y] = anchor(p, 0.48, 0.5, 3.6);
    layer(p.c, (l) => {
      // coils in the crate: blue, yellow, orange loops
      for (const [dx, dy, col] of [[-8, 0, CABLES[1]], [2, -3, CABLES[0]], [9, 2, CABLES[4]]] as const) {
        for (let r = 0; r < 3; r++) {
          for (let a = 0; a < 20; a++) {
            const ang = (a / 20) * Math.PI * 2;
            px(l, x + dx + Math.cos(ang) * (6 - r), y + dy + Math.sin(ang) * (3 - r * 0.5) - 2, r === 1 ? darken(col, 0.25) : col);
          }
        }
      }
    }, { rect: [x - 20, y - 10, x + 20, y + 6] });
    // a big reel standing beside it
    const [rx, ry] = anchor(p, 0.85, 0.85, 0);
    layer(p.c, (l) => {
      ell(l, rx, ry - 9, 9, 9, '#8a6a46');
      ell(l, rx, ry - 9, 7, 7, CABLES[1]);
      for (let i = 0; i < 4; i++) ell(l, rx, ry - 9, 6 - i * 1.4, 6 - i * 1.4, i % 2 ? darken(CABLES[1], 0.2) : CABLES[1]);
      ell(l, rx, ry - 9, 2, 2, '#5a4632');
    }, { rect: [rx - 12, ry - 21, rx + 12, ry + 2] });
    void k;
  },
};

export const DC_ROOM: Record<string, PropArt> = {
  servers,
  cooling,
  netcab,
  desk,
  cart,
  counter,
  bench,
  plant,
  lowWall,
  dc_ups,
  dc_tapelib,
  dc_cylinders,
  dc_boxes,
  dc_floorhole,
  dc_cone,
  dc_ladder,
  dc_whiteboard,
  dc_lift,
  dc_spools,
};

export { snowTop };

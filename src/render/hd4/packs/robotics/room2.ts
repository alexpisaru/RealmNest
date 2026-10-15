// Robotics — storage, the break corner and the workshop's lived-in clutter.
//   rack (parts)   slotted-angle shelving full of louvred bins, motors, wheels, extrusions
//   counter        the coffee corner: two flight cases under a ply top, a filter machine,
//                  a mug tree, doughnuts and an airband radio
//   bench          a pair of retired airline seats on their floor track
//   crate          plywood air-freight crates with stencils (one opened)
//   barrel         a blue drum with a hand pump on a spill pallet
//   plant          a dracaena in a galvanised bucket
//   rob_toolchest  a red roll cab with a top chest
//   rob_spool      a cable drum used as a side table
//   rob_drill      a pillar drill on its cabinet
//   rob_dog        a quadruped robot prototype standing by
//   rob_cart       a three-tier utility trolley
//   rob_cobot      a collaborative arm on a mobile pedestal
//   rob_boxes      delivery boxes stacked by the door
//   rob_floor      flat details on the slab: cable ramps, tape marks, a drain
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, side } from '../../plane4';
import { cardboard } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { ALU, base, BIRCH, enamel, extrusion, GALV, KRAFT, LED, ORANGE, PINE, plyEdge, plyFace, RED, RUBBER, SHELL, SLATE, STEEL, stencil, TEAL, YEL } from './rkit';
import { dark, mug, steel } from './room';

// ── the parts rack ──────────────────────────────────────────
/** Slotted angle: a painted upright with its pattern of long and round holes. */
const slotted: Mat = (light, w, h) => (u, v) => {
  let i = base(light, SLATE.length) + 0.4;
  if (u < 1) i += 0.8;
  const fv = v % 9;
  if (u > w * 0.35 && u < w * 0.75 && ((fv > 2 && fv < 5) || (fv > 6.5 && fv < 7.6))) return '#14161a';
  void h;
  return at(SLATE, i);
};

function binRamp(i: number): Ramp {
  return [
    ['#162c58', '#1e3c78', '#264a90', '#2c58a8', '#3a6ac0', '#5a86d4'],
    [YEL[1], YEL[2], YEL[3], YEL[4], YEL[5], YEL[6]],
    [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],
    [TEAL[1], TEAL[2], TEAL[3], TEAL[4], TEAL[5], TEAL[6]],
  ][((i % 4) + 4) % 4];
}

/** A louvred parts bin on a shelf: open-fronted with a label window and a lip. */
function partsBin(p: PropPainter, a: number, b: number, z: number, w: number, d: number, h: number, r: Ramp, fill: string) {
  lbox(p, a, b, w, d, z, h, { front: enamel(r), side: enamel(r), top: (_l) => () => r[0], edge: r[0] });
  const F = front(p, b + d);
  // the open scoop showing what's inside, a label
  pq(p, F, a + w * 0.12, a + w * 0.88, z + h * 0.62, z + h - 0.15, r[0]);
  pq(p, F, a + w * 0.16, a + w * 0.84, z + h * 0.66, z + h * 0.88, fill);
  pq(p, F, a + w * 0.3, a + w * 0.7, z + h * 0.2, z + h * 0.48, '#f2f0ea');
  pq(p, F, a + w * 0.34, a + w * 0.6, z + h * 0.3, z + h * 0.36, '#3a3a40');
}

const rack: PropArt = {
  draw(p, k) {
    const W = k.w;
    const H = 20.4;
    footShadow(p, 0.05, 0.08, W - 0.05, 0.9, 16, 0.26);
    const uprights = [0.06, W / 2 - 0.04, W - 0.14];
    // back uprights first
    for (const a of uprights) lbox(p, a, 0.1, 0.08, 0.08, 0, H, { front: slotted, side: slotted, top: (_l) => () => SLATE[2], edge: SLATE[0] });
    const levels = [0.5, 6.4, 12.3, 18.2];
    const R0 = rng(k.seed * 11 + 5);
    // the decks: galvanised mesh, darker than bare sheet; orange box beams along the front
    const mesh: Mat = (light) => (u, v, x, y) => {
      let i = (light === 2 ? 3 : light ? 2.4 : 1.4) + (hash(x, y, 61) < 0.05 ? -1 : 0);
      if (u % 5 < 1 || v % 5 < 1) i -= 0.9;
      return at(GALV, i);
    };
    const beam: Mat = (light, _w, h) => (_u, v) => at(ORANGE, (light ? 4 : 2.6) + (v > h - 1.2 ? 1 : 0) - (v < 1 ? 1 : 0));
    for (let s = 0; s < levels.length; s++) {
      const z = levels[s];
      lbox(p, 0.06, 0.12, W - 0.12, 0.74, z, 0.2, { front: mesh, side: mesh, top: mesh, edge: GALV[0] });
      lbox(p, 0.06, 0.8, W - 0.12, 0.08, z - 0.5, 0.7, { front: beam, side: beam, top: beam, edge: ORANGE[0] });
      const top = z + 0.2;
      if (s === 0) {
        // the bottom bay: spare wheels, extrusion offcuts, a coil of red cable
        for (let i = 0; i < 3; i++) {
          const [x, y] = anchor(p, 0.42 + i * 0.4, 0.56, top);
          layer(
            p.c,
            (l) => {
              ell(l, x, y - 8, 7, 9, RUBBER[1]);
              ell(l, x - 1, y - 8, 5, 7, RUBBER[3]);
              ell(l, x - 1, y - 8, 2.4, 3, ORANGE[4]);
              px(l, x - 4, y - 14, RUBBER[5], 2, 3);
            },
            { rect: [x - 10, y - 20, x + 10, y + 2] },
          );
        }
        lbox(p, 1.42, 0.3, W - 1.62, 0.12, top, 0.5, { front: extrusion(ALU), side: extrusion(ALU), top: extrusion(ALU), edge: ALU[0] });
        lbox(p, 1.48, 0.52, W - 1.7, 0.12, top, 0.5, { front: extrusion(ALU), side: extrusion(ALU), top: extrusion(ALU), edge: ALU[0] });
        const [cx, cy] = anchor(p, W - 0.42, 0.56, top + 0.5);
        layer(
          p.c,
          (l) => {
            for (let i = 0; i < 4; i++) ell(l, cx + i * 0.5, cy - 4 - i * 1.2, 9, 4, i & 1 ? '#c8382a' : '#a82a22');
            ell(l, cx + 1, cy - 8, 5, 2, '#1e1e24');
          },
          { rect: [cx - 12, cy - 16, cx + 14, cy + 2] },
        );
      } else if (s === levels.length - 1) {
        // the top: cardboard boxes, a crate of sensors, a robot head looking down
        lbox(p, 0.16, 0.2, 0.72, 0.6, top, 3.4, mono(cardboard(KRAFT), KRAFT[0]));
        const F = front(p, 0.8);
        pq(p, F, 0.3, 0.72, top + 1.4, top + 2.3, '#f2f0ea');
        pq(p, F, 0.34, 0.6, top + 1.7, top + 1.9, '#3a3a40');
        lbox(p, 0.16, 0.2, 0.72, 0.6, top + 3.4, 0.05, mono(cardboard(['#5e4224', '#7c5a32', '#9a7442', '#b48c54', '#c8a46a', '#dabc86']), KRAFT[0]));
        lbox(p, 0.95, 0.26, 0.58, 0.52, top, 2.2, mono(cardboard(KRAFT), KRAFT[0]));
        lbox(p, 1.0, 0.3, 0.46, 0.42, top + 2.2, 1.6, mono(enamel(binRamp(k.seed + 2)), '#1e1e24'));
        const [hx, hy] = anchor(p, W - 0.6, 0.5, top);
        layer(
          p.c,
          (l) => {
            fillPoly(l, [[hx - 9, hy], [hx + 9, hy], [hx + 8, hy - 15], [hx - 8, hy - 15]], SHELL[4]);
            fillPoly(l, [[hx - 9, hy], [hx - 5, hy], [hx - 5, hy - 15], [hx - 8, hy - 15]], SHELL[6]);
            px(l, hx - 6, hy - 12, '#141820', 12, 6);
            px(l, hx - 4, hy - 10, '#2a5a64', 2, 2);
            px(l, hx + 2, hy - 10, '#2a5a64', 2, 2);
            ln(l, hx + 6, hy - 2, hx + 14, hy + 2, '#d8402e');
          },
          { rect: [hx - 12, hy - 18, hx + 16, hy + 4] },
        );
      } else {
        // a row of louvred bins at the front edge, a box or two behind
        if (R0() < 0.7) lbox(p, 0.2 + R0() * (W - 1), 0.16, 0.6, 0.3, top, 3.6, mono(cardboard(KRAFT), KRAFT[0]));
        let a = 0.14;
        let i = 0;
        while (a < W - 0.4) {
          const w = R0() < 0.3 ? 0.5 : 0.34;
          if (a + w > W - 0.12) break;
          const fill = ['#c8c8c8', '#d8a050', '#1e1e24', '#3aa058', '#e86ad8', '#d8402e'][Math.floor(R0() * 6)];
          partsBin(p, a, 0.4, top, w - 0.04, 0.42, 2.2 + (w > 0.4 ? 0.6 : 0), binRamp(i + s + k.seed), fill);
          a += w;
          i++;
        }
      }
    }
    // front uprights with a stencilled bay number
    for (const a of uprights) lbox(p, a, 0.82, 0.08, 0.08, 0, H, { front: slotted, side: slotted, top: (_l) => () => SLATE[2], edge: SLATE[0] });
    // (the visible end is a = W when the rack faces +y, a = 0 when it faces +x)
    const S = side(p, p.rot === 0 ? W - 0.06 : 0.06);
    pq(p, S, 0.3, 0.72, 14.6, 16.2, YEL[4]);
    const [nx, ny] = S.F(0.4, 15.9);
    stencil(p.c, 'B2', nx, ny, 1, p.rot === 0 ? -0.5 : 0.5, 0, 1, '#1e1e24');
  },
};

// ── the coffee corner on flight cases ───────────────────────
/** Black flight-case ply with aluminium edge extrusions and ball corners. */
const caseMat: Mat = (light, w, h) => (u, v, x, y) => {
  if (u < 2.2 || u > w - 2.2 || v < 2.2 || v > h - 2.2) return at(ALU, (light ? 4 : 2) + (u < 1 || v > h - 1 ? 1 : 0));
  let i = light ? 2.2 : 1.2;
  if (hash(Math.floor(u / 2), Math.floor(v / 2), 3) < 0.25) i += 0.6;
  if (hash(x, y, 4) < 0.02) i -= 0.6;
  return at(['#141418', '#1c1c22', '#26262e', '#30303a', '#3c3c48'], i);
};

const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.06, 0.1, W - 0.06, 0.94, 10, 0.26);
    // two cases on castors, butterfly latches and recessed handles
    for (let i = 0; i < 2; i++) {
      const a0 = 0.08 + i * (W - 0.16) / 2;
      const aw = (W - 0.16) / 2 - 0.03;
      lbox(p, a0, 0.14, aw, 0.76, 0.6, Z - 1.2, { front: caseMat, side: caseMat, top: caseMat, edge: '#0e0e12' });
      const F = front(p, 0.9);
      for (const da of [0.18, aw - 0.18]) {
        const [cx, cy] = anchor(p, a0 + da, 0.9, 0.3);
        ell(p.c, cx, cy, 3, 2, RUBBER[1]);
      }
      for (const da of [0.2, aw - 0.3]) {
        pq(p, F, a0 + da, a0 + da + 0.1, Z - 2.4, Z - 1.6, ALU[5]);
        pq(p, F, a0 + da + 0.02, a0 + da + 0.08, Z - 2.2, Z - 1.8, ALU[2]);
      }
      pq(p, F, a0 + aw / 2 - 0.18, a0 + aw / 2 + 0.18, 3.2, 4.4, ALU[1]);
      pq(p, F, a0 + aw / 2 - 0.14, a0 + aw / 2 + 0.14, 3.4, 4.0, '#0e0e12');
      // stickers on the cases: a club sticker, a fragile label
      if (i === 0) {
        const [sx, sy] = F.F(a0 + 0.3, 5.6);
        ell(p.c, sx, sy, 6, 5, '#f2f0ea');
        ell(p.c, sx, sy, 4.6, 3.8, '#2b98aa');
        px(p.c, sx - 2, sy - 1, '#f2f0ea', 5, 2);
      } else {
        pq(p, F, a0 + 0.36, a0 + 0.72, 5, 6.4, '#e8402e');
        pq(p, F, a0 + 0.4, a0 + 0.68, 5.2, 6.2, '#f2f0ea');
      }
    }
    // the birch ply top
    lbox(p, 0.04, 0.08, W - 0.08, 0.86, Z - 0.6, 0.6, { front: plyEdge(BIRCH), side: plyEdge(BIRCH), top: plyFace(BIRCH), edge: BIRCH[0] });
    const tz = Z;
    // a filter coffee machine with its glass jug
    lbox(p, 0.2, 0.18, 0.46, 0.4, tz, 0.5, mono(dark, STEEL[0]));
    lbox(p, 0.2, 0.18, 0.46, 0.14, tz + 0.5, 4.6, { front: dark, side: dark, top: dark, edge: STEEL[0] });
    lbox(p, 0.18, 0.16, 0.5, 0.42, tz + 5.1, 1.1, { front: dark, side: dark, top: dark, edge: STEEL[0] });
    const [jx, jy] = anchor(p, 0.43, 0.45, tz + 0.5);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[jx - 7, jy], [jx + 7, jy], [jx + 8, jy - 9], [jx + 5, jy - 14], [jx - 5, jy - 14], [jx - 8, jy - 9]], '#c8dce2');
        fillPoly(l, [[jx - 7, jy], [jx + 7, jy], [jx + 8, jy - 6], [jx - 8, jy - 6]], '#4a2a16');
        px(l, jx - 6, jy - 13, '#ffffff', 2, 10);
        px(l, jx + 8, jy - 10, '#1e1e24', 3, 7);
        px(l, jx - 5, jy - 16, '#1e1e24', 10, 2);
      },
      { rect: [jx - 10, jy - 18, jx + 12, jy + 2] },
    );
    const Fm = front(p, 0.32);
    const [lx, ly] = Fm.F(0.58, tz + 4.4);
    px(p.c, lx - 1, ly - 1, '#ff3a2a', 2, 2);
    // a mug tree, doughnuts in their box, an airband radio
    const [tx, ty] = anchor(p, 0.92, 0.52, tz);
    const [dx, dy] = anchor(p, 1.32, 0.68, tz);
    const [rx, ry] = anchor(p, W - 0.32, 0.36, tz);
    layer(
      p.c,
      (l) => {
        px(l, tx - 1, ty - 22, '#8a6a46', 2, 22);
        ell(l, tx, ty, 5, 2, '#8a6a46');
        for (const [ox, oy, c] of [[-8, -16, '#2b98aa'], [6, -19, '#f3c843'], [-7, -9, '#e8402e'], [7, -12, '#f2f0ea']] as const) {
          ln(l, tx, ty + oy - 2, tx + Math.sign(ox) * 3, ty + oy, '#8a6a46');
          mug(l, tx + ox, ty + oy + 6, c);
        }
        // doughnuts
        fillPoly(l, [[dx - 12, dy + 1], [dx + 2, dy - 6], [dx + 14, dy - 1], [dx, dy + 6]], '#f4a6c0');
        fillPoly(l, [[dx - 10, dy + 1], [dx + 2, dy - 5], [dx + 12, dy - 1], [dx, dy + 5]], '#fbe4ec');
        for (const [ox, oy, c] of [[-4, 0, '#c87a3a'], [3, -3, '#e86aa8'], [5, 1, '#8a4a22'], [-1, 2, '#f2e2b0']] as const) {
          ell(l, dx + ox, dy + oy - 1, 3, 2, c);
          px(l, dx + ox, dy + oy - 1, '#fbe4ec', 1, 1);
        }
        fillPoly(l, [[dx + 2, dy - 6], [dx + 14, dy - 1], [dx + 16, dy - 12], [dx + 4, dy - 17]], '#f4a6c0');
        // the radio
        fillPoly(l, [[rx - 10, ry - 1], [rx + 2, ry - 6], [rx + 12, ry - 2], [rx, ry + 3]], '#4a3a2a');
        fillPoly(l, [[rx - 10, ry - 1], [rx, ry + 3], [rx, ry - 8], [rx - 10, ry - 12]], '#6a5238');
        fillPoly(l, [[rx, ry + 3], [rx + 12, ry - 2], [rx + 12, ry - 13], [rx, ry - 8]], '#56422e');
        fillPoly(l, [[rx - 10, ry - 12], [rx, ry - 8], [rx + 12, ry - 13], [rx + 2, ry - 17]], '#7a6046');
        px(l, rx - 8, ry - 9, '#e8d8a8', 6, 3);
        ell(l, rx - 4, ry - 3, 2.4, 2.4, '#2a2a30');
        ln(l, rx + 8, ry - 14, rx + 14, ry - 30, GALV[4]);
      },
      { rect: [tx - 16, Math.min(ty, ry) - 34, rx + 18, dy + 8] },
    );
    void k;
  },
  anim(p, k) {
    // steam off the jug, the radio's dial glow
    const [x, y] = anchor(p, 0.43, 0.45, 9 + 0.5 + 3.6);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.5 + i / 3) % 1;
      p.c.globalAlpha = 0.32 * (1 - t);
      ell(p.c, x + Math.sin(t * 6 + i) * 3 * u, y - t * 22 * u, (2 + t * 3) * u, (2 + t * 2.4) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
    const [rx, ry] = anchor(p, 2 - 0.32, 0.36, 9);
    px(p.c, rx - 7 * u, ry - 8 * u, Math.sin(k.t * 0.7) > -0.5 ? '#ffd86a' : '#e8c070', Math.max(1, 4 * u), Math.max(1, u));
  },
};

// ── airline seats as the break bench ────────────────────────
const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.12, W - 0.08, 0.92, 9, 0.26);
    const navy: Ramp = ['#141c34', '#1a2442', '#222e52', '#2c3a64', '#3a4a78', '#4e5e8e'];
    const fabric: Mat = (light, _w, h) => (u, v, x, y) => {
      let i = base(light, navy.length) + 0.3;
      if (v > h - 2) i += 1;
      if ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 === 0) i += 0.3;
      if (hash(x, y, 7) < 0.03) i -= 0.6;
      return at(navy, i);
    };
    const plastic = enamel(['#4a4c52', '#5e6066', '#74767c', '#8a8c92', '#a0a2a6', '#b8babc']);
    // the floor track and the legs
    for (const b of [0.3, 0.74]) lbox(p, 0.06, b, W - 0.12, 0.06, 0, 0.3, mono(enamel(ALU), ALU[0]));
    for (const a of [0.24, W - 0.3]) {
      lbox(p, a, 0.28, 0.06, 0.06, 0.3, 3.4, mono(enamel(ALU), ALU[0]));
      lbox(p, a, 0.72, 0.06, 0.06, 0.3, 3.4, mono(enamel(ALU), ALU[0]));
      ln(p.c, ...anchor(p, a + 0.03, 0.31, 0.6), ...anchor(p, a + 0.03, 0.75, 3.5), ALU[4]);
    }
    // under each seat: the life vest pouch
    for (let i = 0; i < 2; i++) {
      const a = 0.18 + i * 0.86;
      lbox(p, a + 0.2, 0.5, 0.4, 0.3, 2.4, 1.1, mono(enamel(['#6a4a0e', '#946414', '#bf891e', '#dfa92c', '#f3c843', '#f8db74']), '#6a4a0e'));
    }
    // seat pans, then the backs with their headrest covers, then the armrests
    for (let i = 0; i < 2; i++) {
      const a = 0.12 + i * 0.88;
      lbox(p, a, 0.3, 0.82, 0.62, 3.7, 1.2, { front: fabric, side: fabric, top: fabric, edge: navy[0] });
    }
    for (let i = 0; i < 2; i++) {
      const a = 0.12 + i * 0.88;
      lbox(p, a, 0.12, 0.82, 0.2, 4.4, 7, { front: fabric, side: fabric, top: fabric, edge: navy[0] });
      const F = front(p, 0.32);
      pq(p, F, a + 0.1, a + 0.72, 9.4, 11.2, '#e8e8ea');
      pq(p, F, a + 0.1, a + 0.72, 9.4, 9.6, '#c8c8cc');
      pq(p, F, a + 0.36, a + 0.46, 10.2, 10.6, '#2b98aa');
      // seatbelt halves lying on the cushion with a chrome buckle
      const [bx, by] = anchor(p, a + 0.42, 0.66, 4.95);
      ln(p.c, bx - 10, by - 2, bx - 2, by + 2, '#6a6c74', 2);
      ln(p.c, bx + 10, by - 1, bx + 2, by + 2, '#6a6c74', 2);
      px(p.c, bx - 2, by + 1, '#e8eaee', 4, 2);
    }
    for (const a of [0.06, 0.95, W - 0.14]) {
      lbox(p, a, 0.26, 0.1, 0.62, 4.9, 0.5, { front: plastic, side: plastic, top: plastic, edge: '#3a3c42' });
      lbox(p, a + 0.02, 0.3, 0.06, 0.06, 3.7, 1.2, mono(plastic, '#3a3c42'));
    }
    // an ashtray lid in the middle armrest, as they were
    const [ax, ay] = anchor(p, 1.0, 0.7, 5.4);
    px(p.c, ax - 2, ay - 1, '#c8cacc', 4, 2);
    void k;
  },
};

// ── crates and the drum ─────────────────────────────────────
const crate: PropArt = {
  draw(p, k) {
    const open = k.seed % 2 === 0;
    footShadow(p, 0.08, 0.1, 0.92, 0.92, 9, 0.26);
    const ply = plyFace(['#6e5a3c', '#8a7450', '#a68e66', '#bca47a', '#d0b88e', '#e0cca6']);
    const H = 8.6;
    lbox(p, 0.1, 0.12, 0.8, 0.78, 0, H, { front: ply, side: ply, top: ply, edge: '#4e3e28' });
    const F = front(p, 0.9);
    const S = side(p, 0.9);
    // pine battens round the edges and across
    const batt = (pl: typeof F, u0: number, u1: number) => {
      pq(p, pl, u0, u1, 0, 0.8, PINE[pl.light ? 3 : 2]);
      pq(p, pl, u0, u1, H - 0.8, H, PINE[pl.light ? 4 : 2]);
      pq(p, pl, u0, u0 + 0.08, 0, H, PINE[pl.light ? 4 : 2]);
      pq(p, pl, u1 - 0.08, u1, 0, H, PINE[pl.light ? 3 : 1]);
      pq(p, pl, u0, u1, H / 2 - 0.35, H / 2 + 0.35, PINE[pl.light ? 3 : 2]);
    };
    batt(F, 0.1, 0.9);
    batt(S, 0.12, 0.9);
    // stencils: this-way-up arrows, a red fragile glass, a shipping label
    const [ax, ay] = F.F(0.22, H - 1.4);
    for (const dx of [0, 6]) {
      fillPoly(p.c, [[ax + dx, ay - 4], [ax + dx + 3, ay], [ax + dx - 3, ay]], '#1e1e24');
      px(p.c, ax + dx - 1, ay, '#1e1e24', 2, 4);
    }
    const [gx, gy] = F.F(0.7, 2.6);
    fillPoly(p.c, [[gx - 3, gy - 6], [gx + 3, gy - 6], [gx + 1, gy - 1], [gx - 1, gy - 1]], '#c8302a');
    px(p.c, gx, gy - 1, '#c8302a', 1, 3);
    px(p.c, gx - 2, gy + 2, '#c8302a', 5, 1);
    pq(p, S, 0.4, 0.75, 1.6, 3.6, '#f2f0ea');
    for (let i = 0; i < 3; i++) pq(p, S, 0.44, 0.7 - i * 0.06, 2.0 + i * 0.5, 2.2 + i * 0.5, '#3a3a40');
    const [sx, sy] = S.F(0.5, 5.6);
    stencil(p.c, k.seed % 4 === 0 ? 'NVO' : 'TLS', sx - 6, sy - 3, 1.2, -0.6, 0, 1.1, '#2a2a30');
    if (open) {
      // the lid leaning off one side, foam inside and a gripper poking out
      lbox(p, 0.14, 0.16, 0.72, 0.7, H, 0.1, mono(enamel(['#2a2a30', '#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76', '#7a7a86']), '#2a2a30'));
      const [fx, fy] = anchor(p, 0.5, 0.5, H + 0.1);
      layer(
        p.c,
        (l) => {
          for (let i = 0; i < 9; i++) ell(l, fx - 14 + (i % 3) * 12, fy - 3 + Math.floor(i / 3) * 4 - (i % 3) * 2, 6, 3, i % 2 ? '#c8c4b8' : '#dad6cc');
          ln(l, fx - 2, fy - 2, fx + 2, fy - 18, ALU[4], 3);
          ln(l, fx + 2, fy - 18, fx - 3, fy - 24, ALU[3], 2);
          ln(l, fx + 2, fy - 18, fx + 7, fy - 23, ALU[3], 2);
          px(l, fx - 1, fy - 12, ORANGE[4], 3, 3);
        },
        { rect: [fx - 22, fy - 28, fx + 20, fy + 8] },
      );
      const [lx, ly] = anchor(p, 0.98, 0.5, 0);
      layer(
        p.c,
        (l) => {
          fillPoly(l, [[lx - 2, ly + 2], [lx + 4, ly - 1], [lx - 10, ly - 38], [lx - 16, ly - 35]], '#a68e66');
          fillPoly(l, [[lx + 4, ly - 1], [lx + 6, ly - 2], [lx - 8, ly - 39], [lx - 10, ly - 38]], '#6e5a3c');
        },
        { rect: [lx - 20, ly - 42, lx + 10, ly + 4] },
      );
    } else {
      // a steel strap over the top
      lbox(p, 0.46, 0.11, 0.08, 0.8, H, 0.05, mono(enamel(GALV), GALV[0]));
      pq(p, F, 0.46, 0.54, 0, H, GALV[4]);
    }
  },
};

const barrel: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 10, 0.26);
    // a yellow spill pallet
    lbox(p, 0.08, 0.1, 0.84, 0.82, 0, 1.2, { front: enamel(YEL), side: enamel(YEL), top: (_l) => (u, v) => (Math.floor(u / 4) % 2 && Math.floor(v / 4) % 2 ? YEL[2] : YEL[3]), edge: YEL[0] });
    const [x, y] = anchor(p, 0.5, 0.52, 1.2);
    const blue: Ramp = ['#0e2244', '#14305c', '#1c4078', '#265294', '#3466ae', '#4a80c8', '#6a9ade'];
    layer(
      p.c,
      (l) => {
        const R0 = 17;
        const H = 34;
        for (let j = 0; j < H; j++)
          for (let i = -R0; i <= R0; i++) {
            const t = (i + R0) / (2 * R0);
            let tone = t < 0.18 ? 5 : t < 0.42 ? 4 : t < 0.7 ? 3 : t < 0.9 ? 2 : 1;
            if (j === 9 || j === 10 || j === 23 || j === 24) tone += 1;
            if (j === 11 || j === 25) tone -= 1;
            const yy = y - j + Math.round(Math.sqrt(Math.max(0, 1 - (i / R0) ** 2)) * 6);
            px(l, x + i, yy, blue[Math.max(0, Math.min(6, tone))]);
          }
        ell(l, x, y - H, R0, 6, blue[5]);
        ell(l, x, y - H, R0 - 2, 4.6, blue[4]);
        ell(l, x + 6, y - H, 2, 1, '#1e2028');
        // the rotary hand pump in the bung
        px(l, x - 7, y - H - 16, '#b42e28', 4, 16);
        px(l, x - 7, y - H - 16, '#d24434', 1, 16);
        ell(l, x - 5, y - H - 10, 5, 3, '#8e2220');
        ln(l, x - 5, y - H - 10, x + 3, y - H - 14, '#2a2a30', 2);
        ln(l, x - 7, y - H - 14, x - 15, y - H - 10, GALV[4], 2);
        ln(l, x - 15, y - H - 10, x - 16, y - H - 4, GALV[4], 2);
        // a hazard diamond label
        fillPoly(l, [[x - 6, y - 18], [x, y - 24], [x + 6, y - 18], [x, y - 12]], '#f2f0ea');
        fillPoly(l, [[x - 4, y - 18], [x, y - 22], [x + 4, y - 18], [x, y - 14]], '#e8402e');
      },
      { rect: [x - 22, y - 56, x + 22, y + 10] },
    );
    void k;
  },
};

// ── a columnar cactus in a galvanised bucket ──────────────
const CACT: Ramp = ['#1c3424', '#24442c', '#2e5634', '#3a6a3e', '#4a7e48', '#5e9454', '#78aa62'];
const plant: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 18, 6, 0.26);
    const R0 = rng(k.seed * 7 + 3);
    layer(
      p.c,
      (l) => {
        // the bucket, ribbed galvanised steel with a handle
        for (let j = 0; j < 18; j++) {
          const w = 12 - j * 0.14;
          for (let i = -w; i < w; i++) {
            const t = (i + w) / (2 * w);
            let tone = t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.85 ? 3 : 2;
            if (j === 4 || j === 13) tone += 1;
            px(l, x + i, y - j, GALV[tone]);
          }
        }
        ell(l, x, y - 18, 10.6, 3.4, GALV[5]);
        ell(l, x, y - 18, 9.4, 2.6, '#3a2a1c');
        ln(l, x - 11, y - 16, x - 4, y - 26, GALV[2]);
        ln(l, x + 11, y - 16, x + 6, y - 24, GALV[2]);
        // ribbed columns: lit on the left, dark seams between ribs, pale spines along the crests
        const column = (cx: number, base: number, h: number, w: number) => {
          for (let j = 0; j < h; j++) {
            const capStart = h - w * 0.6;
            const ww = j > capStart ? Math.round(w * Math.sqrt(Math.max(0, 1 - ((j - capStart) / (w * 0.6)) ** 2))) : w;
            for (let i = -ww; i <= ww; i++) {
              const t = (i + ww) / (2 * ww + 0.01);
              let tone = t < 0.22 ? 5 : t < 0.5 ? 4 : t < 0.78 ? 3 : 2;
              const rib = (i + w + 40) % 3;
              if (rib === 0) tone -= 1;
              px(l, cx + i, base - j, CACT[Math.max(0, Math.min(6, tone))]);
              if (rib === 1 && j % 4 === 0 && R0() < 0.6) px(l, cx + i, base - j, '#e8e4c8');
            }
          }
        };
        column(x + 6, y - 19, 46, 4);
        column(x - 2, y - 19, 70, 5);
        // a side arm off the main stem: out, then up
        for (let i = 0; i < 6; i++) px(l, x - 9 - i, y - 52 - Math.floor(i * 0.3), CACT[i < 2 ? 4 : 3], 3, 6);
        column(x - 15, y - 54, 18, 3);
        // a white bud on the tallest column
        ell(l, x - 2, y - 90, 3, 2.4, '#f6f2e6');
        px(l, x - 3, y - 92, '#ffffff', 2, 1);
      },
      { rect: [x - 24, y - 98, x + 16, y + 4] },
    );
  },
};

// ── extra workshop pieces ───────────────────────────────────
const rob_toolchest: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.16, 0.88, 0.86, 12, 0.26);
    const red = enamel(RED, 0.01);
    // the roll cab on castors, then the top chest
    for (const [a, b] of [[0.2, 0.26], [0.74, 0.26], [0.2, 0.8], [0.74, 0.8]] as const) {
      const [cx, cy] = anchor(p, a, b, 0.4);
      ell(p.c, cx, cy, 3, 2, RUBBER[1]);
    }
    lbox(p, 0.14, 0.2, 0.72, 0.62, 0.8, 7.2, { front: red, side: red, top: red, edge: RED[0] });
    const F = front(p, 0.82);
    const S = side(p, 0.86);
    const drawers = [1.2, 2.6, 3.8, 4.9, 6.0];
    for (let i = 0; i < drawers.length; i++) {
      const z0 = drawers[i];
      const z1 = (drawers[i + 1] ?? 7.8) - 0.15;
      pq(p, F, 0.17, 0.83, z0, z1, RED[F.light ? 3 : 2]);
      pq(p, F, 0.17, 0.83, z1 - 0.12, z1, RED[F.light ? 5 : 3]);
      pq(p, F, 0.24, 0.76, z1 - 0.5, z1 - 0.28, ALU[5]);
    }
    pq(p, S, 0.3, 0.72, 5, 6.6, ALU[3]);
    // the top chest with a lift lid, a socket tray and a drill on top
    lbox(p, 0.16, 0.24, 0.68, 0.54, 8, 3.4, { front: red, side: red, top: red, edge: RED[0] });
    for (let i = 0; i < 3; i++) {
      const z0 = 8.3 + i * 0.95;
      pq(p, front(p, 0.78), 0.19, 0.81, z0, z0 + 0.8, RED[2]);
      pq(p, front(p, 0.78), 0.3, 0.7, z0 + 0.5, z0 + 0.65, ALU[5]);
    }
    const [tx, ty] = anchor(p, 0.42, 0.52, 11.4);
    const [dx, dy] = anchor(p, 0.66, 0.5, 11.4);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[tx - 10, ty], [tx, ty - 5], [tx + 10, ty], [tx, ty + 5]], '#2a2a30');
        for (let i = 0; i < 6; i++) ell(l, tx - 6 + i * 2.4, ty - 1 + (i % 2), 1.6, 1.2, GALV[5]);
        px(l, dx - 3, dy - 6, '#1e1e24', 6, 6);
        px(l, dx - 2, dy - 14, YEL[3], 4, 8);
        px(l, dx - 2, dy - 14, YEL[5], 1, 8);
        px(l, dx - 3, dy - 18, '#1e1e24', 10, 4);
        px(l, dx + 7, dy - 17, GALV[4], 4, 2);
      },
      { rect: [tx - 14, dy - 22, dx + 14, ty + 8] },
    );
    void k;
  },
};

const rob_spool: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 20, 7, 0.26);
    // a cable drum lying flat: the bottom flange, the black cable core, the top flange as a table
    layer(
      p.c,
      (l) => {
        ell(l, x, y - 2, 24, 10, PINE[1]);
        for (let j = 0; j < 14; j++) ell(l, x, y - 3 - j, 14, 6, j % 3 === 0 ? '#2a2a30' : '#1e1e24');
        ell(l, x, y - 17, 25, 10.5, PINE[2]);
        ell(l, x - 1, y - 18, 24, 10, PINE[4]);
        for (let i = -20; i < 22; i += 6) ln(l, x + i, y - 26 + Math.abs(i) * 0.12, x + i + 2, y - 10 - Math.abs(i) * 0.12, PINE[3]);
        ell(l, x, y - 18, 4, 1.8, '#3a2a1c');
        // on top: a mug, a magazine, a model glider
        mug(l, x + 10, y - 19, '#f3c843');
        fillPoly(l, [[x - 16, y - 18], [x - 6, y - 22], [x + 2, y - 19], [x - 8, y - 15]], '#2e4a6a');
        fillPoly(l, [[x - 14, y - 18], [x - 6, y - 21], [x, y - 19], [x - 8, y - 16]], '#d8e2ec');
      },
      { rect: [x - 30, y - 34, x + 30, y + 10] },
    );
    void k;
  },
};

const rob_drill: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 16, 0.26);
    const cast: Ramp = ['#22302a', '#2c3e36', '#384e44', '#466054', '#567466', '#6a8a7a', '#86a492'];
    // the base cabinet with a drawer and the bit index
    lbox(p, 0.14, 0.18, 0.72, 0.66, 0, 7.4, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    const F = front(p, 0.84);
    pq(p, F, 0.18, 0.82, 4.8, 6.9, SLATE[F.light ? 2 : 1]);
    pq(p, F, 0.42, 0.58, 5.6, 5.9, GALV[5]);
    pq(p, F, 0.18, 0.82, 0.6, 4.4, SLATE[F.light ? 2 : 1]);
    // the foot casting bolted to the cabinet top
    lbox(p, 0.26, 0.24, 0.48, 0.42, 7.4, 0.7, mono(enamel(cast), cast[0]));
    const [cx, cy] = anchor(p, 0.5, 0.36, 8.1);
    const [tx, ty] = anchor(p, 0.5, 0.56, 11.6);
    const [hx, hy] = anchor(p, 0.5, 0.44, 16.4);
    layer(
      p.c,
      (l) => {
        // the column
        for (let j = 0; j < cy - hy; j++) {
          px(l, cx - 2, cy - j, GALV[5], 1, 1);
          px(l, cx - 1, cy - j, GALV[4], 2, 1);
          px(l, cx + 1, cy - j, GALV[2], 2, 1);
        }
        // the work table on its collar, a cross of T-slots
        px(l, cx - 3, ty - 3, cast[2], 7, 5);
        ell(l, tx, ty + 1, 11, 5.2, cast[1]);
        ell(l, tx, ty, 11, 5.2, cast[4]);
        ell(l, tx - 2, ty - 1, 7, 3, cast[5]);
        ln(l, tx - 8, ty, tx + 8, ty, cast[2]);
        ln(l, tx, ty - 4, tx, ty + 4, cast[2]);
        ell(l, tx, ty, 2, 1.2, cast[0]);
      },
      { rect: [tx - 14, hy - 4, tx + 14, cy + 4] },
    );
    // the head: body, motor at the back, the belt guard on top
    lbox(p, 0.34, 0.12, 0.32, 0.22, 16.2, 2.6, { front: enamel(STEEL), side: enamel(STEEL), top: enamel(STEEL), edge: STEEL[0] });
    lbox(p, 0.28, 0.3, 0.44, 0.44, 15.6, 3.4, { front: enamel(cast), side: enamel(cast), top: enamel(cast), edge: cast[0] });
    lbox(p, 0.26, 0.22, 0.48, 0.56, 19, 1.2, { front: enamel(cast), side: enamel(cast), top: enamel(cast), edge: cast[0] });
    layer(
      p.c,
      (l) => {
        // quill, chuck and bit, under the head
        const [qx, qy] = anchor(p, 0.5, 0.58, 15.6);
        px(l, qx - 2, qy, GALV[3], 4, 6);
        px(l, qx - 2, qy, GALV[5], 1, 6);
        px(l, qx - 3, qy + 6, GALV[4], 6, 4);
        px(l, qx - 3, qy + 6, GALV[6], 2, 4);
        px(l, qx - 1, qy + 10, GALV[5], 1, 8);
        // the three-spoke feed handle on the right flank
        const [fx, fy] = anchor(p, 0.74, 0.52, 17.2);
        for (const ang of [0.3, 2.4, 4.5]) {
          const ex = fx + Math.cos(ang) * 9;
          const ey = fy + Math.sin(ang) * 6;
          ln(l, fx, fy, ex, ey, GALV[5]);
          ell(l, ex, ey, 1.6, 1.6, '#1e1e24');
        }
        ell(l, fx, fy, 2.4, 2.4, GALV[3]);
        // the red emergency stop and a switch on the front
        const [ex2, ey2] = anchor(p, 0.38, 0.74, 17.6);
        ell(l, ex2, ey2, 2.6, 2, RED[3]);
        px(l, ex2 - 1, ey2 - 1, RED[5], 2, 1);
        px(l, ex2 + 6, ey2 - 1, '#2a8a4a', 2, 2);
      },
      { rect: [hx - 26, hy - 30, hx + 30, hy + 30] },
    );
    void k;
  },
};

const rob_dog: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 8, y + 2, 18, 5, 0.28);
    layer(
      p.c,
      (l) => {
        // four legs with knees bent backwards, black feet
        const leg = (hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, col: string) => {
          ln(l, hx, hy, kx, ky, col, 4);
          ln(l, kx, ky, fx, fy, '#1e1e24', 3);
          ell(l, fx, fy, 2.4, 1.6, '#121214');
          ell(l, kx, ky, 2.4, 2.4, '#3a3d46');
        };
        leg(x + 10, y - 22, x + 14, y - 12, x + 11, y - 1, '#26282e');
        leg(x - 12, y - 18, x - 8, y - 9, x - 12, y + 1, '#26282e');
        // the body: a long yellow box with black side panels
        fillPoly(l, [[x - 18, y - 16], [x + 8, y - 27], [x + 18, y - 22], [x - 8, y - 11]], YEL[3]);
        fillPoly(l, [[x - 18, y - 16], [x - 8, y - 11], [x - 8, y - 17], [x - 18, y - 22]], YEL[4]);
        fillPoly(l, [[x - 8, y - 11], [x + 18, y - 22], [x + 18, y - 28], [x - 8, y - 17]], '#2a2a30');
        fillPoly(l, [[x - 18, y - 22], [x - 8, y - 17], [x + 18, y - 28], [x + 8, y - 33]], YEL[5]);
        px(l, x - 4, y - 22, '#1e1e24', 12, 1);
        // the sensor head at the front, lit eyes
        fillPoly(l, [[x + 18, y - 22], [x + 24, y - 25], [x + 24, y - 31], [x + 18, y - 28]], '#1e1e24');
        px(l, x + 20, y - 28, LED.cyan, 2, 2);
        px(l, x + 22, y - 29, LED.cyan, 2, 1);
        leg(x + 12, y - 20, x + 16, y - 10, x + 14, y + 2, '#3a3d46');
        leg(x - 10, y - 16, x - 6, y - 7, x - 9, y + 3, '#3a3d46');
        // a handle on its back
        ln(l, x - 4, y - 30, x - 2, y - 36, '#1e1e24', 2);
        ln(l, x - 2, y - 36, x + 6, y - 40, '#1e1e24', 2);
        ln(l, x + 6, y - 40, x + 6, y - 34, '#1e1e24', 2);
      },
      { rect: [x - 24, y - 46, x + 30, y + 6] },
    );
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    const u = p.k / 4;
    if (Math.sin(k.t * 0.8 + k.seed) > 0.9) px(p.c, x + 20 * u, y - 28 * u, '#1e1e24', Math.max(1, 4 * u), Math.max(1, 2 * u));
  },
};

const rob_cart: PropArt = {
  draw(p, k) {
    footShadow(p, 0.14, 0.18, 0.86, 0.84, 10, 0.26);
    for (const [a, b] of [[0.2, 0.24], [0.76, 0.24], [0.2, 0.8], [0.76, 0.8]] as const) {
      const [cx, cy] = anchor(p, a, b, 0.4);
      ell(p.c, cx, cy, 2.6, 1.8, RUBBER[1]);
      lbox(p, a - 0.03, b - 0.03, 0.06, 0.06, 0.6, 8.6, mono(dark, STEEL[0]));
    }
    for (const z of [0.9, 4.4, 8.4]) {
      lbox(p, 0.14, 0.18, 0.72, 0.66, z, 0.5, { front: steel, side: steel, top: (_l) => () => SLATE[3], edge: SLATE[0] });
    }
    // the trays: a filament spool and a bag of screws below, a scope probe set and a box on top
    const [ax, ay] = anchor(p, 0.42, 0.5, 4.9);
    const [bx, by] = anchor(p, 0.5, 0.5, 8.9);
    const [cx, cy] = anchor(p, 0.5, 0.5, 1.4);
    layer(
      p.c,
      (l) => {
        ell(l, ax + 2, ay - 5, 8, 4, '#1e1e24');
        ell(l, ax, ay - 6, 8, 4, TEAL[4]);
        ell(l, ax, ay - 6, 3, 1.4, '#1e1e24');
        px(l, ax + 8, ay - 5, '#e8e4dc', 6, 4);
        fillPoly(l, [[bx - 10, by - 1], [bx, by - 6], [bx + 10, by - 1], [bx, by + 4]], '#5e4224');
        fillPoly(l, [[bx - 10, by - 1], [bx, by + 4], [bx, by - 2], [bx - 10, by - 7]], '#b48c54');
        fillPoly(l, [[bx, by + 4], [bx + 10, by - 1], [bx + 10, by - 7], [bx, by - 2]], '#9a7442');
        fillPoly(l, [[bx - 10, by - 7], [bx, by - 2], [bx + 10, by - 7], [bx, by - 12]], '#c8a46a');
        ln(l, bx - 6, by - 9, bx + 6, by - 3, '#d8c8a0');
        for (let i = 0; i < 3; i++) ell(l, cx - 4 + i * 4, cy - 3, 3, 2, ['#d8402e', '#2c62c8', YEL[4]][i]);
      },
      { rect: [cx - 14, by - 16, cx + 16, cy + 4] },
    );
    void k;
  },
};

const rob_cobot: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 18, 0.28);
    // the pedestal on locking castors
    lbox(p, 0.18, 0.2, 0.64, 0.6, 0.6, 7, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    for (const [a, b] of [[0.24, 0.26], [0.76, 0.26], [0.24, 0.8], [0.76, 0.8]] as const) {
      const [cx, cy] = anchor(p, a, b, 0.3);
      ell(p.c, cx, cy, 3, 2, RUBBER[1]);
    }
    const F = front(p, 0.8);
    pq(p, F, 0.26, 0.74, 1.4, 6.6, SLATE[F.light ? 2 : 1]);
    pq(p, F, 0.36, 0.64, 4.6, 5.8, '#121418');
    // the arm: base, shoulder, upper arm, elbow, forearm, wrist, gripper — white with blue rings
    const [x, y] = anchor(p, 0.5, 0.5, 7.6);
    layer(
      p.c,
      (l) => {
        const ring = (cx: number, cy: number, r: number) => {
          ell(l, cx, cy, r, r * 0.9, SHELL[3]);
          ell(l, cx - 1, cy - 1, r - 1.5, r * 0.9 - 1.5, SHELL[5]);
          ell(l, cx, cy, r * 0.55, r * 0.5, '#2c62c8');
        };
        fillPoly(l, [[x - 8, y], [x + 8, y], [x + 7, y - 9], [x - 7, y - 9]], SHELL[4]);
        px(l, x - 8, y - 4, '#2c62c8', 16, 2);
        ring(x, y - 12, 7);
        fillPoly(l, [[x - 4, y - 14], [x + 4, y - 14], [x + 14, y - 40], [x + 6, y - 42]], SHELL[4]);
        fillPoly(l, [[x - 4, y - 14], [x - 1, y - 14], [x + 8, y - 41], [x + 6, y - 42]], SHELL[6]);
        ring(x + 10, y - 42, 6);
        fillPoly(l, [[x + 12, y - 44], [x + 16, y - 39], [x + 34, y - 32], [x + 31, y - 37]], SHELL[3]);
        ring(x + 33, y - 33, 4.6);
        px(l, x + 32, y - 28, '#2a2a30', 3, 5);
        ln(l, x + 31, y - 23, x + 29, y - 18, ALU[4], 2);
        ln(l, x + 35, y - 23, x + 37, y - 18, ALU[4], 2);
        // a gripped part: an orange printed bracket
        px(l, x + 30, y - 20, ORANGE[4], 7, 3);
      },
      { rect: [x - 14, y - 52, x + 44, y + 4] },
    );
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 7.6);
    const u = p.k / 4;
    px(p.c, x - 2 * u, y - 4 * u, Math.sin(k.t * 2.2) > 0 ? LED.blue : '#2a4a8a', Math.max(1, 4 * u), Math.max(1, u));
  },
};

const rob_boxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 8, 0.24);
    const R0 = rng(k.seed * 5 + 1);
    const stack: [number, number, number, number, number][] = [
      [0.14, 0.18, 0.7, 0.64, 0],
      [0.2, 0.24, 0.56, 0.5, 3.6],
      [0.3, 0.28, 0.4, 0.36, 6.6],
    ];
    for (const [a, b, w, d, z] of stack) {
      const h = z === 0 ? 3.6 : z < 5 ? 3 : 2.2;
      lbox(p, a, b, w, d, z, h, mono(cardboard(KRAFT), KRAFT[0]));
      const F = front(p, b + d);
      const S = side(p, a + w);
      // tape across, a shipping label, a brand stripe
      pq(p, F, a + w * 0.44, a + w * 0.56, z, z + h, '#d8c08a');
      pq(p, S, b + d * 0.2, b + d * 0.6, z + h * 0.3, z + h * 0.7, '#f2f0ea');
      if (R0() < 0.6) pq(p, F, a + 0.05, a + w * 0.36, z + h * 0.55, z + h * 0.75, ['#2c62c8', '#d8402e', '#3aa058'][Math.floor(R0() * 3)]);
    }
  },
};

/** An aircraft flat-four on a yellow engine stand, plugs out, half-way through an overhaul. */
const rob_engine: PropArt = {
  draw(p, k) {
    footShadow(p, 0.06, 0.1, 0.94, 0.92, 12, 0.26);
    const stand = enamel(YEL);
    for (const [a, b] of [[0.12, 0.18], [0.84, 0.18], [0.12, 0.84], [0.84, 0.84]] as const) {
      const [cx, cy] = anchor(p, a, b, 0.4);
      ell(p.c, cx, cy, 3, 2, RUBBER[1]);
    }
    lbox(p, 0.08, 0.16, 0.84, 0.08, 0.6, 0.6, mono(stand, YEL[1]));
    lbox(p, 0.08, 0.78, 0.84, 0.08, 0.6, 0.6, mono(stand, YEL[1]));
    lbox(p, 0.46, 0.18, 0.08, 0.64, 0.6, 0.6, mono(stand, YEL[1]));
    lbox(p, 0.44, 0.44, 0.12, 0.12, 1.2, 4.4, mono(stand, YEL[1]));
    lbox(p, 0.3, 0.42, 0.4, 0.16, 5.4, 0.5, mono(stand, YEL[1]));
    const [x, y] = anchor(p, 0.5, 0.5, 7.4);
    const alu: Ramp = ['#4a4e56', '#666a72', '#82878e', '#a0a5ab', '#bec2c6', '#dadcde'];
    layer(
      p.c,
      (l) => {
        // the crankcase: a long finned box seen three-quarter
        fillPoly(l, [[x - 22, y + 2], [x + 6, y - 12], [x + 28, y - 1], [x, y + 13]], alu[2]);
        fillPoly(l, [[x - 22, y + 2], [x, y + 13], [x, y + 1], [x - 22, y - 10]], alu[3]);
        fillPoly(l, [[x, y + 13], [x + 28, y - 1], [x + 28, y - 13], [x, y + 1]], alu[1]);
        fillPoly(l, [[x - 22, y - 10], [x, y + 1], [x + 28, y - 13], [x + 6, y - 24]], alu[4]);
        for (let i = 0; i < 5; i++) ln(l, x - 18 + i * 9, y - 9 + i * 1.2 - (i * 7) / 2, x - 18 + i * 9 + 10, y - 4 - (i * 7) / 2, alu[2]);
        // four finned cylinders, two each side, rocker covers in red
        const cyl = (cx: number, cy: number, s2: number) => {
          for (let i = 0; i < 7; i++) ell(l, cx + s2 * i * 2.2, cy - i * 1.1, 7, 5, i % 2 ? alu[1] : alu[3]);
          fillPoly(l, [[cx + s2 * 15 - 7, cy - 12], [cx + s2 * 15 + 7, cy - 15], [cx + s2 * 15 + 8, cy - 7], [cx + s2 * 15 - 6, cy - 4]], RED[3]);
          px(l, cx + s2 * 15 - 4, cy - 13, RED[5], 6, 1);
          px(l, cx + s2 * 15 - 1, cy - 9, GALV[5], 2, 2);
        };
        cyl(x - 14, y - 8, -1);
        cyl(x + 4, y - 17, -1);
        cyl(x + 16, y - 2, 1);
        cyl(x + 32, y - 11, 1);
        // the prop flange at the front, the sump, intake pipes, plug leads hanging loose
        ell(l, x + 32, y + 4, 7, 9, alu[4]);
        ell(l, x + 32, y + 4, 4, 5, alu[1]);
        for (let i = 0; i < 6; i++) px(l, x + 32 + Math.cos(i) * 5.5, y + 4 + Math.sin(i) * 7, alu[5]);
        px(l, x - 8, y + 10, alu[0], 18, 7);
        px(l, x - 8, y + 10, alu[2], 18, 1);
        ln(l, x - 4, y - 18, x + 10, y - 6, '#2a2a30', 2);
        for (let i = 0; i < 4; i++) ln(l, x - 12 + i * 9, y - 20 - i * 2, x - 9 + i * 9 + (i % 2) * 5, y + 6 + i * 2, i % 2 ? '#f2f0ea' : '#d8402e');
      },
      { rect: [x - 44, y - 44, x + 48, y + 22] },
    );
    void k;
  },
};

/** Light-aircraft tyres stacked, and a wheel on its hub leaning against them. */
const rob_tyres: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 18, 6, 0.26);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 3; i++) {
          const yy = y - 4 - i * 7;
          ell(l, x, yy + 3, 15, 7.5, RUBBER[0]);
          ell(l, x, yy, 15, 7.5, RUBBER[2]);
          ell(l, x - 1, yy - 1, 13, 6.4, RUBBER[3]);
          for (let a = 0; a < 18; a++) px(l, x + Math.cos((a / 18) * Math.PI * 2) * 11.5, yy + Math.sin((a / 18) * Math.PI * 2) * 5.6, RUBBER[1], 2, 1);
          ell(l, x, yy, 6, 3, '#121216');
        }
        // the wheel with its silver hub
        ell(l, x + 14, y - 10, 6, 10, RUBBER[1]);
        ell(l, x + 13, y - 10, 4.6, 8, RUBBER[3]);
        ell(l, x + 13, y - 10, 2.4, 4, GALV[4]);
        px(l, x + 12, y - 12, GALV[6], 1, 2);
      },
      { rect: [x - 20, y - 36, x + 24, y + 6] },
    );
    void k;
  },
};

/** An aluminium step ladder standing open, with its top tray. */
const rob_ladder: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.6);
    contactShadow(p.c, x + 8, y + 2, 16, 5, 0.26);
    layer(
      p.c,
      (l) => {
        // the rear legs, then the front stiles with treads, the top tray
        ln(l, x + 2, y - 62, x + 12, y - 4, ALU[2], 2);
        ln(l, x + 8, y - 64, x + 18, y - 8, ALU[2], 2);
        ln(l, x - 2, y - 62, x - 12, y + 2, ALU[4], 3);
        ln(l, x + 4, y - 64, x - 4, y - 2, ALU[3], 3);
        for (let i = 0; i < 5; i++) {
          const t = 0.18 + i * 0.18;
          const ax = x - 2 + (x - 12 - (x - 2)) * t;
          const ay = y - 62 + (y + 2 - (y - 62)) * t;
          const bx = x + 4 + (x - 4 - (x + 4)) * t;
          const by = y - 64 + (y - 2 - (y - 64)) * t;
          ln(l, ax, ay, bx, by, ALU[5], 2);
          ln(l, ax, ay + 2, bx, by + 2, ALU[1]);
        }
        fillPoly(l, [[x - 4, y - 64], [x + 6, y - 68], [x + 12, y - 64], [x + 2, y - 60]], ORANGE[3]);
        fillPoly(l, [[x - 4, y - 64], [x + 2, y - 60], [x + 2, y - 58], [x - 4, y - 62]], ORANGE[4]);
        px(l, x + 1, y - 66, '#2a2a30', 4, 2);
        px(l, x + 6, y - 65, GALV[4], 3, 1);
        ln(l, x + 2, y - 34, x + 12, y - 36, '#c8382a');
      },
      { rect: [x - 16, y - 72, x + 22, y + 6] },
    );
    void k;
  },
};

/** A light-aircraft wing on two padded trestles, its aileron off for re-covering. */
const rob_wing: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.15, W - 0.05, 0.9, 9, 0.26);
    const tres = enamel(YEL);
    // two trestles with carpeted cradles
    for (const a of [0.35, W - 0.5]) {
      lbox(p, a - 0.05, 0.2, 0.08, 0.06, 0, 5.6, mono(tres, YEL[1]));
      lbox(p, a - 0.05, 0.74, 0.08, 0.06, 0, 5.6, mono(tres, YEL[1]));
      lbox(p, a - 0.1, 0.2, 0.18, 0.6, 5.6, 0.6, mono(enamel(['#3a2a22', '#4a362c', '#5a4436', '#6a5242', '#7a604e', '#8a6e5a']), '#2a1e18'));
    }
    // the wing: a long shallow box, fabric-covered (cream doped linen), rib tapes showing through
    const fabric: Mat = (light, _w, h) => (u, v, x, y) => {
      let i = light === 2 ? 4.4 : light ? 3.4 : 2;
      if (u % 18 < 1.6) i -= 0.7;
      if (light === 2 && v < 7) i += 0.6;
      if (hash(x, y, 5) < 0.02) i -= 0.6;
      void h;
      return at(['#8a8270', '#a89e88', '#c4baa2', '#d8cfb8', '#e8e0cc', '#f4eedc', '#fcf8ee'], i);
    };
    lbox(p, 0.06, 0.24, W - 0.12, 0.56, 6.2, 1.3, { front: fabric, side: fabric, top: fabric, edge: '#7a7262' });
    // the leading edge in aluminium, the open aileron bay with its hinges, a red tip
    lbox(p, 0.06, 0.72, W - 0.12, 0.1, 6.3, 1.0, mono(enamel(ALU), ALU[1]));
    lbox(p, 0.06, 0.24, 0.2, 0.56, 6.2, 1.36, mono(enamel(RED), RED[1]));
    const [b0x, b0y] = anchor(p, W * 0.45, 0.28, 7.5);
    const [b1x, b1y] = anchor(p, W - 0.2, 0.28, 7.5);
    ln(p.c, b0x, b0y, b1x, b1y, '#3a3428', 2);
    for (let t = 0.1; t < 1; t += 0.3) px(p.c, b0x + (b1x - b0x) * t - 1, b0y + (b1y - b0y) * t - 1, GALV[5], 2, 2);
    // the aileron leaning against the far trestle, a roll of fabric, a brush in a tin
    const [ax, ay] = anchor(p, W - 0.25, 0.92, 0);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[ax - 2, ay], [ax + 3, ay - 2], [ax - 16, ay - 30], [ax - 21, ay - 28]], '#e8e0cc');
        fillPoly(l, [[ax + 3, ay - 2], [ax + 5, ay - 3], [ax - 14, ay - 31], [ax - 16, ay - 30]], '#b4ac98');
        const [rx, ry] = anchor(p, 0.4, 0.9, 0);
        ell(l, rx, ry - 4, 4, 4, '#e8e0cc');
        px(l, rx, ry - 8, '#f4eedc', 14, 8);
        ell(l, rx + 14, ry - 4, 4, 4, '#d8cfb8');
        px(l, rx + 20, ry - 7, '#7a7a80', 5, 6);
        px(l, rx + 21, ry - 12, '#8a6a46', 2, 6);
      },
      { rect: [ax - 30, ay - 36, ax + 10, ay + 4] },
    );
    void k;
  },
};

/** A tall multi-drawer parts cabinet, every drawer labelled. */
const rob_cabinet: PropArt = {
  draw(p, k) {
    footShadow(p, 0.14, 0.18, 0.86, 0.86, 12, 0.26);
    lbox(p, 0.16, 0.22, 0.68, 0.6, 0, 11.6, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    const F = front(p, 0.82);
    for (let r = 0; r < 8; r++)
      for (let i = 0; i < 2; i++) {
        const z0 = 0.8 + r * 1.32;
        const a0 = 0.2 + i * 0.31;
        pq(p, F, a0, a0 + 0.28, z0, z0 + 1.16, SLATE[F.light ? 4 : 2]);
        pq(p, F, a0 + 0.08, a0 + 0.2, z0 + 0.66, z0 + 0.96, ['#f2f0ea', YEL[5], '#9fc8f2', '#f2a0c0'][(r + i * 3 + k.seed) % 4]);
        pq(p, F, a0 + 0.06, a0 + 0.22, z0 + 0.2, z0 + 0.36, GALV[5]);
      }
    // on top: a box of servos and a coil of solder
    lbox(p, 0.24, 0.3, 0.4, 0.36, 11.6, 1.6, mono(enamel(['#5e4224', '#7c5a32', '#9a7442', '#b48c54', '#c8a46a', '#dabc86']), '#5e4224'));
    const [sx, sy] = anchor(p, 0.7, 0.6, 11.6);
    ell(p.c, sx, sy - 2, 4, 2, '#2a2a30');
    ell(p.c, sx, sy - 3, 3, 1.4, GALV[5]);
    void k;
  },
};

/** A caged pair of welding gas cylinders (argon and CO2) with their regulators. */
const rob_gas: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.3, 0.8, 0.8, 16, 0.26);
    const [x, y] = anchor(p, 0.5, 0.55);
    layer(
      p.c,
      (l) => {
        // the back of the cage
        for (let i = -14; i <= 14; i += 4) px(l, x + i, y - 52, '#4a5a2a', 1, 50);
        const bottle = (bx: number, col: string[], neck: string) => {
          for (let j = 0; j < 54; j++) {
            const w = j > 48 ? 5 - (j - 48) * 0.6 : 5;
            for (let i = -w; i < w; i++) {
              const t = (i + w) / (2 * w);
              px(l, bx + i, y - 2 - j, col[t < 0.25 ? 3 : t < 0.55 ? 2 : t < 0.85 ? 1 : 0]);
            }
          }
          px(l, bx - 3, y - 58, neck, 6, 3);
          px(l, bx - 2, y - 63, GALV[4], 4, 5);
          ell(l, bx + 3, y - 62, 3, 3, '#1e1e24');
          ell(l, bx + 3, y - 62, 1.6, 1.6, '#f2f0ea');
        };
        bottle(x - 6, ['#1e3a2a', '#2a5038', '#386648', '#4a7c5a'], '#e8e8e8');
        bottle(x + 6, ['#2a2c32', '#3a3d46', '#4c5060', '#606474'], '#2a2c32');
        // the front bars and the chain
        px(l, x - 16, y - 2, '#3a4a22', 32, 3);
        px(l, x - 16, y - 50, '#3a4a22', 32, 2);
        for (let i = -15; i <= 15; i += 6) px(l, x + i, y - 50, '#5a6e32', 1, 48);
        ln(l, x - 15, y - 34, x + 15, y - 36, GALV[4]);
        // a yellow danger diamond
        fillPoly(l, [[x + 14, y - 24], [x + 19, y - 29], [x + 24, y - 24], [x + 19, y - 19]], YEL[4]);
      },
      { rect: [x - 20, y - 68, x + 26, y + 4] },
    );
    void k;
  },
};

/** A yellow shop vac with its hose coiled round it. */
const rob_vac: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 6, y + 2, 14, 5, 0.26);
    layer(
      p.c,
      (l) => {
        for (const [dx, dy] of [[-8, 0], [7, 1], [0, 4]] as const) ell(l, x + dx, y + dy, 2, 1.4, RUBBER[1]);
        for (let j = 0; j < 22; j++) {
          const w = 10 - (j < 3 ? (3 - j) * 0.6 : 0);
          for (let i = -w; i < w; i++) {
            const t = (i + w) / (2 * w);
            px(l, x + i, y - 2 - j, YEL[t < 0.22 ? 5 : t < 0.5 ? 4 : t < 0.8 ? 3 : 2]);
          }
        }
        ell(l, x, y - 24, 10, 4, '#2a2a30');
        ell(l, x - 1, y - 26, 8, 3, '#3a3a40');
        px(l, x - 3, y - 31, '#1e1e24', 6, 3);
        for (let i = 0; i < 3; i++) ell(l, x + 2, y - 10 - i * 3, 12, 4, i % 2 ? '#1e1e24' : '#2a2a30');
        ell(l, x + 2, y - 10, 8, 2.4, YEL[4]);
        ln(l, x + 12, y - 12, x + 18, y - 2, '#1e1e24', 3);
      },
      { rect: [x - 16, y - 36, x + 22, y + 6] },
    );
    void k;
  },
};

/** Flat details on the workshop slab. */
const rob_floor: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'tape';
    const c = p.c;
    if (v === 'ramp') {
      // a yellow and black cable protector across the floor, with the cable running into it
      const n = Math.max(1, Math.round(p.pw * 4));
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * p.pw;
        const a1 = ((i + 1) / n) * p.pw;
        const q = [p.P(a0, 0.38), p.P(a1, 0.38), p.P(a1, 0.62), p.P(a0, 0.62)];
        fillPoly(c, q, i % 2 ? YEL[4] : '#1e1e24');
        const r = [p.P(a0, 0.45), p.P(a1, 0.45), p.P(a1, 0.55), p.P(a0, 0.55)];
        fillPoly(c, r, i % 2 ? YEL[5] : '#2e2e34');
      }
      const [x0, y0] = p.P(0, 0.5);
      const [x1, y1] = p.P(-0.2, 0.5);
      ln(c, x0, y0, x1, y1, '#1e1e24', 2);
    } else if (v === 'mat') {
      // an anti-fatigue mat: black rubber with a grid of holes and yellow bevelled edges
      const a0 = 0.08;
      const a1 = p.pw - 0.08;
      const b0 = 0.12;
      const b1 = p.pd - 0.12;
      fillPoly(c, [p.P(a0, b0 + 0.1), p.P(a1, b0 + 0.1), p.P(a1, b1), p.P(a0, b1)], '#2a2c32');
      fillPoly(c, [p.P(a0 + 0.03, b0 + 0.14), p.P(a1 - 0.03, b0 + 0.14), p.P(a1 - 0.03, b1 - 0.04), p.P(a0 + 0.03, b1 - 0.04)], '#3e4048');
      fillPoly(c, [p.P(a0 + 0.03, b1 - 0.1), p.P(a1 - 0.03, b1 - 0.1), p.P(a1 - 0.03, b1 - 0.04), p.P(a0 + 0.03, b1 - 0.04)], YEL[3]);
      for (let a = a0 + 0.12; a < a1 - 0.08; a += 0.1)
        for (let b = b0 + 0.24; b < b1 - 0.14; b += 0.1) {
          const [hx, hy] = p.P(a, b);
          px(c, hx, hy, '#4c4e58', 2, 1);
        }
    } else if (v === 'emblem') {
      // the workshop's emblem painted on the slab: a teal disc, a white arm, a ring of dashes
      const [x, y] = p.P(p.pw / 2, p.pd / 2);
      const R = p.pw * 26;
      ell(c, x, y, R, R / 2, '#e8e4d8');
      ell(c, x, y, R - 3, R / 2 - 1.5, TEAL[3]);
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2;
        px(c, x + Math.cos(ang) * (R - 7), y + Math.sin(ang) * (R / 2 - 3.5), '#e8e4d8', 3, 1);
      }
      ell(c, x, y, R - 11, R / 2 - 5.5, TEAL[2]);
      fillPoly(c, [[x - 18, y + 6], [x - 6, y + 6], [x - 8, y + 2], [x - 16, y + 2]], '#f2f0ea');
      ln(c, x - 12, y + 2, x - 4, y - 8, '#f2f0ea', 3);
      ln(c, x - 4, y - 8, x + 12, y - 4, '#f2f0ea', 3);
      ln(c, x + 12, y - 4, x + 18, y - 9, '#f2f0ea', 2);
      ln(c, x + 12, y - 4, x + 19, y - 1, '#f2f0ea', 2);
      ell(c, x - 4, y - 8, 3, 2, YEL[4]);
      ell(c, x + 12, y - 4, 2.4, 1.6, YEL[4]);
    } else if (v === 'drain') {
      const [x, y] = p.P(0.5, 0.5);
      fillPoly(c, [[x - 14, y], [x, y - 7], [x + 14, y], [x, y + 7]], '#3a3a3e');
      for (let i = -10; i <= 10; i += 3) ln(c, x + i - 3, y + Math.abs(i) * 0 - 1, x + i + 3, y - 1, '#1e1e22');
      fillPoly(c, [[x - 14, y], [x, y - 7], [x + 1, y - 7], [x - 13, y]], '#5a5a60');
    } else if (v === 'cable') {
      // a loose extension lead snaking across
      let [x0, y0] = p.P(0, 0.3);
      const R0 = rng(k.seed + 9);
      for (let i = 1; i <= 8; i++) {
        const [x1, y1] = p.P((i / 8) * p.pw, 0.3 + Math.sin(i * 1.3 + R0()) * 0.2);
        ln(c, x0, y0, x1, y1, ORANGE[3], 2);
        ln(c, x0, y0 - 1, x1, y1 - 1, ORANGE[5], 1);
        x0 = x1;
        y0 = y1;
      }
    } else {
      // tape: yellow floor-tape corners marking a machine's keep-out
      const L = 0.3;
      for (const [a, b, da, db] of [[0.05, 0.05, 1, 1], [p.pw - 0.05, 0.05, -1, 1], [0.05, p.pd - 0.05, 1, -1], [p.pw - 0.05, p.pd - 0.05, -1, -1]] as const) {
        fillPoly(c, [p.P(a, b), p.P(a + da * L, b), p.P(a + da * L, b + db * 0.06), p.P(a, b + db * 0.06)], YEL[4]);
        fillPoly(c, [p.P(a, b), p.P(a + da * 0.06, b), p.P(a + da * 0.06, b + db * L), p.P(a, b + db * L)], YEL[4]);
      }
    }
  },
};

export const ROBOTICS_ROOM2: Record<string, PropArt> = { rack, counter, bench, crate, barrel, plant, rob_toolchest, rob_spool, rob_drill, rob_dog, rob_cart, rob_cobot, rob_boxes, rob_floor, rob_engine, rob_tyres, rob_ladder, rob_wing, rob_cabinet, rob_gas, rob_vac };

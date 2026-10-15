// Space — clutter and life on the hull deck (1 z ≈ 10 cm).
//   spc_cargo      a pallet of strapped containers under a net
//   spc_tank       two spherical pressure tanks in a cradle, gold-wrapped or white
//   spc_box        an orbital replacement unit: a grey box with a handrail and connectors
//   spc_beacon     a floodlight post with a nav beacon
//   spc_mast       a whip antenna mast with a strobe
//   spc_rail       an EVA handrail run on stand-offs with tether rings
//   spc_pipes      a run of conduits along the deck
//   spc_vent       a vent stack breathing a little vapour
//   spc_capsule    a cargo capsule on the landing pad: legs, trunk, cone, solar wings
//   spc_worksite   an EVA worksite: an open access hatch, cables, tool caddy, work lamp
//   spc_telescope  a science telescope on a fork mount
//   spc_dome       a little greenhouse dome with a garden and a dwarf fruit tree
//   spc_cupola     an observation cupola ringed with windows
//   spc_cmg        two gold-blanketed control-moment gyroscope housings
//   spc_decal      flat details baked into the deck: landing pad, arrows, scorch, hatch,
//                  stencil numbers, marker lights, a tether line, painted walkways, the
//                  station's name, a cable run, zone codes
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { ALU, AMBER, ball, CYAN, cyl, flat, frustum, GOLD, GREEN, grille, GUN, halo, HULL, led, plating, quilt, RED, shield, TILE, tone, WHITE } from './common';
import { CRATE_Y } from './spine';

const s4 = (p: PropPainter) => p.k / 4;
const NOMEX: Ramp = ['#6a6250', '#857c66', '#a0967e', '#b8ae94', '#ccc3aa', '#ddd6c0', '#ebe6d4'];

const spc_cargo: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.08, 0.08, W - 0.08, D - 0.08, 10, 0.36);
    // the pallet with tie-down rings
    lbox(p, 0.06, 0.06, W - 0.12, D - 0.12, 0, 1, { front: plating(GUN, 18, 4, 81), side: plating(GUN, 18, 4, 82), top: plating(HULL, 22, 22, 83), edge: GUN[0] });
    cage(p, 0.04, 0.04, W - 0.04, D - 0.04, 8.4, false);
    const Rn = rng(k.seed * 7 + 3);
    // containers of different sizes: white cases, soft bags, a gold-wrapped instrument
    const items: [number, number, number, number, number, number][] = [
      [0.15, 0.15, 0.9, 0.75, 1, 5.4],
      [1.1, 0.2, 0.75, 0.7, 1, 4.2],
      [0.18, 1.0, 0.8, 0.8, 1, 3.6],
      [1.05, 1.0, 0.8, 0.8, 1, 6.2],
      [0.3, 0.3, 0.55, 0.45, 6.4, 2.8],
    ];
    items.forEach(([a, b, w, d, z, h], i) => {
      const kind = Math.floor(Rn() * 3);
      if (kind === 0) lbox(p, a, b, w, d, z, h, { front: shield(WHITE, 16, 12), side: shield(WHITE, 16, 12), top: tone(WHITE, 0.6), edge: WHITE[0] });
      else if (kind === 1) lbox(p, a, b, w, d, z, h, { front: quilt(NOMEX, 22), side: quilt(NOMEX, 22), top: tone(NOMEX, 0.6), edge: NOMEX[0] });
      else lbox(p, a, b, w, d, z, h, { front: plating(CRATE_Y, 30, 40, 84), side: plating(CRATE_Y, 30, 40, 85), top: tone(CRATE_Y, 0.6), edge: CRATE_Y[0] });
      const F = front(p, b + d);
      pq(p, F, a + w * 0.15, a + w * 0.45, z + h * 0.4, z + h * 0.7, '#f6f4ec');
      pq(p, F, a + w * 0.18, a + w * 0.26, z + h * 0.48, z + h * 0.62, i % 2 ? AMBER[4] : CYAN[4]);
    });
    // the cargo net's straps over the stack
    for (const a of [0.6, 1.4]) {
      const [x0, y0] = p.P(a, D - 0.06, 1);
      const [x1, y1] = p.P(a, D - 0.06, 6.6);
      ln(p.c, x0, y0, x1, y1, AMBER[3], 2);
      const [x2, y2] = p.P(a, 0.2, 7.4);
      ln(p.c, x1, y1, x2, y2, AMBER[4], 1);
    }
    for (const b of [0.6, 1.4]) {
      const [x0, y0] = p.P(W - 0.06, b, 1);
      const [x1, y1] = p.P(W - 0.06, b, 6.6);
      ln(p.c, x0, y0, x1, y1, AMBER[2], 2);
    }
    // the front corner posts of the cargo cage and its top rails, a tag light
    cage(p, 0.04, 0.04, W - 0.04, D - 0.04, 8.4, true);
    const [tx, ty] = p.P(W - 0.04, D - 0.04, 8.4);
    halo(p.c, tx, ty, 10, 8, AMBER[5], 0.4);
    px(p.c, tx - 2, ty - 2, AMBER[6], 3, 3);
  },
};

/** A cage frame's posts and top rails (back half before the load, front half after it). */
function cage(p: PropPainter, a0: number, b0: number, a1: number, b1: number, h: number, frontHalf: boolean) {
  const P = (a: number, b: number, z: number) => p.P(a, b, z);
  const post = (a: number, b: number, col: string) => {
    const [x0, y0] = P(a, b, 0);
    const [x1, y1] = P(a, b, h);
    ln(p.c, x0, y0, x1, y1, GUN[0], 3);
    ln(p.c, x0, y0, x1, y1, col, 1);
  };
  const rail = (aa: number, ba: number, ab: number, bb: number, col: string) => {
    const [x0, y0] = P(aa, ba, h);
    const [x1, y1] = P(ab, bb, h);
    ln(p.c, x0, y0, x1, y1, GUN[1], 2);
    ln(p.c, x0, y0 - 1, x1, y1 - 1, col, 1);
  };
  if (!frontHalf) {
    post(a0, b0, GUN[4]);
    rail(a0, b0, a1, b0, GUN[4]);
    rail(a0, b0, a0, b1, GUN[4]);
  } else {
    post(a0, b1, ALU[5]);
    post(a1, b1, ALU[3]);
    post(a1, b0, ALU[2]);
    rail(a0, b1, a1, b1, ALU[5]);
    rail(a1, b0, a1, b1, ALU[3]);
    // a mid rail on the front
    const [x0, y0] = P(a0, b1, h * 0.5);
    const [x1, y1] = P(a1, b1, h * 0.5);
    ln(p.c, x0, y0, x1, y1, GUN[2], 1);
  }
}

/** A cargo rack: a cage of white and yellow crates stacked on a pallet, a tag light on top. */
const spc_rack: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 13 + 5);
    footShadow(p, 0.06, 0.06, W - 0.06, 0.94, 14, 0.4);
    lbox(p, 0.08, 0.08, W - 0.16, 0.84, 0, 0.7, mono(plating(GUN, 12, 4, 151), GUN[0]));
    cage(p, 0.1, 0.1, W - 0.1, 0.9, 10, false);
    const n = Math.max(1, Math.round(W / 0.95));
    const cw = (W - 0.3) / n;
    for (let i = 0; i < n; i++) {
      const a = 0.15 + i * cw;
      let z = 0.7;
      const stack = 1 + Math.floor(Rn() * 2.4);
      for (let j = 0; j < stack && z < 8; j++) {
        const h = 2.8 + Rn() * 1.6;
        const yel = Rn() < 0.45;
        const R = yel ? CRATE_Y : WHITE;
        const in2 = j * 0.04;
        lbox(p, a + 0.03 + in2, 0.16 + in2, cw - 0.06 - in2 * 2, 0.68 - in2 * 2, z, h, { front: shield(R, 14, 10), side: shield(R, 14, 10), top: tone(R, 0.8), edge: R[0] });
        const F = front(p, 0.84 - in2);
        pq(p, F, a + cw * 0.2, a + cw * 0.55, z + h * 0.35, z + h * 0.75, yel ? '#2a2c34' : '#f6f4ec');
        pq(p, F, a + cw * 0.24, a + cw * 0.34, z + h * 0.45, z + h * 0.65, Rn() < 0.5 ? RED[4] : yel ? AMBER[6] : AMBER[4]);
        z += h;
      }
    }
    cage(p, 0.1, 0.1, W - 0.1, 0.9, 10, true);
    const [tx, ty] = p.P(W - 0.1, 0.9, 10);
    halo(p.c, tx, ty, 9, 7, AMBER[5], 0.45);
    px(p.c, tx - 2, ty - 2, AMBER[6], 3, 3);
  },
  lights: (k) => [{ a: k.w - 0.1, b: 0.9, z: 10, r: 0.6, color: '#fbd262', kind: 'lamp' }],
};

/** An equipment cabinet on the deck: plated sides, a control panel, status lights, a vent on top. */
const spc_cabinet: PropArt = {
  draw(p, k) {
    const v = k.seed % 3;
    const h = v === 0 ? 8.5 : v === 1 ? 6.4 : 10.5;
    const R = v === 1 ? ALU : WHITE;
    footShadow(p, 0.14, 0.18, 0.86, 0.86, 12, 0.4);
    lbox(p, 0.16, 0.2, 0.68, 0.6, 0, 0.6, mono(flat(GUN), GUN[0]));
    lbox(p, 0.2, 0.24, 0.6, 0.52, 0.6, h, { front: shield(R, 12, 14), side: plating(R, 12, 10, 152 + v), top: v === 2 ? grille(GUN, 3) : plating(ALU, 10, 10, 153), edge: GUN[1] });
    const F = front(p, 0.76);
    // the control panel: a dark inset with lit keys and a little screen
    pq(p, F, 0.27, 0.73, 0.6 + h * 0.4, 0.6 + h * 0.86, '#141a26');
    pq(p, F, 0.31, 0.5, 0.6 + h * 0.62, 0.6 + h * 0.8, v === 2 ? '#3a9aa8' : '#2c6a8a');
    for (let i = 0; i < 3; i++) pq(p, F, 0.54 + i * 0.06, 0.58 + i * 0.06, 0.6 + h * 0.5, 0.6 + h * 0.58, [GREEN[5], AMBER[5], RED[5]][(i + v) % 3]);
    // a hazard label low on the front
    pq(p, F, 0.3, 0.7, 0.6 + h * 0.08, 0.6 + h * 0.2, AMBER[4]);
    for (let a = 0.32; a < 0.68; a += 0.08) pq(p, F, a, a + 0.03, 0.6 + h * 0.08, 0.6 + h * 0.2, '#1c1e26');
    // the side's pipe stub and a top light
    const [sx, sy] = p.P(p.rot ? 0.2 : 0.8, 0.5, h * 0.5);
    px(p.c, sx - 1, sy - 2, GUN[2], 4, 4);
    const [lx, ly] = p.P(0.72, 0.7, h + 0.6);
    halo(p.c, lx, ly, 8, 6, AMBER[5], 0.4);
    px(p.c, lx - 1, ly - 2, AMBER[6], 3, 2);
  },
};


const spc_tank: PropArt = {
  draw(p, k) {
    const W = k.w;
    const gold = k.seed % 2 === 0;
    footShadow(p, 0.08, 0.12, W - 0.08, 0.92, 12, 0.36);
    // the cradle: a frame of beams, then two spheres
    lbox(p, 0.06, 0.14, W - 0.12, 0.72, 0, 1, mono(plating(GUN, 16, 4, 91), GUN[0]));
    for (let i = 0; i < 2; i++) {
      const a = 0.5 + i * (W - 1);
      for (const [da, db] of [[-0.3, 0.2], [0.3, 0.2], [-0.3, 0.8], [0.3, 0.8]] as const) lbox(p, a + da - 0.04, db - 0.04, 0.08, 0.08, 1, 2.6, mono(tone(ALU), GUN[1]));
      ball(p, a, 0.5, 5.6, 0.42, 0.42, 0.42, {
        ramp: gold ? GOLD : WHITE,
        spec: 0.8,
        tex: (ns, nt, nw, x, y) => {
          if (gold) return hash(x >> 1, y, 92) < 0.25 ? 1.4 : (ns + nt * 0.5 + nw) % 0.5 < 0.05 ? -1 : 0;
          if (Math.abs(nw) < 0.05) return -1.6;
          return Math.abs(ns - nt) < 0.04 ? -0.8 : 0;
        },
      });
    }
    // a manifold pipe between them with a valve
    const [x0, y0] = p.P(0.5, 0.86, 5);
    const [x1, y1] = p.P(W - 0.5, 0.86, 5);
    ln(p.c, x0, y0, x1, y1, ALU[4], 2);
    const [vx, vy] = p.P(W / 2, 0.86, 5);
    ell(p.c, vx, vy, 3, 3, RED[3]);
    px(p.c, vx - 1, vy - 1, RED[5], 2, 1);
  },
};

const spc_box: PropArt = {
  draw(p, k) {
    const v = k.seed % 3;
    footShadow(p, 0.16, 0.16, 0.84, 0.84, 8, 0.34);
    const h = v === 0 ? 4.6 : v === 1 ? 3.4 : 6;
    lbox(p, 0.2, 0.22, 0.6, 0.56, 0, h, { front: plating(ALU, 16, 12, 101), side: plating(ALU, 16, 12, 102), top: v === 2 ? grille(GUN, 3) : plating(ALU, 14, 14, 103), edge: GUN[1] });
    const F = front(p, 0.78);
    pq(p, F, 0.28, 0.52, h * 0.45, h * 0.75, '#f2f4f6');
    pq(p, F, 0.3, 0.36, h * 0.5, h * 0.7, v === 1 ? RED[4] : AMBER[4]);
    // handrail on top, connectors on the side
    const [x0, y0] = p.P(0.3, 0.5, h);
    const [x1, y1] = p.P(0.7, 0.5, h);
    ln(p.c, x0, y0 - 3, x1, y1 - 3, AMBER[4], 2);
    ln(p.c, x0, y0, x0, y0 - 3, GUN[3], 1);
    ln(p.c, x1, y1, x1, y1 - 3, GUN[3], 1);
    const [cx, cy] = p.P(0.8, 0.4, h * 0.5);
    px(p.c, cx, cy - 2, GUN[1], 3, 3);
    px(p.c, cx + 3, cy - 1, '#2a2c34', 5, 1);
  },
};

const spc_beacon: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    footShadow(p, 0.3, 0.3, 0.7, 0.7, 20, 0.32);
    lbox(p, 0.32, 0.32, 0.36, 0.36, 0, 1, mono(flat(GUN), GUN[0]));
    cyl(p, 0.5, 0.5, 1, 0.5, 0.5, 15, 0.06, { ramp: ALU, cap: false, spec: 0.6 });
    // the floodlight head, angled down at the deck, and the beacon dome on top
    const [hx, hy] = p.P(0.5, 0.5, 15);
    const s = s4(p);
    layer(p.c, (l) => {
      fillPoly(l, [[hx - 2 * s, hy - 4 * s], [hx + 10 * s, hy - 8 * s], [hx + 13 * s, hy - 1 * s], [hx + 1 * s, hy + 3 * s]], GUN[2]);
      fillPoly(l, [[hx + 9 * s, hy - 7 * s], [hx + 13 * s, hy - 1 * s], [hx + 11 * s, hy], [hx + 8 * s, hy - 6 * s]], '#fff4d0');
      ell(l, hx, hy - 7 * s, 3 * s, 3 * s, GUN[3]);
    }, { rect: [hx - 6 * s, hy - 14 * s, hx + 16 * s, hy + 6 * s] });
    // the lamp's warm glow round the head (the reference's amber posts)
    halo(p.c, hx + 6 * s, hy - 4 * s, 16 * s, 13 * s, AMBER[5], 0.4);
    px(p.c, hx + 8 * s, hy - 5 * s, AMBER[6], 3 * s, 3 * s);
    void x;
    void y;
    void k;
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 15, r: 2.2, color: '#fbd262', kind: 'lamp' }],
  anim(p, k) {
    const [hx, hy] = p.P(0.5, 0.5, 15);
    const s = s4(p);
    const S = Math.max(1, Math.round(s));
    const on = Math.sin(k.t * 2.6 + k.seed * 1.7) > 0.3;
    const col = k.seed % 3 === 0 ? RED : k.seed % 3 === 1 ? GREEN : AMBER;
    px(p.c, hx - S, hy - 9 * s, on ? col[6] : col[2], 2 * S, 2 * S);
    if (on) {
      p.c.globalAlpha = 0.25;
      ell(p.c, hx, hy - 8 * s, 6 * s, 6 * s, col[5]);
      p.c.globalAlpha = 1;
    }
    // the floodlight's pool on the deck
    p.c.globalAlpha = 0.07;
    const [fx, fy] = p.P(1.4, 0.6, 0);
    ell(p.c, fx, fy, 40 * s, 18 * s, '#fff4d0');
    p.c.globalAlpha = 1;
  },
};

const spc_mast: PropArt = {
  draw(p, k) {
    footShadow(p, 0.3, 0.3, 0.7, 0.7, 26, 0.32);
    lbox(p, 0.3, 0.3, 0.4, 0.4, 0, 1.4, { front: plating(GUN, 10, 8, 111), side: plating(GUN, 10, 8, 112), top: tone(GUN, 1), edge: GUN[0] });
    cyl(p, 0.5, 0.5, 1.4, 0.5, 0.5, 30, 0.07, { ramp: WHITE, cap: false, spec: 0.6, tex: (t) => (Math.abs((t * 10) % 7 - 3.5) < 0.3 ? AMBER[4] : 0) });
    const [x, y] = p.P(0.5, 0.5, 30);
    const s = s4(p);
    layer(p.c, (l) => {
      for (const dx of [-7, 7]) ln(l, x, y + 10 * s, x + dx * s, y - 12 * s, ALU[4], 1);
      ln(l, x, y, x, y - 30 * s, ALU[5], 1);
      ell(l, x + 6 * s, y + 18 * s, 5 * s, 4 * s, WHITE[4]);
    }, { rect: [x - 10 * s, y - 34 * s, x + 12 * s, y + 24 * s] });
    void k;
  },
  anim(p, k) {
    const [x, y] = p.P(0.5, 0.5, 30);
    const s = s4(p);
    if (Math.sin(k.t * 4.2 + k.seed) > 0.75) {
      const S = Math.max(1, Math.round(s));
      px(p.c, x - S, y - 31 * s, '#ffffff', 2 * S, 2 * S);
      p.c.globalAlpha = 0.3;
      ell(p.c, x, y - 30 * s, 7 * s, 7 * s, '#e8f4ff');
      p.c.globalAlpha = 1;
    }
  },
};

const spc_rail: PropArt = {
  draw(p, k) {
    const W = k.w;
    for (let a = 0.3; a < W; a += 0.9) {
      const [x0, y0] = p.P(a, 0.5, 0);
      const [, y1] = p.P(a, 0.5, 2.4);
      px(p.c, x0 - 1, y1, GUN[3], 2, y0 - y1);
      px(p.c, x0 - 2, y0 - 1, GUN[1], 4, 2);
    }
    const [r0x, r0y] = p.P(0.2, 0.5, 2.6);
    const [r1x, r1y] = p.P(W - 0.2, 0.5, 2.6);
    ln(p.c, r0x, r0y, r1x, r1y, AMBER[5], 2);
    ln(p.c, r0x, r0y + 2, r1x, r1y + 2, AMBER[2], 1);
    // tether rings and a foot restraint plate
    for (let a = 0.75; a < W; a += 1.8) {
      const [tx, ty] = p.P(a, 0.5, 2.6);
      ell(p.c, tx, ty + 3, 2, 2, ALU[5]);
    }
    if (W >= 3) {
      const [fx, fy] = p.P(W / 2, 0.8, 0);
      fillPoly(p.c, [[fx - 8, fy], [fx, fy - 4], [fx + 8, fy], [fx, fy + 4]], GUN[3]);
      fillPoly(p.c, [[fx - 6, fy - 1], [fx, fy - 4], [fx + 6, fy - 1], [fx, fy + 2]], AMBER[3]);
    }
    void k;
  },
};

const spc_pipes: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0, 0.3, W, 0.7, 3, 0.26);
    for (let a = 0.4; a < W; a += 1.5) lbox(p, a - 0.06, 0.25, 0.12, 0.5, 0, 1.4, mono(flat(GUN), GUN[0]));
    const cols: Ramp[] = [CYAN, ALU, GOLD];
    cols.forEach((r, i) => {
      const b = 0.34 + i * 0.16;
      cyl(p, 0, b, 1.2 + i * 0.1, W, b, 1.2 + i * 0.1, 0.06, { ramp: r, cap: false, spec: 0.8 });
    });
    void k;
  },
};

const spc_vent: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 8, 0.32);
    lbox(p, 0.22, 0.22, 0.56, 0.56, 0, 3, { front: grille(GUN, 3), side: grille(GUN, 3), top: plating(GUN, 12, 12, 121), edge: GUN[0] });
    cyl(p, 0.5, 0.5, 3, 0.5, 0.5, 7, 0.16, { ramp: ALU, cap: GUN, spec: 0.6, capTex: (rr) => (rr < 0.7 ? -3 : 0.6) });
    void k;
  },
  anim(p, k) {
    const [x, y] = p.P(0.5, 0.5, 7);
    const s = s4(p);
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.4 + i / 3 + k.seed * 0.13) % 1;
      p.c.globalAlpha = 0.22 * (1 - t);
      ell(p.c, x + t * 10 * s, y - t * 18 * s, (2 + t * 5) * s, (2 + t * 4) * s, '#dce8f8');
    }
    p.c.globalAlpha = 1;
  },
};

/** A cargo capsule on the pad: landing legs, a trunk ringed with cells, a blunt cone, solar wings out. */
const spc_capsule: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    const R0 = 0.95;
    footShadow(p, 0.5, 0.5, W - 0.5, D - 0.5, 22, 0.42);
    // landing legs splayed out to footpads
    for (const [da, db] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const [x0, y0] = p.P(cx + da * 1.4, cb + db * 1.4, 0);
      const [x1, y1] = p.P(cx + da * 0.66, cb + db * 0.66, 6);
      ln(p.c, x0, y0 - 1, x1, y1, ALU[2], 3);
      ln(p.c, x0 - 1, y0 - 1, x1 - 1, y1, ALU[4], 1);
      ell(p.c, x0, y0, 7, 3.2, GUN[2]);
      px(p.c, x0 - 5, y0 - 2, ALU[4], 10, 1);
    }
    const wing = (b0: number, b1: number) => {
      const zw = 7.2;
      const a0 = cx - 0.62;
      const a1 = cx + 0.62;
      const O = p.P(a0, b1, zw);
      const A = p.P(a1, b1, zw);
      const B = p.P(a0, b0, zw);
      fillPoly(p.c, [O, A, [A[0] + B[0] - O[0], A[1] + B[1] - O[1]], B], '#1b285a');
      for (let i = 1; i < 5; i++) {
        const [x0, y0] = p.P(a0 + (i * (a1 - a0)) / 5, b0, zw);
        const [x1, y1] = p.P(a0 + (i * (a1 - a0)) / 5, b1, zw);
        ln(p.c, x0, y0, x1, y1, '#4462a0', 1);
      }
      ln(p.c, O[0], O[1], A[0], A[1], GOLD[4], 1);
      const [m0x, m0y] = p.P(cx, b0 < cb ? b1 : b0, zw);
      const [m1x, m1y] = p.P(cx, b0 < cb ? cb - R0 : cb + R0, zw);
      ln(p.c, m0x, m0y, m1x, m1y, ALU[4], 2);
    };
    wing(0.04, cb - R0 - 0.1);
    // the trunk: white with a band of cells and radiator fins
    frustum(p, cx, cb, 4, 11, R0, R0, {
      ramp: WHITE,
      spec: 0.5,
      top: false,
      tex: (z, ang) => {
        if (z > 6.6 && z < 9.2) return at(['#141d3c', '#1d2a52', '#283a6c', '#344c86', '#4462a0', '#6484c4', '#8aa4d8'], 3 + Math.cos(ang - 2.2) * 1.6 + (Math.floor((ang * 8) / Math.PI) % 2 ? -0.5 : 0));
        if (z < 4.6) return -1.6;
        if (Math.abs(((ang * 6) / Math.PI) % 1) < 0.06) return -1;
        return 0;
      },
    });
    // the capsule: a dark heat-shield band, the white cone with windows, RCS ports and a hatch, the nose cap
    frustum(p, cx, cb, 11, 12, R0 + 0.05, R0 + 0.02, { ramp: TILE, top: false, spec: 0.3 });
    frustum(p, cx, cb, 12, 25, R0, 0.4, {
      ramp: WHITE,
      spec: 0.7,
      top: false,
      tex: (z, ang, x, y) => {
        const da = Math.atan2(Math.sin(ang - 1.0), Math.cos(ang - 1.0));
        if (z > 17 && z < 19 && Math.abs(da) < 0.5 && Math.abs((da * 4) % 1) > 0.32) return (x + y) % 5 ? '#1a2a3e' : '#8ab0d8';
        if (z > 13.4 && z < 14.2 && Math.abs(((ang * 4) / Math.PI) % 1) < 0.12) return '#1c1e26';
        const dh = Math.atan2(Math.sin(ang + 0.4), Math.cos(ang + 0.4));
        if (z > 14 && z < 20 && Math.abs(dh) < 0.3 && (Math.abs(dh) > 0.25 || z < 14.3 || z > 19.7)) return -1.5;
        if (Math.abs(z - 23.4) < 0.25) return -1.4;
        return 0;
      },
    });
    frustum(p, cx, cb, 25, 26.6, 0.4, 0.32, { ramp: ALU, spec: 0.8, top: ALU, topTex: (r) => (r < 0.5 ? -1 : r > 0.86 ? 1 : 0) });
    wing(cb + R0 + 0.1, D - 0.04);
    void k;
  },
  anim(p, k) {
    const [x, y] = p.P(k.w / 2, k.d / 2, 26.9);
    const s = Math.max(1, Math.round(s4(p)));
    if (Math.sin(k.t * 3.1) > 0.7) px(p.c, x - s, y - s, GREEN[6], 2 * s, 2 * s);
  },
};

/** An EVA worksite: an open access hatch, cables pulled out, a tool caddy, a work lamp, a tether ring (the astronaut is a critter). */
const spc_worksite: PropArt = {
  draw(p) {
    const s = s4(p);
    footShadow(p, 0.1, 0.15, 1.9, 0.9, 8, 0.34);
    // the open hatch: a dark well with pipes inside, the lid standing up on its hinge
    const well = [p.P(0.25, 0.25), p.P(1.05, 0.25), p.P(1.05, 0.78), p.P(0.25, 0.78)];
    fillPoly(p.c, well, '#0c0e14');
    const inner = [p.P(0.3, 0.3), p.P(1.0, 0.3), p.P(1.0, 0.73), p.P(0.3, 0.73)];
    fillPoly(p.c, inner, '#141822');
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = p.P(0.32, 0.4 + i * 0.12);
      const [x1, y1] = p.P(0.98, 0.4 + i * 0.12);
      ln(p.c, x0, y0 + 3, x1, y1 + 3, [CYAN[2], GOLD[3], ALU[2]][i], 2);
    }
    lbox(p, 0.25, 0.18, 0.8, 0.06, 0, 6.2, { front: plating(HULL, 14, 12, 131), side: tone(HULL, -1), top: tone(HULL, 1), edge: GUN[0] });
    // cables pulled out over the rim
    for (let i = 0; i < 2; i++) {
      const [x0, y0] = p.P(0.6 + i * 0.2, 0.5);
      const [x1, y1] = p.P(0.9 + i * 0.25, 0.95);
      ln(p.c, x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 4, i ? '#8a2a2a' : '#2a2c34', 2);
      ln(p.c, (x0 + x1) / 2, Math.max(y0, y1) + 4, x1, y1, i ? '#8a2a2a' : '#2a2c34', 2);
    }
    // the tool caddy: an orange box with tools sticking out, a spare part beside it
    lbox(p, 1.32, 0.3, 0.42, 0.34, 0, 2.2, { front: flat(AMBER), side: flat(AMBER), top: tone(GUN, -0.5), edge: AMBER[0] });
    const [tx, ty] = p.P(1.53, 0.47, 2.2);
    ln(p.c, tx - 4, ty, tx - 6, ty - 9, ALU[5], 2);
    ln(p.c, tx + 2, ty, tx + 4, ty - 7, GUN[4], 2);
    px(p.c, tx + 3, ty - 9, RED[4], 3, 2);
    lbox(p, 1.4, 0.72, 0.3, 0.2, 0, 1.2, mono(plating(ALU, 8, 6, 132), GUN[1]));
    // a work lamp on a short tripod aimed into the well
    const [lx, ly] = p.P(1.86, 0.2, 0);
    layer(p.c, (l) => {
      for (const dx of [-4, 0, 4]) ln(l, lx, ly - 18 * s, lx + dx * s, ly + (dx ? 0 : 2) * s, GUN[4], 1);
      fillPoly(l, [[lx - 6 * s, ly - 24 * s], [lx + 3 * s, ly - 21 * s], [lx + 2 * s, ly - 16 * s], [lx - 7 * s, ly - 19 * s]], GUN[2]);
      fillPoly(l, [[lx - 6 * s, ly - 23 * s], [lx - 3 * s, ly - 22 * s], [lx - 4 * s, ly - 18 * s], [lx - 7 * s, ly - 19 * s]], '#fff4d0');
    }, { rect: [lx - 12 * s, ly - 28 * s, lx + 8 * s, ly + 4 * s] });
    // the tether back to a ring on the deck
    const [rx, ry] = p.P(1.95, 0.9, 0);
    const [qx, qy] = p.P(1.1, 0.98, 0);
    ln(p.c, qx, qy, (qx + rx) / 2, Math.max(qy, ry) + 3, '#e8e2d0');
    ln(p.c, (qx + rx) / 2, Math.max(qy, ry) + 3, rx, ry, '#e8e2d0');
    ell(p.c, rx, ry, 3, 1.5, ALU[5]);
  },
  anim(p, k) {
    // the work lamp's pool of light in the well
    const [x, y] = p.P(0.65, 0.5, 0);
    const s = s4(p);
    p.c.globalAlpha = 0.16 + Math.sin(k.t * 7 + k.seed) * 0.02;
    ell(p.c, x, y, 22 * s, 9 * s, '#fff4d0');
    p.c.globalAlpha = 1;
  },
};

/** A science telescope on a fork mount, its aperture turned up toward the camera's sky. */
const spc_telescope: PropArt = {
  draw(p, k) {
    footShadow(p, 0.3, 0.3, 1.7, 1.7, 24, 0.36);
    cyl(p, 1, 1, 0, 1, 1, 1.2, 0.62, { ramp: GUN, cap: GUN, spec: 0.3 });
    cyl(p, 1, 1, 1.2, 1, 1, 7.4, 0.26, { ramp: WHITE, cap: false, spec: 0.6, tex: (t) => (Math.abs(t - 0.36) < 0.03 ? -1.4 : 0) });
    // the fork
    for (const sd of [-1, 1]) {
      const [x0, y0] = p.P(1 - 0.3 * sd, 1 + 0.3 * sd, 7.4);
      const [x1, y1] = p.P(1 - 0.42 * sd, 1 + 0.42 * sd, 12);
      ln(p.c, x0, y0, x1, y1, GUN[3], 4);
    }
    // the tube: white, a dark ring, the sunshade at the aperture end facing the camera
    cyl(p, 0.8, 0.8, 8, 1.45, 1.5, 21, 0.36, {
      ramp: WHITE,
      spec: 0.7,
      cap: GUN,
      tex: (t) => (t > 1.3 && t < 1.42 ? -2 : t > 0.2 && t < 0.3 ? at(GOLD, 4) : 0),
      capTex: (rr, ang) => (rr > 0.86 ? 0.8 : rr > 0.72 ? -2 : rr < 0.24 && Math.cos(ang - 2.4) > 0.3 ? '#8ab0d8' : '#141a26'),
    });
    const [lx, ly] = p.P(1, 1, 3);
    led(p.c, lx + 6, ly, GREEN, 2);
    void k;
  },
};

/** A small glass greenhouse dome on the hull: a planted bed under struts, lamps inside. */
const spc_dome: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    const R0 = Math.min(W, D) / 2 - 0.15;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 16, 0.36);
    // the base ring, the bed of soil, the plants
    cyl(p, cx, cb, 0, cx, cb, 2.4, R0 + 0.08, { ramp: GUN, cap: ['#2a1e16', '#3a2a1e', '#4a3626', '#5a4230', '#6a4e38', '#7a5a40', '#8a6648'], spec: 0.3, tex: (t) => (t > 0.18 ? 0.6 : 0), capTex: (rr) => (rr > 0.94 ? '#5a606e' : 0) });
    const [x, y] = p.P(cx, cb, 2.4);
    const s = s4(p);
    // grow lamps: a warm light over the whole bed
    halo(p.c, x, y - 6 * s, 70 * s, 34 * s, '#fbd262', 0.4);
    layer(p.c, (l) => {
      const Rn = rng(k.seed * 3 + 7);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Rn();
        const r = (0.25 + Rn() * 0.5) * R0;
        const [px0, py0] = p.P(cx + Math.cos(a) * r, cb + Math.sin(a) * r, 2.4);
        const m = [{ x: px0, y: py0 - 8 * s, rx: (9 + Rn() * 5) * s, ry: (7 + Rn() * 4) * s, z: py0 }];
        foliage(l, m, ['#163020', '#1e4428', '#285a30', '#34723a', '#468a44', '#62a452', '#86be64'], k.seed + i, { cell: 2.6, dots: i % 3 === 0 ? ['#f2c43a', '#e04a3c'] : undefined, dotChance: 0.5, dotSize: 3 });
      }
      // a dwarf fruit tree in the middle
      ln(l, x, y, x, y - 30 * s, '#5a4030', 3);
      foliage(l, [{ x, y: y - 38 * s, rx: 16 * s, ry: 12 * s, z: 1 }], ['#163020', '#1e4428', '#285a30', '#34723a', '#468a44', '#62a452', '#86be64'], k.seed + 50, { cell: 3, dots: ['#f2a83e'], dotChance: 0.4, dotSize: 3 });
    }, { rect: [x - 110 * s, y - 80 * s, x + 110 * s, y + 50 * s] });
    // the glass: a dome drawn faint over the garden, then its struts and a lit rim
    p.c.globalAlpha = 0.4;
    ball(p, cx, cb, 2.4, R0, R0, R0 * 1.25, { ramp: ['#5a6a5a', '#7a8a6e', '#a4ac84', '#c8c89a', '#e6dcb4', '#f6eecc', '#ffffff'], dome: true, spec: 1.6, bias: 0.05 });
    p.c.globalAlpha = 1;
    // the grow lamps' warm light through the glass
    halo(p.c, x, y - R0 * 30 * s, R0 * 64 * s, R0 * 40 * s, '#fbd262', 0.3);
    // a bright glint on the glass, upper left
    const [gx, gy] = p.P(cx - R0 * 0.35, cb - R0 * 0.1, 2.4 + R0 * 10);
    ell(p.c, gx, gy, 9 * s, 4 * s, '#f4fbff');
    ell(p.c, gx + 10 * s, gy + 6 * s, 4 * s, 2 * s, '#dcf0f6');
    for (let m = 0; m < 10; m++) {
      const ang = (m / 10) * Math.PI;
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * Math.PI;
        const q = p.P(cx + Math.cos(ang) * Math.cos(t) * R0, cb + Math.sin(ang) * Math.cos(t) * R0, 2.4 + Math.sin(t) * R0 * 12.5);
        if (prev && Math.cos(t) * Math.cos(ang - 0.8) > -0.2) ln(p.c, prev[0], prev[1], q[0], q[1], ALU[5], 1);
        prev = q;
      }
    }
    for (const z of [2.4 + R0 * 3.6, 2.4 + R0 * 7.2, 2.4 + R0 * 10.4]) {
      const rr = Math.sqrt(Math.max(0, 1 - ((z - 2.4) / (R0 * 12.5)) ** 2)) * R0;
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 24; i++) {
        const a = -0.3 + (i / 24) * Math.PI * 1.2;
        const q = p.P(cx + Math.cos(a) * rr, cb + Math.sin(a) * rr, z);
        if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], ALU[3], 1);
        prev = q;
      }
    }
    const [tx, ty] = p.P(cx, cb, 2.4 + R0 * 12.5);
    px(p.c, tx - 2, ty - 3, ALU[5], 5, 3);
  },
  anim(p, k) {
    const [tx, ty] = p.P(k.w / 2, k.d / 2, 2.4 + (Math.min(k.w, k.d) / 2 - 0.15) * 12.5);
    const s = Math.max(1, Math.round(s4(p)));
    if (Math.sin(k.t * 2.4 + k.seed) > 0.6) px(p.c, tx - s, ty - 5 * s, '#fff4d0', 2 * s, 2 * s);
  },
  lights: (k) => [{ a: k.w / 2, b: k.d / 2, z: 8, r: 2.2, color: '#fbd262', kind: 'window' }],
};

/** An observation cupola: a gunmetal collar, a white turret ringed with windows, the round top window, shutters. */
const spc_cupola: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cx = W / 2;
    const cb = D / 2;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 14, 0.36);
    // the berthing collar on the deck
    frustum(p, cx, cb, 0, 2.4, 0.86, 0.86, { ramp: GUN, top: GUN, spec: 0.4, tex: (_z, ang) => (Math.abs(((ang * 8) / Math.PI) % 1) < 0.08 ? 1.4 : 0) });
    // the turret: six trapezoid windows between white frames, two shutters closed
    frustum(p, cx, cb, 2.4, 8.2, 0.8, 0.56, {
      ramp: WHITE,
      spec: 0.7,
      top: false,
      tex: (z, ang, x, y) => {
        const sector = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 6);
        const f = (((ang + Math.PI) / (Math.PI * 2)) * 6) % 1;
        if (z > 3 && z < 7.6 && f > 0.14 && f < 0.86) {
          if (sector === 1 || sector === 4) return (z * 4) % 3 < 1 ? -1.4 : 0.4;
          if ((f * 2 + z * 0.3) % 1 < 0.12) return '#a8d0ec';
          return bayer(x, y) > 0.8 ? '#2a4a66' : '#14263a';
        }
        return 0;
      },
    });
    // the top window: dark glass in a frame, a reflection
    frustum(p, cx, cb, 8.2, 8.7, 0.56, 0.52, { ramp: ALU, spec: 0.8, top: ['#0e1a28', '#14263a', '#1c3450', '#2a4a66', '#3a6080', '#6a94b8', '#b4d4ec'], topTex: (r, ang) => (r > 0.84 ? ALU[5] : r < 0.5 && Math.cos(ang + 2.2) > 0.6 ? 3.5 : 0) });
    // handrails up the turret, a light by the top window
    for (const a of [2.2, 3.6]) {
      const [x0, y0] = p.P(cx + Math.cos(a) * 0.82, cb + Math.sin(a) * 0.82, 2.6);
      const [x1, y1] = p.P(cx + Math.cos(a) * 0.6, cb + Math.sin(a) * 0.6, 7.6);
      ln(p.c, x0, y0, x1, y1, AMBER[4], 2);
    }
  },
  anim(p, k) {
    // the warm glow of the module's lights through the windows
    const [x, y] = p.P(k.w / 2, k.d / 2, 5.5);
    const s = s4(p);
    p.c.globalAlpha = 0.08 + Math.sin(k.t * 0.7 + k.seed) * 0.02;
    ell(p.c, x, y, 34 * s, 22 * s, '#ffd27a');
    p.c.globalAlpha = 1;
  },
};

/** Two control-moment gyroscope housings: gold-blanketed drums on a frame, cabled together. */
const spc_cmg: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.06, 0.12, W - 0.06, 0.92, 10, 0.36);
    lbox(p, 0.08, 0.14, W - 0.16, 0.72, 0, 1.2, { front: plating(GUN, 16, 5, 141), side: plating(GUN, 16, 5, 142), top: plating(GUN, 14, 14, 143), edge: GUN[0] });
    for (let i = 0; i < 2; i++) {
      const a = 0.5 + i * (W - 1);
      cyl(p, a, 0.5, 1.2, a, 0.5, 6.4, 0.36, {
        ramp: GOLD,
        spec: 0.7,
        cap: WHITE,
        tex: (t, _ang, x, y) => (Math.abs(t - 0.26) < 0.03 ? -2 : hash(x >> 1, y, 144) < 0.25 ? 1.4 : 0),
        capTex: (rr) => (rr > 0.86 ? -0.6 : rr < 0.3 ? -1.2 : 0),
      });
      const [lx, ly] = p.P(a, 0.86, 3.6);
      led(p.c, lx, ly, i ? GREEN : AMBER, 2);
    }
    // the cable harness between the drums and a label on the frame
    const [x0, y0] = p.P(0.5, 0.86, 2.2);
    const [x1, y1] = p.P(W - 0.5, 0.86, 2.2);
    ln(p.c, x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 4, '#2a2c34', 2);
    ln(p.c, (x0 + x1) / 2, Math.max(y0, y1) + 4, x1, y1, '#2a2c34', 2);
    const F = front(p, 0.86);
    pq(p, F, W / 2 - 0.2, W / 2 + 0.2, 0.3, 0.9, '#e8ecf2');
    pq(p, F, W / 2 - 0.18, W / 2 - 0.08, 0.4, 0.8, AMBER[4]);
  },
};

// ── flat decals baked into the deck ──────────────────────────
const spc_decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'scorch';
    const c = p.c;
    const [x, y] = anchor(p, 0.5 * p.pw, 0.5 * p.pd);
    const s = s4(p);
    if (v === 'pad') {
      // a landing circle on the deck plane: amber ring, a dashed inner ring, an H, corner marks
      const rho = 0.46 * Math.min(p.pw, p.pd);
      const rx = 90.51 * rho * s;
      const ry = 45.25 * rho * s;
      for (let j = Math.floor(-ry) - 1; j <= ry + 1; j++)
        for (let i = Math.floor(-rx) - 1; i <= rx + 1; i++) {
          const d = Math.hypot(i / rx, j / ry);
          if (d > 1.01) continue;
          let col: string | null = null;
          if (d > 0.9) col = d > 0.97 ? AMBER[2] : AMBER[4];
          else if (d > 0.66 && d < 0.71 && Math.floor(((Math.atan2(j / ry, i / rx) + Math.PI) / (Math.PI * 2)) * 24) % 2 === 0) col = '#e8ecf2';
          if (col) px(c, x + i, y + j, col);
        }
      // the H, laid on the deck
      const cpx = 0.5 * p.pw;
      const cpy = 0.5 * p.pd;
      const bar = (a0: number, b0: number, a1: number, b1: number) => fillPoly(c, [p.P(a0, b0), p.P(a1, b0), p.P(a1, b1), p.P(a0, b1)], '#e8ecf2');
      const h = rho * 0.42;
      bar(cpx - h, cpy - h, cpx - h * 0.6, cpy + h);
      bar(cpx + h * 0.6, cpy - h, cpx + h, cpy + h);
      bar(cpx - h * 0.6, cpy - h * 0.18, cpx + h * 0.6, cpy + h * 0.18);
    } else if (v === 'arrows') {
      // chevrons pointing along +a
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = p.P(0.2 + i * 0.28, 0.5);
        const [bx, by] = p.P(0.34 + i * 0.28, 0.3);
        const [cx2, cy2] = p.P(0.34 + i * 0.28, 0.7);
        ln(c, bx, by, ax, ay, AMBER[4], 2);
        ln(c, ax, ay, cx2, cy2, AMBER[4], 2);
      }
    } else if (v === 'scorch') {
      // thruster scorching: dark radial streaks, dithered
      const Rn = rng(k.seed + 11);
      const R0 = 40 * s;
      for (let j = -R0; j <= R0; j++)
        for (let i = -R0 * 1.8; i <= R0 * 1.8; i++) {
          const d = Math.hypot(i / 1.8, j) / R0;
          if (d > 1) continue;
          const a = Math.atan2(j, i / 1.8);
          const streak = Math.sin(a * 9 + k.seed) * 0.5 + 0.5;
          if (hash(x + i, y + j, 131) < (1 - d) * (0.45 + streak * 0.4)) {
            c.globalAlpha = 0.35;
            px(c, x + i, y + j, '#140e12');
            c.globalAlpha = 1;
          }
        }
      void Rn;
    } else if (v === 'hatch') {
      // a square access hatch with bolts and a pull ring
      const q = [p.P(0.2, 0.2), p.P(0.8, 0.2), p.P(0.8, 0.8), p.P(0.2, 0.8)];
      fillPoly(c, q, GUN[2]);
      const q2 = [p.P(0.25, 0.25), p.P(0.75, 0.25), p.P(0.75, 0.75), p.P(0.25, 0.75)];
      fillPoly(c, q2, HULL[4]);
      for (const [a, b] of [[0.28, 0.28], [0.72, 0.28], [0.72, 0.72], [0.28, 0.72]] as const) {
        const [bx, by] = p.P(a, b);
        px(c, bx - 1, by - 1, HULL[6], 2, 2);
      }
      const [rx, ry] = p.P(0.5, 0.5);
      ell(c, rx, ry, 5 * s, 2.5 * s, AMBER[3]);
      ell(c, rx, ry, 3 * s, 1.5 * s, HULL[4]);
    } else if (v === 'number') {
      // a stencilled bay number in white blocks
      const Rn = rng(k.seed * 3 + 1);
      for (let i = 0; i < 2; i++)
        for (let r = 0; r < 5; r++)
          for (let q = 0; q < 3; q++) {
            if (Rn() < 0.35) continue;
            const [bx, by] = p.P(0.3 + i * 0.22 + q * 0.06, 0.3 + r * 0.08);
            px(c, bx - 2, by - 1, '#d8dce4', 4, 2);
          }
    } else if (v === 'lights') {
      // a row of flush marker lights
      for (let i = 0; i < 4; i++) {
        const [lx, ly] = p.P(0.12 + i * 0.25, 0.5);
        led(c, lx, ly, (i + k.seed) % 2 ? CYAN : AMBER, 2);
      }
    } else if (v === 'walk') {
      // a painted walkway along local a: two worn dashed lines and chevrons every two metres
      const W = p.pw;
      for (const b of [0.18, 0.82]) {
        for (let a = 0.1; a < W - 0.1; a += 0.5) {
          const q = [p.P(a, b - 0.025), p.P(a + 0.32, b - 0.025), p.P(a + 0.32, b + 0.025), p.P(a, b + 0.025)];
          fillPoly(c, q, hash(Math.round(a * 10), Math.round(b * 10), k.seed) < 0.15 ? '#8a8060' : '#d8c890');
        }
      }
      for (let a = 1; a < W - 0.6; a += 2) {
        const [ax, ay] = p.P(a + 0.25, 0.5);
        const [bx, by] = p.P(a, 0.32);
        const [cx2, cy2] = p.P(a, 0.68);
        ln(c, bx, by, ax, ay, '#d8c890', 2);
        ln(c, ax, ay, cx2, cy2, '#d8c890', 2);
      }
    } else if (v === 'name') {
      // the station's name in giant stencilled letters, worn by boots and dust
      const FONT: Record<string, string[]> = {
        N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
        E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
        T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
        '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
      };
      // the dark painted panel the name sits on
      c.globalAlpha = 0.55;
      fillPoly(c, [p.P(0, 0), p.P(p.pw, 0), p.P(p.pw, p.pd), p.P(0, p.pd)], '#262f43');
      c.globalAlpha = 1;
      const text = 'REALMNEST-1';
      const cw = p.pw / text.length;
      const ch = p.pd * 0.8;
      const cellA = (cw * 0.82) / 5;
      const cellB = ch / 7;
      for (let i = 0; i < text.length; i++) {
        const g = FONT[text[i]];
        if (!g) continue;
        for (let r = 0; r < 7; r++)
          for (let q = 0; q < 5; q++) {
            if (g[r][q] !== '1') continue;
            // rows run toward the front (b), columns along a
            const a0 = i * cw + cw * 0.09 + q * cellA;
            const b0 = p.pd * 0.1 + r * cellB;
            const o = p.P(a0, b0);
            const ua = p.P(a0 + cellA, b0);
            const vb = p.P(a0, b0 + cellB);
            const ux = ua[0] - o[0];
            const uy = ua[1] - o[1];
            const vx = vb[0] - o[0];
            const vy = vb[1] - o[1];
            const det = ux * vy - uy * vx;
            const xs = [o[0], ua[0], vb[0], ua[0] + vx];
            const ys = [o[1], ua[1], vb[1], ua[1] + vy];
            for (let yy = Math.floor(Math.min(...ys)); yy <= Math.max(...ys); yy++)
              for (let xx = Math.floor(Math.min(...xs)); xx <= Math.max(...xs); xx++) {
                const X = xx + 0.5 - o[0];
                const Y = yy + 0.5 - o[1];
                const s1 = (X * vy - Y * vx) / det;
                const t1 = (ux * Y - uy * X) / det;
                if (s1 < 0 || s1 > 1 || t1 < 0 || t1 > 1) continue;
                if (hash(xx >> 2, yy >> 1, 141) < 0.03 || hash(xx, yy, 142) < 0.02) continue;
                c.globalAlpha = 0.95;
                px(c, xx, yy, '#e8ecf2');
              }
            c.globalAlpha = 1;
          }
      }
    } else if (v === 'cable') {
      // cables lying across the deck in loose curves, clipped down here and there
      const cols = ['#2a2c34', '#3a5a9a', '#8a2a2a'];
      cols.forEach((col, j) => {
        let prev = p.P(0.05, 0.4 + j * 0.08);
        for (let i = 1; i <= 24; i++) {
          const t = i / 24;
          const q = p.P(0.05 + t * (p.pw - 0.1), 0.4 + j * 0.08 + Math.sin(t * 6 + j + k.seed) * 0.12);
          ln(c, prev[0], prev[1], q[0], q[1], col, 2);
          prev = q;
        }
      });
      for (let a = 0.6; a < p.pw - 0.2; a += 1.4) {
        const q = [p.P(a, 0.36), p.P(a + 0.08, 0.36), p.P(a + 0.08, 0.7), p.P(a, 0.7)];
        fillPoly(c, q, '#9aa2b0');
      }
    } else if (v === 'label') {
      // a stencilled zone code in amber and white on the deck
      const Rn = rng(k.seed * 5 + 2);
      for (let i = 0; i < 3; i++)
        for (let r = 0; r < 5; r++)
          for (let q = 0; q < 3; q++) {
            if (Rn() < 0.4) continue;
            const a0 = 0.15 + i * 0.26 + q * 0.07;
            const b0 = 0.3 + r * 0.08;
            fillPoly(c, [p.P(a0, b0), p.P(a0 + 0.06, b0), p.P(a0 + 0.06, b0 + 0.07), p.P(a0, b0 + 0.07)], i === 0 ? AMBER[4] : '#c8ccd4');
          }
    } else if (v === 'tether') {
      // a tether line lying in loops on the deck
      let [px0, py0] = p.P(0.1, 0.6);
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const [nx, ny] = p.P(0.1 + t * 0.8, 0.5 + Math.sin(t * 9 + k.seed) * 0.2);
        ln(c, px0, py0, nx, ny, '#e8e2d0', 1);
        px0 = nx;
        py0 = ny;
      }
    }
  },
};

export const SPACE_DECK: Record<string, PropArt> = {
  spc_cargo,
  spc_rack,
  spc_cabinet,
  spc_tank,
  spc_box,
  spc_beacon,
  spc_mast,
  spc_rail,
  spc_pipes,
  spc_vent,
  spc_capsule,
  spc_worksite,
  spc_telescope,
  spc_dome,
  spc_cupola,
  spc_cmg,
  spc_decal,
};


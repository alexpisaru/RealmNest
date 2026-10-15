// Research Hub — the things people left on the summit (1 z ≈ 10 cm).
//   res_drywall   'dry' stone walls of the pastures, 'parapet' along the road
//   res_snowpole  red-and-white snow poles lining the road
//   res_signpost  yellow hiking signs on a pole, a red-white trail mark
//   res_bench     a rough larch bench
//   res_scope     the coin telescope at the viewpoint
//   res_railing   a larch rail fence along the brink
//   res_orient    an orientation table: a bronze panorama on a stone pedestal
//   res_jeep      an old green off-roader, parked
//   res_woodpile  split firewood stacked under a little roof
//   res_trough    a log fountain with water running into the trough
//   res_table     a terrace table with two benches and a half-drunk tea
//   res_lamp      a lantern on a larch post
//   res_windsock  a windsock on a mast
//   res_gear      skis, poles and snowshoes leaning together
//   res_crates    supply crates and a gas bottle
//   res_decal     flat ground details: marmot burrows, stones, snow, tracks, needles, puddles
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { at, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { fieldStones4, glass4 } from '../../materials4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { brushed, grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { cylinder, lightOf, plot, rockMass, rubble, toneOf } from './kit';
import { BARKG, BRASS, CONCRETE, GNEISS, IRONK, LARCHF, MORTAR, PIODE, RED, ROCK, STEEL, TIMBER } from './palette';

const GLASS: Ramp = ['#1c2c34', '#24404a', '#30545e', '#466e76', '#6a9096', '#9ab8ba', '#d0e2e0'];
const MOSS: Ramp = ['#24381c', '#2e4822', '#3a5a2a', '#4a6e32', '#5e843c'];

// ── stone walls ─────────────────────────────────────────────
const res_drywall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const parapet = k.variant === 'parapet';
    const H = parapet ? 6.4 : 5;
    const T = parapet ? 0.34 : 0.4;
    const b0 = 0.5 - T / 2;
    footShadow(p, 0, b0, W, b0 + T, H, 0.24);
    const stones: Mat = parapet ? rubble(GNEISS, MORTAR, 11) : fieldStones4(ROCK, 11, 0.45, MOSS);
    lbox(p, 0, b0, W, T, 0, H, { front: stones, side: stones, top: stones, edge: ROCK[0] });
    if (parapet) {
      // granite capstones with chamfered edges
      const cap: Mat = (light) => (u, v, x, y) => {
        const fu = u % 34;
        if (fu < 1.2) return '#4a4a4c';
        return at(['#4a4a4c', '#5a5a5c', '#6c6b68', '#7e7c78', '#908e88', '#a4a098'], (light === 2 ? 3.6 : light ? 3 : 1.6) + (v > 3 ? 0.6 : 0) + (hash(x, y, 3) < 0.08 ? -1 : 0));
      };
      lbox(p, -0.02, b0 - 0.05, W + 0.04, T + 0.1, H, 1.4, { front: cap, side: cap, top: cap, edge: '#3a3a3c' });
    } else {
      // turf and stonecrop on the top, tufts at the foot
      const R = rng(k.seed * 13 + 1);
      layer(p.c, (l) => {
        for (let a = 0.1; a < W - 0.05; a += 0.16) {
          const [x, y] = p.P(a, 0.5, H);
          if (R() < 0.55) for (let i = 0; i < 3; i++) ln(l, x + i * 2 - 2, y + 1, x + i * 2 - 3 + R() * 2, y - 2 - R() * 4, ['#3c5e28', '#4e7430', '#64883a'][i]);
          else if (R() < 0.3) {
            ell(l, x, y, 3, 1.5, '#6a8a4a');
            px(l, x - 1, y - 1, '#e8c040', 2, 1);
          }
        }
        for (let a = 0.2; a < W - 0.1; a += 0.35 + R() * 0.4) {
          const [x, y] = p.P(a, b0 + T + 0.04, 0);
          for (let i = 0; i < 4; i++) ln(l, x + i * 2 - 3, y, x + i * 2 - 4 + R() * 3, y - 3 - R() * 5, ['#3c5e28', '#4e7430', '#64883a', '#7e9e46'][i]);
        }
      }, { outline: 0.45 });
    }
  },
};

// ── snow poles ──────────────────────────────────────────────
const res_snowpole: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const lean = (hash(k.seed, 1, 5) - 0.5) * 3;
    contactShadow(p.c, x + 4, y + 1, 5, 2, 0.22);
    layer(p.c, (l) => {
      const H = 92;
      for (let j = 0; j < H; j++) {
        const xx = x + (lean * j) / H;
        const band = Math.floor(j / 13) % 2;
        const col = band ? '#f2eee6' : RED[3];
        px(l, xx - 1, y - j, j === 0 ? '#3a2e24' : col, 3, 1);
        px(l, xx - 1, y - j, band ? '#ffffff' : RED[5], 1, 1);
      }
      px(l, x + lean - 1, y - H - 2, '#e8c040', 3, 3);
    }, { outline: 0.55 });
  },
};

// ── a yellow hiking signpost ────────────────────────────────
const res_signpost: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 2, 10, 3, 0.26);
    layer(p.c, (l) => {
      px(l, x - 1, y - 80, STEEL[4], 3, 80);
      px(l, x - 1, y - 80, STEEL[6], 1, 80);
      // the red-white-red trail mark painted on the pole
      px(l, x - 1, y - 30, RED[3], 3, 2);
      px(l, x - 1, y - 28, '#f2eee6', 3, 2);
      px(l, x - 1, y - 26, RED[3], 3, 2);
      // arrow signs pointing three ways, black letters
      const sign = (sy: number, dir: number, len: number) => {
        const x0 = dir > 0 ? x + 1 : x - len - 1;
        const tip = dir > 0 ? x0 + len + 6 : x0 - 6;
        fillPoly(l, [[x0, sy], [x0 + len, sy], [dir > 0 ? tip : x0 + len, sy + 4], [x0 + len, sy + 8], [x0, sy + 8], [dir > 0 ? x0 : tip, sy + 4]].map(([a, b]) => [a, b] as [number, number]), '#f0c830');
        fillPoly(l, [[x0, sy + 7], [x0 + len, sy + 7], [x0 + len, sy + 8], [x0, sy + 8]], '#b88a18');
        for (let i = 0; i < Math.floor(len / 4); i++) px(l, x0 + 2 + i * 4, sy + 3, '#2a2420', 2, 2);
      };
      sign(y - 80, 1, 26);
      sign(y - 70, -1, 22);
      sign(y - 60, 1, 18);
      px(l, x - 4, y - 84, '#f2eee6', 8, 3);
    }, { outline: 0.55 });
    void k;
  },
};

// ── a rough larch bench ─────────────────────────────────────
const res_bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.3, W - 0.08, 0.75, 6, 0.26);
    const wood = grain(LARCHF);
    // split-log legs, a thick plank seat, a back rail on two posts
    for (const a of [0.2, W - 0.3]) lbox(p, a, 0.35, 0.1, 0.32, 0, 4.2, mono(wood, LARCHF[0]));
    lbox(p, 0.08, 0.3, W - 0.16, 0.42, 4.2, 0.9, mono(wood, LARCHF[0]));
    for (const a of [0.24, W - 0.32]) lbox(p, a, 0.28, 0.08, 0.06, 4.6, 5.2, mono(wood, LARCHF[0]));
    lbox(p, 0.12, 0.26, W - 0.24, 0.07, 8, 1.4, mono(wood, LARCHF[0]));
    // a carved heart in the back rail and a forgotten pair of gloves
    const F = front(p, 0.33);
    const [hx, hy] = F.F(W / 2, 8.7);
    px(p.c, hx - 2, hy - 1, LARCHF[0], 2, 2);
    px(p.c, hx + 1, hy - 1, LARCHF[0], 2, 2);
    px(p.c, hx - 1, hy + 1, LARCHF[0], 3, 1);
    if (k.seed % 3 === 0) {
      const [gx, gy] = anchor(p, W * 0.7, 0.5, 5.1);
      px(p.c, gx - 4, gy - 2, RED[3], 6, 3);
      px(p.c, gx + 1, gy - 1, RED[2], 5, 3);
    }
  },
};

// ── the coin telescope ──────────────────────────────────────
// A tourist binocular on its pedestal, looking out south-west over the valley: a cast column with
// the coin box, a fork, the head with its rubber visor at the back and two fat tubes pointing out.
const res_scope: PropArt = {
  draw(p, k) {
    const G: Ramp = ['#1a2a22', '#24382e', '#30483a', '#3e5a48', '#507058', '#68886e', '#88a68a'];
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 9, y + 3, 15, 5, 0.28);
    // the concrete footplate
    lbox(p, 0.3, 0.32, 0.4, 0.36, 0, 0.8, mono(paint(CONCRETE), CONCRETE[0]));
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    const tone = (nx: number, ny: number, xx: number, yy: number, lift = 0) => G[toneOf(G, lightOf(nx, ny, 0) + lift, xx, yy, 0.3, 0.7)];
    // the cast foot, the column, the coin box on its front
    cylinder(p.c, p.k, cx, cy, 0.11, 0.8, 2.2, (nx, ny, _a, z, xx, yy) => (z > 1.9 ? G[5] : tone(nx, ny, xx, yy, -0.1)));
    cylinder(p.c, p.k, cx, cy, 0.055, 2.2, 11, (nx, ny, _a, z, xx, yy) => (Math.abs(z - 6) < 0.3 ? G[1] : tone(nx, ny, xx, yy)));
    lbox(p, 0.44, 0.55, 0.12, 0.07, 6.6, 2.4, mono(paint(G), G[0]));
    const [sx, sy] = p.P(0.5, 0.62, 8.2);
    px(p.c, sx - 2, sy - 1, BRASS[4], 4, 1);
    px(p.c, sx - 2, sy, BRASS[1], 4, 1);
    // the fork
    lbox(p, 0.38, 0.47, 0.03, 0.06, 10.4, 2.6, mono(paint(G), G[0]));
    lbox(p, 0.59, 0.47, 0.03, 0.06, 10.4, 2.6, mono(paint(G), G[0]));
    // the head: the body, the dark rubber visor over the eyepieces at the back, the top cap
    lbox(p, 0.36, 0.38, 0.28, 0.17, 11.4, 2.8, mono(paint(G), G[0]));
    lbox(p, 0.37, 0.3, 0.26, 0.09, 11.8, 2.2, mono(paint(IRONK), IRONK[0]));
    // the tubes, side by side, pointing along +y out of the head; the near one (higher x) last
    const r = 0.068;
    const zc = 12.9;
    const ring = (xc: number, yc: number, rr: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        pts.push(p.P(xc + Math.cos(a) * rr, yc, zc + Math.sin(a) * rr * 16));
      }
      return pts;
    };
    for (const xc of [0.42, 0.58]) {
      const y0 = 0.5;
      const y1 = 0.86;
      // the barrel: stamped rings from the head outwards, a lit upper edge and a dark lower one
      for (let yy = y0; yy <= y1; yy += 0.01) fillPoly(p.c, ring(xc, yy, r), G[3]);
      const [ux0, uy0] = p.P(xc - r * 0.55, y0, zc + r * 16 * 0.75);
      const [ux1, uy1] = p.P(xc - r * 0.55, y1 - 0.02, zc + r * 16 * 0.75);
      ln(p.c, ux0, uy0, ux1, uy1, G[5], 2);
      const [lx0, ly0] = p.P(xc + r * 0.7, y0, zc - r * 16 * 0.7);
      const [lx1, ly1] = p.P(xc + r * 0.7, y1, zc - r * 16 * 0.7);
      ln(p.c, lx0, ly0, lx1, ly1, G[1], 2);
      // a band round the barrel, then the objective: a bright rim, dark glass, a glint
      fillPoly(p.c, ring(xc, y0 + 0.2, r * 1.04), G[2]);
      for (let yy = y0 + 0.21; yy <= y1; yy += 0.01) fillPoly(p.c, ring(xc, yy, r), G[3]);
      ln(p.c, ...p.P(xc - r * 0.55, y0 + 0.21, zc + r * 16 * 0.75), ...p.P(xc - r * 0.55, y1 - 0.02, zc + r * 16 * 0.75), G[5], 2);
      fillPoly(p.c, ring(xc, y1, r), G[5]);
      fillPoly(p.c, ring(xc, y1 + 0.001, r * 0.78), '#0e141c');
      const [gx, gy] = p.P(xc - r * 0.3, y1, zc + r * 16 * 0.35);
      px(p.c, gx - 1, gy - 1, '#6a8cb4', 2, 2);
      px(p.c, gx - 1, gy - 1, '#c8dcf0');
    }
    void k;
  },
};

// ── a rail fence along the brink ────────────────────────────
const res_railing: PropArt = {
  draw(p, k) {
    const W = k.w;
    const wood = grain(LARCHF);
    if (k.variant && /diag|sw|se/.test(k.variant)) {
      // pieces of a rail that follows the brink from corner to corner of the tiles: across the
      // tile's diagonal ('diag', W to E) or along a front edge ('sw' W to S, 'se' S to E); the
      // posts stand exactly on the corners so neighbouring pieces share them
      const post = (x: number, y: number) => lbox(p, x - 0.045, y - 0.045, 0.09, 0.09, 0, 9, mono(wood, LARCHF[0]));
      const SEG: Record<string, [number, number, number, number]> = { diag: [0, 1, 1, 0], sw: [0, 1, 1, 1], se: [1, 1, 1, 0] };
      const parts = k.variant.split(',').filter((v) => SEG[v]);
      const corners = new Map<string, [number, number]>();
      for (const v of parts) {
        const [ax, ay, bx, by] = SEG[v];
        corners.set(`${ax},${ay}`, [ax, ay]);
        corners.set(`${bx},${by}`, [bx, by]);
      }
      // back posts, the rails, then the post on the front corner over them
      for (const [x, y] of corners.values()) if (x + y < 2) post(x, y);
      for (const v of parts) {
        const [ax, ay, bx, by] = SEG[v];
        for (const z of [4.2, 8]) {
          const [x0, y0] = p.P(ax, ay, z);
          const [x1, y1] = p.P(bx, by, z);
          ln(p.c, x0, y0, x1, y1, LARCHF[2], 4);
          ln(p.c, x0, y0 - 1, x1, y1 - 1, LARCHF[5], 1);
          ln(p.c, x0, y0 + 2, x1, y1 + 2, LARCHF[0], 1);
        }
      }
      if (corners.has('1,1')) post(1, 1);
      return;
    }
    const n = Math.max(1, Math.round(W * 1.5));
    for (let i = 0; i <= n; i++) lbox(p, (W * i) / n - 0.04, 0.46, 0.08, 0.08, 0, 9, mono(wood, LARCHF[0]));
    for (const z of [4.2, 8]) {
      const [x0, y0] = p.P(0, 0.5, z);
      const [x1, y1] = p.P(W, 0.5, z);
      ln(p.c, x0, y0, x1, y1, LARCHF[2], 4);
      ln(p.c, x0, y0 - 1, x1, y1 - 1, LARCHF[5], 1);
    }
    void k;
  },
};

// ── an orientation table ────────────────────────────────────
const res_orient: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 10, y + 3, 18, 6, 0.28);
    const st = rubble(GNEISS, MORTAR, 8);
    lbox(p, 0.3, 0.3, 0.4, 0.4, 0, 9, { front: st, side: st, top: st, edge: GNEISS[0] });
    const [tx, ty] = anchor(p, 0.5, 0.5, 9.4);
    layer(p.c, (l) => {
      // the tilted bronze disc with a panorama engraved round its rim, an arrow north
      ell(l, tx, ty, 18, 8, '#5a4220');
      ell(l, tx - 1, ty - 1, 17, 7, '#a07a34');
      ell(l, tx - 3, ty - 2, 9, 3, '#c8a050');
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const r = 13 + (i % 3);
        px(l, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.45, '#5a4220');
      }
      ln(l, tx, ty, tx - 6, ty - 3, '#3a2a14');
      px(l, tx - 1, ty - 1, '#f2d27a', 2, 2);
    });
    void k;
  },
};

// ── the summit's off-roaders: a green one parked, a red one that drives the road ──
// A short-wheelbase 4×4 at true scale (3 m × 1.3 m, 1.8 m to the roof): a boxy body on big
// knobbly tyres with flared arches, a hardtop with a roof rack, a seven-slot grille and round
// lamps on the nose (a = w, the visible end), tail lamps at the back corner.
const TYRE: Ramp = ['#0e0c10', '#18161c', '#24222a', '#302e36', '#3e3c46'];
/**
 * A tyre on the long side face (a vertical disc in the plane along a): the iso projection makes it a
 * sheared ellipse (its horizontal diameter runs along the face's slope). R is the radius in z units at
 * k = 4. The tread's thickness shows behind it, up and to the right; then sidewall, rim, bolts, hub.
 */
function tyre(c: CanvasRenderingContext2D, x: number, y: number, R: number, rim: string) {
  const r4 = R * 4;
  const ring = (dx: number, dy: number) => {
    const cc = dx / r4;
    const ss = (dx / 2 - dy) / r4;
    return [Math.hypot(cc, ss), Math.atan2(ss, cc)] as const;
  };
  const ext = Math.ceil(r4 * 1.3) + 8;
  // the tread, seen past the sidewall toward the body
  for (let dy = -ext; dy <= ext; dy++)
    for (let dx = -ext; dx <= ext; dx++) {
      const [q] = ring(dx - 5, dy + 2.5);
      if (q <= 1) plot(c, x + dx, y + dy, ((dx + dy * 2) & 3) === 0 ? TYRE[0] : TYRE[1]);
    }
  for (let dy = -ext; dy <= ext; dy++)
    for (let dx = -ext; dx <= ext; dx++) {
      const [q, ang] = ring(dx, dy);
      if (q > 1) continue;
      let col: string;
      if (q > 0.86) {
        // the knobbly outer edge: blocks round the rim, lit on the upper left
        const knob = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2;
        col = TYRE[(knob ? 2 : 1) + (Math.sin(ang) > 0.3 ? 1 : 0)];
      } else if (q > 0.6) col = TYRE[Math.cos(ang - 2.4) > 0.4 ? 4 : 3];
      else if (q > 0.54) col = darken(rim, 0.4);
      else if (q > 0.16) {
        const bolt = q > 0.3 && q < 0.4 && Math.abs(((ang / ((Math.PI * 2) / 5)) % 1 + 1) % 1 - 0.5) > 0.4;
        col = bolt ? darken(rim, 0.5) : Math.cos(ang - 2.4) > 0.3 ? lighten(rim, 0.25) : q > 0.45 ? darken(rim, 0.12) : rim;
      } else col = darken(rim, 0.3);
      plot(c, x + dx, y + dy, col);
    }
}

const res_jeep: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    // 'red' / 'green' (default); a '-back' suffix draws it nose to a = 0 (the line's start), for a run back
    const red = (k.variant ?? '').startsWith('red');
    const back = (k.variant ?? '').endsWith('back');
    /** a span along a (start, width), mirrored end to end for the back variant */
    const M = (a: number, w: number) => (back ? W - a - w : a);
    const BODY: Ramp = red ? ['#4a0e10', '#6e1618', '#962220', '#b8302a', '#d4463a', '#e8685a', '#f48c7c'] : ['#1a2014', '#28321e', '#3a4628', '#4c5a34', '#607044', '#788a56', '#94a670'];
    const TRIM: Ramp = ['#141418', '#1e1e24', '#2a2a32', '#383842', '#484852', '#5a5a66'];
    const TOP: Ramp = red ? ['#8a8c90', '#a8aaae', '#c4c6ca', '#dcdee2', '#eceef0', '#f8f9fa'] : TRIM;
    const GL = (light: number) => (u: number, v: number) => ((u * 0.8 + v) % 26 < 4 ? '#c8e0ec' : (u * 0.8 + v) % 26 < 6 ? '#8ab0c4' : light ? '#4a6878' : '#3a5462');
    const a0 = 0.08;
    const a1 = W - 0.06;
    const b0 = (D - 0.78) / 2 + 0.02;
    const b1 = b0 + 0.76;
    const zb = 4.2; // the body's sill
    const zw = 10.6; // the waistline (bonnet and door tops)
    const zr = 16.4; // the roof
    const ah = W - 0.72; // the windscreen's foot: the bonnet in front of it
    footShadow(p, 0, b0 - 0.05, W, b1 + 0.12, 18, 0.38);
    const F = front(p, b1);
    const S = side(p, a1);
    const wZ = 4.6; // the tyre's radius in z (≈ 0.9 m tall knobbly tyres)
    const wR = wZ * 4;
    const wheelsA = [a0 + 0.42, a1 - 0.4];
    // contact shadows under the wheels, the far-side tyres glimpsed under the body
    for (const a of wheelsA) {
      const [x, y] = p.P(a, b1, 0);
      p.c.globalAlpha = 0.45;
      ell(p.c, x + 4, y + 1, wR * 0.9, 4, '#1a0e16');
      p.c.globalAlpha = 1;
      const [fx, fy] = p.P(a, b0 + 0.05, wZ);
      ell(p.c, fx, fy, wR * 0.9, wR * 0.95, TYRE[1]);
    }
    // chassis and axles between the wheels
    lbox(p, a0 + 0.2, b0 + 0.12, a1 - a0 - 0.4, b1 - b0 - 0.24, 2.2, 2.2, mono(paint(TRIM), TRIM[0]));
    // the body: sill to waist, lit on the long side, shaded on the nose
    const body: Mat = (light, w, h) => {
      const m = brushed(BODY, 0.82)(light, w, h);
      return (u, v, x, y) => {
        // a livery stripe along the flank (white on the red one, sand on the green one)
        if (light === 1 && v > h * 0.5 && v < h * 0.62) return red ? '#f4f0e8' : '#c8b47a';
        if (v < 1.2) return at(BODY, light ? 1 : 0);
        return m(u, v, x, y);
      };
    };
    lbox(p, a0, b0, a1 - a0, b1 - b0, zb, zw - zb, { front: body, side: body, top: paint(BODY), edge: BODY[0] });
    // the cabin: pillars and glass under a hardtop
    lbox(p, M(a0 + 0.04, ah - a0 - 0.04), b0 + 0.04, ah - a0 - 0.04, b1 - b0 - 0.08, zw, zr - zw, { front: paint(BODY), side: paint(BODY), top: paint(TOP), edge: BODY[0] });
    const Fc = front(p, b1 - 0.04);
    const Sc = side(p, back ? W - a0 - 0.04 : ah);
    // side windows: front door, rear door, the rear quarter; a black frame round each
    for (const [u0, u1] of [[ah - 0.5, ah - 0.06], [ah - 1.0, ah - 0.56], [a0 + 0.12, ah - 1.06]] as const) {
      if (u1 - u0 < 0.08) continue;
      const m0 = M(u0, u1 - u0);
      pq(p, Fc, m0 - 0.02, m0 + (u1 - u0) + 0.02, zw + 0.6, zr - 0.6, TRIM[1]);
      pt(p, Fc, m0, m0 + (u1 - u0), zw + 1, zr - 1, GL(1), 1);
    }
    if (!back) {
      // the windscreen on the cabin's nose face: frame, glass, a wiper
      pq(p, Sc, b0 + 0.06, b1 - 0.06, zw + 0.4, zr - 0.3, TRIM[1]);
      pt(p, Sc, b0 + 0.1, b1 - 0.1, zw + 0.9, zr - 0.8, GL(0), 0);
      pq(p, Sc, b0 + 0.18, b0 + 0.42, zw + 1.1, zw + 1.4, TRIM[0]);
    } else {
      // the rear window in the hardtop's tail, a little smaller, with a wiper
      pq(p, Sc, b0 + 0.1, b1 - 0.1, zw + 0.8, zr - 0.6, TRIM[1]);
      pt(p, Sc, b0 + 0.14, b1 - 0.14, zw + 1.2, zr - 1, GL(0), 0);
      pq(p, Sc, (b0 + b1) / 2 - 0.02, (b0 + b1) / 2 + 0.22, zw + 1.4, zw + 1.7, TRIM[0]);
    }
    // the hardtop: a lid, roof rails and a rack with a duffel bag and a larch crate
    lbox(p, M(a0 + 0.02, ah - a0), b0 + 0.02, ah - a0, b1 - b0 - 0.04, zr, 0.8, mono(paint(TOP), TOP[0]));
    for (const b of [b0 + 0.12, b1 - 0.12]) lbox(p, M(a0 + 0.12, ah - a0 - 0.24), b - 0.02, ah - a0 - 0.24, 0.04, zr + 0.8, 1.1, mono(paint(TRIM), TRIM[0]));
    const BAG: Ramp = red ? ['#2a3a24', '#3a4e30', '#4c623c', '#5e7648', '#728a56', '#8aa268'] : ['#5a2010', '#7a2c16', '#9a3a1e', '#b84e2a', '#cc6a3e', '#de8a5a'];
    const rack: [number, number, number, Mat, string][] = [[a0 + 0.3, 0.34, 2.2, paint(BAG), '#1a1210'], [a0 + 0.72, 0.42, 1.8, grain(LARCHF), LARCHF[0]]];
    if (back) rack.reverse();
    for (const [a, w, h, m, e] of rack) lbox(p, M(a, w), b0 + 0.21, w, b1 - b0 - 0.42, zr + 0.8, h, mono(m, e));
    // door lines, handles, the mirror
    for (const u of [ah - 0.53, ah - 1.03]) pq(p, F, M(u, 0.012), M(u, 0.012) + 0.012, zb + 0.6, zw, BODY[0]);
    for (const u of [ah - 0.2, ah - 0.7]) pq(p, F, M(u - 0.06, 0.06), M(u - 0.06, 0.06) + 0.06, zw - 1.6, zw - 1.2, '#d0d4da');
    const [mx, my] = p.P(back ? W - ah + 0.04 : ah - 0.04, b1 + 0.1, zw + 1.6);
    px(p.c, mx - (back ? 4 : 1), my - 3, TRIM[0], 6, 5);
    px(p.c, mx - (back ? 3 : 0), my - 2, '#7a9aac', 3, 2);
    if (back) {
      // the tail: a tailgate with the spare wheel on it, tall red lamps at the corners, the bumper and plate
      pq(p, S, b0 + 0.08, b1 - 0.08, zb + 0.6, zw - 0.4, BODY[2]);
      pq(p, S, (b0 + b1) / 2 - 0.006, (b0 + b1) / 2 + 0.006, zb + 0.6, zw - 0.4, BODY[0]);
      for (const b of [b0 + 0.06, b1 - 0.06]) {
        pq(p, S, b - 0.05, b + 0.05, zw - 4, zw - 0.8, '#b01818');
        pq(p, S, b - 0.03, b + 0.03, zw - 3.6, zw - 2.6, '#ff6a5a');
        pq(p, S, b - 0.05, b + 0.05, zw - 5, zw - 4.2, '#f0a020');
      }
      lbox(p, a1, b0 - 0.04, 0.05, b1 - b0 + 0.08, 2.6, 2.2, mono(paint(TRIM), TRIM[0]));
      const Sb = side(p, a1 + 0.05);
      pq(p, Sb, (b0 + b1) / 2 - 0.12, (b0 + b1) / 2 + 0.12, 3, 4.4, '#f4f2ea');
      pq(p, Sb, (b0 + b1) / 2 - 0.1, (b0 + b1) / 2 + 0.1, 3.4, 3.9, '#2a2a30');
      const [sx, sy] = S.F((b0 + b1) / 2, zb + 4.4);
      // a disc on the end face (the plane along b): its horizontal diameter runs down to the left
      const R4 = 13;
      for (let dy = -R4 * 2; dy <= R4 * 2; dy++)
        for (let dx = -R4 * 2; dx <= R4 * 2; dx++) {
          const cc = -dx / R4;
          const ss = (-dx / 2 - dy) / R4;
          const q = Math.hypot(cc, ss);
          if (q > 1) continue;
          const ang = Math.atan2(ss, cc);
          const col = q > 0.86 ? TYRE[(Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 ? 2 : 1) + (Math.sin(ang) > 0.3 ? 1 : 0)] : q > 0.58 ? TYRE[Math.sin(ang) > 0.2 ? 4 : 3] : q > 0.2 ? (red ? '#d8dade' : '#b8bcc4') : TRIM[2];
          plot(p.c, sx + dx, sy + dy, col);
        }
      // the headlamps glimpsed at the far end of the flank
      pq(p, F, a0, a0 + 0.06, zw - 2.6, zw - 1.2, '#fff6d8');
      pq(p, F, a0, a0 + 0.06, zb + 1, zb + 1.8, '#f0a020');
    } else {
    // the nose: grille with seven slots, round lamps, indicators, a black bumper with the plate
    pq(p, S, b0 + 0.14, b1 - 0.14, zb + 1.4, zw - 1, TRIM[1]);
    for (let i = 0; i < 7; i++) {
      const b = b0 + 0.2 + i * ((b1 - b0 - 0.4) / 6);
      pq(p, S, b - 0.018, b + 0.018, zb + 1.8, zw - 1.6, '#3a3a44');
    }
    for (const b of [b0 + 0.1, b1 - 0.1]) {
      const [lx, ly] = S.F(b, zw - 2.6);
      ell(p.c, lx, ly, 4, 4.4, '#c8ccd2');
      ell(p.c, lx, ly, 3, 3.3, '#fff6d8');
      px(p.c, lx - 1, ly - 2, '#ffffff', 2, 2);
      const [ix, iy] = S.F(b, zb + 1.2);
      px(p.c, ix - 2, iy - 1, '#f0a020', 4, 2);
    }
    lbox(p, a1, b0 - 0.04, 0.05, b1 - b0 + 0.08, 2.6, 2.2, mono(paint(TRIM), TRIM[0]));
    const Sb = side(p, a1 + 0.05);
    pq(p, Sb, (b0 + b1) / 2 - 0.12, (b0 + b1) / 2 + 0.12, 3, 4.4, '#f4f2ea');
    pq(p, Sb, (b0 + b1) / 2 - 0.1, (b0 + b1) / 2 + 0.1, 3.4, 3.9, '#2a2a30');
    // tail lamps at the back corner of the flank
    pq(p, F, a0, a0 + 0.07, zw - 3, zw - 0.8, '#d02020');
    pq(p, F, a0, a0 + 0.07, zw - 1.6, zw - 1.1, '#ff7060');
    }
    // wheel arches cut into the body with black flares, then the tyres
    for (const a of wheelsA) {
      const [x, y] = p.P(a, b1, wZ);
      // the arch: a dark well cut into the flank
      for (let dy = -wR - 6; dy <= 0; dy++) for (let dx = -wR - 6; dx <= wR + 6; dx++) if (Math.hypot(dx / (wR + 5), (dx / 2 - dy) / (wR + 5)) <= 1) px(p.c, x + dx, y + dy, '#0e0c12');
      tyre(p.c, x, y, wZ, red ? '#d8dade' : '#b8bcc4');
      // the flare: a thick black arc over the tyre, following the face
      for (let t = 0; t <= 24; t++) {
        const ang = (t / 24) * Math.PI;
        const cc = Math.cos(ang) * (wR + 4);
        px(p.c, x + cc - 1, y + cc / 2 - Math.sin(ang) * (wR + 4) - 1, TRIM[2], 3, 3);
      }
    }
    // the near nose tyre seen end-on under the bumper
    const [nx, ny] = S.F(b1 - 0.14, 2.4);
    px(p.c, nx - 6, ny - 8, TYRE[2], 9, 18);
    px(p.c, nx - 6, ny - 8, TYRE[3], 2, 18);
    void k;
  },
};

// ── the Swiss flag on its pole ──────────────────────────────
const res_flag: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 2, 12, 4, 0.28);
    const H = 290;
    layer(p.c, (l) => {
      // a white pole on a stone foot, a gilt knob
      ell(l, x, y - 2, 9, 4, GNEISS[2]);
      px(l, x - 8, y - 8, GNEISS[4], 16, 6);
      px(l, x - 2, y - H, '#d8dce2', 4, H - 6);
      px(l, x - 2, y - H, '#ffffff', 1, H - 6);
      px(l, x + 1, y - H, '#9aa0a8', 1, H - 6);
      ell(l, x, y - H - 2, 3, 3, BRASS[4]);
      // the flag, square, waving out to the right: a red field, the white cross
      const fw = 74;
      const fh = 66;
      for (let i = 0; i < fw; i++) {
        const wave = Math.round(Math.sin(i * 0.1 + k.seed) * 4 + i * 0.08);
        const shade = Math.cos(i * 0.1 + k.seed) < -0.3 ? -1 : Math.cos(i * 0.1 + k.seed) > 0.5 ? 1 : 0;
        for (let j = 0; j < fh; j++) {
          const cu = Math.abs(i - fw / 2);
          const cv = Math.abs(j - fh / 2);
          const cross = (cu < 7 && cv < 22) || (cv < 7 && cu < 22);
          const col = cross ? (shade < 0 ? '#d8d8dc' : '#ffffff') : RED[3 + shade];
          px(l, x + 2 + i, y - H + 4 + j + wave, col);
        }
      }
    }, { outline: 0.55 });
  },
};

// ── a red-and-white radio mast on its rock ─────────────────
const res_mast: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 24, y + 6, 40, 12, 0.3);
    layer(p.c, (l) => rockMass(l, x, y - 12, 34, 20, k.seed * 5 + 3, ROCK, { lichen: 0.06, moss: 0.4 }), { outline: 0.6 });
    const H = 470;
    layer(p.c, (l) => {
      // guy wires to the rock
      for (const [dx, dy] of [[-34, -6], [30, -4], [10, 8]] as const) ln(l, x, y - H * 0.62, x + dx, y + dy - 14, '#4a4e56');
      // the lattice: two legs, red and white bands, cross bracing
      const top = y - H;
      for (let j = 0; j < H - 20; j++) {
        const yy = y - 22 - j;
        const half = 5 - (j / H) * 3;
        const band = Math.floor(j / 40) % 2 ? '#f4f4f2' : RED[3];
        const dark = Math.floor(j / 40) % 2 ? '#b8bcc4' : RED[1];
        px(l, x - half - 1, yy, band, 2, 1);
        px(l, x + half - 1, yy, dark, 2, 1);
        if (j % 10 === 0) ln(l, x - half, yy, x + half, yy - 10, band);
      }
      // aerials and dishes near the top, a red lamp on the tip
      px(l, x - 1, top - 30, '#9aa0a8', 2, 30);
      ell(l, x - 10, top + 40, 6, 7, '#e8ecf0');
      ell(l, x - 11, top + 40, 4, 5, '#c4ccd6');
      ell(l, x + 10, top + 70, 5, 6, '#e8ecf0');
      px(l, x + 6, top + 20, '#c4ccd6', 8, 3);
      px(l, x - 8, top + 100, '#d0d4da', 6, 10);
      px(l, x - 2, top - 34, '#ff4a3a', 4, 4);
    }, { outline: 0.5 });
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 125, r: 0.5, color: '#ff5a4a', kind: 'lamp' }],
};

// ── geraniums: a larch box or a granite pot full of red flowers ──
const res_planter: PropArt = {
  draw(p, k) {
    const pot = k.variant === 'pot';
    const R = rng(k.seed * 17 + 3);
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 10, y + 3, 22, 7, 0.32);
    if (pot) {
      const [cx, cy] = anchor(p, 0.5, 0.5, 0);
      cylinder(p.c, p.k, cx, cy, 0.2, 0, 5, (nx, ny, _a, z, xx, yy) => (z > 4.4 ? '#a8a49a' : GNEISS[toneOf(GNEISS, lightOf(nx, ny, 0), xx, yy, 0.25, 0.75)]));
    } else {
      lbox(p, 0.18, 0.3, 0.64, 0.4, 0, 3.4, mono(grain(LARCHF), LARCHF[0]));
      lbox(p, 0.16, 0.28, 0.68, 0.44, 3.4, 0.5, mono(paint(LARCHF), LARCHF[0]));
    }
    const [tx, ty] = anchor(p, 0.5, 0.5, pot ? 5 : 3.9);
    const masses: Mass[] = [];
    const n = pot ? 4 : 6;
    for (let i = 0; i < n; i++) masses.push({ x: tx + (pot ? (R() - 0.5) * 18 : (i / (n - 1) - 0.5) * 34), y: ty - 6 - R() * 5 + (pot ? 0 : (i / (n - 1) - 0.5) * -14), rx: 8 + R() * 3, ry: 7 + R() * 2, z: i });
    const blooms = k.variant === 'pink' ? ['#e04a7a', '#f07aa0', '#f8b0c8'] : ['#d02a26', '#e8443a', '#f2665a'];
    layer(p.c, (l) => {
      foliage(l, masses, ['#16300f', '#204218', '#2c5620', '#3a6c2a', '#4c8434', '#62983e', '#80b050'], k.seed, { cell: 2.6, dots: [...blooms, '#f6f2ea'], dotChance: 0.8, dotSize: 3 });
      // trailing stems over the rim
      for (let i = 0; i < 5; i++) for (let q = 0; q < 6 + i; q++) px(l, tx - 14 + i * 7 + (q % 3 === 2 ? 1 : 0), ty + q - 2, ['#2c5620', '#3a6c2a'][q & 1]);
    }, { outline: 0.55 });
  },
};

// ── firewood under a little roof ────────────────────────────
const res_woodpile: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.2, W - 0.05, 0.85, 14, 0.28);
    // a stone sill, the stack of split logs showing their end grain, a slab roof on posts
    lbox(p, 0.06, 0.22, W - 0.12, 0.6, 0, 1, mono(paint(CONCRETE), CONCRETE[0]));
    lbox(p, 0.08, 0.26, W - 0.16, 0.5, 1, 11, { front: (light) => (u: number, v: number, x: number, y: number) => {
      // end grain: rings in a grid of rounded log ends
      const cx = Math.floor(u / 7);
      const cy = Math.floor(v / 6.5);
      const ox = cx * 7 + 3.5 + (cy % 2) * 1.5;
      const oy = cy * 6.5 + 3.2;
      const d = Math.hypot(u - ox, (v - oy) * 1.1);
      if (d > 3.4) return '#2a1c12';
      if (d < 1) return '#c49a5a';
      const ring = Math.floor(d * 1.6) % 2;
      return at(['#6a4628', '#8a5e36', '#a87844', '#c49a5a', '#d8b070'], (light ? 3 : 2) + (ring ? 0 : -1) + (hash(cx, cy, 3) < 0.2 ? -1 : 0) + (hash(x, y, 4) < 0.05 ? -1 : 0));
    }, side: (light) => (u: number, v: number) => at(BARKG, (light ? 3 : 1.6) + ((u + v * 0.2) % 5 < 1 ? -1 : 0)), top: (light) => (u: number) => at(['#4a3220', '#5e4028', '#745030'], (light ? 2 : 1) + (u % 6 < 1 ? -1 : 0)), edge: '#2a1c12' });
    for (const a of [0.06, W - 0.14]) lbox(p, a, 0.78, 0.08, 0.08, 0, 14, mono(grain(LARCHF), LARCHF[0]));
    poly3(p, [[-0.05, 0.1, 15.6], [W + 0.05, 0.1, 15.6], [W + 0.05, 1.0, 13.4], [-0.05, 1.0, 13.4]], (u: number, v: number, x: number, y: number) => at(PIODE, 3.6 + ((v % 10) < 1.5 ? -2 : 0) + (hash(Math.floor(u / 20), Math.floor(v / 10), 2) - 0.5) + (hash(x, y, 3) < 0.05 ? -1 : 0)), 2, [[-0.05, 1.0, 13.4], [W + 0.05, 1.0, 13.4], [-0.05, 0.1, 15.6]]);
    // an axe in the chopping block in front
    const [bx, by] = anchor(p, W * 0.8, 0.95, 0);
    layer(p.c, (l) => {
      ell(l, bx, by - 1, 7, 3, BARKG[2]);
      px(l, bx - 7, by - 9, BARKG[3], 14, 8);
      ell(l, bx, by - 9, 7, 3, '#c49a5a');
      ell(l, bx, by - 9, 3, 1.4, '#a87844');
      ln(l, bx + 1, by - 10, bx + 9, by - 22, LARCHF[4], 2);
      fillPoly(l, [[bx - 2, by - 13], [bx + 4, by - 12], [bx + 3, by - 8], [bx - 1, by - 9]], '#9aa0a8');
    });
    void k;
  },
};

// ── a log fountain ──────────────────────────────────────────
const res_trough: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.2, W - 0.05, 0.85, 8, 0.26);
    // the hollowed trunk: bark outside, worn wet wood on the rim, water inside
    lbox(p, 0.12, 0.26, W - 0.24, 0.5, 0, 4.6, { front: (light) => (u: number, v: number, x: number, y: number) => at(BARKG, (light ? 3.2 : 1.8) + (Math.floor(u / 4 + v * 0.3) % 3 === 0 ? -1 : 0) + (v > 15 ? 1 : 0) + (hash(x, y, 2) < 0.08 ? 1 : 0)), side: (light) => (u: number, v: number) => {
      const d = Math.hypot(u - 10, (v - 9) * 1.2);
      return d < 8 ? at(['#6a4628', '#8a5e36', '#a87844', '#c49a5a'], (light ? 2.4 : 1.4) + (Math.floor(d) % 2 ? 0 : -0.6)) : at(BARKG, light ? 2.6 : 1.4);
    }, top: () => (u: number, v: number, x: number, y: number) => {
      // a worn wooden rim round the basin; inside, still water: dark under the near rim,
      // the sky in it further back, a few pale ripple dashes
      const uw = (W - 0.24) * 72;
      if (u < 3.5 || v < 3.5 || u > uw - 4 || v > 31) return u < 2 || v < 2 ? '#6a4a2e' : hash(x, y, 7) < 0.1 ? '#a07a50' : '#8a6a46';
      if (v < 6 || u < 6) return '#24485a';
      if ((((u * 0.5 + v) | 0) % 13) === 0 && v > 10) return '#b8dce8';
      return v > 20 ? '#4a7e96' : '#3a6a82';
    }, edge: BARKG[0] });
    // moss creeping over the rim
    const [ra, rb] = anchor(p, 0.4, 0.74, 4.6);
    for (let i = 0; i < 8; i++) px(p.c, ra + i * 4, rb - i * 2 + (i % 2), i % 3 ? '#4a6a30' : '#5e823c', 3, 2);
    // the spout post with an iron pipe
    lbox(p, 0.02, 0.38, 0.16, 0.26, 0, 13, mono(grain(LARCHF, 'v'), LARCHF[0]));
    const [sx, sy] = p.P(0.18, 0.51, 10.5);
    ln(p.c, sx, sy, sx + 10, sy + 4, IRONK[3], 2);
    // moss on the rim, a puddle where it overflows
    const [mx, my] = anchor(p, W - 0.2, 0.86, 0);
    ell(p.c, mx, my, 14, 4, '#4a6a7a');
    ell(p.c, mx - 3, my - 1, 6, 1.5, '#8ab4c8');
    void k;
  },
  anim(p, k) {
    const [sx, sy] = p.P(0.18, 0.51, 10.5);
    const u = p.k / 4;
    for (let i = 0; i < 7; i++) {
      const t = (k.t * 1.6 + i / 7) % 1;
      p.c.fillStyle = t < 0.2 ? '#ffffff' : '#c8eef6';
      p.c.fillRect(Math.round(sx + 10 * u + t * 3 * u), Math.round(sy + 4 * u + t * t * 22 * u), Math.max(1, Math.round(u)), Math.max(1, Math.round(2 * u)));
    }
    const r = ((k.t * 0.8) % 1) * 7 * u;
    p.c.globalAlpha = 0.5;
    ell(p.c, sx + 13 * u, sy + 27 * u, r + 1, (r + 1) * 0.4, '#e8f8fc');
    p.c.globalAlpha = 1;
  },
};

// ── a terrace table with benches ────────────────────────────
const res_table: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.95, 8, 0.26);
    const wood = grain(LARCHF);
    // the back bench, the table on cross legs, the front bench
    lbox(p, 0.12, 0.08, W - 0.24, 0.2, 4, 0.7, mono(wood, LARCHF[0]));
    for (const a of [0.2, W - 0.28]) lbox(p, a, 0.12, 0.06, 0.12, 0, 4, mono(wood, LARCHF[0]));
    for (const a of [0.24, W - 0.32]) {
      const [x0, y0] = p.P(a, 0.36, 0);
      const [x1, y1] = p.P(a, 0.64, 7);
      const [x2, y2] = p.P(a, 0.64, 0);
      const [x3, y3] = p.P(a, 0.36, 7);
      ln(p.c, x0, y0, x1, y1, LARCHF[2], 3);
      ln(p.c, x2, y2, x3, y3, LARCHF[3], 3);
    }
    lbox(p, 0.06, 0.32, W - 0.12, 0.36, 7, 0.8, { front: wood, side: wood, top: wood, edge: LARCHF[0] });
    // things on the table: a teapot, cups, a map, a pair of binoculars
    const [tx, ty] = anchor(p, W * 0.35, 0.5, 7.8);
    layer(p.c, (l) => {
      ell(l, tx, ty - 5, 5, 4, '#f2eee4');
      px(l, tx - 5, ty - 6, '#3a5aa8', 10, 1);
      ln(l, tx + 4, ty - 5, tx + 8, ty - 8, '#e8e2d4', 2);
      for (const dx of [10, 18]) {
        px(l, tx + dx - 2, ty - 3, '#f6f2e8', 5, 4);
        px(l, tx + dx - 2, ty - 3, '#3a5aa8', 5, 1);
      }
      const [mx, my] = anchor(p, W * 0.72, 0.48, 7.8);
      fillPoly(l, [[mx - 12, my], [mx, my - 6], [mx + 12, my], [mx, my + 6]], '#e8e2c8');
      ln(l, mx - 6, my + 1, mx + 5, my - 3, '#c8382a');
      ln(l, mx - 8, my - 1, mx + 2, my - 4, '#7a9a52');
      ell(l, mx + 14, my - 4, 3, 2, '#2a2a2e');
      ell(l, mx + 18, my - 2, 3, 2, '#2a2a2e');
    });
    lbox(p, 0.12, 0.74, W - 0.24, 0.2, 4, 0.7, mono(wood, LARCHF[0]));
    for (const a of [0.2, W - 0.28]) lbox(p, a, 0.78, 0.06, 0.12, 0, 4, mono(wood, LARCHF[0]));
    void k;
  },
};

// ── a lantern on a larch post ───────────────────────────────
const res_lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 2, 10, 3, 0.26);
    layer(p.c, (l) => {
      px(l, x - 3, y - 70, TIMBER[3], 6, 70);
      px(l, x - 3, y - 70, TIMBER[5], 2, 70);
      px(l, x - 3, y - 72, TIMBER[2], 18, 3);
      ln(l, x + 2, y - 60, x + 10, y - 70, TIMBER[3], 2);
      px(l, x + 10, y - 70, IRONK[3], 2, 4);
      fillPoly(l, [[x + 5, y - 66], [x + 17, y - 66], [x + 15, y - 50], [x + 7, y - 50]], IRONK[2]);
      fillPoly(l, [[x + 7, y - 64], [x + 15, y - 64], [x + 14, y - 52], [x + 8, y - 52]], '#f6d890');
      px(l, x + 9, y - 62, '#fff6d8', 2, 8);
      fillPoly(l, [[x + 3, y - 66], [x + 19, y - 66], [x + 11, y - 74]], IRONK[3]);
    });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const u = p.k / 4;
    p.c.globalAlpha = 0.1 + Math.sin(k.t * 2 + k.seed) * 0.015;
    ell(p.c, x + 11 * u, y - 58 * u, 22 * u, 22 * u, '#ffd890');
    p.c.globalAlpha = 1;
  },
};

// ── a windsock ──────────────────────────────────────────────
const res_windsock: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 6, y + 2, 8, 3, 0.24);
    layer(p.c, (l) => {
      px(l, x - 1, y - 110, STEEL[4], 3, 110);
      px(l, x - 1, y - 110, STEEL[6], 1, 110);
      ell(l, x + 2, y - 108, 3, 5, STEEL[2]);
    });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const u = p.k / 4;
    const sway = Math.sin(k.t * 1.7 + k.seed) * 3;
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const cx = x + (4 + i * 6) * u;
      const cy = y - 108 * u + (t * t * 6 + Math.sin(k.t * 4 - i) * t * 2 + sway * t) * u;
      p.c.fillStyle = i % 2 ? '#f2eee6' : RED[3];
      p.c.fillRect(Math.round(cx), Math.round(cy - (5 - i * 0.6) * u), Math.round(6 * u), Math.round((10 - i * 1.2) * u));
    }
  },
};

// ── skis and snowshoes leaning together ─────────────────────
const res_gear: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.3, 0);
    layer(p.c, (l) => {
      for (const [dx, col] of [[-6, '#c8382a'], [-2, '#c8382a'], [8, '#2a5aa8'], [12, '#2a5aa8']] as const) {
        ln(l, x + dx, y, x + dx + 6, y - 64, col, 2);
        curve(l, x + dx + 6, y - 64, x + dx + 8, y - 68, x + dx + 5, y - 70, col, 2);
      }
      ln(l, x + 2, y + 1, x + 4, y - 50, STEEL[4]);
      ln(l, x + 5, y + 1, x + 6, y - 50, STEEL[4]);
      ell(l, x + 3, y - 6, 3, 1, '#2a2a2e');
      // a wooden snowshoe
      ell(l, x + 22, y - 14, 6, 12, LARCHF[3]);
      ell(l, x + 22, y - 14, 4, 10, '#2a2420');
      for (let i = -8; i <= 8; i += 3) ln(l, x + 18, y - 14 + i, x + 26, y - 14 + i, '#a89878');
    });
    void k;
  },
};

// ── supply crates and a gas bottle ──────────────────────────
const res_crates: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.15, 0.9, 0.9, 10, 0.26);
    const wood = grain(LARCHF);
    lbox(p, 0.12, 0.2, 0.5, 0.5, 0, 4.6, mono(wood, LARCHF[0]));
    lbox(p, 0.18, 0.26, 0.4, 0.4, 4.6, 3.8, mono(wood, LARCHF[0]));
    const F = front(p, 0.7);
    pq(p, F, 0.2, 0.54, 1.6, 2.8, '#2a2a30');
    pq(p, F, 0.24, 0.5, 1.9, 2.5, '#f2eee4');
    // a red gas bottle
    const [gx, gy] = anchor(p, 0.78, 0.66, 0);
    cylinder(p.c, p.k, gx, gy, 0.1, 0, 8, (nx, ny, _a, z, x, y) => (z > 7.2 ? '#8a8e94' : RED[toneOf(RED, lightOf(nx, ny, 0), x, y, 0.3, 0.7)]));
    px(p.c, gx - 2, gy - 38, '#5a5e66', 4, 4);
    void k;
  },
};

// ── a red piste groomer, parked for the summer ──────────────
const res_snowcat: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.02, 0.1, W - 0.02, 0.95, 16, 0.3);
    const red = paint(RED);
    const trk = paint(['#141416', '#1e1e22', '#2a2a2e', '#36363c', '#44444a', '#52525a']);
    // the two tracks with their treads, the chassis between
    for (const b of [0.12, 0.62]) {
      lbox(p, 0.1, b, W - 0.3, 0.26, 0, 3.2, mono(trk, '#0e0e10'));
      const F = front(p, b + 0.26);
      for (let a = 0.16; a < W - 0.24; a += 0.09) pq(p, F, a, a + 0.04, 0.2, 3, '#3e3e44');
      for (const a of [0.3, 0.75, 1.2, W - 0.42]) {
        const [wx, wy] = F.F(a, 1.6);
        ell(p.c, wx, wy, 4, 4, '#5a5a62');
        px(p.c, wx - 1, wy - 1, '#8a8a92', 2, 2);
      }
    }
    lbox(p, 0.2, 0.36, W - 0.5, 0.28, 2.2, 1.6, mono(paint(IRONK), IRONK[0]));
    // the engine hood, the cab with big windows, an orange beacon
    lbox(p, 0.14, 0.18, 0.7, 0.66, 3.4, 4.2, { front: red, side: red, top: paint(RED), edge: RED[0] });
    lbox(p, 0.84, 0.16, 0.86, 0.7, 3.4, 9.6, { front: red, side: red, top: paint(['#c8c8c4', '#dcdcd8', '#ececea', '#f6f6f4', '#fafaf8', '#ffffff']), edge: RED[0] });
    const CF = front(p, 0.86);
    const CS = side(p, 1.7);
    pt(p, CF, 0.9, 1.64, 8, 12.6, glass4(GLASS), 1);
    pt(p, CS, 0.22, 0.8, 7.6, 12.6, glass4(GLASS), 0);
    pq(p, CF, 1.24, 1.27, 8, 12.6, RED[1]);
    const [bx, by] = anchor(p, 1.27, 0.5, 13);
    px(p.c, bx - 2, by - 4, '#e88a1a', 4, 4);
    px(p.c, bx - 1, by - 4, '#ffd060', 1, 2);
    // the front blade, raised
    lbox(p, W - 0.22, 0.02, 0.1, 0.96, 3.2, 4.2, { front: paint(['#5a5e66', '#727680', '#8a8e98', '#a2a6b0', '#babec6', '#d2d6dc']), side: brushed(['#5a5e66', '#727680', '#8a8e98', '#a2a6b0', '#babec6', '#d2d6dc'], 0.8), top: paint(STEEL), edge: STEEL[0] });
    void k;
  },
};

// ── a stack of sawn larch under a tarp ──────────────────────
const res_timber: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.15, W - 0.05, 0.9, 8, 0.26);
    for (const a of [0.2, W - 0.4]) lbox(p, a, 0.18, 0.18, 0.66, 0, 0.8, mono(paint(BARKG), BARKG[0]));
    lbox(p, 0.1, 0.22, W - 0.2, 0.58, 0.8, 5.6, {
      front: (light) => (u: number, v: number, x: number, y: number) => at(LARCHF, (light ? 4 : 3) + ((v % 6) < 1 ? -2 : 0) + ((u + Math.floor(v / 6) * 13) % 37 < 1 ? -1.5 : 0) + (hash(x, y, 4) < 0.05 ? -1 : 0)),
      side: (light) => (u: number, v: number) => {
        const cx = Math.floor(u / 6);
        const cy = Math.floor(v / 6);
        const fu = u - cx * 6;
        const fv = v - cy * 6;
        if (fu < 0.8 || fv < 0.8) return '#3a2a1a';
        return at(['#8a6236', '#a87a46', '#c49a5a', '#d8b070'], (light ? 2.6 : 1.8) + (Math.hypot(fu - 3, fv - 3) < 1.2 ? 0.8 : 0));
      },
      top: (light) => (u: number) => at(LARCHF, (light ? 5 : 4) + ((u % 9) < 1 ? -2 : 0)),
      edge: LARCHF[0],
    });
    // a green tarp thrown over the back half, tied down with a rope
    poly3(p, [[0.06, 0.2, 6.6], [W * 0.62, 0.2, 6.6], [W * 0.62, 0.82, 6.6], [0.06, 0.82, 6.6]], (u: number, v: number) => at(['#1e3a2a', '#284a34', '#325c3e', '#3e6e4a', '#4e8258'], 3 + (Math.sin(u * 0.4 + v * 0.1) > 0.6 ? -1 : 0)), 2);
    poly3(p, [[0.06, 0.82, 6.6], [W * 0.62, 0.82, 6.6], [W * 0.62, 0.86, 2.4], [0.06, 0.86, 3]], (u: number) => at(['#1e3a2a', '#284a34', '#325c3e', '#3e6e4a', '#4e8258'], 2 + (Math.sin(u * 0.5) > 0.5 ? 1 : 0)), 1);
    const [r0x, r0y] = p.P(W * 0.3, 0.85, 1.6);
    const [r1x, r1y] = p.P(W * 0.3, 0.2, 6.8);
    ln(p.c, r0x, r0y, r1x, r1y, '#c8b890');
    void k;
  },
};

// ── a notice board with a little roof ───────────────────────
const res_board: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 10, y + 3, 16, 5, 0.26);
    layer(p.c, (l) => {
      for (const dx of [-14, 12]) {
        px(l, x + dx, y - 56, TIMBER[3], 3, 56);
        px(l, x + dx, y - 56, TIMBER[5], 1, 56);
      }
      fillPoly(l, [[x - 18, y - 52], [x + 17, y - 52], [x + 17, y - 22], [x - 18, y - 22]], TIMBER[2]);
      fillPoly(l, [[x - 16, y - 50], [x + 15, y - 50], [x + 15, y - 24], [x - 16, y - 24]], '#e8dcbc');
      // a map of the summit's paths, a poster about the night sky, a weather sheet
      fillPoly(l, [[x - 14, y - 48], [x - 1, y - 48], [x - 1, y - 30], [x - 14, y - 30]], '#d6e0b4');
      ln(l, x - 12, y - 34, x - 4, y - 44, '#c8382a');
      ln(l, x - 12, y - 40, x - 6, y - 38, '#a8845a');
      fillPoly(l, [[x + 1, y - 48], [x + 13, y - 48], [x + 13, y - 38], [x + 1, y - 38]], '#1a2446');
      for (let i = 0; i < 6; i++) px(l, x + 2 + ((i * 5) % 10), y - 47 + i * 1.4, '#fff6d8');
      fillPoly(l, [[x + 1, y - 36], [x + 13, y - 36], [x + 13, y - 27], [x + 1, y - 27]], '#fbf6e8');
      for (let i = 0; i < 3; i++) ln(l, x + 3, y - 34 + i * 2.5, x + 11, y - 34 + i * 2.5, '#8a8070');
      // the shingled roof
      fillPoly(l, [[x - 22, y - 52], [x + 21, y - 52], [x + 17, y - 62], [x - 18, y - 62]], PIODE[3]);
      fillPoly(l, [[x - 22, y - 52], [x + 21, y - 52], [x + 21, y - 54], [x - 22, y - 54]], PIODE[1]);
    });
    void k;
  },
};

// ── an alpine slat fence: split larch slats leaning on paired posts ──
const res_fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const grey: Ramp = ['#3e3a36', '#56504a', '#6e6860', '#8a847a', '#a69e92', '#c0b8aa'];
    const R = rng(k.seed * 3 + 1);
    // the slats: long diagonals, overlapping, weathered silver
    layer(p.c, (l) => {
      for (let a = 0.04; a < W - 0.1; a += 0.13) {
        const [x0, y0] = p.P(a, 0.5, 0.4);
        const [x1, y1] = p.P(a + 0.32, 0.5, 9.5 + R() * 1.4);
        ln(l, x0, y0, x1, y1, grey[3 + (R() < 0.3 ? 1 : 0)], 2);
        ln(l, x0 - 1, y0, x1 - 1, y1, grey[5]);
      }
      // paired posts every half tile with withy bands
      for (let a = 0.02; a <= W - 0.02; a += 0.5) {
        for (const off of [-0.04, 0.04]) {
          const [x0, y0] = p.P(a, 0.5 + off, 0);
          px(l, x0 - 1, y0 - 44, grey[2], 3, 44);
          px(l, x0 - 1, y0 - 44, grey[4], 1, 44);
        }
        const [bx, by] = p.P(a, 0.5, 7);
        px(l, bx - 4, by, '#6a5a3a', 8, 2);
      }
    }, { outline: 0.5 });
  },
};

// ── flat details of the ground ──────────────────────────────
const res_decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'stones';
    const [x, y] = anchor(p, 0.5 * p.pw, 0.5 * p.pd);
    const c = p.c;
    const R = rng(k.seed * 7 + 3);
    if (v === 'burrow') {
      // a marmot burrow: a dark hole under a fan of dug earth and stones
      ell(c, x + 6, y + 3, 22, 8, '#6a5238');
      ell(c, x + 4, y + 2, 16, 5, '#7e6444');
      for (let i = 0; i < 8; i++) px(c, x - 8 + R() * 30, y - 2 + R() * 8, '#9a948a', 3, 2);
      ell(c, x - 6, y - 2, 7, 4, '#1a120c');
      ell(c, x - 7, y - 3, 4, 2, '#2e2016');
    } else if (v === 'stones') {
      for (let i = 0; i < 9; i++) {
        const sx = x + (R() - 0.5) * 80;
        const sy = y + (R() - 0.5) * 34;
        const w = 3 + Math.floor(R() * 4);
        px(c, sx, sy, '#a8a49c', w, 1);
        px(c, sx, sy + 1, '#6a6862', w, 1);
        px(c, sx + w, sy + 1, '#3a3632', 1, 1);
      }
    } else if (v === 'snow') {
      ell(c, x + 2, y + 1, 30, 9, '#8a9ab4');
      ell(c, x, y, 28, 8, '#d8e4f0');
      ell(c, x - 6, y - 2, 14, 3, '#f4f8fc');
      for (let i = 0; i < 6; i++) px(c, x - 20 + R() * 40, y - 4 + R() * 8, '#b0bccc', 2, 1);
    } else if (v === 'tracks') {
      // tyre tracks in the gravel
      for (const off of [0.32, 0.68]) {
        const [x0, y0] = p.P(0, off * p.pd);
        const [x1, y1] = p.P(p.pw, off * p.pd);
        ln(c, x0, y0 + 1, x1, y1 + 1, '#6e6456');
        ln(c, x0, y0, x1, y1, '#7c7262');
        for (let i = 0; i < 14; i++) {
          const t = i / 14;
          px(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 1, '#a49882', 2, 1);
        }
      }
    } else if (v === 'needles') {
      for (let i = 0; i < 30; i++) {
        const sx = x + (R() - 0.5) * 90;
        const sy = y + (R() - 0.5) * 40;
        ln(c, sx, sy, sx + 3, sy - 1 + R() * 2, ['#8a6234', '#a07a3e', '#c4a050'][i % 3]);
      }
    } else if (v === 'slab' || v === 'snowfield') {
      // an organic patch filling the footprint: polished granite with cracks and lichen, or old snow
      const rx = (p.pw + p.pd) * 26;
      const ry = (p.pw + p.pd) * 12;
      const ph = R() * 6;
      const snow = v === 'snowfield';
      for (let yy = Math.floor(-ry * 1.3); yy <= ry * 1.3; yy++)
        for (let xx = Math.floor(-rx * 1.3); xx <= rx * 1.3; xx++) {
          const a = Math.atan2(yy / ry, xx / rx);
          const rr = 1 + 0.16 * Math.sin(3 * a + ph) + 0.09 * Math.sin(7 * a + ph * 2);
          const d = Math.hypot(xx / rx, yy / ry) / rr;
          if (d > 1) continue;
          const X = x + xx;
          const Y = y + yy;
          let col: string;
          if (snow) {
            if (d > 0.93) col = (X + Y) & 1 ? '#7a7c74' : '#9aa0a4';
            else {
              const sh = xx / rx + yy / ry > 0.55 + (d - 0.7);
              let i = sh ? 2 : 4;
              if (((X >> 1) + Y * 3) % 11 === 0) i -= 1;
              if (hash(X, Y, 3) < 0.03) i -= 1;
              col = ['#8a9ab4', '#a6b4ca', '#c0cede', '#d8e2ee', '#eef3f8', '#f8fbfd'][Math.max(0, i)];
            }
          } else {
            if (d > 0.94) col = '#3a3c3a';
            else {
              let i = 3 + (-xx / rx - yy / ry) * 0.8 + (hash(X >> 2, Y >> 2, 4) - 0.5);
              if (Math.abs(Math.sin(xx * 0.08 + yy * 0.21 + ph)) < 0.05) i -= 2;
              if (hash(X >> 1, Y >> 1, 5) < 0.05) {
                c.fillStyle = ['#b4a83c', '#c8843a', '#9aa070'][Math.floor(hash(X >> 2, Y, 6) * 3)];
                c.fillRect(X, Y, 1, 1);
                continue;
              }
              col = ['#4e4e50', '#626262', '#787774', '#8e8c88', '#a4a29c', '#bab6ae'][Math.max(0, Math.min(5, Math.round(i)))];
            }
          }
          c.fillStyle = col;
          c.fillRect(X, Y, 1, 1);
        }
    } else if (v === 'puddle') {
      ell(c, x + 1, y + 1, 24, 8, '#3a3a40');
      ell(c, x, y, 22, 7, '#6a8aa6');
      ell(c, x - 6, y - 2, 10, 2, '#b8d4e6');
    } else if (v === 'flowers') {
      for (let i = 0; i < 16; i++) {
        const sx = x + (R() - 0.5) * 80;
        const sy = y + (R() - 0.5) * 34;
        const col = ['#3050c8', '#f0c830', '#f2eee2', '#d0406a'][(k.seed + Math.floor(i / 5)) % 4];
        px(c, sx - 1, sy, col, 3, 1);
        px(c, sx, sy - 1, col, 1, 3);
      }
    } else {
      // moss and lichen on a flat rock
      ell(c, x + 2, y + 1, 26, 9, '#4a4a4c');
      ell(c, x, y, 24, 8, '#8a8986');
      ell(c, x - 6, y - 2, 12, 3, '#a8a49c');
      for (let i = 0; i < 8; i++) dotFruit(c, x - 16 + R() * 32, y - 4 + R() * 8, ['#b4a83c', '#c8843a', '#9aa070'][i % 3], 3);
    }
  },
};

export const RESEARCH_OUTSIDE: Record<string, PropArt> = {
  res_drywall,
  res_snowpole,
  res_signpost,
  res_bench,
  res_scope,
  res_railing,
  res_orient,
  res_jeep,
  res_woodpile,
  res_trough,
  res_table,
  res_lamp,
  res_windsock,
  res_gear,
  res_crates,
  res_snowcat,
  res_flag,
  res_planter,
  res_mast,
  res_timber,
  res_board,
  res_fence,
  res_decal,
};
export { darken, lighten };

// Office — life on the piazza: plane trees, cast-iron lamps, a baroque
// fountain, the newsstand, market stalls, a café terrace, planters, benches,
// bicycles, scooters, a three-wheeler, a drinking fountain, the tram stop and
// the tram, bollards, a menu board — and the flat details of the paving.
import { darken, lighten } from '../../../color';
import type { PropArt } from '../../../props';
import { contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, R, type Ramp, rng } from '../../kit4';
import { cutStone4, glass4 } from '../../materials4';
import { front, pq, pt, side } from '../../plane4';
import { brushed, grain, paint, twill } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';

const IRON: Ramp = ['#14141a', '#1e1e26', '#2a2a34', '#383844', '#484856', '#5a5a6a'];
const GREEN: Ramp = ['#14281e', '#1c3828', '#264834', '#305a40', '#3c6c4c', '#4c7e5a'];
const TRAV: Ramp = ['#9a8a6e', '#b0a084', '#c4b598', '#d4c6aa', '#e2d6bc', '#eee4ce'];
const PLANE: Ramp = ['#1e3a20', '#284a26', '#335c2c', '#3f6e32', '#4e823a', '#629644', '#7aaa52'];
const BARKP: Ramp = ['#4a4a3e', '#6a6a58', '#8a8a72', '#a8a68a', '#c4c0a2', '#dcd8bc'];

// ── plane tree (platano): mottled bark, a broad high crown ──
const platano: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 97 + 5);
    const s = 0.95 + Rn() * 0.25;
    const rx = 150 * s;
    const ry = 104 * s;
    const cz = 140 * s;
    const cy = y - cz;
    contactShadow(c, x + 40 * s, y + 10, rx * 1.1, ry * 0.42, 0.34);
    // the trunk: pale, flaking in olive and cream patches
    layer(c, (l) => {
      const H = cz - ry * 0.35;
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const ww = 40 * s * (1 - t * 0.35);
        const cx = x + Math.sin(t * 2.4 + k.seed) * 3;
        for (let i = 0; i < ww; i++) {
          const u = i / ww;
          let tone = u < 0.25 ? 3 : u < 0.55 ? 2 : u < 0.8 ? 1 : 0;
          // flaking bark: rounded cream and olive plates over grey (noise, not blocks)
          const n = noise2((cx - ww / 2 + i) * 0.16 + k.seed, (y - j) * 0.09, 7);
          if (n > 0.68) tone += 2;
          else if (n > 0.55) tone += 1;
          else if (n < 0.24) tone -= 1;
          if (Math.abs(n - 0.68) < 0.015 || Math.abs(n - 0.55) < 0.012) tone -= 1;
          px(l, cx - ww / 2 + i, y - j, BARKP[Math.max(0, Math.min(5, tone))]);
        }
      }
      // two big limbs into the crown
      for (const [dx, dy] of [[-0.45, -0.25], [0.4, -0.35], [0.05, -0.6]] as const) {
        ln(l, x, cy + ry * 0.55, x + dx * rx, cy + dy * ry, BARKP[2], 7);
        ln(l, x - 2, cy + ry * 0.55, x + dx * rx - 2, cy + dy * ry, BARKP[4], 2);
      }
    });
    // crown: three or four separate lobes on the limbs, irregular, gaps between them
    const masses: Mass[] = [];
    const lobes = 3 + Math.floor(Rn() * 2);
    for (let i = 0; i < lobes; i++) {
      const a = -Math.PI * 0.95 + (i / (lobes - 1)) * Math.PI * 0.9 + (Rn() - 0.5) * 0.35;
      const lx = x + Math.cos(a) * rx * 0.48;
      const ly = cy + Math.sin(a) * ry * 0.42 + ry * 0.05;
      masses.push({ x: lx, y: ly, rx: rx * (0.42 + Rn() * 0.1), ry: ry * (0.4 + Rn() * 0.08) });
      for (let j = 0; j < 3; j++) masses.push({ x: lx + (Rn() - 0.5) * rx * 0.5, y: ly + (Rn() - 0.3) * ry * 0.4, rx: rx * (0.2 + Rn() * 0.1), ry: ry * (0.18 + Rn() * 0.08) });
    }
    masses.push({ x: x + (Rn() - 0.5) * rx * 0.3, y: cy - ry * 0.35, rx: rx * 0.36, ry: ry * 0.3 });
    for (const m of masses) m.z = m.y + m.ry * 0.3;
    layer(c, (l) => foliage(l, masses, PLANE, k.seed, { cell: 8, holes: 0.08, tilt: 0.16, dots: ['#a8a060', '#8a8a4a'], dotChance: 0.05, dotSize: 3 }));
    // seed balls hanging, a few fallen leaves
    const fr = rng(k.seed + 4);
    for (let i = 0; i < 8; i++) px(c, x + (fr() - 0.3) * rx * 1.2, y + (fr() - 0.4) * 20, ['#c8a050', '#a87a3a', '#d8b860'][i % 3], 3, 2);
  },
};

// ── cast-iron street lamp with three lanterns ───────────────
const lampione: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 14, 5, 0.28);
    layer(p.c, (l) => {
      // fluted base, a tall post, a scrolled crown with three lanterns
      fillPoly(l, [[x - 8, y], [x + 8, y], [x + 6, y - 14], [x - 6, y - 14]], IRON[2]);
      px(l, x - 6, y - 14, IRON[3], 2, 14);
      px(l, x - 3, y - 120, IRON[2], 6, 106);
      px(l, x - 3, y - 120, IRON[4], 2, 106);
      for (const z of [40, 80]) px(l, x - 4, y - z, IRON[3], 8, 3);
      for (const s of [-1, 1]) {
        curve(l, x, y - 120, x + s * 10, y - 132, x + s * 18, y - 124, IRON[2], 2);
        curve(l, x + s * 18, y - 124, x + s * 22, y - 118, x + s * 18, y - 114, IRON[2], 2);
      }
      const lantern = (lx: number, ly: number) => {
        fillPoly(l, [[lx - 6, ly - 14], [lx + 6, ly - 14], [lx + 4, ly], [lx - 4, ly]], IRON[1]);
        fillPoly(l, [[lx - 5, ly - 13], [lx + 5, ly - 13], [lx + 3, ly - 1], [lx - 3, ly - 1]], '#f6e0a0');
        px(l, lx - 2, ly - 12, '#fff8dc', 2, 9);
        fillPoly(l, [[lx - 8, ly - 14], [lx + 8, ly - 14], [lx, ly - 22]], IRON[2]);
        px(l, lx - 1, ly - 25, IRON[3], 2, 3);
      };
      lantern(x - 18, y - 104);
      lantern(x + 18, y - 104);
      lantern(x, y - 128);
    });
    void k;
  },
};

// ── the baroque fountain: a lobed basin, a rock with a Triton blowing a shell ──
const fontana: PropArt = {
  draw(p, k) {
    const [cx, cy] = anchor(p, k.w / 2, k.d / 2);
    const K = (p.k / 4) * (k.w / 3);
    contactShadow(p.c, cx + 30 * K, cy + 10 * K, 150 * K, 60 * K, 0.28);
    layer(p.c, (l) => {
      // a quatrefoil basin: four overlapping lobes, a moulded travertine rim
      const lobes: [number, number][] = [[-48, 0], [48, 0], [0, -24], [0, 24]];
      const rim = 70 * K;
      const inside = (x: number, y: number, grow: number) => lobes.some(([lx, ly]) => ((x - lx * K) / (rim * 0.62 + grow)) ** 2 + ((y - ly * K) / (rim * 0.31 + grow * 0.5)) ** 2 <= 1);
      const H = 14 * K;
      for (let y = -70 * K; y <= 70 * K; y++)
        for (let x = -130 * K; x <= 130 * K; x++) {
          if (!inside(x, y, 6 * K)) continue;
          // the outer wall below the rim (visible where the lobe's lower edge is)
          const inRim = inside(x, y, 0);
          const inWater = inside(x, y, -6 * K);
          if (inWater) {
            const d = Math.hypot(x / 1.6, y);
            let i = d < 30 * K ? 1 : d < 60 * K ? 2 : 3;
            if ((x + y * 3 + 400) % 23 < 2) i += 2;
            px(l, cx + x, cy + y - H + 4 * K, R.water[Math.min(6, i)]);
          } else if (inRim) {
            const lit = x < 0 || y < 0;
            px(l, cx + x, cy + y - H, TRAV[lit ? 5 : 3]);
          } else {
            // the rim's outer roll and the wall below it
            px(l, cx + x, cy + y - H, TRAV[2]);
            for (let j = 1; j < H && !inside(x, y + j, 6 * K); j++) {
              const t = (x + 130 * K) / (260 * K);
              px(l, cx + x, cy + y - H + j, TRAV[t < 0.4 ? 3 : t < 0.7 ? 2 : 1] + '');
            }
          }
        }
      // the rock in the middle, the Triton kneeling on it, blowing a shell skyward
      const rk = [
        { x: cx, y: cy - 30 * K, rx: 30 * K, ry: 22 * K, z: 1 },
        { x: cx - 16 * K, y: cy - 22 * K, rx: 18 * K, ry: 14 * K, z: 2 },
        { x: cx + 16 * K, y: cy - 20 * K, rx: 16 * K, ry: 13 * K, z: 2 },
      ];
      foliage(l, rk, ['#6a6258', '#827a6e', '#9a9284', '#b0a898', '#c4bcac', '#d6cfc0', '#e4dece'], k.seed, { cell: 7 * K, tilt: 0.2 });
      const bronze: Ramp = ['#2a3a32', '#38504a', '#4a665c', '#5c7c70', '#749484', '#94b0a0'];
      const tx = cx;
      const ty = cy - 52 * K;
      // torso, head, arms raised holding the shell; a fish tail curled on the rock
      fillPoly(l, [[tx - 10 * K, ty + 6 * K], [tx + 10 * K, ty + 6 * K], [tx + 8 * K, ty - 22 * K], [tx - 8 * K, ty - 22 * K]], bronze[2]);
      fillPoly(l, [[tx - 10 * K, ty + 6 * K], [tx - 4 * K, ty + 6 * K], [tx - 3 * K, ty - 22 * K], [tx - 8 * K, ty - 22 * K]], bronze[4]);
      ell(l, tx, ty - 28 * K, 6 * K, 7 * K, bronze[3]);
      ell(l, tx - 2 * K, ty - 30 * K, 3 * K, 3 * K, bronze[5]);
      ln(l, tx - 7 * K, ty - 20 * K, tx - 4 * K, ty - 40 * K, bronze[3], Math.round(4 * K));
      ln(l, tx + 7 * K, ty - 20 * K, tx + 6 * K, ty - 40 * K, bronze[2], Math.round(4 * K));
      fillPoly(l, [[tx - 6 * K, ty - 40 * K], [tx + 8 * K, ty - 40 * K], [tx + 4 * K, ty - 52 * K], [tx - 2 * K, ty - 50 * K]], bronze[4]);
      curve(l, tx + 8 * K, ty + 4 * K, tx + 26 * K, ty + 2 * K, tx + 22 * K, ty - 14 * K, bronze[2], Math.round(5 * K));
      fillPoly(l, [[tx + 18 * K, ty - 14 * K], [tx + 28 * K, ty - 20 * K], [tx + 24 * K, ty - 8 * K]], bronze[3]);
      // dolphins at the rock's foot spouting into the basin
      for (const s of [-1, 1]) {
        const dx2 = cx + s * 30 * K;
        const dy2 = cy - 16 * K;
        curve(l, dx2, dy2, dx2 + s * 8 * K, dy2 - 12 * K, dx2 + s * 2 * K, dy2 - 20 * K, bronze[2], Math.round(5 * K));
        ell(l, dx2 + s * 2 * K, dy2 + 2 * K, 5 * K, 4 * K, bronze[3]);
      }
    });
  },
  anim(p, k) {
    const [cx, cy] = anchor(p, k.w / 2, k.d / 2);
    const K = (p.k / 4) * (k.w / 3);
    // the jet from the shell: a column that rises and falls back in drops
    const top = cy - 104 * K - Math.sin(k.t * 3) * 4 * K;
    for (let i = 0; i < 26; i++) {
      const t = (k.t * 1.4 + i / 26) % 1;
      const yy = top + (cy - 40 * K - top) * t * t;
      const xx = cx + (i % 2 ? 1 : -1) * t * 18 * K;
      px(p.c, xx, yy, t < 0.2 ? '#ffffff' : '#c8eef6', Math.max(1, K), Math.max(1, 2 * K));
    }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const t = (k.t * 1.8 + i / 10) % 1;
        px(p.c, cx + s * (34 + t * 26) * K, cy - 34 * K + t * t * 22 * K, '#d8f2f8', Math.max(1, K), Math.max(1, K));
      }
    }
    p.c.globalAlpha = 0.4;
    for (let r = 0; r < 2; r++) {
      const t = (k.t * 0.6 + r / 2) % 1;
      for (let a = 0; a < 36; a++) {
        const ang = (a / 36) * Math.PI * 2;
        px(p.c, cx + Math.cos(ang) * (40 + t * 50) * K, cy - 10 * K + Math.sin(ang) * (18 + t * 22) * K, '#e8fafc', Math.max(1, K), Math.max(1, K));
      }
    }
    p.c.globalAlpha = 1;
  },
};

// ── the newsstand (edicola) ─────────────────────────────────
const edicola: PropArt = {
  draw(p, k) {
    footShadow(p, 0.05, 0.1, k.w - 0.05, k.d - 0.05, 30, 0.28);
    const W = k.w;
    const D = k.d;
    const g = paint(GREEN);
    lbox(p, 0.15, 0.2, W - 0.3, D - 0.4, 0, 26, { front: g, side: g, top: g, edge: GREEN[0] });
    // the shutters open: magazines racked on the front, posters on the side
    const F = front(p, D - 0.2);
    const S = side(p, W - 0.15);
    const Rn = rng(k.seed + 3);
    for (let row = 0; row < 3; row++)
      for (let a = 0.3; a < W - 0.35; a += 0.22) {
        const z = 4 + row * 6.5;
        const c = ['#c8382a', '#f2c42a', '#2a5aa8', '#fbf8f2', '#3fb68b', '#e8577a', '#1e1e24'][Math.floor(Rn() * 7)];
        pq(p, F, a, a + 0.18, z, z + 5.4, c);
        pq(p, F, a + 0.02, a + 0.16, z + 3.6, z + 5, lighten(c, 0.35));
        pq(p, F, a + 0.03, a + 0.12, z + 1, z + 2, '#2a2a30');
      }
    for (let i = 0; i < 3; i++) {
      const u = 0.35 + i * ((D - 0.7) / 3);
      pq(p, S, u, u + (D - 0.9) / 3, 8, 22, ['#f2ead6', '#e2553b', '#2e4a6a'][i]);
      pq(p, S, u + 0.05, u + 0.25, 16, 20, ['#2a2a30', '#fbf8f2', '#f2c42a'][i]);
    }
    // the roof: a projecting canopy with a scalloped tin edge and a sign
    lbox(p, -0.1, -0.05, W + 0.2, D + 0.15, 26, 2.2, { front: g, side: g, top: g, edge: GREEN[0] });
    const [x0, y0] = p.P(-0.1, D + 0.1, 26);
    const [x1, y1] = p.P(W + 0.1, D + 0.1, 26);
    for (let i = 0; i < 16; i++) {
      const t = (i + 0.5) / 16;
      ell(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 2, 3, 2, GREEN[2]);
    }
    pq(p, F, 0.4, W - 0.4, 28.2, 32, '#f2ead6');
    for (let q = 0; q < 6; q++) pq(p, F, 0.6 + q * ((W - 1.2) / 6), 0.6 + q * ((W - 1.2) / 6) + 0.12, 29, 31, '#14281e');
    // a rack of newspapers on the pavement and a stool
    lbox(p, W - 0.1, 0.4, 0.3, D - 0.8, 0, 6, mono(paint(IRON), IRON[0]));
    for (let i = 0; i < 4; i++) {
      const [nx, ny] = p.P(W + 0.05, 0.5 + i * ((D - 1) / 4), 6);
      px(p.c, nx - 3, ny - 8, i % 2 ? '#e8e2d2' : '#d8d0bc', 7, 8);
      px(p.c, nx - 2, ny - 7, '#3a3a40', 5, 1);
    }
  },
};

// ── market stalls ───────────────────────────────────────────
const bancarella: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? ['frutta', 'fiori', 'libri'][k.seed % 3];
    footShadow(p, 0.05, 0.1, W - 0.05, 0.95, 18, 0.26);
    const wood = grain(['#3d2617', '#5a3a22', '#7a5230', '#9a6b40', '#b88752', '#d2a46a']);
    // trestle table, crates, a striped canopy on poles
    for (const a of [0.15, W - 0.2]) for (const b of [0.2, 0.85]) lbox(p, a, b, 0.05, 0.05, 0, 22, mono(paint(IRON), IRON[0]));
    lbox(p, 0.1, 0.18, W - 0.2, 0.74, 7.5, 0.6, { front: wood, side: wood, top: wood, edge: '#3d2617' });
    lbox(p, 0.12, 0.25, W - 0.24, 0.6, 0, 7.5, { front: twill(['#4a4038', '#5e5248', '#72665a', '#887a6c', '#9c8e7e', '#b0a292']), side: twill(['#4a4038', '#5e5248', '#72665a', '#887a6c', '#9c8e7e', '#b0a292']), top: wood, edge: '#3a3028' });
    const Rn = rng(k.seed * 5 + 1);
    const top = 8.1;
    if (v === 'frutta') {
      // crates heaped with oranges, lemons, apples, grapes, artichokes, with chalk price tags
      const fruits = ['#f08a2e', '#f2d240', '#c8382a', '#6a3a8a', '#7aa04a', '#e8577a'];
      for (let i = 0; i < Math.round(W * 3); i++) {
        const a = 0.25 + (i * (W - 0.5)) / Math.round(W * 3);
        const b = i % 2 ? 0.38 : 0.66;
        lbox(p, a - 0.14, b - 0.12, 0.28, 0.24, top, 1.4, mono(wood, '#3d2617'));
        const [fx, fy] = anchor(p, a, b, top + 1.4);
        const col = fruits[Math.floor(Rn() * fruits.length)];
        layer(p.c, (l) => {
          for (let q = 0; q < 9; q++) dotFruit(l, fx - 8 + (q % 3) * 5 + (Math.floor(q / 3) % 2) * 2, fy - 2 - Math.floor(q / 3) * 3, col, 5);
        });
        if (i % 2 === 0) {
          const [tx, ty] = anchor(p, a, b + 0.13, top + 1.4);
          px(p.c, tx - 4, ty - 4, '#2a2a2e', 8, 5);
          px(p.c, tx - 3, ty - 3, '#f2ead6', 5, 1);
        }
      }
    } else if (v === 'fiori') {
      // zinc buckets of tulips, sunflowers, lavender, roses, and potted herbs
      for (let i = 0; i < Math.round(W * 3); i++) {
        const a = 0.25 + (i * (W - 0.5)) / Math.round(W * 3);
        const b = i % 2 ? 0.4 : 0.68;
        const [bx, by] = anchor(p, a, b, top);
        const col = ['#e8577a', '#f2b33a', '#9a7ad8', '#d8302a', '#fbf7ee', '#f08ab4'][Math.floor(Rn() * 6)];
        layer(p.c, (l) => {
          fillPoly(l, [[bx - 7, by - 12], [bx + 7, by - 12], [bx + 5, by], [bx - 5, by]], '#9aa0a8');
          px(l, bx - 7, by - 13, '#c8ccd2', 14, 2);
          for (let q = 0; q < 9; q++) {
            const sx = bx - 6 + q * 1.5;
            const h = 14 + (q % 3) * 4;
            ln(l, sx + 1, by - 12, sx, by - 12 - h, R.birch[3]);
            ell(l, sx, by - 13 - h, 2.4, 2.4, col);
            px(l, sx - 1, by - 15 - h, lighten(col, 0.4));
          }
        }, { outline: 0.55 });
      }
    } else {
      // second-hand books in rows and boxes, a few prints pegged to the canopy pole
      for (let r2 = 0; r2 < 2; r2++) {
        let a = 0.2;
        const b = r2 ? 0.66 : 0.38;
        while (a < W - 0.3) {
          const w = 0.05 + Rn() * 0.04;
          const c = ['#7a3a2a', '#2e4a6a', '#c8a050', '#3a5a3a', '#e8dcc6', '#8a2a3a', '#4a3a5a'][Math.floor(Rn() * 7)];
          lbox(p, a, b - 0.1, w, 0.2, top, 2.4 + Rn() * 0.9, mono(paint([darken(c, 0.4), darken(c, 0.25), darken(c, 0.1), c, lighten(c, 0.15), lighten(c, 0.3)]), darken(c, 0.5)));
          a += w + 0.006;
        }
      }
    }
    // the canopy: striped cotton, sagging a little, a scalloped valance
    const cz = 22;
    const stripes = v === 'fiori' ? ['#e8577a', '#fbf2e6'] : v === 'libri' ? ['#2e4a6a', '#e8dcc6'] : ['#c8382a', '#fbf2e6'];
    const n = Math.round(W * 5);
    for (let i = 0; i < n; i++) {
      const a0 = -0.05 + ((W + 0.1) * i) / n;
      const a1 = -0.05 + ((W + 0.1) * (i + 1)) / n;
      const q = [p.P(a0, 0.1, cz + 2), p.P(a1, 0.1, cz + 2), p.P(a1, 1.05, cz - 1.5), p.P(a0, 1.05, cz - 1.5)];
      fillPoly(p.c, q, stripes[i % 2]);
      const e0 = p.P(a0, 1.05, cz - 1.5);
      const e1 = p.P(a1, 1.05, cz - 1.5);
      fillPoly(p.c, [e0, e1, [e1[0], e1[1] + 5], [(e0[0] + e1[0]) / 2, e0[1] + 8], [e0[0], e0[1] + 5]], darken(stripes[i % 2], 0.12));
    }
  },
};

// ── café terrace: a table, chairs and an umbrella ───────────
/** A rattan bistro chair seen from the front (f = 1) or from behind (f = -1). */
function bistroChair(l: CanvasRenderingContext2D, cx: number, cy: number, f: number) {
  ln(l, cx - 5, cy, cx - 4, cy - 12, '#6a4a2a', 2);
  ln(l, cx + 5, cy, cx + 4, cy - 12, '#6a4a2a', 2);
  ell(l, cx, cy - 13, 7, 3.5, '#c8a070');
  ell(l, cx - 1, cy - 14, 6, 2.5, '#e0bc8a');
  const bx = cx + f * 3;
  fillPoly(l, [[bx - 6, cy - 14], [bx + 6, cy - 14], [bx + 6, cy - 26], [bx - 6, cy - 26]], f > 0 ? '#b8905a' : '#a07a48');
  for (let i = 0; i < 4; i++) ln(l, bx - 5, cy - 16 - i * 3, bx + 5, cy - 16 - i * 3, '#d8b078');
  px(l, bx - 6, cy - 27, '#6a4a2a', 12, 2);
}

const tavolino: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 26, 9, 0.24);
    const Rn = rng(k.seed * 3 + 1);
    // two chairs behind the table, the table, one chair in front
    layer(p.c, (l) => {
      bistroChair(l, x - 16, y - 6, 1);
      bistroChair(l, x + 14, y - 8, -1);
    });
    layer(p.c, (l) => {
      // cast-iron pedestal, a round marble top, two espresso cups and a little vase
      fillPoly(l, [[x - 7, y], [x + 7, y], [x + 4, y - 4], [x - 4, y - 4]], IRON[2]);
      px(l, x - 1, y - 28, IRON[3], 3, 24);
      ell(l, x, y - 29, 14, 7, '#9a958e');
      ell(l, x, y - 30, 14, 7, '#ece8e0');
      ell(l, x - 4, y - 32, 7, 3, '#f8f6f0');
      px(l, x - 7, y - 34, '#fbf8f2', 4, 3);
      px(l, x + 3, y - 33, '#fbf8f2', 4, 3);
      px(l, x - 6, y - 35, '#4a2e1e', 2, 1);
      px(l, x, y - 38, '#e8f2f6', 3, 6);
      dotFruit(l, x + 1, y - 40, Rn() < 0.5 ? '#e8577a' : '#f2c42a', 3);
    });
    layer(p.c, (l) => bistroChair(l, x + 14, y + 6, -1));
    // the umbrella: cream canvas with green trim, on a wooden pole
    layer(p.c, (l) => {
      px(l, x - 1, y - 76, '#8a6a46', 3, 46);
      const R0 = 46;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        const pts: [number, number][] = [
          [x, y - 84],
          [x + Math.cos(a0) * R0, y - 66 + Math.sin(a0) * R0 * 0.45],
          [x + Math.cos(a1) * R0, y - 66 + Math.sin(a1) * R0 * 0.45],
        ];
        const lit = Math.cos((a0 + a1) / 2 + 2.3) > 0;
        fillPoly(l, pts, i % 2 ? (lit ? '#f4ecd8' : '#d8ccb2') : lit ? '#e8dcc0' : '#c8bca2');
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        px(l, x + Math.cos(a) * R0 - 1, y - 66 + Math.sin(a) * R0 * 0.45, '#2e6a4a', 3, 4);
      }
      px(l, x - 1, y - 88, '#8a6a46', 3, 5);
    });
  },
};

// ── planter with clipped box and lavender ───────────────────
const fioriera: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.2, W - 0.08, 0.8, 6, 0.24);
    const T = cutStone4(TRAV, 4);
    lbox(p, 0.08, 0.22, W - 0.16, 0.56, 0, 5.4, { front: T, side: T, top: T, edge: TRAV[0] });
    const Rn = rng(k.seed + 2);
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let a = 0.25; a < W - 0.2; a += 0.28) {
        const [x, y] = p.P(a, 0.5, 5.4);
        masses.push({ x, y: y - 7, rx: 11, ry: 9, z: y });
      }
      foliage(l, masses, R.hedge, k.seed, { cell: 3, tilt: 0.12 });
      for (let a = 0.3; a < W - 0.2; a += 0.55) {
        const [x, y] = p.P(a, 0.36, 9);
        for (let q = 0; q < 8; q++) {
          const sx = x - 7 + q * 2;
          const h = 10 + Rn() * 6;
          ln(l, sx, y, sx + (q - 4) * 0.4, y - h, '#5e7258');
          for (let j = 0; j < 4; j++) px(l, sx + (q - 4) * 0.4, y - h + j * 1.5, j < 2 ? '#a68ae0' : '#8a6ad0', 2, 1);
        }
      }
    }, { outline: 0.55 });
  },
};

// ── benches, bollards, the drinking fountain, a menu board ──
const panchina: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.25, W - 0.1, 0.75, 6, 0.26);
    const wood = grain(['#3a2a1a', '#5a4026', '#7a5634', '#9a6e44', '#b88a56', '#d2a46a']);
    // cast-iron lion-paw legs, oak slats, a curved back
    for (const a of [0.2, W - 0.26]) {
      lbox(p, a, 0.3, 0.06, 0.4, 0, 4.4, mono(paint(IRON), IRON[0]));
      lbox(p, a, 0.24, 0.06, 0.06, 4.4, 5, mono(paint(IRON), IRON[0]));
    }
    for (let i = 0; i < 4; i++) lbox(p, 0.1, 0.3 + i * 0.1, W - 0.2, 0.08, 4.4, 0.4, mono(wood, '#3a2a1a'));
    for (let i = 0; i < 3; i++) lbox(p, 0.1, 0.24, W - 0.2, 0.04, 5.6 + i * 1.3, 0.9, mono(wood, '#3a2a1a'));
    // a newspaper left on it
    const [nx, ny] = anchor(p, W * 0.7, 0.5, 4.8);
    px(p.c, nx - 6, ny - 3, '#e8e2d2', 12, 4);
    px(p.c, nx - 5, ny - 2, '#3a3a40', 8, 1);
    void k;
  },
};

const dissuasore: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 5, y + 2, 8, 3, 0.26);
    layer(p.c, (l) => {
      // a travertine bollard with a domed top and an iron ring
      for (let j = 0; j < 22; j++) {
        const w = j > 18 ? 7 - (j - 18) * 1.5 : 7;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, TRAV[t < 0.3 ? 5 : t < 0.6 ? 4 : t < 0.85 ? 3 : 2]);
        }
      }
      px(l, x - 7, y - 16, IRON[2], 14, 2);
    });
    void k;
  },
};

const fontanella: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 2, 10, 4, 0.26);
    layer(p.c, (l) => {
      // the Roman "nasone": a cast-iron column with a curved spout, a grate below
      fillPoly(l, [[x - 9, y - 1], [x + 1, y - 6], [x + 11, y - 1], [x + 1, y + 4]], IRON[1]);
      for (let i = -6; i <= 6; i += 3) ln(l, x + i - 2, y + 1 - i * 0.4, x + i + 4, y - 3 - i * 0.4, IRON[3]);
      for (let j = 0; j < 40; j++) {
        const w = 6 - (j > 34 ? (j - 34) * 0.8 : 0);
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - 4 - j, IRON[t < 0.3 ? 4 : t < 0.6 ? 3 : 2]);
        }
      }
      curve(l, x + 5, y - 30, x + 14, y - 32, x + 14, y - 24, IRON[3], 3);
    });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p);
    const u = p.k / 4;
    for (let i = 0; i < 6; i++) {
      const t = (k.t * 2 + i / 6) % 1;
      px(p.c, x + 14 * u, y - 24 * u + t * 18 * u, '#c8eef6', Math.max(1, u), Math.max(1, 2 * u));
    }
  },
};

const lavagna: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 2, 10, 4, 0.24);
    layer(p.c, (l) => {
      // an A-frame chalkboard: today's specials in chalk
      fillPoly(l, [[x - 9, y], [x - 6, y - 30], [x + 6, y - 30], [x + 9, y]], '#6a4a2a');
      fillPoly(l, [[x - 7, y - 3], [x - 5, y - 28], [x + 5, y - 28], [x + 7, y - 3]], '#2a302c');
      for (let i = 0; i < 5; i++) ln(l, x - 4 + (i % 2), y - 24 + i * 4, x + 3 - (i % 3), y - 24 + i * 4, i === 0 ? '#f2c86a' : '#e8e8e2');
      ell(l, x + 2, y - 7, 2, 2, '#e8577a');
    });
    void k;
  },
};

// ── bicycles at a rack, scooters, a three-wheeler ───────────
function bicycle(l: CanvasRenderingContext2D, x: number, y: number, col: string, basket: boolean) {
  for (const wx of [-13, 13]) {
    ell(l, x + wx, y - 9, 9, 9, '#2a2630');
    ell(l, x + wx, y - 9, 7, 7, 'rgba(0,0,0,0)');
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      ln(l, x + wx, y - 9, x + wx + Math.cos(ang) * 7, y - 9 + Math.sin(ang) * 7, '#a8aab4');
    }
  }
  ln(l, x - 13, y - 9, x - 1, y - 19, col, 2);
  ln(l, x - 1, y - 19, x + 11, y - 17, col, 2);
  ln(l, x + 11, y - 17, x + 13, y - 9, col, 2);
  ln(l, x - 13, y - 9, x, y - 8, col, 2);
  ln(l, x, y - 8, x - 1, y - 19, col, 2);
  px(l, x - 5, y - 22, '#3a2a26', 8, 2);
  ln(l, x + 11, y - 17, x + 10, y - 24, col, 2);
  px(l, x + 5, y - 25, '#3a3640', 9, 2);
  if (basket) {
    px(l, x + 12, y - 28, '#b8925a', 9, 6);
    for (let i = 0; i < 9; i += 2) px(l, x + 12 + i, y - 28, '#8a6a3a', 1, 6);
  }
}
const rastrelliera: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.3, W - 0.05, 0.7, 8, 0.22);
    const Rn = rng(k.seed + 11);
    for (let i = 0; i < Math.round(W * 2.5); i++) {
      const [x, y] = anchor(p, 0.25 + i * 0.4, 0.5, 0);
      layer(p.c, (l) => {
        // the rack's hoop
        curve(l, x - 6, y, x - 6, y - 14, x + 2, y - 14, IRON[3], 2);
        ln(l, x + 2, y - 14, x + 4, y, IRON[3], 2);
        if (Rn() < 0.8) bicycle(l, x, y + 2, ['#c8382a', '#2a5aa8', '#3fb68b', '#e8c040', '#2a2a30', '#e8e2d2'][Math.floor(Rn() * 6)], Rn() < 0.4);
      }, { outline: 0.5 });
    }
  },
};

const vespa: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const col = k.color ?? ['#9ad0c8', '#e8c860', '#c8382a', '#e8e2d2', '#5a8ac8'][k.seed % 5];
    contactShadow(p.c, x + 8, y + 3, 24, 6, 0.26);
    layer(p.c, (l) => {
      // the curvy body over the rear wheel, the leg shield and fender up front, the seat, a mirror
      ell(l, x - 14, y - 6, 6, 6, '#1e1e24');
      ell(l, x + 16, y - 6, 6, 6, '#1e1e24');
      ell(l, x - 14, y - 6, 2, 2, '#a8aab4');
      ell(l, x + 16, y - 6, 2, 2, '#a8aab4');
      ell(l, x - 10, y - 14, 14, 9, darken(col, 0.2));
      ell(l, x - 11, y - 15, 12, 7, col);
      ell(l, x - 14, y - 18, 5, 3, lighten(col, 0.35));
      fillPoly(l, [[x + 8, y - 6], [x + 14, y - 8], [x + 12, y - 30], [x + 6, y - 28]], col);
      fillPoly(l, [[x + 6, y - 28], [x + 9, y - 28], [x + 10, y - 8], [x + 8, y - 6]], lighten(col, 0.25));
      ell(l, x + 16, y - 11, 6, 4, col);
      px(l, x - 18, y - 24, '#6a4a2e', 18, 4);
      px(l, x - 18, y - 24, '#8a6a46', 18, 1);
      ln(l, x + 10, y - 30, x + 16, y - 36, '#2a2a30', 2);
      ell(l, x + 18, y - 32, 3, 2.4, '#e8e8e2');
      px(l, x + 15, y - 38, '#a8aab4', 3, 3);
    });
  },
};

const ape: PropArt = {
  draw(p, k) {
    footShadow(p, 0.05, 0.15, k.w - 0.05, 0.85, 14, 0.26);
    const col: Ramp = ['#2e4a5a', '#3a5e70', '#4a7286', '#5c869a', '#709aac', '#86aec0'];
    // the cab: a rounded box with a windscreen, one front wheel; the flatbed with crates of produce
    lbox(p, 0.1, 0.25, 0.7, 0.5, 2.4, 11, { front: brushed(col, 0.8), side: brushed(col, 0.8), top: paint(col), edge: col[0] });
    pt(p, side(p, 0.8), 0.32, 0.68, 7.5, 12.4, glass4(R.glass));
    pt(p, front(p, 0.75), 0.2, 0.7, 6.5, 11.6, glass4(R.glass));
    lbox(p, 0.8, 0.2, 1.0, 0.6, 3, 1.2, mono(paint(IRON), IRON[0]));
    for (const a of [0.85, 1.75]) lbox(p, a, 0.2, 0.05, 0.6, 4.2, 2.6, mono(paint(col), col[0]));
    lbox(p, 0.85, 0.75, 0.95, 0.05, 4.2, 2.6, mono(paint(col), col[0]));
    for (const [a, c] of [[1.05, '#f08a2e'], [1.45, '#7aa04a']] as const) {
      lbox(p, a - 0.15, 0.32, 0.32, 0.34, 4.2, 2.2, mono(grain(['#5a3a22', '#7a5230', '#9a6b40', '#b88752', '#d2a46a', '#e6c08a']), '#3d2617'));
      const [fx, fy] = anchor(p, a, 0.5, 6.4);
      layer(p.c, (l) => {
        for (let q = 0; q < 6; q++) dotFruit(l, fx - 6 + (q % 3) * 5, fy - 2 - Math.floor(q / 3) * 3, c, 5);
      });
    }
    for (const [a, b] of [[0.3, 0.75], [1.3, 0.82], [1.3, 0.2]] as const) {
      const [wx, wy] = anchor(p, a, b, 2);
      ell(p.c, wx, wy, 6, 6, '#1e1e24');
      ell(p.c, wx, wy, 2, 2, '#a8aab4');
    }
  },
};

// ── the tram stop and the tram ──────────────────────────────
const pensilina: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.9, 20, 0.22);
    // steel posts, a glass back panel with a route map, a bench, a curved roof and a sign
    for (const a of [0.15, W - 0.2]) lbox(p, a, 0.2, 0.06, 0.06, 0, 24, mono(paint(IRON), IRON[0]));
    p.c.globalAlpha = 0.45;
    pt(p, front(p, 0.24), 0.2, W - 0.2, 1, 22, glass4(R.glass));
    p.c.globalAlpha = 1;
    pq(p, front(p, 0.25), 0.5, 1.4, 6, 18, '#f2ead6');
    for (let i = 0; i < 6; i++) pq(p, front(p, 0.26), 0.6, 1.3, 16 - i * 1.6, 16.5 - i * 1.6, ['#e2553b', '#2a5aa8', '#3fb68b'][i % 3]);
    lbox(p, 0.3, 0.3, W - 0.6, 0.25, 4.4, 0.6, mono(grain(['#3a2a1a', '#5a4026', '#7a5634', '#9a6e44', '#b88a56', '#d2a46a']), '#3a2a1a'));
    lbox(p, -0.05, 0.05, W + 0.1, 0.95, 24, 1.2, { front: brushed(['#4a5058', '#5e6670', '#747c86', '#8a929c', '#a2aab2', '#bcc2c8']), side: paint(IRON), top: paint(['#4a5058', '#5e6670', '#747c86', '#8a929c', '#a2aab2', '#bcc2c8']), edge: IRON[0] });
    // the stop's sign on a pole
    const [sx, sy] = anchor(p, W + 0.1, 0.8, 0);
    layer(p.c, (l) => {
      px(l, sx - 1, sy - 90, IRON[3], 3, 90);
      ell(l, sx, sy - 94, 9, 9, '#f2c42a');
      ell(l, sx, sy - 94, 7, 7, '#fbf2d6');
      px(l, sx - 3, sy - 97, '#2a2a30', 6, 5);
    });
    void k;
  },
};

const tram: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.05, W - 0.05, 0.95, 30, 0.3);
    const orange: Ramp = ['#7a3410', '#984418', '#b85822', '#d06e2e', '#e48a42', '#f0a660'];
    const cream: Ramp = ['#9a8e74', '#b4a88c', '#cabea2', '#dcd2b8', '#ece4cc', '#f8f2e0'];
    // body: orange lower, cream upper with a row of windows, a clerestory roof, pantograph
    lbox(p, 0.05, 0.1, W - 0.1, 0.8, 2, 13, { front: brushed(orange, 0.8), side: brushed(orange, 0.8), top: paint(orange), edge: orange[0] });
    lbox(p, 0.05, 0.1, W - 0.1, 0.8, 15, 12, { front: paint(cream), side: paint(cream), top: paint(cream), edge: cream[0] });
    const F = front(p, 0.9);
    const S = side(p, W - 0.05);
    for (let a = 0.3; a < W - 0.4; a += 0.62) {
      pt(p, F, a, a + 0.48, 16.5, 25, glass4(R.glass));
      pq(p, F, a, a + 0.48, 16.5, 17, '#3a3a40');
    }
    // doors with folding leaves
    for (const a of [1.2, W - 2]) {
      pq(p, F, a, a + 0.6, 2, 26, '#2a2a30');
      pt(p, F, a + 0.04, a + 0.28, 3, 25, glass4(R.glass));
      pt(p, F, a + 0.32, a + 0.56, 3, 25, glass4(R.glass));
    }
    // the cab end with a big windscreen and a headlamp
    pt(p, S, 0.2, 0.8, 15.5, 26, glass4(R.glass));
    const [hx, hy] = S.F(0.5, 7);
    ell(p.c, hx, hy, 4, 4, '#fff4c0');
    ell(p.c, hx, hy, 2, 2, '#ffffff');
    pq(p, S, 0.25, 0.75, 27.4, 29.4, '#2a2a30');
    for (let q = 0; q < 3; q++) pq(p, S, 0.32 + q * 0.14, 0.42 + q * 0.14, 27.8, 29, '#f2c42a');
    lbox(p, 0.6, 0.3, W - 1.2, 0.4, 27, 2.2, mono(paint(cream), cream[0]));
    // the pantograph on the roof touching the wire
    const [px0, py0] = anchor(p, W / 2, 0.5, 29.2);
    layer(p.c, (l) => {
      ln(l, px0 - 12, py0, px0, py0 - 22, IRON[3], 2);
      ln(l, px0 + 12, py0, px0, py0 - 22, IRON[3], 2);
      px(l, px0 - 10, py0 - 24, IRON[2], 20, 2);
    });
    // wheels / bogies
    for (const a of [0.9, W - 1.1]) {
      const [wx, wy] = anchor(p, a, 0.9, 1.4);
      px(p.c, wx - 12, wy - 2, '#1e1e24', 24, 6);
    }
    void k;
  },
};

// ── flat details of the paving (baked into the ground) ──────
const decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'tombino';
    const [x, y] = anchor(p, 0.5 * p.pw, 0.5 * p.pd);
    const c = p.c;
    if (v === 'tombino') {
      // a cast-iron manhole cover with a grid pattern and the city crest
      ell(c, x, y, 17, 8.5, IRON[0]);
      ell(c, x, y, 15, 7.5, IRON[2]);
      for (let i = -12; i <= 12; i += 4) ln(c, x + i, y - 6, x + i, y + 6, IRON[3]);
      ell(c, x, y, 5, 2.5, IRON[4]);
      px(c, x - 1, y - 1, '#8a7a5a', 3, 2);
    } else if (v === 'grata') {
      // an iron tree grate: concentric rings of slots
      for (let r = 4; r <= 4; r++) ell(c, x, y, 34, 17, IRON[1]);
      ell(c, x, y, 30, 15, IRON[2]);
      for (let r = 0; r < 3; r++)
        for (let a = 0; a < 18 + r * 6; a++) {
          const ang = (a / (18 + r * 6)) * Math.PI * 2;
          px(c, x + Math.cos(ang) * (12 + r * 6), y + Math.sin(ang) * (6 + r * 3), IRON[0], 2, 1);
        }
      ell(c, x, y, 9, 4.5, '#4a3a2a');
    } else if (v === 'binari') {
      // tram rails along the prop: two grooved steel rails set in setts
      for (const off of [0.32, 0.68]) {
        const [x0, y0] = p.P(0, off * p.pd);
        const [x1, y1] = p.P(p.pw, off * p.pd);
        ln(c, x0, y0, x1, y1, '#3a3a40', 3);
        ln(c, x0, y0 - 1, x1, y1 - 1, '#c8ccd2', 1);
      }
    } else if (v === 'foglie') {
      const Rn = rng(k.seed);
      for (let i = 0; i < 14; i++) {
        const [fx, fy] = p.P(Rn() * p.pw, Rn() * p.pd);
        const col = ['#c8a050', '#a87a3a', '#8a9a4a', '#d8b860'][Math.floor(Rn() * 4)];
        px(c, fx, fy, col, 3, 2);
        px(c, fx + 1, fy - 1, col, 2, 1);
      }
    } else if (v === 'pozzanghera') {
      ell(c, x, y + 1, 24, 8, '#3a3a40');
      ell(c, x, y, 22, 7, '#6a8aa6');
      ell(c, x - 6, y - 2, 10, 2, '#a8c8de');
    } else if (v === 'gessetti') {
      // a child's hopscotch in chalk
      const cols = ['#f2ead6', '#f2b6c8', '#9fd8f2'];
      for (let i = 0; i < 6; i++) {
        const [qx, qy] = p.P(0.2 + i * 0.12 * p.pw, 0.5 * p.pd);
        ln(c, qx - 6, qy - 3, qx + 6, qy + 3, cols[i % 3]);
        ln(c, qx - 6, qy - 3, qx - 1, qy - 6, cols[i % 3]);
      }
    } else if (v === 'piume') {
      const Rn = rng(k.seed + 3);
      for (let i = 0; i < 6; i++) {
        const [fx, fy] = p.P(Rn() * p.pw, Rn() * p.pd);
        ln(c, fx, fy, fx + 4, fy - 1, '#b8bcc4');
        px(c, fx, fy, '#e8eaee', 2, 1);
      }
    } else if (v === 'corsia' || v === 'linea' || v === 'gialla') {
      // road markings along the prop, on its middle line (b = d/2): a dashed lane line,
      // a solid white edge line, or a solid yellow line
      const col = v === 'gialla' ? '#f2c21e' : '#f4f6f8';
      const dash = v === 'corsia';
      const bm = 0.5 * p.pd;
      const thick = (q0: number, q1: number) => {
        const [x0, y0] = p.P(q0, bm);
        const [x1, y1] = p.P(q1, bm);
        fillPoly(c, [[x0, y0 - 2], [x1, y1 - 2], [x1, y1 + 2], [x0, y0 + 2]], col);
      };
      if (dash) for (let q = 0.1; q < p.pw - 0.05; q += 1) thick(q, Math.min(p.pw, q + 0.55));
      else thick(0, p.pw);
    } else if (v === 'zebra') {
      // a pedestrian crossing: broad white bars across the prop's length
      for (let q = 0.12; q < p.pw - 0.1; q += 0.36) {
        const pts = [p.P(q, 0.08 * p.pd), p.P(q + 0.18, 0.08 * p.pd), p.P(q + 0.18, 0.92 * p.pd), p.P(q, 0.92 * p.pd)];
        fillPoly(c, pts, '#eef0f2');
      }
    }
  },
};

// ── a flower bed: a travertine kerb, lawn, roses and a clipped bay tree ──
const aiuola: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 3, 0.18);
    const T = cutStone4(TRAV, 2.6);
    // the kerb as four low walls, the bed of lawn inside
    lbox(p, 0.05, 0.05, W - 0.1, 0.18, 0, 2.6, { front: T, side: T, top: T, edge: TRAV[0] });
    lbox(p, 0.05, 0.05, 0.18, D - 0.1, 0, 2.6, { front: T, side: T, top: T, edge: TRAV[0] });
    const lawn = (light: 0 | 1 | 2) => (_u: number, _v: number, x: number, y: number) => ['#3c6a2e', '#477a34', '#52893a', '#5e9842', '#6ca64a'][Math.max(0, Math.min(4, (light === 2 ? 3 : 2) + (hash(x, y >> 1, 3) < 0.2 ? -1 : hash(x, y, 4) > 0.9 ? 1 : 0)))];
    lbox(p, 0.23, 0.23, W - 0.46, D - 0.46, 0, 2.2, { front: lawn, side: lawn, top: lawn, edge: '#2e4a24' });
    const Rn = rng(k.seed * 5 + 3);
    // roses round the edge, a bay tree in the middle
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let a = 0.4; a < W - 0.3; a += 0.4) {
        for (const b of [0.4, D - 0.4]) {
          const [x, y] = p.P(a, b, 2.2);
          masses.push({ x, y: y - 6, rx: 8, ry: 7, z: y });
        }
      }
      foliage(l, masses, R.apple, k.seed, { cell: 2.8, dots: ['#d8302a', '#e8577a', '#f6b6d0', '#fbf7ee'], dotChance: 0.65, dotSize: 4 });
    }, { outline: 0.55 });
    const [tx, ty] = anchor(p, W / 2, D / 2, 2.2);
    layer(p.c, (l) => {
      px(l, tx - 2, ty - 40, '#6a4a2e', 4, 40);
      foliage(l, [{ x: tx, y: ty - 54, rx: 20, ry: 20, z: 1 }], R.hedge, k.seed + 1, { cell: 3.4, tilt: 0.12 });
    }, { outline: 0.6 });
    void Rn;
  },
};

// ── a monument: a poet in bronze on a travertine pedestal ───
const statua: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, k.w - 0.1, k.d - 0.1, 30, 0.28);
    const T = cutStone4(TRAV, 4);
    const W = k.w;
    // stepped base, the pedestal with an inscription, a cornice
    lbox(p, 0.1, 0.1, W - 0.2, W - 0.2, 0, 1.6, { front: T, side: T, top: T, edge: TRAV[0] });
    lbox(p, 0.35, 0.35, W - 0.7, W - 0.7, 1.6, 1.4, { front: T, side: T, top: T, edge: TRAV[0] });
    lbox(p, 0.55, 0.55, W - 1.1, W - 1.1, 3, 14, { front: cutStone4(TRAV, 14), side: cutStone4(TRAV, 14), top: T, edge: TRAV[0] });
    lbox(p, 0.48, 0.48, W - 0.96, W - 0.96, 17, 1.6, { front: T, side: T, top: T, edge: TRAV[0] });
    const F = front(p, W - 0.55);
    pq(p, F, 0.75, W - 0.75, 9, 13, '#8a7a5e');
    for (let i = 0; i < 6; i++) pq(p, F, 0.85 + i * ((W - 1.7) / 6), 0.85 + i * ((W - 1.7) / 6) + 0.08, 10.4, 11.6, '#3a3428');
    // a wreath of flowers laid at its foot
    const [fx, fy] = anchor(p, W / 2, W - 0.3, 1.6);
    layer(p.c, (l) => foliage(l, [{ x: fx, y: fy - 4, rx: 10, ry: 5, z: 1 }], R.oak, k.seed, { cell: 2.4, dots: ['#d8302a', '#f2d240', '#fbf7ee'], dotChance: 0.8, dotSize: 3 }), { outline: 0.55 });
    // the poet: robe, a book held to the chest, a laurel crown, a hand raised
    const [x, y] = anchor(p, W / 2, W / 2, 18.6);
    const bronze: Ramp = ['#1e2a26', '#2a3a34', '#3a4e46', '#4a6458', '#5e7a6c', '#7a9688'];
    layer(p.c, (l) => {
      fillPoly(l, [[x - 12, y], [x + 12, y], [x + 8, y - 44], [x - 8, y - 44]], bronze[2]);
      fillPoly(l, [[x - 12, y], [x - 4, y], [x - 3, y - 44], [x - 8, y - 44]], bronze[4]);
      for (let i = 0; i < 4; i++) ln(l, x - 8 + i * 4, y, x - 6 + i * 3, y - 40, bronze[1]);
      ell(l, x, y - 50, 6, 7, bronze[3]);
      ell(l, x - 2, y - 52, 3, 3, bronze[5]);
      for (let i = 0; i < 7; i++) px(l, x - 7 + i * 2, y - 57 + Math.abs(i - 3), '#5a7a4a', 2, 2);
      fillPoly(l, [[x - 6, y - 30], [x + 4, y - 34], [x + 4, y - 24], [x - 6, y - 20]], bronze[1]);
      ln(l, x + 7, y - 40, x + 16, y - 60, bronze[3], 4);
      ell(l, x + 17, y - 62, 3, 3, bronze[4]);
      // a pigeon on its head, of course
      px(l, x - 3, y - 61, '#5c5e68', 6, 3);
      px(l, x + 2, y - 63, '#757884', 3, 2);
    });
  },
};

// ── a lemon tree in a big terracotta pot ────────────────────
const limone: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 20, 7, 0.26);
    layer(p.c, (l) => {
      // the pot: a fluted terracotta urn with a garland band
      for (let j = 0; j < 26; j++) {
        const w = 14 - Math.abs(j - 14) * 0.18 - (j < 4 ? (4 - j) * 0.8 : 0);
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          const fl = Math.round(i + w) % 4 === 0;
          px(l, x + i, y - j, ['#6a3220', '#8a432a', '#a85a38', '#c07448', '#d48e5e', '#e4a878'][(t < 0.3 ? 4 : t < 0.6 ? 3 : t < 0.85 ? 2 : 1) - (fl ? 1 : 0)]);
        }
      }
      px(l, x - 15, y - 27, '#e4a878', 30, 3);
      for (let i = -12; i < 12; i += 4) ell(l, x + i + 2, y - 19, 2, 1.5, '#a85a38');
      px(l, x - 1, y - 52, '#6a4a2e', 3, 26);
      foliage(l, [{ x, y: y - 64, rx: 22, ry: 18, z: 1 }, { x: x - 10, y: y - 56, rx: 12, ry: 10, z: 2 }, { x: x + 11, y: y - 58, rx: 12, ry: 10, z: 2 }], ['#1e3a22', '#284a28', '#33602e', '#407434', '#52883c', '#6a9e46', '#86b452'], k.seed, { cell: 3, dots: ['#f2d240', '#f6e070'], dotChance: 0.32, dotSize: 4 });
    }, { outline: 0.6 });
  },
};

const cestino: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 5, y + 2, 8, 3, 0.24);
    layer(p.c, (l) => {
      // a cast-iron litter bin with a lid, the city's emblem
      for (let j = 0; j < 20; j++) {
        const w = 6;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, IRON[t < 0.3 ? 4 : t < 0.6 ? 3 : 2]);
        }
      }
      for (let i = -5; i < 6; i += 3) px(l, x + i, y - 18, IRON[1], 1, 16);
      ell(l, x, y - 21, 7, 3, IRON[3]);
      ell(l, x, y - 12, 3, 3, '#c8a050');
    });
    void k;
  },
};

export const OFFICE_PIAZZA: Record<string, PropArt> = {
  aiuola,
  statua,
  limone,
  cestino,
  platano,
  lampione,
  fontana,
  edicola,
  bancarella,
  tavolino,
  fioriera,
  panchina,
  dissuasore,
  fontanella,
  lavagna,
  rastrelliera,
  vespa,
  ape,
  pensilina,
  tram,
  decal,
};

// Chemical Lab — life on the campus: street furniture, bikes, green pergolas,
// EV solar carports with parked cars, the campus shuttle, the fenced hazmat
// yard, and the flat details of the ground.
//   lab_bench ('block' | 'back') · lab_lamp ('pole' | 'bollard') · lab_bin
//   lab_bikes · lab_bikeshare · lab_sign ('map' | 'pond' | 'yard') · lab_banner
//   lab_pergola ('bikes' | 'seats') · lab_planter ('' | 'pot')   (the vehicles and bikes are in vehicles.ts)
//   lab_carport · lab_charger
//   lab_fence ('' | 'gate') · lab_lntank · lab_tank · lab_drumstore
//   lab_cylcage · lab_store · lab_ibc · lab_decal (flat)
import { darken } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, bayer, contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { bike3, CARCOLS, car3, ZT } from './vehicles';
import { ANTH, BLU, coat, CONC, cyl, GALV, ghs, GRN, LARCH, larchMat, P, planeText, RED, rampAround, sign, SILVER, STEEL, TEAL, YEL } from './lk';

const anth = coat(ANTH);
const galv = coat(GALV);
const precast = coat(CONC);

// ── benches, lamps, bins ────────────────────────────────────
const lab_bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? (k.seed % 2 ? 'block' : 'back');
    footShadow(p, 0.08, 0.25, W - 0.08, 0.8, 5, 0.26);
    const slats: Mat = (light) => (u, vv, x, y) => {
      const s = (light === 2 ? vv : u) % 6;
      if (s < 1) return LARCH[1];
      let i = light === 2 ? 4.2 : light === 1 ? 3.2 : 2;
      if (hash(x, y, 91) < 0.04) i -= 1;
      return at(LARCH, i);
    };
    if (v === 'block') {
      // a long precast block with a larch top
      lbox(p, 0.06, 0.28, W - 0.12, 0.44, 0, 3.6, { front: precast, side: precast, top: precast, edge: CONC[0] });
      lbox(p, 0.04, 0.26, W - 0.08, 0.48, 3.6, 0.8, { front: slats, side: slats, top: slats, edge: LARCH[0] });
    } else {
      // steel frames, larch seat and back slats
      for (const a of [0.18, W - 0.24]) {
        lbox(p, a, 0.32, 0.06, 0.42, 0, 4.2, mono(anth, ANTH[0]));
        lbox(p, a, 0.3, 0.06, 0.06, 4.2, 4.8, mono(anth, ANTH[0]));
      }
      for (let i = 0; i < 4; i++) lbox(p, 0.08, 0.34 + i * 0.1, W - 0.16, 0.08, 4.2, 0.45, mono(slats, LARCH[0]));
      for (let i = 0; i < 3; i++) lbox(p, 0.08, 0.28, W - 0.16, 0.05, 5.6 + i * 1.2, 0.85, mono(slats, LARCH[0]));
    }
    // a coffee cup or a paperback left on it
    if (k.seed % 3 === 0) {
      const [x, y] = P(p, W * 0.7, 0.5, v === 'block' ? 4.4 : 4.65);
      px(p.c, x - 2, y - 6, '#f6f2ea', 4, 6);
      px(p.c, x - 2, y - 4, TEAL[4], 4, 2);
    } else if (k.seed % 3 === 1) {
      const [x, y] = P(p, W * 0.3, 0.5, v === 'block' ? 4.4 : 4.65);
      fillPoly(p.c, [[x - 6, y], [x, y - 3], [x + 6, y], [x, y + 3]], '#c8382a');
      fillPoly(p.c, [[x - 5, y - 1], [x, y - 3], [x + 5, y - 1], [x, y + 1]], '#f4f0e4');
    }
  },
};

const lab_lamp: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'pole';
    const [x, y] = P(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 6, y + 2, 9, 3.5, 0.26);
    layer(p.c, (l) => {
      if (v === 'bollard') {
        cyl(l, x, y, 5, 40, ANTH, { top: ANTH[4] });
        px(l, x - 5, y - 34, '#fff4c8', 10, 4);
        px(l, x - 5, y - 34, '#ffffff', 4, 2);
      } else {
        // a slim anthracite column with a flat cantilevered LED head
        ell(l, x, y, 7, 3.5, ANTH[1]);
        cyl(l, x, y, 3, 200, ANTH, { top: null });
        fillPoly(l, [[x - 3, y - 200], [x + 30, y - 214], [x + 32, y - 210], [x - 1, y - 196]], ANTH[3]);
        fillPoly(l, [[x + 4, y - 199], [x + 30, y - 210], [x + 31, y - 208], [x + 5, y - 197]], '#fff4c8');
        px(l, x - 3, y - 120, TEAL[4], 6, 3);
      }
    }, { outline: 0.6 });
    void k;
  },
  lights: (k) => ((k.variant ?? 'pole') === 'bollard' ? [{ a: 0.5, b: 0.5, z: 9, r: 1.4, kind: 'lamp' }] : [{ a: 0.75, b: 0.25, z: 51, r: 3.2, kind: 'lamp' }]),
};

const lab_bin: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.3, 0.85, 0.75, 8, 0.24);
    const cols: [string, string][] = [[BLU[3], 'PAPER'], [GRN[3], 'GLASS'], ['#5a5e64', 'REST']];
    cols.forEach(([col, lab], i) => {
      const a = 0.16 + i * 0.24;
      const body = coat(rampAround(col));
      lbox(p, a, 0.34, 0.22, 0.38, 0, 8.4, { front: body, side: body, top: coat(ANTH), edge: darken(col, 0.5) });
      const F = front(p, 0.72);
      pq(p, F, a + 0.03, a + 0.19, 5.6, 6.8, '#f4f4ee');
      planeText(p, F, a + 0.02, a + 0.2, 5.6, 6.8, lab.slice(0, 1), '#2a2a30');
      pq(p, F, a + 0.06, a + 0.16, 7.4, 7.8, '#1e1e22');
    });
    void k;
  },
};

// ── bikes ───────────────────────────────────────────────────
/** A Sheffield stand: an inverted U along local b, its legs set in the ground. */
function stand(p: PropPainter, l: CanvasRenderingContext2D, a: number, bc: number) {
  const [x0, y0] = P(p, a, bc - 0.2, 0);
  const [x1, y1] = P(p, a, bc + 0.2, 0);
  const [t0x, t0y] = P(p, a, bc - 0.2, 7.6);
  const [t1x, t1y] = P(p, a, bc + 0.2, 7.6);
  ln(l, x0, y0, t0x, t0y, STEEL[3], 2);
  ln(l, x1, y1, t1x, t1y, STEEL[4], 2);
  ln(l, t0x, t0y - 1, t1x, t1y - 1, STEEL[5], 2);
}

/** Visit the slots along local a from the back to the front (the near end flips with rot). */
const slots = (p: PropPainter, a0: number, a1: number, step: number) => {
  const out: number[] = [];
  for (let a = a0; a < a1; a += step) out.push(a);
  return p.rot === 0 ? out : out.reverse();
};

const lab_bikes: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.15, W - 0.05, 0.85, 6, 0.2);
    const Rn = rng(k.seed * 13 + 3);
    const cols = ['#2a6ab8', '#c8382a', '#3fb68b', '#e8c040', '#2a2a30', '#e8e2d2', '#8a4ac8', '#f27a3a'];
    // bikes parked across the rack (along b), each against its own stand
    for (const a of slots(p, 0.3, W - 0.15, 0.5)) {
      const [x, y] = P(p, a, 0.5, 0);
      layer(p.c, (l) => {
        stand(p, l, a - 0.08, 0.5);
        if (Rn() < 0.78) bike3(p, l, a + 0.02, 0.5, cols[Math.floor(Rn() * cols.length)], { basket: Rn() < 0.3, child: Rn() < 0.12, flip: Rn() < 0.5 });
      }, { outline: 0.45, rect: [x - 40, y - 66, x + 40, y + 30] });
    }
  },
};

// ── signs ───────────────────────────────────────────────────
const lab_sign: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'map';
    footShadow(p, 0.25, 0.35, 0.75, 0.65, 10, 0.24);
    if (v === 'map') {
      // a campus totem: an anthracite slab, the building list, a little map
      lbox(p, 0.3, 0.42, 0.4, 0.14, 0, 20, { front: anth, side: anth, top: anth, edge: ANTH[0] });
      const F = front(p, 0.56);
      pq(p, F, 0.32, 0.68, 17.4, 19.2, TEAL[4]);
      planeText(p, F, 0.32, 0.68, 17.4, 19.2, 'CAMPUS', '#f4f8f6');
      for (let i = 0; i < 4; i++) {
        pq(p, F, 0.34, 0.66, 14.2 - i * 1.5, 15.2 - i * 1.5, '#e8ecea');
        pq(p, F, 0.36, 0.4, 14.4 - i * 1.5, 15 - i * 1.5, ['#e2553b', TEAL[4], '#f2c43a', '#5b8def'][i]);
      }
      pq(p, F, 0.34, 0.66, 2.4, 7.4, '#dfe8e4');
      pq(p, F, 0.4, 0.5, 4, 6, '#9ac8a0');
      pq(p, F, 0.52, 0.6, 3, 4.6, '#7ab8d8');
      pq(p, F, 0.44, 0.47, 3.4, 4.2, '#e2553b');
    } else {
      // an interpretation board on two posts, angled for reading
      for (const a of [0.24, 0.72]) lbox(p, a, 0.5, 0.05, 0.05, 0, 9, mono(coat(SILVER), SILVER[0]));
      const F = front(p, 0.56);
      const yard = v === 'yard';
      pq(p, F, 0.18, 0.82, 8.6, 14.6, yard ? YEL[4] : '#f4f1e4');
      pq(p, F, 0.18, 0.82, 14.2, 14.6, yard ? '#1e1e22' : TEAL[3]);
      if (yard) {
        planeText(p, F, 0.2, 0.8, 12.4, 14, 'HAZMAT', '#1e1e22');
        const [gx, gy] = F.F(0.34, 10.4);
        const [hx, hy] = F.F(0.52, 10.4);
        const [ix, iy] = F.F(0.7, 10.4);
        ghs(p.c, gx, gy, 6, 0);
        ghs(p.c, hx, hy, 6, 2);
        ghs(p.c, ix, iy, 6, 1);
      } else {
        planeText(p, F, 0.2, 0.8, 12.6, 14, 'POND LIFE', TEAL[2]);
        // a duck, a dragonfly, a lily
        const [dx, dy] = F.F(0.32, 10.2);
        ell(p.c, dx, dy, 5, 3, '#857868');
        ell(p.c, dx + 4, dy - 3, 2.5, 2.5, '#1e5638');
        px(p.c, dx + 6, dy - 3, '#f2b83a', 2, 1);
        const [fx, fy] = F.F(0.55, 11);
        px(p.c, fx - 4, fy, '#3a7ad8', 9, 1);
        px(p.c, fx - 1, fy - 2, '#5aa0e8', 3, 5);
        const [lx, ly] = F.F(0.72, 9.8);
        ell(p.c, lx, ly, 5, 2.5, '#4e8a42');
        px(p.c, lx - 1, ly - 3, '#f2a6c4', 3, 2);
      }
    }
    void k;
  },
};

// ── planters: timber boxes of flowering perennials, a little tree in the long ones ─
const PLANTLEAF: Ramp = ['#1f3d10', '#2b4c1c', '#39601e', '#4c7424', '#5e862b', '#76a034', '#92b84a', '#b4d470'];
const FLOWERS = ['#f6f8ec', '#f2d24a', '#b88ae0', '#e88ab0', '#ffffff', '#f2a03a'];
const lab_planter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 7 + 1);
    if (k.variant === 'pot') {
      // a square anthracite planter with a slim upright tree (hornbeam) and flowers at its foot
      footShadow(p, 0.15, 0.15, 0.85, 0.85, 8, 0.28);
      lbox(p, 0.17, 0.17, 0.66, 0.66, 0, 6, { front: anth, side: anth, top: anth, edge: ANTH[0] });
      pq(p, front(p, 0.83), 0.3, 0.7, 2.4, 3.6, TEAL[4]);
      const [cx, cy] = P(p, 0.5, 0.5, 6);
      layer(p.c, (l) => {
        px(l, cx - 2, cy - 90, '#6e5438', 4, 90);
        px(l, cx - 2, cy - 90, '#a4845e', 1, 90);
        const masses: Mass[] = [];
        for (let i = 0; i < 9; i++) masses.push({ x: cx + (Rn() - 0.5) * 22, y: cy - 70 - i * 9 - Rn() * 6, rx: 12 + Rn() * 5 - i * 0.6, ry: 9 + Rn() * 3, z: i });
        foliage(l, masses, PLANTLEAF, k.seed, { cell: 3, holes: 0.06, tilt: 0.3, bias: 0.12 });
        foliage(l, [{ x: cx - 6, y: cy - 3, rx: 12, ry: 6, z: 0 }, { x: cx + 7, y: cy - 2, rx: 10, ry: 5, z: 1 }], PLANTLEAF, k.seed + 3, { cell: 2.4, dots: FLOWERS, dotChance: 0.5, dotSize: 2 });
      }, { outline: 0.45 });
      return;
    }
    footShadow(p, 0.06, 0.18, W - 0.06, 0.84, 6, 0.24);
    const box = { front: larchMat(LARCH, 5), side: larchMat(LARCH, 5), top: coat(LARCH), edge: LARCH[0] };
    lbox(p, 0.06, 0.2, W - 0.12, 0.62, 0, 4.4, box);
    const [cx, cy] = P(p, W / 2, 0.5, 4.4);
    layer(p.c, (l) => {
      if (W >= 3) {
        // a multi-stem amelanchier in the middle
        for (let i = 0; i < 4; i++) curve(l, cx + (i - 1.5) * 3, cy, cx + (i - 1.5) * 8, cy - 50, cx + (i - 1.5) * 14, cy - 96, '#7a7068', 2);
        const masses: Mass[] = [];
        for (let i = 0; i < 9; i++) masses.push({ x: cx + (Rn() - 0.5) * 70, y: cy - 100 - Rn() * 40, rx: 16 + Rn() * 8, ry: 13 + Rn() * 6 });
        for (const m of masses) m.z = m.y;
        foliage(l, masses, PLANTLEAF, k.seed, { cell: 3.2, holes: 0.1, bias: 0.1, dots: ['#fbfaf2', '#f6e6ee', '#ffffff'], dotChance: 0.35, dotSize: 3 });
      }
      // perennials spilling over the box: leaf mounds and flowers
      const masses: Mass[] = [];
      for (let a = 0.22; a < W - 0.12; a += 0.22) {
        const [gx, gy] = P(p, a, 0.3 + Rn() * 0.4, 4.4);
        masses.push({ x: gx, y: gy - 7 - Rn() * 5, rx: 13 + Rn() * 6, ry: 9 + Rn() * 4, z: a });
      }
      foliage(l, masses, PLANTLEAF, k.seed + 1, { cell: 2.6, holes: 0.03, bias: 0.14, dots: [FLOWERS[k.seed % 6], FLOWERS[(k.seed + 2) % 6], '#ffffff'], dotChance: 0.65, dotSize: 3 });
    }, { outline: 0.45 });
  },
};

// ── green pergolas: dark steel frames under climbers ('bikes': a bike shelter, 'seats': benches and a slatted end) ─
const PFRAME: Ramp = ['#14261a', '#1c3422', '#24442c', '#2e5636', '#3a6a42', '#4a7e52'];
const lab_pergola: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const H = 24;
    const v = k.variant ?? 'seats';
    const Rn = rng(k.seed * 23 + 5);
    const fr = mono(coat(PFRAME), '#0e1a12');
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.1, 22, 0.3);
    const na = Math.max(2, Math.round(W / 1.7) + 1);
    const posts = Array.from({ length: na }, (_, i) => 0.08 + (i * (W - 0.28)) / (na - 1));
    for (const a of posts) lbox(p, a, 0.12, 0.12, 0.12, 0, H, fr);
    if (v === 'bikes') {
      const cols = ['#2a6ab8', '#c8382a', '#3fb68b', '#e8c040', '#2a2a30', '#e8e2d2', '#f27a3a'];
      for (const a of slots(p, 0.45, W - 0.3, 0.55)) {
        const [x, y] = P(p, a, D * 0.55, 0);
        layer(p.c, (l) => {
          stand(p, l, a - 0.08, D * 0.55);
          if (Rn() < 0.85) bike3(p, l, a + 0.02, D * 0.55, cols[Math.floor(Rn() * cols.length)], { basket: Rn() < 0.3, child: Rn() < 0.1, flip: Rn() < 0.5 });
        }, { outline: 0.45, rect: [x - 40, y - 66, x + 40, y + 30] });
      }
    } else {
      // two larch benches facing each other, a slatted larch screen closing the visible end
      const slat = larchMat(LARCH, 4);
      for (const b of [0.35, D - 0.75]) {
        lbox(p, 0.5, b, W - 1.2, 0.4, 0, 4.4, { front: slat, side: slat, top: coat(LARCH), edge: LARCH[0] });
        lbox(p, 0.5, b < 1 ? b : b + 0.34, W - 1.2, 0.08, 4.4, 4.0, { front: slat, side: slat, top: coat(LARCH), edge: LARCH[0] });
      }
      const ea = p.rot === 0 ? W - 0.22 : 0.1;
      const scr: Mat = (light) => (u, vv, x, y) => {
        const sl = u % 7;
        if (sl < 2) return light ? '#4a2e16' : '#3a2412';
        let i = light ? 4.2 : 3;
        if (hash(Math.floor(u / 7), Math.floor(vv / 30), 61) < 0.25) i -= 0.6;
        if (hash(x, y, 62) < 0.03) i -= 1;
        return at(LARCH, i);
      };
      lbox(p, ea, 0.2, 0.12, D - 0.4, 0, H - 0.5, { front: scr, side: scr, top: coat(LARCH), edge: LARCH[0] });
    }
    for (const a of posts) lbox(p, a, D - 0.24, 0.12, 0.12, 0, H, fr);
    lbox(p, 0, 0.1, W, 0.14, H, 1.4, fr);
    lbox(p, 0, D - 0.26, W, 0.14, H, 1.4, fr);
    for (let a = 0.1; a < W - 0.05; a += 0.5) lbox(p, a, 0.04, 0.08, D - 0.08, H + 1.4, 0.9, fr);
    // the climbers: a leafy roof with flowers, trails hanging off the edges, stems up the front posts
    const masses: Mass[] = [];
    for (let a = 0.12; a < W; a += 0.3)
      for (let b = 0.12; b < D; b += 0.3) {
        const [x, y] = P(p, a + (Rn() - 0.5) * 0.16, b + (Rn() - 0.5) * 0.16, H + 2.4 + Rn() * 2);
        masses.push({ x, y, rx: 16 + Rn() * 8, ry: 10 + Rn() * 4, z: a + b + 5 });
      }
    for (let a = 0.2; a < W; a += 0.55) {
      const [x, y] = P(p, a, D - 0.1, H - 3 - Rn() * 4);
      masses.push({ x, y, rx: 8 + Rn() * 5, ry: 9 + Rn() * 6, z: a + D + 6 });
    }
    for (const a of [posts[0], posts[posts.length - 1]])
      for (let z = 2; z < H; z += 3.4) {
        const [x, y] = P(p, a + 0.06, D - 0.1, z);
        masses.push({ x: x + (Rn() - 0.5) * 8, y, rx: 7 + Rn() * 3, ry: 6, z: a + D + 4 });
      }
    layer(p.c, (l) => foliage(l, masses, PLANTLEAF, k.seed, { cell: 3, holes: 0.06, tilt: 0.3, bias: 0.12, dots: ['#f6f8ec', '#f2d24a', '#e88ab0', '#b88ae0'], dotChance: 0.3, dotSize: 2 }), { outline: 0.5 });
  },
};

// ── the bike-share dock: blue hire bikes in a row, a terminal at the end ─
const lab_bikeshare: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.95, 6, 0.22);
    // the dock rail at the back, a docking post per bike, the hire bikes nosed into them
    lbox(p, 0.1, 0.14, W - 0.2, 0.16, 0, 0.6, mono(coat(GALV), GALV[0]));
    const terminal = () => {
      const [tx, ty] = P(p, W - 0.22, 0.22, 0.6);
      layer(p.c, (l) => {
        px(l, tx - 6, ty - 40, '#1e2a30', 12, 40);
        px(l, tx - 6, ty - 40, '#34464e', 3, 40);
        px(l, tx + 4, ty - 40, '#121a1e', 2, 40);
        px(l, tx - 4, ty - 34, '#3dd656', 8, 7);
        px(l, tx - 3, ty - 33, '#a7e2ab', 3, 2);
        px(l, tx - 3, ty - 24, '#8a9aa0', 6, 3);
        px(l, tx - 6, ty - 42, '#2a7ad8', 12, 3);
      }, { outline: 0.55, rect: [tx - 12, ty - 50, tx + 12, ty + 4] });
    };
    if (p.rot !== 0) terminal();
    for (const a of slots(p, 0.35, W - 0.55, 0.42)) {
      const [x, y] = P(p, a, 0.5, 0);
      layer(p.c, (l) => {
        const [dx, dy] = P(p, a, 0.22, 0.6);
        px(l, dx - 2, dy - 13, GALV[3], 4, 13);
        px(l, dx - 2, dy - 13, GALV[5], 1, 13);
        px(l, dx - 2, dy - 15, '#2a7ad8', 4, 2);
        px(l, dx - 1, dy - 11, '#3dd656', 2, 1);
        bike3(p, l, a, 0.56, '#2a7ad8', { basket: true, flip: true });
      }, { outline: 0.45, rect: [x - 40, y - 66, x + 40, y + 30] });
    }
    if (p.rot === 0) terminal();
    void k;
  },
};

// ── a banner pole: a slim dark mast with the department's navy banner ─
const lab_banner: PropArt = {
  draw(p, k) {
    const [x, y] = P(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 2, 10, 4, 0.26);
    layer(p.c, (l) => {
      ell(l, x, y, 6, 3, ANTH[1]);
      cyl(l, x, y, 3, 226, ANTH, { top: ANTH[4] });
      // two arms and the banner hanging between them, a little to the right of the mast
      px(l, x + 2, y - 214, ANTH[2], 30, 2);
      px(l, x + 2, y - 128, ANTH[2], 30, 2);
      px(l, x + 5, y - 212, '#1d3550', 24, 84);
      px(l, x + 5, y - 212, '#2a4a6c', 3, 84);
      px(l, x + 26, y - 212, '#14263a', 3, 84);
      // the molecule ring in white
      const cx = x + 17;
      const cy = y - 176;
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const t2 = ((i + 1) / 6) * Math.PI * 2 + Math.PI / 6;
        ln(l, cx + Math.cos(t) * 6, cy + Math.sin(t) * 6, cx + Math.cos(t2) * 6, cy + Math.sin(t2) * 6, '#e8f0f4');
        ell(l, cx + Math.cos(t) * 6, cy + Math.sin(t) * 6, 2, 2, i % 2 ? '#7ab8ec' : '#9ad88a');
      }
      px(l, x + 8, y - 150, '#e8f0f4', 18, 2);
      px(l, x + 10, y - 145, '#9ab0c4', 14, 1);
    }, { outline: 0.55 });
    void k;
  },
};

/** An EV charger pillar: dark grey with a bright green screen and a green halo, a cable on its hook. */
function chargerArt(c: CanvasRenderingContext2D, x: number, y: number, busy: boolean) {
  px(c, x - 5, y - 34, '#1e2a2e', 10, 34);
  px(c, x - 5, y - 34, '#34484c', 3, 34);
  px(c, x + 3, y - 34, '#0f1a20', 2, 34);
  px(c, x - 4, y - 30, '#2c4945', 8, 12);
  px(c, x - 3, y - 29, busy ? '#3dd656' : '#2ac0b0', 6, 9);
  px(c, x - 3, y - 29, '#a7e2ab', 2, 2);
  px(c, x - 1, y - 24, '#ffffff', 2, 3);
  px(c, x - 5, y - 36, '#3dd656', 10, 2);
  if (!busy) curve(c, x + 5, y - 16, x + 11, y - 10, x + 5, y - 6, '#101416', 2);
}

const lab_charger: PropArt = {
  draw(p, k) {
    const [x, y] = P(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 5, y + 2, 7, 3, 0.26);
    layer(p.c, (l) => chargerArt(l, x, y, k.seed % 2 === 0), { outline: 0.55 });
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 7, r: 0.8, color: '#7af08a', kind: 'lamp' }],
};

const lab_carport: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const nb = Math.max(1, Math.round(W / 1.86));
    const bw = W / nb;
    const Rn = rng(k.seed * 19 + 7);
    footShadow(p, 0.1, 0.2, W - 0.1, D - 0.2, 26, 0.24);
    // the back columns first, then the cars backed in to the chargers at the canopy's front edge
    // (half under the roof, their tails towards us), the chargers between the bays, the front
    // columns, then the PV roof over all
    const backs: number[] = [];
    for (let i = 0; i <= nb; i += 1) backs.push(i);
    for (const i of p.rot === 0 ? backs : [...backs].reverse()) {
      const a = Math.min(W - 0.1, i * bw);
      lbox(p, a - 0.06, 0.2, 0.12, 0.12, 0, 28.6, mono(galv, GALV[0]));
    }
    const bays: number[] = [];
    for (let i = 0; i < nb; i++) bays.push(i);
    const plugged: boolean[] = [];
    const pick = bays.map(() => ({ occupied: Rn() < 0.75, col: CARCOLS[Math.floor(Rn() * CARCOLS.length)], suv: Rn() < 0.5 }));
    for (const i of p.rot === 0 ? bays : [...bays].reverse()) {
      const { occupied, col } = pick[i];
      const kind = pick[i].suv ? 'estate' : 'hatch';
      const wid = kind === 'estate' ? 1.02 : 0.96;
      const len = kind === 'estate' ? 2.45 : 2.3;
      const a = i * bw + (bw - wid) / 2 + (hash(i, k.seed, 34) - 0.5) * 0.14;
      const b0 = D - 0.62 - len;
      if (occupied) {
        footShadow(p, a, b0, a + wid, b0 + len, 15, 0.3);
        car3(p, a, b0, wid, len, col, false, kind, i + k.seed);
        plugged[i] = hash(i, k.seed, 35) < 0.65;
        // the charging cable from the charger on the bay line to the flap on the car's near side
        if (plugged[i]) {
          const ca = p.rot === 0 ? (i + 1) * bw : i * bw;
          const [x0, y0] = P(p, ca, D - 0.42, 4.4);
          const [x1, y1] = P(p, p.rot === 0 ? a + wid : a, b0 + len - 0.42, 5.6);
          curve(p.c, x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 8, x1, y1, '#101416', 2);
        }
      }
    }
    for (const i of p.rot === 0 ? backs : [...backs].reverse()) {
      if (i === 0 || i === nb) continue;
      const [cx, cy] = P(p, i * bw, D - 0.42, 0);
      contactShadow(p.c, cx + 5, cy + 2, 8, 3, 0.3);
      layer(p.c, (l) => chargerArt(l, cx, cy, !!plugged[p.rot === 0 ? i - 1 : i]), { outline: 0.55, rect: [cx - 10, cy - 40, cx + 16, cy + 4] });
    }
    // front columns at every other bay line
    const m = Math.max(1, Math.round(nb / 2.3));
    for (let j = 0; j <= m; j++) {
      const a = Math.min(W - 0.1, Math.max(0.06, Math.round((j * nb) / m) * bw));
      lbox(p, a - 0.06, D - 0.3, 0.12, 0.12, 0, 25.6, mono(galv, GALV[0]));
    }
    // cantilever beams and the roof: higher at the back, the panels facing south
    for (let i = 0; i <= nb; i += 1) {
      const a = Math.min(W - 0.1, i * bw);
      poly3(p, [[a - 0.05, 0, 29.6], [a + 0.05, 0, 29.6], [a + 0.05, D, 25.4], [a - 0.05, D, 25.4]], () => GALV[2], 2);
    }
    // the PV roof: one fill, then the module grid and the cells drawn as lines (cheap at this size)
    const R0 = p.P(-0.1, 0, 30.4);
    const R1 = p.P(W + 0.1, 0, 30.4);
    const R2 = p.P(W + 0.1, D + 0.1, 26.2);
    const R3 = p.P(-0.1, D + 0.1, 26.2);
    fillPoly(p.c, [R0, R1, R2, R3], '#1e3f89');
    const lerp = (A: [number, number], B: [number, number], t: number): [number, number] => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    // the cells one by one: each a slightly different blue, a lit upper edge, a sky sheen band
    // drifting across, the odd glint; the module frames in pale aluminium
    const nu = Math.round((W + 0.2) / 0.98) * 4;
    const nv2 = Math.round((D + 0.1) / 1.0) * 3;
    const CELL = ['#132a68', '#172f74', '#193781', '#1e3f89', '#23468f', '#294996', '#3a5aa8', '#5776bf'];
    const at2 = (u: number, v: number) => lerp(lerp(R0, R1, u), lerp(R3, R2, u), v);
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv2; j++) {
        const u0 = i / nu;
        const u1 = (i + 1) / nu;
        const v0 = j / nv2;
        const v1 = (j + 1) / nv2;
        const sheen = Math.abs(((u0 * 3 - v0 * 0.8 + 10) % 1.4) - 0.7) < 0.12 ? 2 : 0;
        const t = Math.max(0, Math.min(7, Math.round(2 + sheen + (hash(i, j, k.seed + 5) - 0.5) * 2.4 - v0 * 0.8)));
        fillPoly(p.c, [at2(u0, v0), at2(u1, v0), at2(u1, v1), at2(u0, v1)], CELL[t]);
        const a0 = at2(u0, v0);
        const a1 = at2(u1, v0);
        ln(p.c, a0[0], a0[1], a1[0], a1[1], CELL[Math.min(7, t + 2)]);
        if (hash(i, j, k.seed + 9) < 0.025) px(p.c, (a0[0] + a1[0]) / 2, a0[1] + 2, '#e8f0ff', 3, 1);
      }
    for (let i = 1; i < nu; i++) {
      if (i % 4 === 0) continue;
      const A = at2(i / nu, 0);
      const B = at2(i / nu, 1);
      ln(p.c, A[0], A[1], B[0], B[1], '#122860');
    }
    for (let i = 4; i < nu; i += 4) {
      const A = at2(i / nu, 0);
      const B = at2(i / nu, 1);
      ln(p.c, A[0], A[1], B[0], B[1], '#8aa0d0');
    }
    for (let j = 3; j < nv2; j += 3) {
      const A = at2(0, j / nv2);
      const B = at2(1, j / nv2);
      ln(p.c, A[0], A[1], B[0], B[1], '#8aa0d0');
    }
    ln(p.c, R3[0], R3[1], R2[0], R2[1], '#dfe4ea');
    ln(p.c, R0[0], R0[1], R1[0], R1[1], '#9aa8bc');
    // the fascia: a thin galvanised edge round the front and the side
    poly3(p, [[-0.1, D + 0.1, 25.4], [W + 0.1, D + 0.1, 25.4], [W + 0.1, D + 0.1, 26.2], [-0.1, D + 0.1, 26.2]], () => GALV[3], p.rot === 0 ? 1 : 0);
    const aE = p.rot === 0 ? W + 0.1 : -0.1;
    poly3(p, [[aE, D + 0.1, 25.4], [aE, 0, 29.6], [aE, 0, 30.4], [aE, D + 0.1, 26.2]], () => GALV[1], p.rot === 0 ? 0 : 1);
  },
  lights: (k) => [0.25, 0.5, 0.75].map((f) => ({ a: k.w * f, b: k.d * 0.5, z: 26, r: 2.4, color: '#f4f8ff', kind: 'lamp' as const })),
};

// ── the hazmat yard ─────────────────────────────────────────
const MESH = '#2e4a36';
const lab_fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const gate = k.variant === 'gate';
    const b = 0.5;
    const F = front(p, b);
    // welded mesh panels: vertical wires every few px, horizontal ones in pairs; see-through
    const mesh: FaceTex = (u, v) => (u % 5 < 1 || v % 14 < 1.2 || v % 14 > 12.8 ? MESH : null);
    pt(p, F, 0.02, W - 0.02, 0.6, 19.4, mesh, F.light);
    pq(p, F, 0, W, 0.4, 0.9, MESH);
    pq(p, F, 0, W, 19.2, 19.8, '#3a5a44');
    for (let a = 0; a <= W + 0.01; a += 2) lbox(p, Math.min(a, W - 0.08), b - 0.04, 0.08, 0.08, 0, 20.4, mono(coat(['#1a2a20', '#22362a', '#2e4a36', '#3a5a44', '#4a6c54', '#5c7e64']), '#14201a'));
    if (gate) {
      // the gate: a heavier frame, a padlock, the yard's warning sign
      pq(p, F, 0.06, W - 0.06, 1.0, 1.6, '#3a5a44');
      pq(p, F, 0.06, W - 0.06, 18.2, 18.8, '#3a5a44');
      pq(p, F, W / 2 - 0.03, W / 2 + 0.03, 0.6, 19.4, '#3a5a44');
      const [lx, ly] = F.F(W / 2, 9.6);
      px(p.c, lx - 2, ly - 2, '#c8a030', 4, 4);
      pq(p, F, W / 2 - 0.62, W / 2 - 0.08, 11.4, 15.4, YEL[4]);
      pq(p, F, W / 2 - 0.62, W / 2 - 0.08, 14.8, 15.4, '#1e1e22');
      const [gx, gy] = F.F(W / 2 - 0.35, 12.8);
      ghs(p.c, gx, gy, 5, 0);
      pq(p, F, W / 2 + 0.08, W / 2 + 0.5, 11.4, 15.4, '#f4f4ee');
      sign(p, F, W / 2 + 0.12, W / 2 + 0.46, 11.8, 15.0, 'nofood');
    }
    void k;
  },
};

/** The bulk liquid-nitrogen tank on four straight legs, with its bank of frosted ambient vaporisers. */
const lab_lntank: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 60, 0.3);
    // a concrete pad
    lbox(p, 0.05, 0.05, W - 0.1, D - 0.1, 0, 0.8, mono(coat(CONC), CONC[0]));
    // the tank: a tall white cylinder (R tiles) standing on four vertical legs with foot plates
    const ta = 0.95;
    const tb = D / 2;
    const R = 0.575;
    const legZ = 9.2;
    const rx = Math.round(R * 90.5);
    const legs = [45, 135, 225, 315]
      .map((d) => (d * Math.PI) / 180)
      .map((t): [number, number] => [ta + R * 0.74 * Math.cos(t), tb + R * 0.74 * Math.sin(t)])
      .sort((u, v) => u[0] + u[1] - v[0] - v[1]);
    for (const [la, lb] of legs) {
      const [fx, fy] = P(p, la, lb, 0.8);
      const [, ty] = P(p, la, lb, legZ + 3);
      ell(c, fx, fy, 6, 3, '#8a9296');
      ell(c, fx, fy - 1, 5, 2.4, '#b8c0c4');
      px(c, fx - 2, ty, '#8a9296', 5, fy - ty);
      px(c, fx - 2, ty, '#d4dadd', 2, fy - ty);
      px(c, fx + 2, ty, '#6a7276', 1, fy - ty);
    }
    const [tx, ty] = P(p, ta, tb, legZ);
    const R0: Ramp = ['#8a9296', '#a8b0b4', '#c4cace', '#dce2e4', '#eef2f2', '#fbfdfd'];
    layer(c, (l) => {
      // a dark skirt ring where the shell meets the legs
      ell(l, tx, ty, rx, rx / 2, '#6a7276');
      cyl(l, tx, ty - 2, rx, 300, R0, { top: null, ribs: [100, 200] });
      // the domed top: the rim ellipse, then a shallow dome above it, lit from the upper left
      ell(l, tx, ty - 302, rx, rx / 2, R0[3]);
      for (let j = 0; j < 24; j++) {
        const w = rx * Math.sqrt(1 - (j / 24) ** 2);
        for (let i = -Math.round(w); i <= Math.round(w); i++) {
          const t = (i + w) / (2 * w);
          px(l, tx + i, ty - 302 - j, R0[Math.max(0, Math.min(5, Math.round(5.3 - t * 3 + j * 0.03 + (bayer(tx + i, ty - j) - 0.5) * 0.6)))]);
        }
      }
      ell(l, tx - 4, ty - 324, 9, 3, R0[5]);
      // a relief valve and a vent stack on the dome, both upright
      px(l, tx + 10, ty - 338, STEEL[3], 3, 14);
      px(l, tx + 10, ty - 338, STEEL[5], 1, 14);
      px(l, tx + 7, ty - 340, STEEL[4], 9, 3);
      px(l, tx - 18, ty - 330, STEEL[2], 3, 8);
      px(l, tx - 20, ty - 332, STEEL[4], 7, 2);
      // the product band and lettering
      px(l, tx - rx + 2, ty - 162, '#2a5a8a', rx * 2 - 4, 14);
      for (let i = 0; i < 8; i++) px(l, tx - 30 + i * 8, ty - 158, '#f4f6f8', 4, 6);
      // gauges and valves at the foot, a green gas placard
      px(l, tx - 18, ty - 44, '#e8eaea', 12, 12);
      ell(l, tx - 12, ty - 38, 4, 4, '#2a2a30');
      ell(l, tx - 12, ty - 38, 3, 3, '#f6f6f2');
      ln(l, tx - 12, ty - 38, tx - 10, ty - 40, '#c8382a');
      fillPoly(l, [[tx + 22, ty - 68], [tx + 32, ty - 58], [tx + 22, ty - 48], [tx + 12, ty - 58]], '#22844b');
      fillPoly(l, [[tx + 22, ty - 65], [tx + 29, ty - 58], [tx + 22, ty - 51], [tx + 15, ty - 58]], '#36a062');
      px(l, tx + 20, ty - 56, '#f4f6f8', 4, 2);
    }, { outline: 0.55, rect: [tx - rx - 8, ty - 352, tx + rx + 8, ty + rx / 2 + 6] });
    // the vaporiser bank: two rows of finned tubes, all the same height, on headers top and bottom
    const va = [W - 0.95, W - 0.5];
    const vb = [0.4, 0.78, 1.16, 1.54];
    const HV = 37;
    const pipeM = mono(coat(['#7a828b', '#979fa8', '#b5bcc4', '#d4dadf', '#eff2f4', '#ffffff']), STEEL[1]);
    const frostM = mono(coat(['#9ab4c2', '#b8d0dc', '#d0e4ec', '#e4f0f6', '#f4fafc', '#ffffff']), '#8aa4b2');
    // the transfer lines from the tank to the bank: straight runs along a at the foot and the top
    lbox(p, ta + R * 0.98, tb - 0.04, va[0] - ta - R * 0.98, 0.08, legZ + 1.6, 1.0, frostM);
    lbox(p, ta + R * 0.98, tb - 0.04, va[0] - ta - R * 0.98, 0.08, HV - 1.4, 0.8, pipeM);
    const rows = p.rot === 0 ? va : [...va].reverse();
    for (const a of rows) {
      lbox(p, a - 0.035, vb[0] - 0.06, 0.07, vb[3] - vb[0] + 0.12, 0.8, 1.0, frostM);
      for (const b of vb) {
        const [x, y] = P(p, a, b, 2.2);
        const [, yt] = P(p, a, b, HV);
        const h = y - yt;
        layer(c, (l) => {
          for (let i = 0; i < h; i++) {
            const frost = i < h * 0.32;
            const fin = i % 4 === 0;
            px(l, x - 4, y - i, frost ? (fin ? '#f8fcff' : '#dcecf4') : fin ? STEEL[5] : STEEL[3], 8, 1);
            px(l, x - 4, y - i, frost ? '#ffffff' : STEEL[6], 2, 1);
            px(l, x + 3, y - i, frost ? '#b8d0dc' : STEEL[1], 1, 1);
          }
        }, { outline: 0.5, rect: [x - 8, yt - 4, x + 8, y + 4] });
      }
      lbox(p, a - 0.035, vb[0] - 0.06, 0.07, vb[3] - vb[0] + 0.12, HV, 0.8, pipeM);
    }
    // the cross-headers tying the two rows together, and the outlet line to the building
    lbox(p, va[0], vb[0] - 0.03, va[1] - va[0], 0.06, HV + 0.1, 0.6, pipeM);
    lbox(p, va[0], vb[3] - 0.03, va[1] - va[0], 0.06, 0.9, 0.8, frostM);
    lbox(p, va[1], vb[3] - 0.03, W - 0.12 - va[1], 0.06, 1.0, 0.6, pipeM);
    void k;
  },
  anim(p, k) {
    // cold vapour drifting off the frosted vaporiser feet
    const u = p.k / 4;
    const [x, y] = P(p, k.w - 0.7, 0.9, 0.8);
    for (let i = 0; i < 5; i++) {
      const t = (k.t * 0.25 + i / 5) % 1;
      p.c.globalAlpha = 0.28 * (1 - t);
      ell(p.c, x + (i - 2) * 8 * u + t * 10 * u, y - 20 * u - t * 30 * u, (6 + t * 10) * u, (3 + t * 5) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

/** A horizontal waste-solvent tank on two upright saddles in a yellow steel bund. */
const lab_tank: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const rot0 = p.rot === 0;
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.05, 30, 0.28);
    lbox(p, 0.05, 0.1, W - 0.1, D - 0.15, 0, 3.2, { front: coat(YEL), side: coat(YEL), top: (light) => (u, v) => ((u + v) % 12 < 1 ? '#2e2e28' : light ? '#4a4a40' : '#3a3a32'), edge: YEL[0] });
    // the shell: a round cylinder along a (R tiles, R·ZT in z) on two saddles
    const R = 0.6;
    const Rz = R * ZT;
    const bc = D / 2;
    const zc = 3.2 + 2.4 + Rz;
    const a0 = 0.32;
    const a1 = W - 0.32;
    const am = W / 2;
    const sad = [0.8, W - 0.8];
    // the saddles: a base plate on the bund floor and an upright web up under the shell
    const galvM = mono(coat(GALV), GALV[0]);
    for (const a of rot0 ? sad : [...sad].reverse()) {
      lbox(p, a - 0.1, bc - R * 0.85, 0.2, R * 1.7, 3.2, 0.5, galvM);
      lbox(p, a - 0.04, bc - R * 0.72, 0.08, R * 1.44, 3.7, zc - Rz * 0.7 - 3.7, galvM);
    }
    // the hoops and the label band along a; the surface strips back to front (a convex shell)
    const cuts = [a0, sad[0] - 0.05, sad[0] + 0.05, am - 0.62, am + 0.62, sad[1] - 0.05, sad[1] + 0.05, a1];
    const kindAt = (i: number) => (i === 1 || i === 5 ? 'hoop' : i === 3 ? 'band' : 'shell');
    const SH: Ramp = ['#7e7e74', '#9a9a8e', '#b4b4a8', '#cacabf', '#dcdcd2', '#ececE4', '#f8f8f2', '#ffffff'];
    const N = 36;
    const facing = (n: number) => {
      const t = ((n + 0.5) / N) * Math.PI * 2;
      return Math.cos(t) + Math.sin(t) * 1.25;
    };
    const strips: number[] = [];
    for (let i = 0; i < N; i++) if (facing(i) > -0.1) strips.push(i);
    strips.sort((i, j) => facing(i) - facing(j));
    const ptS = (a: number, t: number) => p.P(a, bc + R * Math.cos(t), zc + Rz * Math.sin(t));
    for (const i of strips) {
      const t0 = (i / N) * Math.PI * 2;
      const t1 = ((i + 1) / N) * Math.PI * 2;
      const tm = (t0 + t1) / 2;
      const lit = 0.5 + 0.42 * Math.sin(tm) + 0.22 * Math.cos(tm) * (rot0 ? 1 : 0.4);
      for (let s = 0; s < cuts.length - 1; s++) {
        const kd = kindAt(s);
        let col: string;
        if (kd === 'hoop') col = at(SH, Math.max(0, lit * 6 - 1.6));
        else if (kd === 'band' && Math.cos(tm) > 0.05 && Math.sin(tm) < 0.62) col = at(YEL, Math.max(0, Math.min(5, lit * 5 + 0.4)));
        else col = at(SH, Math.max(0, Math.min(7, lit * 7 + 0.2)));
        fillPoly(c, [ptS(cuts[s], t0), ptS(cuts[s + 1], t0), ptS(cuts[s + 1], t1), ptS(cuts[s], t1)], col);
      }
    }
    // a lit spine along the top
    const [s0x, s0y] = ptS(a0 + 0.04, 1.75);
    const [s1x, s1y] = ptS(a1 - 0.04, 1.75);
    ln(c, s0x, s0y, s1x, s1y, '#ffffff', 2);
    // the dished head at the visible end, bulging out a little
    const aE = rot0 ? a1 : a0;
    const out = rot0 ? 1 : -1;
    const head = (s: number, da: number, col: string) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        pts.push(p.P(aE + da * out, bc + R * s * Math.cos(t), zc + Rz * s * Math.sin(t)));
      }
      fillPoly(c, pts, col);
    };
    head(1, 0, rot0 ? '#a8a89c' : '#d8d8ce');
    head(0.9, 0.05, rot0 ? '#b8b8ac' : '#e2e2d8');
    head(0.66, 0.1, rot0 ? '#c6c6ba' : '#ececE4');
    head(0.34, 0.13, rot0 ? '#d2d2c6' : '#f4f4ec');
    // the yellow band's dark edges, the warning and a hazard diamond on the near side
    const F = front(p, bc + R);
    for (const ae of [am - 0.62, am + 0.62]) pq(p, F, ae - 0.02, ae + 0.02, zc - Rz * 0.25, zc + Rz * 0.45, '#1e1e22');
    planeText(p, F, am - 0.6, am + 0.6, zc - 1.2, zc + 0.8, 'WASTE', '#1e1e22');
    const [gx, gy] = P(p, W - 1.2, bc + R * 0.96, zc + Rz * 0.25);
    ghs(c, gx, gy, 6, 0);
    // a manway on top, a vent pipe with a flame arrester, both upright
    const [mx, my] = P(p, W * 0.38, bc, zc + Rz);
    ell(c, mx, my + 1, 14, 7, '#7e7e74');
    px(c, mx - 14, my - 3, '#9a9a8e', 28, 4);
    ell(c, mx, my - 3, 14, 7, '#c8c8bc');
    ell(c, mx - 2, my - 4, 7, 3, '#e8e8e0');
    const [vx, vy] = P(p, W * 0.66, bc, zc + Rz);
    px(c, vx - 1, vy - 28, STEEL[3], 3, 28);
    px(c, vx - 1, vy - 28, STEEL[5], 1, 28);
    px(c, vx - 4, vy - 34, '#5a5a50', 9, 6);
    px(c, vx - 4, vy - 34, '#7a7a70', 9, 1);
    // a drain valve under the head, its pipe straight down into the bund
    const [dx, dy] = P(p, aE - out * 0.2, bc + R * 0.4, zc - Rz * 0.9);
    const [, dyb] = P(p, aE - out * 0.2, bc + R * 0.4, 3.4);
    px(c, dx - 1, dy, STEEL[3], 3, dyb - dy);
    px(c, dx - 4, dy + 4, '#c8382a', 8, 3);
    void k;
  },
};

/** Outdoor drum store: drums on two spill pallets, a funnel, labels. */
const lab_drumstore: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.92, 10, 0.26);
    const yel = coat(YEL);
    for (let i = 0; i < 2; i++) lbox(p, 0.05 + i * (W / 2), 0.1, W / 2 - 0.1, 0.84, 0, 1.6, { front: yel, side: yel, top: (light) => (u, v) => (light === 2 && (u % 5 < 1.4 || v % 5 < 1.4) ? '#2a2c30' : light === 2 ? '#151619' : at(YEL, light ? 3 : 2)), edge: YEL[0] });
    const Rn = rng(k.seed * 5 + 9);
    const bodies: Ramp[] = [
      ['#14306a', '#1c4288', '#2656a8', '#3268c0', '#4a82d4', '#78a6e4'],
      ['#1a1c20', '#24272c', '#30343a', '#3e434a', '#50565e', '#6a7078'],
      ['#3a3f45', '#50565d', '#677078', '#828b94', '#a2aab2', '#c4cad0'],
    ];
    const spots: [number, number][] = [];
    for (let i = 0; i < Math.round(W * 2); i++) spots.push([0.28 + (i % Math.round(W)) * 0.5 + (Math.floor(i / Math.round(W)) ? 0.06 : 0), Math.floor(i / Math.round(W)) ? 0.7 : 0.32]);
    spots.sort((m, n) => m[0] + m[1] - (n[0] + n[1]));
    for (const [a, b] of spots) {
      const [x, y] = P(p, a, b, 1.6);
      const r = bodies[Math.floor(Rn() * bodies.length)];
      layer(p.c, (l) => {
        cyl(l, x, y, 15, 34, r, { ribs: [11, 23], top: r[4] });
        ell(l, x - 6, y - 35, 2.5, 1.4, Rn() < 0.5 ? '#e8e8e2' : '#c8382a');
        px(l, x - 9, y - 20, Rn() < 0.5 ? '#f4f2ea' : YEL[4], 8, 8);
        ghs(l, x - 5, y - 16, 3, 0);
      }, { outline: 0.55, rect: [x - 20, y - 46, x + 20, y + 10] });
    }
  },
};

/** A gas cylinder cage: galvanised frame, mesh front, a roof; cylinders chained inside. */
const lab_cylcage: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.92, 20, 0.26);
    lbox(p, 0.05, 0.1, W - 0.1, 0.82, 0, 0.4, mono(coat(CONC), CONC[0]));
    const cols: [Ramp, string][] = [
      [['#1a1c1e', '#24272a', '#30343a', '#3e434a', '#50565e', '#6a7078'], '#2a2c30'],
      [['#5a5e60', '#72777a', '#8b9094', '#a5aaae', '#bec2c6', '#d6dadc'], '#3a6a3a'],
      [['#4a1a1e', '#6a2428', '#8a3034', '#a8403e', '#c45a52', '#da7a6e'], '#4a1a1e'],
      [['#1a1c1e', '#24272a', '#30343a', '#3e434a', '#50565e', '#6a7078'], '#f4f4ee'],
      [['#2a4a3a', '#36604a', '#44785a', '#58906c', '#70a882', '#8ec09c'], '#2a2c30'],
    ];
    const Rn = rng(k.seed * 3 + 5);
    layer(p.c, (l) => {
      for (const b of [0.36, 0.64])
        for (let a = 0.3; a < W - 0.2; a += 0.34) {
          const [x, y] = P(p, a, b, 0.4);
          const [r, sh] = cols[Math.floor(Rn() * cols.length)];
          cyl(l, x, y, 7, 56, r, { top: null });
          ell(l, x, y - 56, 7, 3.5, sh);
          px(l, x - 2, y - 64, '#b8a050', 4, 8);
          px(l, x - 3, y - 66, '#5a5e64', 6, 3);
        }
    }, { outline: 0.5 });
    // the cage: posts, mesh front and side, chains, a sloping roof
    const F = front(p, 0.9);
    const mesh: FaceTex = (u, v) => (u % 6 < 1 || v % 6 < 1 ? GALV[2] : null);
    pt(p, F, 0.06, W - 0.06, 0.4, 17, mesh, F.light);
    pt(p, side(p, p.rot === 0 ? W - 0.06 : 0.06), 0.12, 0.9, 0.4, 17, mesh, p.rot === 0 ? 0 : 1);
    for (const a of [0.05, W / 2 - 0.03, W - 0.11]) lbox(p, a, 0.84, 0.06, 0.06, 0, 18, mono(galv, GALV[0]));
    pq(p, F, 0.06, W - 0.06, 9.6, 9.9, '#c8a030');
    poly3(p, [[0, 0.05, 19.4], [W, 0.05, 19.4], [W, 1.0, 18], [0, 1.0, 18]], (u: number) => (u % 14 < 1.4 ? GALV[1] : GALV[3]), 2);
    pq(p, F, 0.4, W - 0.4, 14.6, 16.4, '#f4f4ee');
    planeText(p, F, 0.4, W - 0.4, 14.6, 16.4, 'GAS STORE', '#22844b');
  },
};

/** A chemical store container: ribbed steel, vents, double doors, hazard placards, an extinguisher. */
const lab_store: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.05, 26, 0.3);
    const ribs: Mat = (light) => (u, v, x, y) => {
      const r = u % 9;
      let i = light === 2 ? 4.2 : light === 1 ? 3.2 : 2;
      if (r < 2) i += 0.8;
      else if (r > 7) i -= 0.8;
      if (v < 3) i -= 1;
      if (hash(x, y, 99) < 0.02) i -= 1;
      return at(['#7a8288', '#949ca2', '#aeb6bc', '#c6cdd2', '#dce2e6', '#eef2f4'], i);
    };
    lbox(p, 0.05, 0.1, W - 0.1, D - 0.2, 0, 1.2, mono(coat(YEL), YEL[0]));
    lbox(p, 0.1, 0.15, W - 0.2, D - 0.3, 1.2, 23, { front: ribs, side: ribs, top: coat(['#8a9298', '#a2aab0', '#bcc4ca', '#d2dade', '#e4eaee', '#f2f6f8']), edge: '#5a6268' });
    const F = front(p, D - 0.15);
    // double doors with locking bars
    pq(p, F, W / 2 - 0.9, W / 2 + 0.9, 1.4, 20.4, '#8a9298');
    pq(p, F, W / 2 - 0.86, W / 2 - 0.02, 1.6, 20.2, '#b8c0c6');
    pq(p, F, W / 2 + 0.02, W / 2 + 0.86, 1.6, 20.2, '#b0b8be');
    for (const a of [W / 2 - 0.5, W / 2 - 0.2, W / 2 + 0.2, W / 2 + 0.5]) pq(p, F, a - 0.02, a + 0.02, 1.6, 20.2, '#6a7278');
    pq(p, F, W / 2 - 0.2, W / 2 + 0.2, 9.4, 9.9, '#3a3e44');
    // vents high and low
    for (const z of [2.4, 19]) for (const a of [0.3, W - 0.7]) for (let i = 0; i < 3; i++) pq(p, F, a, a + 0.4, z + i * 0.45, z + i * 0.45 + 0.22, '#4a5056');
    // placards
    const kinds = [0, 2, 3, 1];
    kinds.forEach((kd, i) => {
      const [gx, gy] = F.F(0.45 + (i % 2) * 0.42 + (i > 1 ? W - 1.35 : 0), 14.6);
      ghs(p.c, gx, gy, 8, kd);
    });
    // an Ex light over the doors, an extinguisher on a post beside
    pq(p, F, W / 2 - 0.2, W / 2 + 0.2, 21, 22.2, '#2a2e34');
    pq(p, F, W / 2 - 0.16, W / 2 + 0.16, 21.2, 21.8, '#fff4c8');
    const [ex, ey] = P(p, W - 0.25, D + 0.15, 0);
    layer(p.c, (l) => {
      px(l, ex - 1, ey - 40, '#5a6068', 3, 40);
      for (let j = 0; j < 22; j++) {
        const w = j > 19 ? 4 - (j - 19) * 1.2 : 4;
        for (let i = -w; i < w; i++) px(l, ex + 4 + i, ey - 8 - j, RED[(i + w) / (2 * w) < 0.3 ? 5 : (i + w) / (2 * w) < 0.6 ? 4 : 3]);
      }
      px(l, ex + 1, ey - 32, '#2a2a30', 6, 3);
    }, { outline: 0.55 });
  },
};

/** An IBC tote: a white tank in a galvanised cage on a pallet, half full, a tap. */
const lab_ibc: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.9, 0.9, 12, 0.26);
    lbox(p, 0.12, 0.14, 0.76, 0.74, 0, 1.4, mono(coat(GALV), GALV[0]));
    const fill = 0.35 + (k.seed % 3) * 0.2;
    const tank: Mat = (light, _w, h) => (_u, v, x, y) => {
      const lvl = v < h * fill;
      let i = light === 2 ? 4.4 : light === 1 ? 3.4 : 2.2;
      if (lvl) i -= 1.2;
      if (hash(x, y, 100) < 0.03) i -= 0.6;
      return at(['#9aa49e', '#b6c0ba', '#ced6d0', '#e2e8e4', '#f0f4f2', '#fbfdfc'], i);
    };
    lbox(p, 0.16, 0.18, 0.68, 0.66, 1.4, 10.4, { front: tank, side: tank, top: tank, edge: '#7a847e' });
    // the cage grid over the tank
    const F = front(p, 0.84);
    const S = side(p, p.rot === 0 ? 0.84 : 0.16);
    const grid: FaceTex = (u, v) => (u % 14 < 1.4 || v % 12 < 1.4 ? GALV[3] : null);
    pt(p, F, 0.16, 0.84, 1.4, 11.8, grid, F.light);
    pt(p, S, 0.18, 0.84, 1.4, 11.8, grid, S.light);
    const [cx, cy] = P(p, 0.5, 0.5, 11.8);
    ell(p.c, cx, cy, 6, 3, '#2a2c30');
    ell(p.c, cx, cy - 1, 5, 2.4, '#4a4c52');
    const [vx, vy] = F.F(0.5, 2.2);
    px(p.c, vx - 3, vy - 2, '#1e1e22', 6, 4);
    px(p.c, vx - 1, vy + 2, '#1e1e22', 2, 3);
    pq(p, F, 0.24, 0.5, 6.4, 8.4, '#f4f2ea');
    const [gx, gy] = F.F(0.65, 7.4);
    ghs(p.c, gx, gy, 4, k.seed);
  },
};

// ── flat details of the ground ──────────────────────────────
const lab_decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'manhole';
    const c = p.c;
    const [x, y] = P(p, 0.5 * p.pw, 0.5 * p.pd, 0);
    const Rn = rng(k.seed * 7 + 3);
    const line = (a0: number, b0: number, a1: number, b1: number, col: string, w = 2) => {
      const [x0, y0] = P(p, a0, b0, 0);
      const [x1, y1] = P(p, a1, b1, 0);
      ln(c, x0, y0, x1, y1, col, w);
    };
    if (v === 'manhole') {
      ell(c, x, y, 18, 9, '#2a2c30');
      ell(c, x, y, 16, 8, '#4a4e54');
      for (let i = -12; i <= 12; i += 4) ln(c, x + i, y - 6 + Math.abs(i) * 0.1, x + i, y + 6 - Math.abs(i) * 0.1, '#3a3e44');
      ell(c, x, y, 4, 2, '#5a6068');
    } else if (v === 'drain') {
      // a linear slot drain along the prop
      const [x0, y0] = P(p, 0.05, 0.5, 0);
      const [x1, y1] = P(p, p.pw - 0.05, 0.5, 0);
      ln(c, x0, y0, x1, y1, '#3a3e44', 4);
      for (let t = 0; t < 1; t += 0.04) px(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 1, '#8a9096', 1, 2);
    } else if (v === 'bay') {
      // parking bay lines: the two sides of a bay along local b
      line(0.05, 0.05, 0.05, p.pd - 0.05, '#f2f2ec');
      line(p.pw - 0.05, 0.05, p.pw - 0.05, p.pd - 0.05, '#f2f2ec');
    } else if (v === 'ev') {
      // a green EV bay with a white plug symbol
      const corners = [P(p, 0.1, 0.1), P(p, p.pw - 0.1, 0.1), P(p, p.pw - 0.1, p.pd - 0.1), P(p, 0.1, p.pd - 0.1)];
      c.globalAlpha = 0.55;
      fillPoly(c, corners, '#2a8a5a');
      c.globalAlpha = 1;
      const [sx, sy] = P(p, p.pw / 2, p.pd * 0.22, 0);
      fillPoly(c, [[sx - 10, sy], [sx, sy - 5], [sx + 10, sy], [sx, sy + 5]], '#f2f2ec');
      fillPoly(c, [[sx - 6, sy], [sx, sy - 3], [sx + 6, sy], [sx, sy + 3]], '#2a8a5a');
      line(p.pw / 2 - 0.1, p.pd * 0.22 - 0.4, p.pw / 2 - 0.1, p.pd * 0.22 - 0.15, '#f2f2ec');
      line(p.pw / 2 + 0.1, p.pd * 0.22 - 0.4, p.pw / 2 + 0.1, p.pd * 0.22 - 0.15, '#f2f2ec');
      // the bay's white outline and a concrete wheel stop at its head
      line(0.1, 0.1, 0.1, p.pd - 0.1, '#f2f2ec');
      line(p.pw - 0.1, 0.1, p.pw - 0.1, p.pd - 0.1, '#f2f2ec');
      line(0.1, p.pd - 0.1, p.pw - 0.1, p.pd - 0.1, '#f2f2ec');
      line(0.5, p.pd - 0.8, p.pw - 0.5, p.pd - 0.8, '#c8c4bc');
      line(0.5, p.pd - 0.75, p.pw - 0.5, p.pd - 0.75, '#8a867e');
    } else if (v === 'bike') {
      // a white bicycle symbol on the cycle path
      ell(c, x - 12, y, 7, 3.5, '#f2f0ea');
      ell(c, x - 12, y, 5, 2.5, '#9e5142');
      ell(c, x + 12, y, 7, 3.5, '#f2f0ea');
      ell(c, x + 12, y, 5, 2.5, '#9e5142');
      ln(c, x - 12, y, x, y - 2, '#f2f0ea', 2);
      ln(c, x, y - 2, x + 12, y, '#f2f0ea', 2);
      ln(c, x - 4, y - 3, x + 6, y - 3, '#f2f0ea', 2);
    } else if (v === 'arrow') {
      const [x0, y0] = P(p, 0.5, 0.15, 0);
      const [x1, y1] = P(p, 0.5, 0.85, 0);
      ln(c, x0, y0, x1, y1, '#f2f2ec', 3);
      fillPoly(c, [[x1 - 8, y1 - 8], [x1 + 6, y1 - 2], [x1 - 2, y1 + 4]], '#f2f2ec');
    } else if (v === 'hatch') {
      // a yellow hatched no-parking box
      const corners = [P(p, 0.05, 0.05), P(p, p.pw - 0.05, 0.05), P(p, p.pw - 0.05, p.pd - 0.05), P(p, 0.05, p.pd - 0.05)];
      for (let i = 0; i < 4; i++) ln(c, corners[i][0], corners[i][1], corners[(i + 1) % 4][0], corners[(i + 1) % 4][1], '#f2c840', 2);
      for (let t = 0.15; t < 1; t += 0.18) line(0.05 + t * (p.pw - 0.1), 0.05, 0.05, 0.05 + t * (p.pd - 0.1), '#f2c840');
    } else if (v === 'tactile') {
      const corners = [P(p, 0.1, 0.2), P(p, p.pw - 0.1, 0.2), P(p, p.pw - 0.1, 0.8), P(p, 0.1, 0.8)];
      fillPoly(c, corners, '#e8c040');
      for (let i = 0; i < 30; i++) {
        const [dx, dy] = P(p, 0.15 + Rn() * (p.pw - 0.3), 0.25 + Rn() * 0.5, 0);
        px(c, dx, dy, '#c89a20', 2, 1);
      }
    } else if (v === 'oil') {
      c.globalAlpha = 0.35;
      ell(c, x + (Rn() - 0.5) * 20, y, 16 + Rn() * 8, 6 + Rn() * 3, '#1a1a1e');
      c.globalAlpha = 1;
    } else if (v === 'puddle') {
      ell(c, x, y + 1, 22, 8, '#2a3038');
      ell(c, x, y, 20, 7, '#6a8aa6');
      ell(c, x - 6, y - 2, 9, 2, '#a8c8de');
    } else if (v === 'leaves') {
      for (let i = 0; i < 16; i++) {
        const [fx, fy] = P(p, Rn() * p.pw, Rn() * p.pd, 0);
        const col = ['#d8c050', '#b8a040', '#e8d070', '#a88a3a'][Math.floor(Rn() * 4)];
        px(c, fx, fy, col, 3, 2);
        px(c, fx + 1, fy - 1, col, 1, 1);
      }
    } else if (v === 'zebra') {
      for (let i = 0; i < 6; i++) {
        const a = 0.1 + (i / 6) * (p.pw - 0.2);
        const q = [P(p, a, 0.1), P(p, a + (p.pw - 0.2) / 12, 0.1), P(p, a + (p.pw - 0.2) / 12, p.pd - 0.1), P(p, a, p.pd - 0.1)];
        fillPoly(c, q, '#f2f2ec');
      }
    } else if (v === 'dash') {
      // a white dashed centre line along the prop (the middle of a two-way cycle path)
      for (let a = 0.15; a < p.pw - 0.1; a += 0.5) line(a, p.pd / 2, Math.min(p.pw - 0.05, a + 0.28), p.pd / 2, '#ecebe4', 2);
    } else if (v === 'tape') {
      // yellow and black floor tape round a hazard storage spot
      const q = [P(p, 0.04, 0.04), P(p, p.pw - 0.04, 0.04), P(p, p.pw - 0.04, p.pd - 0.04), P(p, 0.04, p.pd - 0.04)];
      for (let i = 0; i < 4; i++) {
        const [x0, y0] = q[i];
        const [x1, y1] = q[(i + 1) % 4];
        const n2 = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
        for (let j = 0; j < n2; j++) {
          const t0 = j / n2;
          ln(c, x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * (t0 + 1 / n2), y0 + (y1 - y0) * (t0 + 1 / n2), j % 2 ? '#1e1e22' : '#f2c63e', 2);
        }
      }
    } else if (v === 'scuff') {
      // grey rubber marks where the trolleys turn in by the door
      for (let i = 0; i < 7; i++) {
        const a0 = 0.15 + Rn() * 0.5;
        const b0 = 0.15 + Rn() * 0.6;
        const [x0, y0] = P(p, a0, b0, 0);
        const [x1, y1] = P(p, a0 + 0.2 + Rn() * 0.2, b0 + (Rn() - 0.5) * 0.3, 0);
        c.globalAlpha = 0.35;
        ln(c, x0, y0, x1, y1, '#5a6066', 1);
        c.globalAlpha = 1;
      }
    } else if (v === 'spill') {
      // a small blue spill being soaked up by white absorbent pads
      ell(c, x + 4, y + 2, 20, 9, '#3a6aa8');
      ell(c, x + 2, y + 1, 17, 7.5, '#4a84c8');
      ell(c, x - 3, y - 1, 6, 2, '#8ab8e8');
      for (const [dx, dy] of [[-10, -2], [8, 4], [16, -3]] as const) {
        fillPoly(c, [[x + dx - 7, y + dy], [x + dx, y + dy - 3.5], [x + dx + 7, y + dy], [x + dx, y + dy + 3.5]], '#e8ecec');
        fillPoly(c, [[x + dx - 6, y + dy], [x + dx, y + dy - 3], [x + dx + 6, y + dy], [x + dx, y + dy + 3]], '#f8fafa');
        ln(c, x + dx - 4, y + dy + 1, x + dx + 4, y + dy - 1, '#c8d0d2');
      }
    } else if (v === 'floordrain') {
      ell(c, x, y, 9, 4.5, '#5a626a');
      ell(c, x, y, 7, 3.5, '#9aa2aa');
      for (let i = -5; i <= 5; i += 2) px(c, x + i, y - 2 + Math.abs(i) * 0.1, '#3a4048', 1, 4);
    } else if (v === 'stones') {
      // stepping stones through the grass
      for (let i = 0; i < 3; i++) {
        const [sx, sy] = P(p, 0.25 + i * 0.25, 0.3 + (i % 2) * 0.35, 0);
        ell(c, sx, sy + 1, 11, 5.5, '#5e5c58');
        ell(c, sx, sy, 10, 5, '#b4b0a8');
        ell(c, sx - 2, sy - 1, 5, 2, '#d0ccc4');
      }
    }
  },
};

export const CHEMLAB_SITE: Record<string, PropArt> = {
  lab_bench,
  lab_pergola,
  lab_bikeshare,
  lab_banner,
  lab_lamp,
  lab_bin,
  lab_bikes,
  lab_sign,
  lab_planter,
  lab_charger,
  lab_carport,
  lab_fence,
  lab_lntank,
  lab_tank,
  lab_drumstore,
  lab_cylcage,
  lab_store,
  lab_ibc,
  lab_decal,
};

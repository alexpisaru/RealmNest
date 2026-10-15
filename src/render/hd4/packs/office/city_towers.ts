// Office — the city round the plaza: glass towers with roof decks, the
// elevated monorail and its train, the canal's stone edge and a footbridge.
//   torre        a glass tower, variant 'storeys-roof': 6..24 storeys over a
//                two-storey stone base; roof piscina | terrazza | tecnico
//   monorotaia   the guideway (length along a, d = 1): a white box beam with
//                its top at z = 62, on round pillars (see pillarsAt)
//   trenoM       the monorail train (same footprint as the track it sits on):
//                skirts from z = 62, body underside z = 71, roof ~ z = 95;
//                a cab at both ends (it runs back and forth)
//   bordoCanale  the canal's cream coping, a glass balustrade, lamps (water on
//                the b = 0 side; variant 'fronte': water on the b = d side)
//   ponte        a footbridge over the canal: span along a, d = 2
// 1 z ≈ 10 cm (4 px), a storey is 32 z. Light from the upper left: the front
// (b = d) is lit for rot 0; the visible side is a = w (rot 0) or a = 0 (rot 1).
import { darken, mix } from '../../../color';
import type { PropMeta } from '../../../../data/props';
import { type Light, type Mat, texPara } from '../../../hd/kit';
import { parseColor } from '../../../hd/soft';
import type { PropPainter, V2 } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, bayer, type C, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, OUTL, px, R, type Ramp, rng, SHADOW, soft } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';

type V3 = [number, number, number];
type Pl = Plane & { at: (u: number, z: number) => V3 };
type Rect = [number, number, number, number];

// ── palette ─────────────────────────────────────────────────
/** deep blue curtain-wall glass, dark → sky reflection */
const GL: Ramp = ['#0c1a3a', '#14295a', '#1c3768', '#23447c', '#28508e', '#3462a2', '#3f72b4', '#5a8cc8', '#7aa6dc', '#a4c4ea', '#c4dcf4'];
/** cream / ivory stone and fins */
const CR: Ramp = ['#857456', '#a39174', '#bfae8e', '#d6c7a8', '#e6dbc0', '#f1e9d6', '#faf5e8', '#fffdf6'];
/** warm light inside */
const LIT: Ramp = ['#8e5a22', '#b87a34', '#dc9e4a', '#f2bc62', '#ffd98a', '#ffe7b0', '#fff4d8'];
const STEEL: Ramp = ['#2e343e', '#46505c', '#66717e', '#8c96a2', '#b4bcc6', '#dde2e8', '#f6f8fa'];
const BRONZE: Ramp = ['#2a2018', '#3e3024', '#54422f', '#6c563c', '#86704e'];
const POOL: Ramp = ['#0a5a7a', '#10789a', '#1896b6', '#24b0cc', '#3ec6dc', '#68d8e8', '#9ce8f2', '#d8f8fc'];
/** white concrete of the guideway, cool in the shade */
const CONC: Ramp = ['#7c7f8e', '#9a9daa', '#b6b8c4', '#ced0d8', '#e2e3e8', '#eff0f2', '#fafaf8'];
const PAVE: Ramp = ['#a89a80', '#c2b498', '#d6c9ae', '#e4d9c0', '#eee6d2', '#f6f0e2'];
const TEAK: Ramp = ['#4e321e', '#6a442a', '#865a38', '#a07248', '#b98a5c', '#d0a674'];
const GRAPH: Ramp = ['#1c1e24', '#2a2d35', '#3a3e48', '#4c515d', '#626875', '#7c8290'];
const CUSH: Ramp = ['#a29e94', '#bebab0', '#d8d4ca', '#e9e6de', '#f5f3ee', '#ffffff'];
const FROND: Ramp = ['#10301e', '#17442a', '#205a34', '#2b7240', '#3e8c48', '#5aa652', '#82c464', '#b4dc7c'];
const TRUNK: Ramp = ['#4a3018', '#6a4622', '#8c6230', '#ae8040', '#cca058', '#e6c47c'];
const OLIVE: Ramp = ['#26362a', '#344832', '#465c3c', '#5a7048', '#708656', '#8a9e68', '#a6b880'];
const GRASS: Ramp = ['#2e5a26', '#3a6e2c', '#468234', '#54953c', '#64a846', '#7aba52'];
const WARM = '#ffd49a';

// ── small helpers ───────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Depth of a local point for back-to-front sorting (bigger is nearer). */
const depth = (p: PropPainter, a: number, b: number) => (p.rot ? b - a : a + b);
/** Face px per tile along a vertical plane. */
const UT = (p: PropPainter) => Math.hypot(16, 8) * p.k;

// ── fast faces ──────────────────────────────────────────────
// The towers' big faces cover millions of pixels: their textures return packed
// colours (parseColor) and are written straight into the CPU raster.
type PTex = (u: number, v: number, x: number, y: number) => number;
type PMat = (light: Light, w: number, h: number) => PTex;
// (typed arrays: packed colours above 2^31 would be boxed doubles in a plain array)
const pk = (r: Ramp) => Uint32Array.from(r.map(parseColor));
const atP = (r: Uint32Array, i: number) => {
  const j = (i + 0.5) | 0;
  return r[j < 0 ? 0 : j >= r.length ? r.length - 1 : j];
};
const BAYF = new Float64Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));
/** kit4's bayer() on a typed array, for the hot loops. */
const bayT = (x: number, y: number) => BAYF[((y & 3) << 2) | (x & 3)];
const hex = (v: number) => `#${[v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** texPara for packed opaque colours (0 skips a pixel). */
function fastPara(c: C, o: V2, U: V2, V: V2, tex: PTex) {
  const s = soft(c);
  if (!s || s.globalAlpha < 0.999) {
    texPara(c, o, U, V, (u, v, x, y) => {
      const k = tex(u, v, x, y);
      return k ? hex(k) : null;
    });
    return;
  }
  const det = U[0] * V[1] - U[1] * V[0];
  if (Math.abs(det) < 1e-6) return;
  const lu = Math.hypot(U[0], U[1]);
  const lv = Math.hypot(V[0], V[1]);
  const xs = [o[0], o[0] + U[0], o[0] + V[0], o[0] + U[0] + V[0]];
  const ys = [o[1], o[1] + U[1], o[1] + V[1], o[1] + U[1] + V[1]];
  const { width: W, height: H, data, ox, oy } = s;
  const x0 = Math.max(Math.floor(Math.min(...xs)), ox);
  const x1 = Math.min(Math.ceil(Math.max(...xs)), ox + W);
  const y0 = Math.max(Math.floor(Math.min(...ys)), oy);
  const y1 = Math.min(Math.ceil(Math.max(...ys)), oy + H);
  const cu = V[1] / det;
  const cv = -U[1] / det;
  const hx = 0.5 - o[0];
  let bx0 = Infinity;
  let bx1 = -Infinity;
  let by0 = Infinity;
  let by1 = -Infinity;
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - o[1];
    let lo = x0;
    let hi = x1 - 1;
    const ku = (hx * V[1] - dy * V[0]) / det;
    if (cu !== 0) {
      const a = -ku / cu;
      const b = (1 - ku) / cu;
      lo = Math.max(lo, Math.floor(Math.min(a, b)) - 1);
      hi = Math.min(hi, Math.ceil(Math.max(a, b)) + 1);
    } else if (ku < 0 || ku >= 1) continue;
    const kv = (U[0] * dy - U[1] * hx) / det;
    if (cv !== 0) {
      const a = -kv / cv;
      const b = (1 - kv) / cv;
      lo = Math.max(lo, Math.floor(Math.min(a, b)) - 1);
      hi = Math.min(hi, Math.ceil(Math.max(a, b)) + 1);
    } else if (kv < 0 || kv >= 1) continue;
    if (hi < lo) continue;
    const row = (y - oy) * W - ox;
    let any = false;
    // u and v are linear along the row
    const dx0 = lo + 0.5 - o[0];
    let u = (dx0 * V[1] - dy * V[0]) / det;
    let v = (U[0] * dy - U[1] * dx0) / det;
    const du = V[1] / det;
    const dv = -U[1] / det;
    for (let x = lo; x <= hi; x++, u += du, v += dv) {
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const col = tex(u * lu, v * lv, x, y);
      if (!col) continue;
      data[row + x] = col;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      any = true;
    }
    if (any) {
      if (y < by0) by0 = y;
      by1 = y;
    }
  }
  if (bx1 >= bx0) s.touch(bx0 - ox, by0 - oy, bx1 + 1 - ox, by1 + 1 - oy);
}
/** pt() with a packed material. */
function ptF(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, m: PMat, light?: Light) {
  const o = pl.F(u0, z0);
  const a = pl.F(u1, z0);
  const b = pl.F(u0, z1);
  const U: V2 = [a[0] - o[0], a[1] - o[1]];
  const V: V2 = [b[0] - o[0], b[1] - o[1]];
  fastPara(p.c, o, U, V, m(light ?? pl.light, Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1])));
}
/** topT() with a packed material. */
function topF(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, m: PMat) {
  const o = p.P(a0, b0, z);
  const pa = p.P(a1, b0, z);
  const pb = p.P(a0, b1, z);
  const U: V2 = [pa[0] - o[0], pa[1] - o[1]];
  const V: V2 = [pb[0] - o[0], pb[1] - o[1]];
  fastPara(p.c, o, U, V, m(2, Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1])));
}

/** A textured horizontal quad (a0..a1 × b0..b1 at height z): u runs along a, v along b. */
function topT(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, m: Mat) {
  const o = p.P(a0, b0, z);
  const pa = p.P(a1, b0, z);
  const pb = p.P(a0, b1, z);
  const U: V2 = [pa[0] - o[0], pa[1] - o[1]];
  const V: V2 = [pb[0] - o[0], pb[1] - o[1]];
  texPara(p.c, o, U, V, m(2, Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1])));
}
function topQ(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, col: string) {
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], col);
}

interface BoxM {
  front?: Mat;
  side?: Mat;
  top?: Mat;
  edge?: string;
  outline?: boolean;
}
type Face = 'front' | 'side' | 'top';
/** The faces of a box by local faces (front = b0 + bd, side = the visible end) and its outline, drawn with unbounded lines (tall boxes). */
function boxFaces(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z0: number, h: number, paint: (o: V2, U: V2, V: V2, f: Face, light: Light) => void, edge = '#4a3428', outline = true) {
  const [xa, ya] = p.W(a0, b0);
  const [xb, yb] = p.W(a0 + aw, b0 + bd);
  const x0 = Math.min(xa, xb);
  const y0 = Math.min(ya, yb);
  const x1 = Math.max(xa, xb);
  const y1 = Math.max(ya, yb);
  const z1 = z0 + h;
  const P = (x: number, y: number, z: number) => p.w.P(x, y, z);
  const face = (o: V2, pu: V2, pv: V2, f: Face, light: Light) => paint(o, [pu[0] - o[0], pu[1] - o[1]], [pv[0] - o[0], pv[1] - o[1]], f, light);
  if (h > 0) {
    face(P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1), p.rot ? 'side' : 'front', 1);
    face(P(x1, y1, z0), P(x1, y0, z0), P(x1, y1, z1), p.rot ? 'front' : 'side', 0);
  }
  face(P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1), 'top', 2);
  if (!outline) return;
  const hull: V2[] = h > 0 ? [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)] : [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  const hi = mix(edge, OUTL, 0.4);
  const lo = mix(darken(edge, 0.3), OUTL, 0.7);
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i];
    const [bx, by] = hull[(i + 1) % hull.length];
    ln(p.c, ax, ay, bx, by, i < 2 ? hi : lo);
  }
}
/** A textured box by local faces. */
function box(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z0: number, h: number, m: BoxM) {
  boxFaces(
    p, a0, b0, aw, bd, z0, h,
    (o, U, V, f, light) => {
      const mat = m[f];
      if (mat) texPara(p.c, o, U, V, mat(light, Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1])));
    },
    m.edge, m.outline !== false,
  );
}
/** A box with packed materials (big faces). */
function boxP(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z0: number, h: number, m: { front?: PMat; side?: PMat; top?: PMat; edge?: string }) {
  boxFaces(p, a0, b0, aw, bd, z0, h, (o, U, V, f, light) => {
    const mat = m[f];
    if (mat) fastPara(p.c, o, U, V, mat(light, Math.hypot(U[0], U[1]), Math.hypot(V[0], V[1])));
  }, m.edge);
}

/** Flat ramp material: lit / shaded / top tones, a lit top lip, a little grit. */
const solid =
  (r: Ramp, lit: number, shade: number, top: number): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = light === 2 ? top : light ? lit : shade;
    if (light !== 2 && v > h - 1.2) i += 0.8;
    if (hash(x, y, 7) < 0.03) i -= 0.5;
    return at(r, i);
  };

/** A dithered shadow polygon (screen points); dens(x, y) gives the share of pixels shaded. */
function shadePoly(c: C, pts: V2[], alpha: number, dens: (x: number, y: number) => number) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  const ga = c.globalAlpha;
  c.globalAlpha = alpha;
  c.fillStyle = SHADOW;
  const xs: number[] = [];
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) if (bayer(x, y) < dens(x, y)) c.fillRect(x, y, 1, 1);
  }
  c.globalAlpha = ga;
}

/** A soft shadow band on the ground under a raised plan rectangle at height h, cast to the lower right. */
function liftedShadow(p: PropPainter, a0: number, b0: number, a1: number, b1: number, h: number, alpha: number) {
  const dx = 0.35 * h * p.k;
  const dy = 1.5 * p.k;
  const q = [p.P(a0, b0), p.P(a1, b0), p.P(a1, b1), p.P(a0, b1)].map(([x, y]): V2 => [x + dx, y + dy]);
  const cx = (q[0][0] + q[2][0]) / 2;
  const cy = (q[0][1] + q[2][1]) / 2;
  // denser along the middle, thinning to the edges
  const ex = q[1][0] - q[0][0];
  const ey = q[1][1] - q[0][1];
  const el = Math.hypot(ex, ey) || 1;
  const half = Math.abs(((q[3][0] - q[0][0]) * -ey + (q[3][1] - q[0][1]) * ex) / el) / 2 || 1;
  shadePoly(p.c, q, alpha, (x, y) => {
    const d = Math.abs(((x - cx) * -ey + (y - cy) * ex) / el) / half;
    return 1.25 - d;
  });
}

/** A translucent glass panel with a glint, on a plane. */
function glassPane(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, alpha = 0.36) {
  const c = p.c;
  const ga = c.globalAlpha;
  c.globalAlpha = alpha;
  pq(p, pl, u0, u1, z0, z1, pl.light ? '#dcf2fa' : '#a6cfe0');
  c.globalAlpha = Math.min(1, alpha + 0.3);
  pt(p, pl, u0, u1, z0, z1, (u: number, v: number) => ((((u - v * 1.6) % 52) + 52) % 52 < 2.5 ? '#ffffff' : null));
  c.globalAlpha = ga;
}

/** A glass balustrade: panels, slim posts, a steel top rail. */
function railing(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, h: number, step = 0.8, alpha = 0.36) {
  glassPane(p, pl, u0, u1, z0, z0 + h, alpha);
  const n = Math.max(1, Math.round((u1 - u0) / step));
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const [x0, y0] = pl.F(u, z0);
    const [, y1] = pl.F(u, z0 + h + 0.5);
    px(p.c, x0 - 1, y1, STEEL[1], 2, y0 - y1);
    px(p.c, x0 - 1, y1, STEEL[4], 1, y0 - y1);
  }
  const [ax, ay] = pl.F(u0, z0 + h + 0.5);
  const [bx, by] = pl.F(u1, z0 + h + 0.5);
  ln(p.c, ax, ay - 1, bx, by - 1, STEEL[6]);
  ln(p.c, ax, ay, bx, by, STEEL[3]);
}

// ── plants ──────────────────────────────────────────────────
/**
 * A Canary date palm: a stout trunk with a diamond pattern of old leaf bases,
 * warm on its lit side, and a fountain of arching fronds (feathered, lighter
 * at the tips). (x, y) is the foot, h the trunk in px, s the crown's scale.
 */
function palm(c: C, x: number, y: number, h: number, seed: number, s = 1) {
  const Rn = rng(seed * 13 + 7);
  const lean = (Rn() - 0.5) * 0.12 * h;
  const cx = x + lean;
  const cy = y - h;
  const R0 = 46 * s;
  const rect: Rect = [Math.min(x, cx) - R0 * 1.25 - 8, cy - R0 * 1.05 - 8, Math.max(x, cx) + R0 * 1.25 + 8, y + 4];
  layer(
    c,
    (l) => {
      const tw = 12 * Math.max(0.75, s);
      for (let j = 0; j < h; j++) {
        const t = j / h;
        const xc = x + lean * t * t;
        const w = Math.max(5, tw * (1 - t * 0.12) + (j < 5 ? (5 - j) * 0.8 : 0) + (t > 0.85 ? (t - 0.85) * 40 : 0));
        const x0 = Math.round(xc - w / 2);
        const n = Math.round(w);
        const row = Math.floor((j + seed * 3) / 5);
        for (let i = 0; i < n; i++) {
          const u = i / Math.max(1, n - 1);
          let tone = u < 0.22 ? 4.6 : u < 0.5 ? 3.6 : u < 0.8 ? 2.5 : 1.4;
          // diamonds of old leaf bases, each row offset by half a diamond
          const dd = Math.abs(((i + (row & 1) * 3) % 6) - 3) + Math.abs(((j + seed * 3) % 5) - 2.5) * 0.9;
          if (dd > 3.4) tone -= 1.4;
          else if (dd < 1.2) tone += 0.6;
          px(l, x0 + i, y - j - 1, TRUNK[clamp(Math.round(tone), 0, 5)]);
        }
      }
    },
    { outline: 0.6, rect },
  );
  layer(
    c,
    (l) => {
      const n = 15 + Math.floor(Rn() * 4);
      const fr: { ang: number; L: number; up: number; dark: number }[] = [];
      for (let i = 0; i < n; i++) fr.push({ ang: (i / n) * Math.PI * 2 + (Rn() - 0.5) * 0.3, L: R0 * (0.85 + Rn() * 0.35), up: Rn(), dark: Rn() < 0.3 ? -0.7 : 0 });
      // young fronds standing up in the middle
      for (let i = 0; i < 4; i++) fr.push({ ang: (i / 4) * Math.PI * 2 + Rn(), L: R0 * (0.6 + Rn() * 0.2), up: 2, dark: 0.3 });
      // back to front: fronds pointing away first, the upright ones in the middle, those coming toward us last
      fr.sort((m, k) => Math.sin(m.ang) * (m.up > 1.5 ? 0.25 : 1) - Math.sin(k.ang) * (k.up > 1.5 ? 0.25 : 1));
      let dates = false;
      for (const f of fr) {
        const dx = Math.cos(f.ang);
        const dy = Math.sin(f.ang) * 0.5;
        const young = f.up > 1.5;
        if (!dates && dy > 0 && !young) {
          // a bunch of dates under the crown, behind the fronds that come toward us
          dates = true;
          for (let i = 0; i < 5; i++) ell(l, cx - 4 * s + i * 2 * s, cy + 4 * s + (i & 1) * 2, 2.2 * s, 2.4 * s, i & 1 ? '#d8962e' : '#b47024');
        }
        // a frond rises from the crown, arches out and hangs at the tip; the young ones stand up
        const qx = cx + dx * f.L * (young ? 0.15 : 0.42);
        const qy = cy + dy * f.L * (young ? 0.1 : 0.42) - f.L * (young ? 0.75 : 0.56 + f.up * 0.24);
        const ex = cx + dx * f.L * (young ? 0.4 : 1);
        const ey = young ? cy - f.L * 0.85 + dy * f.L * 0.3 : cy + dy * f.L + f.L * (0.1 - f.up * 0.16);
        // lit from the upper left; the far fronds are in the crown's shade
        const base = 3.2 - dx * 1.1 - dy * 1.8 + f.dark;
        const N = Math.max(8, Math.ceil(f.L / 2));
        let x0 = cx;
        let y0 = cy;
        for (let q = 1; q <= N; q++) {
          const t = q / N;
          const bx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * qx + t * t * ex;
          const by = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * qy + t * t * ey;
          const tx = bx - x0;
          const ty = by - y0;
          const tl = Math.hypot(tx, ty) || 1;
          const nx = -ty / tl;
          const ny = tx / tl;
          // leaflets: longest a third of the way out, swept toward the tip, hanging a little
          if (t > 0.1) {
            const ll = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 8 * s + 1.5;
            const tone = base + t * 1.3;
            for (const sd of [-1, 1]) {
              const lx = bx + nx * sd * ll * 0.8 + (tx / tl) * ll * 0.6;
              const ly = by + ny * sd * ll * 0.45 + ll * 0.5;
              ln(l, bx, by, lx, ly, FROND[clamp(Math.round(tone + (sd * nx < 0 ? 0.6 : -0.6) + (q % 2 ? 0 : -0.5)), 0, 7)]);
            }
          }
          ln(l, x0, y0, bx, by, FROND[clamp(Math.round(base + 0.6 + t), 0, 7)]);
          x0 = bx;
          y0 = by;
        }
      }
    },
    { outline: 0.55, rect },
  );
}

/** Clipped shrubs as leaf masses round a few screen points. */
function shrubs(c: C, pts: V2[], r: number, seed: number, o: { ramp?: Ramp; dots?: string[]; dotChance?: number } = {}) {
  if (!pts.length) return;
  const masses: Mass[] = pts.map(([x, y], i) => ({ x, y, rx: r * (0.85 + hash(i, 1, seed) * 0.3), ry: r * (0.72 + hash(i, 2, seed) * 0.25), z: y }));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of masses) {
    x0 = Math.min(x0, m.x - m.rx - 8);
    x1 = Math.max(x1, m.x + m.rx + 8);
    y0 = Math.min(y0, m.y - m.ry - 8);
    y1 = Math.max(y1, m.y + m.ry + 8);
  }
  // long rows run diagonally across the screen: grow them a few masses at a time, so
  // foliage only scans small boxes, but outline the row as one
  masses.sort((m, n) => m.y - n.y);
  layer(
    c,
    (l) => {
      for (let i = 0; i < masses.length; i += 6) foliage(l, masses.slice(i, i + 7), o.ramp ?? R.hedge, seed + i, { cell: 2.6, tilt: 0.14, dots: o.dots, dotChance: o.dotChance ?? 0.5, dotSize: 3 });
    },
    { outline: 0.55, rect: [x0, y0, x1, y1] },
  );
}

const planterMat = solid(CR, 4.4, 2.6, 5.4);
const soilMat: Mat = () => (_u, _v, x, y) => (hash(x, y, 3) < 0.2 ? '#4a3424' : '#3a2818');

/** A square cream planter with a palm and a skirt of green at its foot. */
function palmPlanter(p: PropPainter, a: number, b: number, z: number, seed: number, s = 1) {
  const r = 0.26;
  box(p, a - r, b - r, 2 * r, 2 * r, z, 4.5, { front: planterMat, side: planterMat, top: soilMat, edge: CR[0] });
  const [x, y] = p.P(a, b, z + 4.5);
  shrubs(p.c, [[x - 9, y - 3], [x + 9, y - 3]], 7, seed + 1);
  palm(p.c, x, y, (64 + hash(seed, 3) * 40) * s, seed, s);
  shrubs(p.c, [[x - 4, y + 2], [x + 6, y + 1]], 6, seed + 2, { dots: ['#e8457a', '#fbf2e6'], dotChance: 0.4 });
}

/** A long cream planter of clipped shrubs (and flowers) along a or b. */
function hedgeBox(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z: number, seed: number, flowers?: string[]) {
  box(p, a0, b0, aw, bd, z, 4, { front: planterMat, side: planterMat, top: soilMat, edge: CR[0] });
  const pts: V2[] = [];
  const along = aw >= bd;
  const len = along ? aw : bd;
  for (let t = 0.14; t < len - 0.08; t += 0.26) {
    const [x, y] = along ? p.P(a0 + t, b0 + bd / 2, z + 4) : p.P(a0 + aw / 2, b0 + t, z + 4);
    pts.push([x, y - 7 - hash(Math.round(t * 10), 3, seed) * 4]);
  }
  shrubs(p.c, pts, 12, seed, { dots: flowers, dotChance: flowers ? 0.45 : 0 });
}

/** An olive tree in a big planter: a grey-green crown on a twisted trunk. */
function oliveTree(p: PropPainter, a: number, b: number, z: number, seed: number) {
  const r = 0.32;
  box(p, a - r, b - r, 2 * r, 2 * r, z, 5, { front: planterMat, side: planterMat, top: soilMat, edge: CR[0] });
  const [x, y] = p.P(a, b, z + 5);
  const rect: Rect = [x - 64, y - 150, x + 64, y + 4];
  layer(
    p.c,
    (l) => {
      for (let j = 0; j < 58; j++) {
        const xc = x + Math.sin(j * 0.12 + seed) * 3;
        px(l, xc - 4, y - j, R.barkPale[2], 8, 1);
        px(l, xc - 4, y - j, R.barkPale[3], 3, 1);
        px(l, xc + 3, y - j, R.barkPale[1], 1, 1);
      }
      const masses: Mass[] = [
        { x: x - 22, y: y - 80, rx: 30, ry: 23, z: 1 },
        { x: x + 21, y: y - 78, rx: 28, ry: 22, z: 2 },
        { x: x, y: y - 104, rx: 32, ry: 24, z: 0 },
        { x: x - 3, y: y - 68, rx: 24, ry: 16, z: 3 },
      ];
      foliage(l, masses, OLIVE, seed, { cell: 3.6, tilt: 0.16, holes: 0.06 });
    },
    { outline: 0.6, rect },
  );
}

// ── furniture for the roof decks ────────────────────────────
const frameMat = solid(GRAPH, 3.2, 1.8, 4);
const cushMat = solid(CUSH, 4.2, 2.6, 5);

/** A sun lounger: a graphite frame, a white cushion, the backrest raised at the head (dir points to the head). */
function lounger(p: PropPainter, a: number, b: number, z: number, dir: 'a-' | 'a+' | 'b-' | 'b+', towel?: string) {
  const L = 0.84;
  const Wl = 0.32;
  const alongA = dir[0] === 'a';
  const a0 = alongA ? a - L / 2 : a - Wl / 2;
  const b0 = alongA ? b - Wl / 2 : b - L / 2;
  const aw = alongA ? L : Wl;
  const bd = alongA ? Wl : L;
  box(p, a0, b0, aw, bd, z, 1.6, { front: frameMat, side: frameMat, top: frameMat, edge: GRAPH[0] });
  box(p, a0 + 0.02, b0 + 0.02, aw - 0.04, bd - 0.04, z + 1.6, 0.9, { front: cushMat, side: cushMat, top: cushMat, edge: CUSH[0] });
  const zc = z + 2.5;
  const back = 0.3;
  let q: V3[];
  if (dir === 'b-') q = [[a0 + 0.03, b0 + back, zc], [a0 + aw - 0.03, b0 + back, zc], [a0 + aw - 0.03, b0 + 0.04, zc + 4.4], [a0 + 0.03, b0 + 0.04, zc + 4.4]];
  else if (dir === 'b+') q = [[a0 + 0.03, b0 + bd - back, zc], [a0 + aw - 0.03, b0 + bd - back, zc], [a0 + aw - 0.03, b0 + bd - 0.04, zc + 4.4], [a0 + 0.03, b0 + bd - 0.04, zc + 4.4]];
  else if (dir === 'a-') q = [[a0 + back, b0 + 0.03, zc], [a0 + back, b0 + bd - 0.03, zc], [a0 + 0.04, b0 + bd - 0.03, zc + 4.4], [a0 + 0.04, b0 + 0.03, zc + 4.4]];
  else q = [[a0 + aw - back, b0 + 0.03, zc], [a0 + aw - back, b0 + bd - 0.03, zc], [a0 + aw - 0.04, b0 + bd - 0.03, zc + 4.4], [a0 + aw - 0.04, b0 + 0.03, zc + 4.4]];
  poly3(p, q, (_u: number, v: number, x: number, y: number) => (v < 1.5 ? CUSH[2] : hash(x, y, 5) < 0.04 ? CUSH[3] : CUSH[4]), 2);
  if (towel) {
    const t0 = alongA ? [a0 + 0.36, b0 + 0.04, a0 + 0.62, b0 + bd - 0.04] : [a0 + 0.04, b0 + 0.36, a0 + aw - 0.04, b0 + 0.62];
    topQ(p, t0[0], t0[1], t0[2], t0[3], z + 2.55, towel);
  }
}

/** A white parasol on a pole: (x, y) its foot, hp the pole in px. */
function parasol(c: C, x: number, y: number, hp: number, r: number, col: string) {
  const cy = y - hp;
  layer(
    c,
    (l) => {
      px(l, x - 1, cy, '#d8d4cc', 2, hp);
      ell(l, x, y, 5, 2.5, GRAPH[2]);
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        const lit = Math.cos((a0 + a1) / 2 + 2.3) > -0.2;
        fillPoly(l, [[x, cy - r * 0.4], [x + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.48], [x + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.48]], lit ? col : darken(col, 0.16));
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        if (Math.sin(a) < -0.3) continue;
        px(l, x + Math.cos(a) * r - 1, cy + Math.sin(a) * r * 0.48, darken(col, 0.24), 3, 2);
      }
      px(l, x - 1, cy - r * 0.4 - 3, '#d8d4cc', 2, 3);
    },
    { outline: 0.5, rect: [x - r - 4, cy - r, x + r + 4, y + 4] },
  );
}

/** An outdoor sofa along a (its back at b0) or along b (its back at the far end). */
function sofa(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z: number, back: 'b0' | 'a0' | 'a1', cushion: Ramp = CUSH) {
  const cm = solid(cushion, 4.2, 2.6, 5);
  box(p, a0, b0, aw, bd, z, 1.8, { front: frameMat, side: frameMat, top: frameMat, edge: GRAPH[0] });
  box(p, a0 + 0.03, b0 + 0.03, aw - 0.06, bd - 0.06, z + 1.8, 1.4, { front: cm, side: cm, top: cm, edge: cushion[0] });
  if (back === 'b0') box(p, a0 + 0.03, b0 + 0.02, aw - 0.06, 0.13, z + 3.2, 3.2, { front: cm, side: cm, top: cm, edge: cushion[0] });
  else if (back === 'a0') box(p, a0 + 0.02, b0 + 0.03, 0.13, bd - 0.06, z + 3.2, 3.2, { front: cm, side: cm, top: cm, edge: cushion[0] });
  else box(p, a0 + aw - 0.15, b0 + 0.03, 0.13, bd - 0.06, z + 3.2, 3.2, { front: cm, side: cm, top: cm, edge: cushion[0] });
}

/** A low table with a tray and a vase. */
function lowTable(p: PropPainter, a: number, b: number, z: number, r = 0.22) {
  box(p, a - r, b - r * 0.7, 2 * r, 1.4 * r, z, 2.6, { front: solid(TEAK, 3.2, 2, 4.2), side: solid(TEAK, 3.2, 2, 4.2), top: solid(TEAK, 3.6, 2, 4.4), edge: TEAK[0] });
  const [x, y] = p.P(a, b, z + 2.6);
  px(p.c, x - 2, y - 7, '#f2f0ea', 4, 6);
  px(p.c, x - 3, y - 11, '#5aa652', 6, 4);
}

/** A pergola: white posts, a frame and timber slats; `inner` draws what stands under it. */
function pergola(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, h: number, inner?: () => void) {
  const post = solid(CR, 5, 3, 6);
  const wood = solid(TEAK, 3.4, 2, 4.4);
  const posts: [number, number][] = [[a0, b0], [a1, b0], [a0, b1], [a1, b1]];
  posts.sort((m, n) => depth(p, m[0], m[1]) - depth(p, n[0], n[1]));
  for (let i = 0; i < 3; i++) box(p, posts[i][0] - 0.06, posts[i][1] - 0.06, 0.12, 0.12, z, h, { front: post, side: post, top: post, edge: CR[1] });
  inner?.();
  box(p, posts[3][0] - 0.06, posts[3][1] - 0.06, 0.12, 0.12, z, h, { front: post, side: post, top: post, edge: CR[1] });
  for (const b of [b0, b1]) box(p, a0 - 0.1, b - 0.06, a1 - a0 + 0.2, 0.12, z + h, 1.6, { front: post, side: post, top: post, edge: CR[1] });
  for (let a = a0 + 0.02; a < a1 - 0.02; a += 0.2) box(p, a, b0 - 0.16, 0.07, b1 - b0 + 0.32, z + h + 1.6, 0.9, { front: wood, side: wood, top: wood, edge: TEAK[0] });
}

// ── the glass tower ─────────────────────────────────────────
type Roof = 'piscina' | 'terrazza' | 'tecnico';
interface Tower {
  W: number;
  D: number;
  storeys: number;
  roof: Roof;
  seed: number;
  /** base height, storey height, the deck's height */
  BH: number;
  SH: number;
  ZT: number;
  /** the shaft, inset from the base */
  A0: number;
  A1: number;
  B0: number;
  B1: number;
  /** fin centres along the front (a) and the side (b), and the pane pitch in tiles */
  finsF: number[];
  finsS: number[];
  pitchF: number;
  pitchS: number;
  bandEvery: number;
}

function towerOf(k: PropCtx): Tower {
  const m = /^(\d+)(?:-([a-z]+))?/.exec(k.variant ?? '');
  const storeys = clamp(m ? +m[1] : 12, 6, 24);
  const r = m?.[2];
  const roof: Roof = r === 'terrazza' || r === 'tecnico' ? r : 'piscina';
  const W = k.w;
  const D = k.d;
  const A0 = 0.6;
  const A1 = W - 0.6;
  const B0 = 0.6;
  const B1 = D - 0.6;
  const BH = 72;
  const SH = 32;
  const nF = Math.max(2, Math.round((A1 - A0) / 1.8));
  const nS = Math.max(2, Math.round((B1 - B0) / 1.8));
  const sF = (A1 - A0) / nF;
  const sS = (B1 - B0) / nS;
  return {
    W,
    D,
    storeys,
    roof,
    seed: k.seed,
    BH,
    SH,
    ZT: BH + storeys * SH,
    A0,
    A1,
    B0,
    B1,
    finsF: Array.from({ length: nF - 1 }, (_, i) => A0 + sF * (i + 1)),
    finsS: Array.from({ length: nS - 1 }, (_, i) => B0 + sS * (i + 1)),
    pitchF: sF / 3,
    pitchS: sS / 3,
    bandEvery: 3 + (Math.abs(k.seed) % 2),
  };
}

/** Is a pane of the curtain wall lit (an office with the lights on)? Panes light up in pairs. */
const paneLit = (face: number, col: number, st: number, seed: number) => hash(Math.floor(col / 2) + face * 1013, st, seed * 7 + 3) < 0.15;

const GLP = pk(GL);
const LITP = pk(LIT);

/** The curtain wall: blue panes in a pale grid, a spandrel per floor, reflections, some offices lit. */
const curtain =
  (o: { pitch: number; sh: number; face: number; seed: number; dark?: number }): PMat =>
  (light, _w, lv) => {
    const lit = light !== 0;
    const base = (lit ? 5 : 2.2) - (o.dark ?? 0);
    const mull = parseColor(lit ? '#9fb7da' : '#4e6894');
    const slab = parseColor(lit ? '#c2d4ec' : '#6880ac');
    const pitch = o.pitch;
    const sh = o.sh;
    const ip = 1 / pitch;
    const is = 1 / sh;
    const il = 1.4 / lv;
    const ivis = 1 / (sh - 13.2);
    const tr = 13.2 + (sh - 13.2) * 0.5;
    const { face, seed } = o;
    const off = face * 211 + 700000;
    let lc = NaN;
    let ls = NaN;
    let tone = 0;
    let on = false;
    let glint = false;
    return (u, v, x, y) => {
      const col = Math.floor(u * ip);
      const st = Math.floor(v * is);
      if (col !== lc || st !== ls) {
        lc = col;
        ls = st;
        on = paneLit(face, col, st, seed);
        const n = noise2(col * 0.29 + face * 7.7, st * 0.21, seed + 5);
        tone = (hash(col, st, seed * 5 + face) - 0.5) * 0.7 + (n > 0.64 ? 1.6 : n > 0.57 ? 0.7 : n < 0.3 ? -0.6 : 0);
        glint = hash(col, st, seed + 31) < 0.3;
      }
      const fu = u - col * pitch;
      const fv = v - st * sh;
      if (fu < 1.6) return mull;
      if (fv < 2.4) return slab;
      const b = bayT(x, y) - 0.5;
      const g = v * il;
      // the spandrel at the floor, the sill, a transom halfway up the glass
      if (fv < 12) return atP(GLP, base - 0.9 + g * 0.5 + b * 0.6);
      if (fv < 13.2 || (fv > tr && fv < tr + 1.3)) return mull;
      if (on) {
        // an office with the lights on: a bright ceiling, desks and people against the warm wall
        const t = (fv - 13.2) * ivis;
        if (t > 0.92) return Math.floor(u / 6) % 3 === 0 ? LITP[6] : LITP[5];
        if (t < 0.24) return hash(Math.floor(u / 6), st, seed + 9) < 0.4 ? LITP[1] : LITP[3];
        if (t < 0.56 && hash(Math.floor(u / 4), st, seed + 3) < 0.08) return LITP[1];
        return atP(LITP, 4 + (t > 0.78 ? 0.8 : 0) + b * 0.8);
      }
      let t = base + g + tone + fv * is * 0.5;
      const d = (((v - u * 0.58) | 0) + off) % 700;
      if (d < 64) t += 1.5;
      else if (d > 80 && d < 88) t += 3.5;
      if (glint) {
        const gd = fu * 0.9 + (sh - fv);
        if (gd > 22 && gd < 27) t += 1.8;
      }
      if (fv > sh - 5) t -= 1.1;
      return atP(GLP, t + b * 0.9);
    };
  };

const CRP = pk(CR);
/** Cream fins and piers: a lit arris, a soft shadow edge. */
const finMat: PMat = (light, w) => (u, _v, x, y) => {
  let i = light === 2 ? 5.5 : light ? 4.6 : 2.7;
  if (light === 1 && u < 1.5) i += 1.6;
  if (u > w - 1.4) i -= 0.9;
  if (hash(x, y, 9) < 0.025) i -= 0.6;
  return atP(CRP, i);
};
/** Big panels of cream limestone for the base. */
const stoneMat: PMat = (light) => (u, v, x, y) => {
  const row = Math.floor(v / 44);
  const fv = v - row * 44;
  const off = row & 1 ? 46 : 0;
  const col = Math.floor((u + off) / 92);
  const fu = u + off - col * 92;
  if (fv < 1.2 || fu < 1.2) return light ? CRP[2] : CRP[1];
  let i = (light ? 4.6 : 2.8) + (hash(col, row, 13) - 0.5) * 0.5;
  if (fv > 42) i += 0.6;
  if (hash(x, y, 14) < 0.03) i -= 0.6;
  return atP(CRP, i);
};

/** The lobby seen through tall glass: warm light, downlights, a desk, plants, a reflection. */
const LOBBYP = pk([BRONZE[2], '#fff6e6', '#c08a4a', '#8a5a2a', '#5a8a3a', '#3e6a34']);
const lobbyMat =
  (seed: number): PMat =>
  (_light, _w, h) =>
  (u, v, x, y) => {
    if (u % 34 < 1.6) return LOBBYP[0];
    if (v > h - 8) return Math.floor(u / 7) % 3 === 0 ? LITP[6] : LITP[5];
    if ((u * 0.8 + v) % 120 < 6) return LOBBYP[1];
    if (v < 34) {
      const hs = hash(Math.floor(u / 9), 0, seed);
      if (hs < 0.25 && v < 18) return v > 15 ? LOBBYP[2] : LOBBYP[3];
      if (hs > 0.8 && v < 30) return hash(x >> 1, y >> 1, 3) < 0.3 ? LOBBYP[4] : LOBBYP[5];
    }
    return atP(LITP, 4 + (v > h * 0.6 ? 0.6 : 0) + (bayT(x, y) - 0.5) * 0.9);
  };

/** Roof pavers: big pale stone squares. */
const paveMat: Mat = () => (u, v, x, y) => {
  const fu = u % 36;
  const fv = v % 36;
  if (fu < 1.1 || fv < 1.1) return PAVE[1];
  let i = 3.6 + (hash(Math.floor(u / 36), Math.floor(v / 36), 21) - 0.5) * 0.8;
  if (hash(x, y, 22) < 0.03) i -= 0.6;
  return at(PAVE, i);
};
const PAVEP = pk(PAVE);
const paveP: PMat = () => (u, v, x, y) => {
  const fu = u % 36;
  const fv = v % 36;
  if (fu < 1.1 || fv < 1.1) return PAVEP[1];
  let i = 3.6 + (hash(Math.floor(u / 36), Math.floor(v / 36), 21) - 0.5) * 0.8;
  if (hash(x, y, 22) < 0.03) i -= 0.6;
  return atP(PAVEP, i);
};

/** Timber decking. */
const deckMat: Mat = () => (u, v, x, y) => {
  const row = Math.floor(v / 9);
  if (v % 9 < 1) return TEAK[1];
  const seg = Math.floor((u + hash(row, 1, 23) * 60) / 90);
  let i = 3.6 + (hash(seg, row, 24) - 0.5) * 0.9;
  if (noise2(u * 0.06, row * 3.1, 25) > 0.66) i -= 0.6;
  if (hash(x, y, 26) < 0.03) i -= 0.5;
  return at(TEAK, i);
};

/** A grey roof membrane with walkway tiles. */
const membraneMat: Mat = () => (u, v, x, y) => {
  if (u % 72 < 1 || v % 72 < 1) return '#8e939a';
  const n = hash(x >> 1, y >> 1, 27);
  return n < 0.12 ? '#a2a7ae' : n > 0.9 ? '#c4c8cc' : '#b4b8be';
};
const MEMP = pk(['#8e939a', '#a2a7ae', '#b4b8be', '#c4c8cc']);
const membraneP: PMat = () => (u, v, x, y) => {
  if (u % 72 < 1 || v % 72 < 1) return MEMP[0];
  const n = hash(x >> 1, y >> 1, 27);
  return n < 0.12 ? MEMP[1] : n > 0.9 ? MEMP[3] : MEMP[2];
};

function towerDraw(p: PropPainter, k: PropCtx) {
  const T = towerOf(k);
  // a contact shadow round the foot, cast to the lower right: only the band
  // between the two lower edges of the base and the same edges shifted
  const sa = p.rot ? 0.1 : T.W - 0.1;
  const C0 = p.P(sa, T.D - 0.1);
  const E1 = p.P(p.rot ? T.W - 0.1 : 0.1, T.D - 0.1);
  const E2 = p.P(sa, 0.1);
  const sh = (q: V2): V2 => [q[0] + 0.35 * 30 * p.k, q[1] + 6];
  shadePoly(p.c, [E1, sh(E1), sh(C0), sh(E2), E2, C0], 0.22, () => 0.85);
  podium(p, T);
  shaft(p, T);
  ledges(p, T);
  roof(p, T);
  entrance(p, T);
}

/** The base: two storeys of cream stone round a lit glass lobby, a cornice, the podium roof. */
function podium(p: PropPainter, T: Tower) {
  const { W, D, BH, seed } = T;
  const a0 = 0.1;
  const a1 = W - 0.1;
  const b0 = 0.1;
  const b1 = D - 0.1;
  const F = front3(p, b1);
  const S = side3(p, p.rot ? a0 : a1);
  ptF(p, F, a0, a1, 0, BH, stoneMat);
  ptF(p, S, b0, b1, 0, BH, stoneMat);
  const ut = UT(p);
  const faces: [Pl, number, number, number][] = [[F, a0, a1, 0], [S, b0, b1, 1]];
  for (const [pl, u0, u1, face] of faces) {
    const n = Math.max(2, Math.round((u1 - u0) / 1.7));
    const bay = (u1 - u0) / n;
    for (let i = 0; i < n; i++) {
      const c0 = u0 + i * bay + 0.17;
      const c1 = u0 + (i + 1) * bay - 0.17;
      if (!(face === 0 && i === Math.floor(n / 2))) {
        pq(p, pl, c0 - 0.04, c1 + 0.04, 0.8, 33, BRONZE[1]);
        ptF(p, pl, c0, c1, 1.4, 32, lobbyMat(seed * 3 + i + face * 17));
      }
      pq(p, pl, c0 - 0.04, c1 + 0.04, 39, 64, BRONZE[1]);
      ptF(p, pl, c0, c1, 39.6, 63.4, curtain({ pitch: ((c1 - c0) / 3) * ut, sh: 23.8 * p.k, face: 8 + face * 2 + i * 4, seed, dark: 0.4 }));
      // warm uplights washing the piers
      const up = u0 + i * bay;
      const glow = parseColor(pl.light ? '#fff4dc' : CR[4]);
      if (i > 0)
        ptF(p, pl, up - 0.13, up + 0.13, 0, 30, (_l, w) => (u, v, x, y) => (bayT(x, y) < (1 - v / 120) * (1.1 - Math.abs(u - w / 2) / (w / 2)) ? glow : 0));
    }
    // string course between the floors
    pq(p, pl, u0, u1, 35, 37.4, pl.light ? CR[5] : CR[3]);
    pq(p, pl, u0, u1, 34.2, 35, pl.light ? CR[2] : CR[1]);
  }
  // the cornice: a band standing proud, a lit lip, a shadow below
  const t = 0.08;
  const Fo = front3(p, b1 + t);
  const So = side3(p, p.rot ? a0 - t : a1 + t);
  pq(p, F, a0, a1, BH - 6.4, BH - 5, 'rgba(40,30,30,0.3)');
  pq(p, S, b0, b1, BH - 6.4, BH - 5, 'rgba(40,30,30,0.3)');
  pq(p, Fo, p.rot ? a0 - t : a0, p.rot ? a1 : a1 + t, BH - 5, BH, Fo.light ? CR[5] : CR[3]);
  pq(p, So, b0, b1 + t, BH - 5, BH, So.light ? CR[5] : CR[3]);
  pq(p, Fo, p.rot ? a0 - t : a0, p.rot ? a1 : a1 + t, BH - 0.8, BH, Fo.light ? CR[7] : CR[4]);
  pq(p, So, b0, b1 + t, BH - 0.8, BH, So.light ? CR[7] : CR[4]);
  topF(p, a0 - (p.rot ? t : 0), b0, a1 + (p.rot ? 0 : t), b1 + t, BH, paveP);
}

/** The shaft: curtain walls, floor bands, cream fins and corner piers, a few balconies. */
function shaft(p: PropPainter, T: Tower) {
  const { A0, A1, B0, B1, BH, ZT, SH, seed } = T;
  const ut = UT(p);
  const F = front3(p, B1);
  const sa = p.rot ? A0 : A1;
  const S = side3(p, sa);
  ptF(p, F, A0, A1, BH, ZT, curtain({ pitch: T.pitchF * ut, sh: SH * p.k, face: 0, seed }));
  ptF(p, S, B0, B1, BH, ZT, curtain({ pitch: T.pitchS * ut, sh: SH * p.k, face: 1, seed }));
  // floor bands every few storeys
  const bt = 0.07;
  const Fo = front3(p, B1 + bt);
  const So = side3(p, p.rot ? A0 - bt : A1 + bt);
  for (let s = T.bandEvery; s < T.storeys; s += T.bandEvery) {
    const z = BH + s * SH;
    pq(p, F, A0, A1, z - 2.9, z - 1.3, 'rgba(8,14,40,0.35)');
    pq(p, S, B0, B1, z - 2.9, z - 1.3, 'rgba(8,14,40,0.35)');
    pq(p, Fo, p.rot ? A0 - bt : A0, p.rot ? A1 : A1 + bt, z - 1.3, z + 1.3, Fo.light ? CR[5] : CR[3]);
    pq(p, So, B0, B1 + bt, z - 1.3, z + 1.3, So.light ? CR[5] : CR[3]);
    pq(p, Fo, p.rot ? A0 - bt : A0, p.rot ? A1 : A1 + bt, z + 0.6, z + 1.3, Fo.light ? CR[7] : CR[4]);
    pq(p, So, B0, B1 + bt, z + 0.6, z + 1.3, So.light ? CR[7] : CR[4]);
  }
  // a base band where the shaft meets the podium
  pq(p, Fo, p.rot ? A0 - bt : A0, p.rot ? A1 : A1 + bt, BH, BH + 3, Fo.light ? CR[5] : CR[3]);
  pq(p, So, B0, B1 + bt, BH, BH + 3, So.light ? CR[5] : CR[3]);
  // fins, back to front; each throws a thin shadow on the lit glass beside it
  const fw = 0.16;
  const ft = 0.14;
  const fins: [0 | 1, number][] = [...T.finsF.map((u): [0 | 1, number] => [0, u]), ...T.finsS.map((u): [0 | 1, number] => [1, u])];
  fins.sort((m, n) => depth(p, m[0] ? sa : m[1], m[0] ? m[1] : B1) - depth(p, n[0] ? sa : n[1], n[0] ? n[1] : B1));
  for (const [face, u] of fins) {
    const u0 = u - fw / 2;
    const u1 = u + fw / 2;
    if (face === 0) {
      if (F.light) pq(p, F, u1, u1 + 0.07, BH + 3, ZT, 'rgba(8,14,40,0.28)');
      ptF(p, front3(p, B1 + ft), u0, u1, BH, ZT, finMat);
      ptF(p, side3(p, p.rot ? u0 : u1), B1, B1 + ft, BH, ZT, finMat);
    } else {
      if (S.light) pq(p, S, u1, u1 + 0.07, BH + 3, ZT, 'rgba(8,14,40,0.28)');
      ptF(p, side3(p, p.rot ? A0 - ft : A1 + ft), u0, u1, BH, ZT, finMat);
      ptF(p, front3(p, u1), p.rot ? A0 - ft : A1, p.rot ? A0 : A1 + ft, BH, ZT, finMat);
    }
  }
  // corner piers
  const cw = 0.3;
  const ct = 0.1;
  const corners: [number, number][] = [[A0, B1], [A1, B1], [p.rot ? A0 : A1, B0]];
  corners.sort((m, n) => depth(p, m[0], m[1]) - depth(p, n[0], n[1]));
  for (const [ca, cb] of corners) {
    const a0 = ca === A0 ? A0 - ct : A1 - cw;
    const b0 = cb === B1 ? B1 - cw : B0 - ct;
    boxP(p, a0, b0, cw + ct, cw + ct, BH, ZT - BH, { front: finMat, side: finMat, edge: CR[1] });
  }
  // balconies: glass railings, a potted palm
  const Rn = rng(seed * 31 + 7);
  const nb = 2 + Math.floor(Rn() * 3);
  const bal: { face: 0 | 1; uc: number; w: number; z: number; s: number }[] = [];
  for (let i = 0; i < nb; i++) {
    const face: 0 | 1 = Rn() < 0.5 ? 0 : 1;
    const edges = face ? [B0, ...T.finsS, B1] : [A0, ...T.finsF, A1];
    const bi = Math.floor(Rn() * (edges.length - 1));
    const st = 1 + Math.floor(Rn() * (T.storeys - 2));
    bal.push({ face, uc: (edges[bi] + edges[bi + 1]) / 2, w: Math.min(1.3, edges[bi + 1] - edges[bi] - 0.34), z: BH + st * SH, s: seed * 17 + i });
  }
  bal.sort((m, n) => depth(p, m.face ? sa : m.uc, m.face ? m.uc : B1) - depth(p, n.face ? sa : n.uc, n.face ? n.uc : B1));
  for (const b of bal) balcony(p, T, b.face, b.uc, b.w, b.z, b.s);
}

/** A balcony: a cream slab, a potted palm or shrub, glass on three sides. */
function balcony(p: PropPainter, T: Tower, face: 0 | 1, uc: number, w: number, z: number, seed: number) {
  const dep = 0.42;
  const { A0, A1, B1 } = T;
  const a0 = face ? (p.rot ? A0 - dep : A1) : uc - w / 2;
  const b0 = face ? uc - w / 2 : B1;
  const aw = face ? dep : w;
  const bd = face ? w : dep;
  const slab = solid(CR, 4.6, 2.8, 5.6);
  box(p, a0, b0, aw, bd, z - 1.6, 1.8, { front: slab, side: slab, top: paveMat, edge: CR[1] });
  // the far end panel, the plant, then the near panels
  const zr = z + 0.2;
  if (face === 0) {
    const far = side3(p, p.rot ? a0 + aw : a0);
    railing(p, far, b0, b0 + bd, zr, 8.5, 1);
  } else railing(p, front3(p, b0), a0, a0 + aw, zr, 8.5, 1);
  const [x, y] = p.P(a0 + aw / 2, b0 + bd / 2, zr);
  if (hash(seed, 1, 3) < 0.65) {
    box(p, a0 + aw / 2 - 0.1, b0 + bd / 2 - 0.1, 0.2, 0.2, zr, 3, { front: planterMat, side: planterMat, top: soilMat, edge: CR[0] });
    palm(p.c, x, y - 12, 56, seed, 0.62);
  } else shrubs(p.c, [[x - 6, y - 6], [x + 6, y - 5]], 7, seed, { dots: ['#e8457a'], dotChance: 0.5 });
  if (face === 0) {
    railing(p, side3(p, p.rot ? a0 : a0 + aw), b0, b0 + bd, zr, 8.5, 1);
    railing(p, front3(p, b0 + bd), a0, a0 + aw, zr, 8.5, 0.6);
  } else {
    railing(p, front3(p, b0 + bd), a0, a0 + aw, zr, 8.5, 1);
    railing(p, side3(p, p.rot ? a0 : a0 + aw), b0, b0 + bd, zr, 8.5, 0.6);
  }
}

/** Planters along the podium's edge in front of the shaft. */
function ledges(p: PropPainter, T: Tower) {
  const { W, D, BH, A0, A1, B0, B1, seed } = T;
  const fl = ['#e8457a', '#fbf2e6', '#f2c42a'];
  hedgeBox(p, A0 - 0.2, D - 0.38, A1 - A0 + 0.4, 0.26, BH, seed + 41, fl);
  if (p.rot) hedgeBox(p, 0.12, B0 - 0.2, 0.26, B1 - B0 + 0.48, BH, seed + 42, fl);
  else hedgeBox(p, W - 0.38, B0 - 0.2, 0.26, B1 - B0 + 0.48, BH, seed + 42, fl);
}

/** The entrance in the middle of the front: a revolving door under a canopy, gilt letters. */
function entrance(p: PropPainter, T: Tower) {
  const { W, D } = T;
  const n = Math.max(2, Math.round((W - 0.2) / 1.7));
  const bay = (W - 0.2) / n;
  const i = Math.floor(n / 2);
  const c0 = 0.1 + i * bay + 0.17;
  const c1 = 0.1 + (i + 1) * bay - 0.17;
  const F = front3(p, D - 0.1);
  pq(p, F, c0 - 0.06, c1 + 0.06, 0, 31, BRONZE[1]);
  pt(p, F, c0, c1, 0.6, 30, (u: number, v: number, x: number, y: number) => (u % 40 < 2 ? BRONZE[3] : v > 100 ? LIT[5] : at(LIT, 3.6 + (bayer(x, y) - 0.5) * 0.8)));
  // the revolving door: a drum of dark glass
  const cm = (c0 + c1) / 2;
  pq(p, F, cm - 0.36, cm + 0.36, 0.3, 24, BRONZE[0]);
  pt(p, F, cm - 0.32, cm + 0.32, 0.6, 23, (u: number, v: number) => (u % 18 < 2 ? BRONZE[3] : (u + v * 0.5) % 46 < 6 ? '#9ab8cc' : '#2a3a48'));
  // the canopy
  const cv = solid(CR, 5, 3, 6);
  box(p, c0 - 0.25, D - 0.1, c1 - c0 + 0.5, 0.3, 30, 1.8, { front: cv, side: cv, top: cv, edge: CR[1] });
  // gilt letters above it
  for (let q = 0; q < 7; q++) {
    const u = cm - 0.6 + q * 0.18;
    pq(p, F, u, u + 0.11, 33.5, 37, q === 3 ? '#e2b85a' : '#c8983e');
  }
}

/** The roof: the deck, the parapets and glass, the variant's furniture. */
function roof(p: PropPainter, T: Tower) {
  const { A0, A1, B0, B1, ZT } = T;
  const items: { d: number; draw: () => void }[] = [];
  topF(p, A0, B0, A1, B1, ZT, T.roof === 'tecnico' ? membraneP : paveP);
  // the parapets at the back, seen from inside, with their glass
  const th = 0.14;
  const ph = 3;
  const Fb = front3(p, B0 + th);
  pq(p, Fb, A0, A1, ZT, ZT + ph, Fb.light ? CR[4] : CR[2]);
  topQ(p, A0, B0, A1, B0 + th, ZT + ph, CR[6]);
  const sb = p.rot ? A1 - th : A0 + th;
  const Sb = side3(p, sb);
  pq(p, Sb, B0, B1, ZT, ZT + ph, Sb.light ? CR[4] : CR[2]);
  topQ(p, p.rot ? A1 - th : A0, B0, p.rot ? A1 : A0 + th, B1, ZT + ph, CR[6]);
  railing(p, front3(p, B0 + th / 2), A0, A1, ZT + ph, 8);
  railing(p, side3(p, p.rot ? A1 - th / 2 : A0 + th / 2), B0, B1, ZT + ph, 8);
  if (T.roof === 'piscina') roofPool(p, T, items);
  else if (T.roof === 'terrazza') roofGarden(p, T, items);
  else roofPlant(p, T, items);
  items.sort((m, n) => m.d - n.d);
  for (const it of items) it.draw();
  // the crown: a cream band round the top, the front parapet, glass
  const t = 0.1;
  const Fo = front3(p, B1 + t);
  const So = side3(p, p.rot ? A0 - t : A1 + t);
  const crown: Mat = (light, _w, h) => (_u, v, x, y) => {
    let i = light ? 4.8 : 2.8;
    if (v > h - 1.2) i += 1.6;
    else if (v > 13 && v < 15) i -= 1.2;
    else if (v < 2) i -= 1;
    if (hash(x, y, 11) < 0.02) i -= 0.5;
    return at(CR, i);
  };
  pt(p, So, B0 - t, B1 + t, ZT - 7, ZT + ph, crown);
  pt(p, Fo, A0 - t, A1 + t, ZT - 7, ZT + ph, crown);
  topQ(p, A0 - t, B1 - th, A1 + t, B1 + t, ZT + ph, CR[7]);
  if (p.rot) topQ(p, A0 - t, B0 - t, A0 + th, B1 + t, ZT + ph, CR[7]);
  else topQ(p, A1 - th, B0 - t, A1 + t, B1 + t, ZT + ph, CR[7]);
  railing(p, side3(p, p.rot ? A0 + 0.02 : A1 - 0.02), B0, B1, ZT + ph, 8);
  railing(p, front3(p, B1 - 0.02), A0, A1, ZT + ph, 8);
}

/** The pool deck's layout (shared by the drawing and the lights). */
function poolLayout(T: Tower) {
  const { A0, A1, B0, B1 } = T;
  const Wd = A1 - A0;
  const Dd = B1 - B0;
  const pa0 = A0 + Math.max(1.3, Wd * 0.17);
  const pa1 = Math.min(A1 - 1.6, pa0 + clamp(Wd * 0.46, 3, 6.5));
  const pb0 = B0 + Math.max(2.1, Dd * 0.33);
  const pb1 = Math.min(B1 - 1.5, pb0 + clamp(Dd * 0.28, 1.8, 3.4));
  return { pa0, pa1, pb0, pb1, Wd, Dd };
}

/** A pool sunk in the deck: white coping, turquoise water with caustics, the shallow end lighter. */
function pool(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, spa = false) {
  const cw = 0.13;
  const coping: Mat = () => (u, v, x, y) => (u % 30 < 1 || v % 30 < 1 ? '#d6d8d6' : hash(x, y, 31) < 0.04 ? '#e8eae8' : '#f8f8f4');
  topT(p, a0, b0, a1, b1, z + 0.4, coping);
  const zw = z - 1.2;
  const wa0 = a0 + cw;
  const wa1 = a1 - cw;
  const wb0 = b0 + cw;
  const wb1 = b1 - cw;
  const water: Mat = (_l, lu, lv) => (u, v, x, y) => {
    const fa = u / lu;
    let t = spa ? 4.4 : 2.7 + fa * 1.5 + (1 - v / lv) * 0.4;
    const n = noise2(u * 0.07 + Math.sin(v * 0.05) * 1.5, v * 0.12, seed);
    const e = Math.abs(n - 0.5);
    if (e < 0.03) t += 1.8;
    else if (e < 0.065) t += 0.8;
    if (!spa && Math.abs(v - lv / 2) < 1.6 && u > 14 && u < lu - 14) t -= 0.9;
    if (hash(x, y, seed) < 0.006) return POOL[7];
    return at(POOL, t + (bayer(x, y) - 0.5) * 0.7);
  };
  topT(p, wa0, wb0, wa1, wb1, zw, water);
  // the inner walls we see: the back one and the far end
  const wall = spa ? '#7adce8' : '#9ee6ee';
  pq(p, front3(p, wb0), wa0, wa1, zw, z + 0.4, wall);
  const ea = p.rot ? wa1 : wa0;
  pq(p, side3(p, ea), wb0, wb1, zw, z + 0.4, darken(wall, 0.12));
  // the near coping strips again over the water's edge
  topT(p, a0, wb1, a1, b1, z + 0.4, coping);
  if (p.rot) topT(p, a0, b0, wa0, b1, z + 0.4, coping);
  else topT(p, wa1, b0, a1, b1, z + 0.4, coping);
  // a chrome ladder
  if (!spa) {
    const [lx, ly] = p.P(a0 + 0.5, b0 + cw * 0.5, z + 0.4);
    for (const dx of [-3, 3]) {
      px(p.c, lx + dx, ly - 10, STEEL[5], 1, 12);
      px(p.c, lx + dx + 1, ly - 10, STEEL[2], 1, 12);
    }
  }
}

/**
 * A roof deck being furnished: what stands where (so nothing overlaps), and
 * the items to draw back to front once everything is placed.
 */
class Deck {
  readonly items: { d: number; draw: () => void }[] = [];
  readonly taken: Rect[] = [];
  constructor(
    readonly p: PropPainter,
    readonly T: Tower,
  ) {}
  free(a0: number, b0: number, a1: number, b1: number) {
    return this.taken.every(([x0, y0, x1, y1]) => a1 <= x0 || a0 >= x1 || b1 <= y0 || b0 >= y1);
  }
  take(a0: number, b0: number, a1: number, b1: number) {
    this.taken.push([a0, b0, a1, b1]);
  }
  add(a: number, b: number, draw: () => void) {
    this.items.push({ d: depth(this.p, a, b), draw });
  }
  /** Something square of half-size r at (a, b), if it fits. */
  place(a: number, b: number, r: number, draw: () => void) {
    if (!this.free(a - r, b - r, a + r, b + r)) return false;
    this.take(a - r, b - r, a + r, b + r);
    this.add(a, b, draw);
    return true;
  }
  palm(a: number, b: number, seed: number, s: number) {
    return this.place(a, b, 0.3, () => palmPlanter(this.p, a, b, this.T.ZT, seed, s));
  }
  /** Potted shrubs dotted over whatever deck is left. */
  pots(n: number, seed: number) {
    const { A0, A1, B0, B1, ZT } = this.T;
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const a = A0 + 1 + hash(i, seed, 71) * (A1 - A0 - 2);
      const b = B0 + 1 + hash(i, seed, 72) * (B1 - B0 - 2);
      const ok = this.place(a, b, 0.25, () => {
        box(this.p, a - 0.16, b - 0.16, 0.32, 0.32, ZT, 3.2, { front: planterMat, side: planterMat, top: soilMat, edge: CR[0] });
        const [x, y] = this.p.P(a, b, ZT + 3.2);
        shrubs(this.p.c, [[x - 4, y - 9], [x + 5, y - 8], [x, y - 15]], 9, seed + i * 3, { dots: i % 2 ? ['#d8337a'] : undefined, dotChance: 0.5 });
      });
      if (ok) n--;
    }
  }
  /** Planters of clipped shrubs and flowers along all four edges, in every free stretch. */
  edges(flowers: string[], seed: number) {
    const { A0, A1, B0, B1, ZT } = this.T;
    const th = 0.26;
    const lines: [boolean, number, number, number][] = [
      [true, B0 + 0.2, A0 + 0.2, A1 - 0.2],
      [true, B1 - 0.2 - th, A0 + 0.2, A1 - 0.2],
      [false, A0 + 0.2, B0 + 0.2, B1 - 0.2],
      [false, A1 - 0.2 - th, B0 + 0.2, B1 - 0.2],
    ];
    lines.forEach(([alongA, f, u0, u1], li) => {
      const seg = (s0: number, s1: number) => {
        if (s1 - s0 < 0.5) return;
        const [a0, b0, aw, bd] = alongA ? [s0, f, s1 - s0, th] : [f, s0, th, s1 - s0];
        this.take(a0, b0, a0 + aw, b0 + bd);
        this.add(a0 + aw / 2, b0 + bd / 2, () => hedgeBox(this.p, a0, b0, aw, bd, ZT, seed + li * 7 + Math.round(s0 * 3), flowers));
      };
      let s = -1;
      for (let u = u0; u < u1 - 0.05; u += 0.1) {
        const ok = alongA ? this.free(u, f, u + 0.1, f + th) : this.free(f, u, f + th, u + 0.1);
        if (ok && s < 0) s = u;
        if (!ok && s >= 0) {
          seg(s + 0.12, u - 0.12);
          s = -1;
        }
      }
      if (s >= 0) seg(s + 0.12, u1);
    });
  }
}

function roofPool(p: PropPainter, T: Tower, items: { d: number; draw: () => void }[]) {
  const { A0, A1, B0, B1, ZT, seed } = T;
  const { pa0, pa1, pb0, pb1 } = poolLayout(T);
  const Rn = rng(seed * 13 + 5);
  const dk = new Deck(p, T);
  pool(p, pa0, pb0, pa1, pb1, ZT, seed);
  // timber strips along the pool's back and front, loungers and parasols on them
  topT(p, pa0 - 0.2, pb0 - 1.3, Math.min(pa1 + 0.2, A1 - 0.4), pb0 - 0.05, ZT, deckMat);
  topT(p, pa0 - 0.2, pb1 + 0.05, Math.min(pa0 + 2.6, pa1 + 0.2), pb1 + 1.15, ZT, deckMat);
  dk.take(pa0 - 0.2, pb0 - 1.3, pa1 + 0.2, pb1 + 1.15);
  const towels = ['#f2c42a', '#3fb6c8', '#e8577a', '#ffffff', '#5b8def'];
  let li = 0;
  for (let a = pa0 + 0.3; a < pa1 - 0.15; a += 0.72, li++) {
    const aa = a;
    const tw = Rn() < 0.5 ? towels[Math.floor(Rn() * towels.length)] : undefined;
    dk.add(aa, pb0 - 0.62, () => lounger(p, aa, pb0 - 0.62, ZT, 'b-', tw));
    if (li % 2 === 1) {
      const col = li % 4 === 1 ? '#fbf8f0' : '#f4ecd8';
      dk.add(aa - 0.36, pb0 - 1.1, () => {
        const [x, y] = p.P(aa - 0.36, pb0 - 1.1, ZT);
        parasol(p.c, x, y, 84, 40, col);
      });
    }
  }
  for (let a = pa0 + 0.35; a < pa0 + 2.4 && a < pa1; a += 0.72) {
    const aa = a;
    const tw = Rn() < 0.5 ? towels[Math.floor(Rn() * towels.length)] : undefined;
    dk.add(aa, pb1 + 0.62, () => lounger(p, aa, pb1 + 0.62, ZT, 'b+', tw));
  }
  // a spa at the front right
  const sa0 = pa1 + 0.5;
  if (sa0 + 1.25 < A1 - 0.6) {
    const sb0 = Math.min(pb1 - 0.4, B1 - 1.9);
    dk.take(sa0, sb0, sa0 + 1.25, sb0 + 1.25);
    dk.add(sa0 + 0.6, sb0 + 0.6, () => {
      box(p, sa0, sb0, 1.25, 1.25, ZT, 2.2, { front: planterMat, side: planterMat, top: planterMat, edge: CR[0] });
      pool(p, sa0 + 0.05, sb0 + 0.05, sa0 + 1.2, sb0 + 1.2, ZT + 2.2, seed + 3, true);
    });
  }
  // a pergola with a lounge in the back corner
  const ga0 = Math.max(pa1 + 0.3, A1 - 2.7);
  const ga1 = A1 - 0.35;
  const gb0 = B0 + 0.4;
  const gb1 = Math.min(pb0 - 0.3, B0 + 2);
  const hasPergola = ga1 - ga0 > 1.5;
  if (hasPergola) {
    dk.take(ga0 - 0.15, B0 + 0.25, A1 - 0.2, gb1 + 0.15);
    dk.add((ga0 + ga1) / 2, (gb0 + gb1) / 2, () =>
      pergola(p, ga0, gb0, ga1, gb1, ZT, 22, () => {
        sofa(p, ga0 + 0.15, gb0 + 0.1, ga1 - ga0 - 0.3, 0.42, ZT, 'b0');
        lowTable(p, (ga0 + ga1) / 2, gb0 + 0.95, ZT);
      }),
    );
  }
  // palms in planters round the deck and by the pool
  const pm = (pb0 + pb1) / 2;
  const fa = (pa0 + pa1) / 2 + 0.4;
  const palms: [number, number][] = [
    [A0 + 0.5, B0 + 0.5],
    [A0 + 0.5, B1 - 0.55],
    [A1 - 0.55, B1 - 0.55],
    [A0 + 0.5, pm],
    [fa, B1 - 0.55],
    [pa1 + 0.5, pb0 - 0.55],
    [A1 - 0.55, hasPergola ? Math.max(gb1 + 0.8, pm) : pm],
  ];
  palms.forEach(([a, b], i) => dk.palm(a, b, seed * 7 + i, 1.45 + hash(i, seed, 2) * 0.4));
  dk.pots(3, seed);
  // clipped shrubs and bougainvillea along the edges, between the palms
  dk.edges(['#d8337a', '#fbf2e6', '#e8577a'], seed);
  items.push(...dk.items);
}

function roofGarden(p: PropPainter, T: Tower, items: { d: number; draw: () => void }[]) {
  const { A0, A1, B0, B1, ZT, seed } = T;
  const Wd = A1 - A0;
  const Dd = B1 - B0;
  const dk = new Deck(p, T);
  // a timber deck at the back
  topT(p, A0 + 0.55, B0 + 0.55, A1 - 0.55, B0 + Dd * 0.46, ZT, deckMat);
  // a lawn at the front right, mown in stripes, in a cream kerb, loungers and a palm on it
  const la0 = A0 + Wd * 0.5;
  const lb0 = B0 + Dd * 0.56;
  const la1 = A1 - 0.6;
  const lb1 = B1 - 0.6;
  const zl = ZT + 1.2;
  const kerb = solid(CR, 4.4, 2.6, 5.4);
  const lawn: Mat = () => (u, _v, x, y) => at(GRASS, 3 + (Math.floor(u / 22) % 2 ? 0.6 : -0.3) + (hash(x, y >> 1, 3) < 0.2 ? -1 : hash(x, y, 4) > 0.93 ? 1 : 0) + (bayer(x, y) - 0.5) * 0.6);
  box(p, la0, lb0, la1 - la0, lb1 - lb0, ZT, 1.2, { front: kerb, side: kerb, top: lawn, edge: CR[0] });
  dk.take(la0 - 0.1, lb0 - 0.1, la1 + 0.1, lb1 + 0.1);
  for (let a = la0 + 0.45; a < la1 - 1.1; a += 0.78) {
    const aa = a;
    dk.add(aa, lb0 + 0.6, () => lounger(p, aa, lb0 + 0.6, zl, 'b-', aa > la0 + 1 ? '#3fb6c8' : undefined));
  }
  dk.add(la1 - 0.6, lb1 - 0.6, () => palmPlanter(p, la1 - 0.6, lb1 - 0.6, zl, seed + 13, 1.4));
  // the pergola over a lounge at the back left
  const ga0 = A0 + 0.5;
  const ga1 = A0 + 0.5 + clamp(Wd * 0.42, 2.4, 4.4);
  const gb0 = B0 + 0.5;
  const gb1 = B0 + clamp(Dd * 0.32, 1.9, 2.8);
  const linen: Ramp = ['#8a7a62', '#a8977c', '#c4b496', '#d8cab0', '#e8dcc6', '#f4ecdc'];
  dk.take(ga0 - 0.15, gb0 - 0.15, ga1 + 0.15, gb1 + 0.15);
  dk.add((ga0 + ga1) / 2, (gb0 + gb1) / 2, () =>
    pergola(p, ga0, gb0, ga1, gb1, ZT, 22, () => {
      sofa(p, ga0 + 0.15, gb0 + 0.1, ga1 - ga0 - 0.3, 0.44, ZT, 'b0', linen);
      sofa(p, ga0 + 0.1, gb0 + 0.6, 0.44, gb1 - gb0 - 0.7, ZT, 'a0', linen);
      lowTable(p, (ga0 + ga1) / 2 + 0.2, (gb0 + gb1) / 2 + 0.25, ZT, 0.3);
    }),
  );
  // a dining table with chairs at the front left
  const ta = A0 + Wd * 0.28;
  const tb = B0 + Dd * 0.7;
  dk.take(ta - 0.95, tb - 0.7, ta + 0.95, tb + 0.6);
  dk.add(ta, tb, () => {
    const chair = solid(TEAK, 3.4, 2, 4.4);
    for (const [da, db] of [[-0.55, -0.28], [0, -0.42], [0.55, -0.28]] as const) box(p, ta + da - 0.13, tb + db - 0.13, 0.26, 0.26, ZT, 4.5, { front: chair, side: chair, top: chair, edge: TEAK[0] });
    box(p, ta - 0.75, tb - 0.25, 1.5, 0.5, ZT + 6.6, 0.8, { front: solid(TEAK, 3.6, 2.2, 4.6), side: solid(TEAK, 3.6, 2.2, 4.6), top: solid(TEAK, 4, 2.2, 4.8), edge: TEAK[0] });
    for (const da of [-0.6, 0.6]) box(p, ta + da - 0.04, tb - 0.04, 0.08, 0.08, ZT, 6.6, { front: frameMat, side: frameMat, top: frameMat, edge: GRAPH[0] });
    const [x, y] = p.P(ta, tb, ZT + 7.4);
    px(p.c, x - 2, y - 8, '#f2f0ea', 4, 7);
    shrubs(p.c, [[x, y - 10]], 5, seed + 9, { dots: ['#f2c42a'], dotChance: 0.8 });
    for (const [da, db] of [[-0.55, 0.3], [0.55, 0.3]] as const) box(p, ta + da - 0.13, tb + db - 0.13, 0.26, 0.26, ZT, 4.5, { front: chair, side: chair, top: chair, edge: TEAK[0] });
  });
  // olive trees and palms in big planters
  const trees: [number, number][] = [[A1 - 0.85, B0 + 0.85], [A0 + 0.8, B1 - 0.85], [(la0 + A1) / 2, B0 + 0.85], [A0 + 0.8, (gb1 + tb) / 2]];
  trees.forEach(([a, b], i) => dk.place(a, b, 0.4, () => oliveTree(p, a, b, ZT, seed * 5 + i)));
  dk.palm(ga1 + 0.6, B0 + 0.6, seed + 17, 1.5);
  dk.palm(la0 - 0.55, B1 - 0.6, seed + 19, 1.3);
  dk.pots(4, seed + 1);
  dk.edges(['#e8457a', '#9a7ad8', '#fbf2e6', '#f2c42a'], seed + 2);
  items.push(...dk.items);
}

function roofPlant(p: PropPainter, T: Tower, items: { d: number; draw: () => void }[]) {
  const { A0, A1, B0, B1, ZT, seed } = T;
  const Wd = A1 - A0;
  const Dd = B1 - B0;
  // the plant room: cream walls with louvres, a steel door, a mast with a dish
  const ra0 = A0 + Wd * 0.14;
  const ra1 = A0 + Wd * 0.58;
  const rb0 = B0 + Dd * 0.14;
  const rb1 = B0 + Dd * 0.52;
  const RH = 24;
  items.push({
    d: depth(p, (ra0 + ra1) / 2, (rb0 + rb1) / 2),
    draw: () => {
      const wallM: Mat = (light, w, h) => (u, v, x, y) => {
        const fu = u % 60;
        if (v > 30 && v < h - 18 && fu > 12 && fu < 48) return Math.floor(v) % 5 < 2 ? (light ? '#7a7e86' : '#5a5e66') : light ? '#c4c8cc' : '#9a9ea6';
        let i = light ? 4.4 : 2.6;
        if (v > h - 2) i += 1.2;
        if (hash(x, y, 12) < 0.03) i -= 0.6;
        void w;
        return at(CR, i);
      };
      box(p, ra0, rb0, ra1 - ra0, rb1 - rb0, ZT, RH, { front: wallM, side: wallM, top: membraneMat, edge: CR[0] });
      const F = front3(p, rb1);
      pq(p, F, ra0 + 0.3, ra0 + 0.75, ZT, ZT + 19, STEEL[1]);
      pq(p, F, ra0 + 0.34, ra0 + 0.71, ZT + 0.5, ZT + 18.5, STEEL[3]);
      // a mast with a dish and an aviation light
      const [mx, my] = p.P(ra0 + (ra1 - ra0) * 0.7, rb0 + (rb1 - rb0) * 0.4, ZT + RH);
      layer(
        p.c,
        (l) => {
          px(l, mx - 1, my - 150, STEEL[2], 3, 150);
          px(l, mx - 1, my - 150, STEEL[4], 1, 150);
          for (let j = 20; j < 150; j += 18) ln(l, mx - 6, my - j, mx + 6, my - j - 9, STEEL[2]);
          ell(l, mx, my - 152, 3, 3, '#ff4a3a');
          px(l, mx - 1, my - 154, '#ffd0c8', 1, 1);
          ell(l, mx - 22, my - 40, 9, 9, '#e8eaec');
          ell(l, mx - 20, my - 40, 6, 7, '#c4c8cc');
          ln(l, mx - 22, my - 40, mx - 12, my - 44, STEEL[1]);
          ln(l, mx - 1, my - 30, mx - 18, my - 36, STEEL[2]);
        },
        { outline: 0.6, rect: [mx - 40, my - 160, mx + 12, my + 4] },
      );
    },
  });
  // chillers with fans in a row
  const ca0 = A0 + Wd * 0.62;
  for (let i = 0; i < 3; i++) {
    const b = B0 + 0.6 + i * Math.max(1.3, (Dd - 1.4) / 3);
    if (b + 1.1 > B1 - 0.3) break;
    const bb = b;
    items.push({
      d: depth(p, ca0 + 0.9, bb + 0.5),
      draw: () => {
        const m = solid(STEEL, 4.4, 2.6, 5);
        box(p, ca0, bb, Math.min(1.9, A1 - 0.4 - ca0), 1.05, ZT, 11, { front: m, side: m, top: solid(STEEL, 4, 2.4, 4.8), edge: STEEL[0] });
        for (let f = 0; f < 2; f++) {
          const [fx, fy] = p.P(ca0 + 0.5 + f * 0.85, bb + 0.52, ZT + 11);
          ell(p.c, fx, fy, 22, 11, STEEL[1]);
          ell(p.c, fx, fy, 19, 9, '#22262c');
          for (let q = 0; q < 6; q++) ln(p.c, fx, fy, fx + Math.cos(q + seed) * 18, fy + Math.sin(q + seed) * 8, STEEL[3]);
          ell(p.c, fx, fy, 3, 2, STEEL[4]);
        }
      },
    });
  }
  // vent stacks and a window-cleaning gantry on its track
  for (let i = 0; i < 4; i++) {
    const a = A0 + 0.6 + hash(i, seed, 5) * (Wd * 0.5);
    const b = B1 - 0.6 - hash(i, seed, 6) * (Dd * 0.3);
    items.push({
      d: depth(p, a, b),
      draw: () => {
        const m = solid(STEEL, 4.6, 2.8, 5.4);
        box(p, a - 0.09, b - 0.09, 0.18, 0.18, ZT, 7, { front: m, side: m, top: solid(GRAPH, 2, 1, 2), edge: STEEL[0] });
        box(p, a - 0.14, b - 0.14, 0.28, 0.28, ZT + 7, 1.2, { front: m, side: m, top: m, edge: STEEL[0] });
      },
    });
  }
  const ga = A0 + Wd * 0.3;
  items.push({
    d: depth(p, ga, B1 - 0.5),
    draw: () => {
      const m = solid(['#8a6a1a', '#a8821e', '#c89a24', '#e0b42e', '#f0c840', '#f8dc70'], 3.6, 2.2, 4.4);
      box(p, ga - 0.35, B1 - 0.75, 0.7, 0.5, ZT, 8, { front: m, side: m, top: m, edge: '#5a4410' });
      box(p, ga - 0.06, B1 - 0.56, 0.12, 0.12, ZT + 8, 14, { front: m, side: m, top: m, edge: '#5a4410' });
      box(p, ga - 0.06, B1 - 2.2, 0.12, 1.75, ZT + 20, 1.6, { front: m, side: m, top: m, edge: '#5a4410' });
    },
  });
}

/** Where a tower glows at night: lit offices on both faces, the lobby, the roof. */
function towerLights(T: Tower): PropLight[] {
  const out: PropLight[] = [];
  const pick = (face: 0 | 1, n: number) => {
    const L = face ? T.B1 - T.B0 : T.A1 - T.A0;
    const pitch = face ? T.pitchS : T.pitchF;
    const cols = Math.round(L / pitch);
    const cands: [number, number, number][] = [];
    for (let st = 0; st < T.storeys; st++) for (let g = 0; g < cols; g += 2) if (paneLit(face, g, st, T.seed)) cands.push([hash(g, st, T.seed + 99), g, st]);
    cands.sort((x, y) => x[0] - y[0]);
    for (const [, g, st] of cands.slice(0, n)) {
      const u = (face ? T.B0 : T.A0) + (g + 1) * pitch;
      const z = T.BH + st * T.SH + 18;
      out.push(face ? { a: T.A1, b: u, z, r: 1.2, color: WARM, kind: 'window' } : { a: u, b: T.B1, z, r: 1.2, color: WARM, kind: 'window' });
    }
  };
  pick(0, 9);
  pick(1, 8);
  for (const a of [T.W * 0.3, T.W * 0.7]) out.push({ a, b: T.D - 0.1, z: 14, r: 1.6, color: WARM, kind: 'window' });
  out.push({ a: T.W - 0.1, b: T.D * 0.5, z: 14, r: 1.6, color: WARM, kind: 'window' });
  if (T.roof === 'piscina') {
    const { pa0, pa1, pb0, pb1 } = poolLayout(T);
    out.push({ a: (pa0 + pa1) / 2, b: (pb0 + pb1) / 2, z: T.ZT + 1, r: 2.4, color: '#5ad8ec', kind: 'lamp' });
    out.push({ a: T.A1 - 1.3, b: T.B0 + 1.2, z: T.ZT + 18, r: 1.2, color: WARM, kind: 'lamp' });
  } else if (T.roof === 'terrazza') {
    out.push({ a: T.A0 + 1.6, b: T.B0 + 1.3, z: T.ZT + 18, r: 1.6, color: WARM, kind: 'lamp' });
    out.push({ a: T.A0 + (T.A1 - T.A0) * 0.28, b: T.B0 + (T.B1 - T.B0) * 0.7, z: T.ZT + 10, r: 1.2, color: WARM, kind: 'lamp' });
  } else out.push({ a: T.A0 + (T.A1 - T.A0) * 0.45, b: T.B0 + (T.B1 - T.B0) * 0.3, z: T.ZT + 60, r: 0.8, color: '#ff5a4a', kind: 'lamp' });
  return out;
}

const torre: PropArt = { draw: towerDraw, lights: (k) => towerLights(towerOf(k)) };

// ── the monorail guideway ───────────────────────────────────
/** Top and underside of the beam, and its width across b. */
const RAIL_TOP = 62;
const RAIL_BOT = 53;
const RB0 = 0.275;
const RB1 = 0.725;

/** Pillar positions along a guideway of length w: n = floor(w / 4) pillars, 4 tiles apart, on tile centres, the set centred on the span. */
export function pillarsAt(w: number): number[] {
  const n = Math.max(1, Math.floor(w / 4));
  const a0 = Math.floor((w - 4 * (n - 1)) / 2) + 0.5;
  return Array.from({ length: n }, (_, i) => a0 + 4 * i);
}

/** A round column drawn as stacked 1-px slices: lit on the left, a formwork line every 12 z; rad(z) in tiles. */
function roundColumn(c: C, x: number, y: number, k: number, h: number, rad: (z: number) => number, ramp: Ramp) {
  const KX = 16 * k * Math.SQRT2;
  const KY = 8 * k * Math.SQRT2;
  const steps = Math.ceil(h * k);
  const n = ramp.length - 1;
  for (let s = 0; s <= steps; s++) {
    const z = s / k;
    const r = rad(z);
    const rx = r * KX;
    const ry = r * KY;
    const cy = y - s;
    const line = s % (12 * k) === 0 && s > 0 ? -0.7 : 0;
    const m = Math.ceil(rx);
    for (let i = -m; i <= m; i++) {
      const nx = (i + 0.5) / rx;
      if (nx < -1 || nx > 1) continue;
      const hh = Math.sqrt(1 - nx * nx) * ry;
      const t = (0.7 - nx * 0.42) * n + line + (bayer(x + i, cy) - 0.5) * 0.8;
      c.fillStyle = at(ramp, t);
      if (s === steps) c.fillRect(Math.round(x + i), Math.round(cy - hh), 1, Math.max(1, Math.round(2 * hh)));
      else c.fillRect(Math.round(x + i), Math.round(cy + hh - 1), 1, 2);
    }
  }
}

const concMat = solid(CONC, 4.6, 2.8, 5.4);

/** A guideway pillar: a footing, a round column, a flared head under the beam. */
function pillar(p: PropPainter, a: number, b: number) {
  box(p, a - 0.34, b - 0.34, 0.68, 0.68, -0.6, 2.4, { front: concMat, side: concMat, top: concMat, edge: CONC[0] });
  const [x, y] = p.P(a, b, 1.8);
  const h = RAIL_BOT - 1.8;
  const zf = h - 10;
  layer(p.c, (l) => roundColumn(l, x, y, p.k, h, (z) => (z < zf ? 0.19 : 0.19 + 0.06 * ((z - zf) / 10) ** 2), CONC), { outline: 0.7, rect: [x - 36, y - h * p.k - 24, x + 36, y + 6] });
}

/** The beam's face: smooth white concrete, a lit top lip, a drip groove, joints every 2 tiles. */
const beamMat =
  (ut: number): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = light ? 4.7 : 3;
    if (v > h - 2.4) i += 1.3;
    else if (v > h - 6 && v < h - 4.6) i -= 1.2;
    if (v < 2.2) i -= 1.4;
    if (u % (2 * ut) < 1.2) i -= 0.8;
    if (hash(x, y, 41) < 0.03) i -= 0.5;
    return at(CONC, i + (bayer(x, y) - 0.5) * 0.4);
  };

/** The running surface: pale concrete edges, a dark guide strip with two bright rails. */
const beamTop: Mat = (_l, _w, lv) => (_u, v, x, y) => {
  const t = v / lv;
  if (t < 0.08 || t > 0.92) return CONC[6];
  if (t > 0.28 && t < 0.72) {
    if (Math.abs(t - 0.34) < 0.03 || Math.abs(t - 0.66) < 0.03) return STEEL[5];
    return hash(x, y, 42) < 0.05 ? '#5a5f68' : '#4a4f58';
  }
  return hash(x, y, 43) < 0.05 ? CONC[3] : CONC[4];
};

const monorotaia: PropArt = {
  draw(p, k) {
    const W = k.w;
    const ut = UT(p);
    // shadows on the ground: the beam's band and each pillar's stripe
    liftedShadow(p, 0, RB0 + 0.04, W, RB1 - 0.04, (RAIL_TOP + RAIL_BOT) / 2, 0.24);
    const pil = pillarsAt(W);
    for (const a of pil) {
      const [x, y] = p.P(a, 0.5, 0);
      const len = 0.35 * RAIL_BOT * p.k;
      shadePoly(p.c, [[x + 4, y - 6], [x + len, y - 4], [x + len, y + 6], [x + 4, y + 7]], 0.24, () => 0.8);
    }
    const order = [...pil].sort((m, n) => depth(p, m, 0.5) - depth(p, n, 0.5));
    for (const a of order) pillar(p, a, 0.5);
    // the beam: its face, the visible end, the running surface, edge lines
    const F = front3(p, RB1);
    const S = side3(p, p.rot ? 0 : W);
    pt(p, F, 0, W, RAIL_BOT, RAIL_TOP, beamMat(ut));
    pt(p, S, RB0, RB1, RAIL_BOT, RAIL_TOP, beamMat(ut));
    topT(p, 0, RB0, W, RB1, RAIL_TOP, beamTop);
    const e = (a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, col: string) => {
      const [x0, y0] = p.P(a0, b0, z0);
      const [x1, y1] = p.P(a1, b1, z1);
      ln(p.c, x0, y0, x1, y1, col);
    };
    const dark = mix(CONC[0], OUTL, 0.6);
    e(0, RB0, RAIL_TOP, W, RB0, RAIL_TOP, dark);
    e(0, RB1, RAIL_BOT, W, RB1, RAIL_BOT, dark);
    const ea = p.rot ? 0 : W;
    e(ea, RB0, RAIL_TOP, ea, RB0, RAIL_BOT, dark);
    e(ea, RB0, RAIL_BOT, ea, RB1, RAIL_BOT, dark);
  },
};

// ── the monorail train ──────────────────────────────────────
type Fk = 'low' | 'wall' | 'stripe' | 'glass' | 'roof';
/** Body cross-section, front half from the bottom to the crown: half-width as a share of HW, z, the facet that follows. */
const PROF: [number, number, Fk][] = [
  [0.8, 71, 'low'],
  [0.93, 72, 'low'],
  [0.99, 73.5, 'wall'],
  [1, 75.2, 'stripe'],
  [1, 76.6, 'wall'],
  [1, 78.4, 'glass'],
  [0.992, 83.4, 'glass'],
  [0.975, 88.4, 'wall'],
  [0.94, 90.6, 'wall'],
  [0.87, 92.4, 'wall'],
  [0.74, 93.7, 'roof'],
  [0.55, 94.4, 'roof'],
  [0.3, 94.75, 'roof'],
  [0, 94.85, 'roof'],
];
const HW = 0.38;
const NOSE = 1.05;
const TWH: Ramp = ['#5e6576', '#7e8596', '#9ea4b2', '#bcc1cc', '#d6dae2', '#e8ebf0', '#f6f7fa', '#ffffff'];
const TROOF: Ramp = ['#6a7488', '#8692a8', '#a2aec2', '#bcc6d8', '#d0d8e6', '#e0e6f0', '#eef2f8'];
const TGLASS: Ramp = ['#0a1430', '#122046', '#1a2e5e', '#26437a', '#3a5e98', '#5a80b8', '#8aaad6', '#c4d6f0'];
const TSTRIPE: Ramp = ['#08324e', '#0c4c74', '#106a9c', '#1688c0', '#24a4dc', '#4cc0ee'];
const LIGHT_DIR: V3 = (() => {
  const v: V3 = [-0.3, 0.75, 0.9];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/**
 * The closed cross-section at nose parameter s (0 = full body, 1 = the tip):
 * points (b, z) round the profile (front half up, back half down) and, for the
 * facet that follows each point, the front facet it mirrors (-1: the bottom).
 */
function section(s: number): { pts: V2[]; fi: number[] } {
  const k = Math.sqrt(Math.max(0.05, 1 - 0.78 * s ** 2.3));
  const zb = 71 + 3.2 * s ** 3;
  const zt = 94.85 - 15.5 * s ** 1.7;
  const map = (f: number, z: number): V2 => [0.5 + f * HW * k, zb + ((z - 71) * (zt - zb)) / 23.85];
  const n = PROF.length;
  const pts: V2[] = [];
  const fi: number[] = [];
  for (let i = 0; i < n; i++) {
    pts.push(map(PROF[i][0], PROF[i][1]));
    fi.push(i < n - 1 ? i : n - 2);
  }
  for (let i = n - 2; i >= 0; i--) {
    pts.push(map(-PROF[i][0], PROF[i][1]));
    fi.push(i - 1);
  }
  return { pts, fi };
}

/** The train: three (or two) cars of a white monorail, a rounded cab at both ends (it runs both ways). */
const trenoM: PropArt = {
  draw(p, k) {
    const W = k.w;
    const n = W >= 7.5 ? 3 : 2;
    const gap = 0.09;
    const L = (W - 0.08 - gap * (n - 1)) / n;
    const cars: [number, number][] = [];
    for (let i = 0; i < n; i++) cars.push([0.04 + i * (L + gap), 0.04 + i * (L + gap) + L]);
    const nose = Math.min(NOSE, L * 0.45);
    const e0 = cars[0][0];
    const e1 = cars[n - 1][1];
    const sAt = (a: number) => clamp(Math.max((e0 + nose - a) / nose, (a - (e1 - nose)) / nose), 0, 1);
    const toWorld = (v: V3): V3 => (p.rot ? [v[1], -v[0], v[2]] : v);
    const lumOf = (w: V3) => 0.45 + 0.55 * Math.max(0, w[0] * LIGHT_DIR[0] + w[1] * LIGHT_DIR[1] + w[2] * LIGHT_DIR[2]);
    const c = p.c;
    const skirt = (a0: number, a1: number): Mat => (light, lu, h) => (u, v, x, y) => {
      // in the body's shadow at the top
      if (v > h - 5) return v > h - 2 ? '#3e424e' : '#626674';
      const a = a0 + (u / lu) * (a1 - a0);
      // two bogies per car behind louvred panels
      const bog = cars.some(([c0, c1]) => Math.abs(a - (c0 + 0.75)) < 0.42 || Math.abs(a - (c1 - 0.75)) < 0.42);
      let i = light ? 2.9 : 1.8;
      if (v < 1.6) i -= 1.2;
      if (bog) i -= Math.floor(u) % 4 < 1 ? 1.4 : 0.5;
      return at(CONC, i + (bayer(x, y) - 0.5) * 0.4);
    };
    /** A cab: slices along a in drawing order, each leaving only its rim to the next. */
    const cab = (a0: number, a1: number, ci: number) => {
      const from = p.rot ? a1 : a0;
      const to = p.rot ? a0 : a1;
      const steps = Math.max(1, Math.ceil(Math.abs(to - from) * 44));
      for (let q = 0; q <= steps; q++) {
        const a = from + ((to - from) * q) / steps;
        const s = sAt(a);
        const sec = section(s);
        const nxt = section(sAt(a + 0.01));
        if (s < 0.5) {
          const zb = s < 0.3 ? 62 : 62 + (s - 0.3) * 40;
          fillPoly(c, [[0.27, zb], [0.73, zb], [0.73, 72.5], [0.27, 72.5]].map(([b, z]): V2 => p.P(a, b, z)), at(CONC, p.rot ? 1.8 : 2.9));
        }
        if (q === steps && s > 0.95) {
          fillPoly(c, sec.pts.map(([b, z]) => p.P(a, b, z)), at(TWH, (p.rot ? 0.92 : 0.5) * 7));
          continue;
        }
        const ctr = p.P(a, 0.5, (sec.pts[0][1] + sec.pts[PROF.length - 1][1]) / 2);
        const m = sec.pts.length;
        for (let i = 0; i < m; i++) {
          const [b0, z0] = sec.pts[i];
          const [b1, z1] = sec.pts[(i + 1) % m];
          // the facet's normal from its direction round the section and the taper along a
          const t1: V3 = [0, (b1 - b0) * 16, z1 - z0];
          const mz = (z0 + z1) / 2;
          const nb = (nxt.pts[i][0] + nxt.pts[(i + 1) % m][0]) / 2;
          const nz = (nxt.pts[i][1] + nxt.pts[(i + 1) % m][1]) / 2;
          const t2: V3 = [0.01 * 16, (nb - (b0 + b1) / 2) * 16, nz - mz];
          const nrm: V3 = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
          const nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
          const w = toWorld([nrm[0] / nl, nrm[1] / nl, nrm[2] / nl]);
          if (w[0] + w[1] + w[2] < -0.05) continue;
          fillPoly(c, [ctr, p.P(a, b0, z0), p.P(a, b1, z1)], facetColour(sec.fi[i], lumOf(w), a, s, ci, cars[ci], mz));
        }
      }
    };
    /** The straight body: the skirt, then every facet that faces us as one long textured strip. */
    const body = (a0: number, a1: number, ci: number) => {
      pt(p, front3(p, 0.73), a0, a1, 62, 72.5, skirt(a0, a1));
      const sec = section(0);
      const m = sec.pts.length;
      for (let i = 0; i < m; i++) {
        const [b0, z0] = sec.pts[i];
        const [b1, z1] = sec.pts[(i + 1) % m];
        const len = Math.hypot((b1 - b0) * 16, z1 - z0) || 1;
        const w = toWorld([0, (z1 - z0) / len, (-(b1 - b0) * 16) / len]);
        if (w[0] + w[1] + w[2] < 0.02) continue;
        const lum = lumOf(w);
        const fi = sec.fi[i];
        const mz = (z0 + z1) / 2;
        const strip: Mat = (_l, lu) => (u) => facetColour(fi, lum, a0 + (u / lu) * (a1 - a0), 0, ci, cars[ci], mz);
        poly3(p, [[a0, b0, z0], [a1, b0, z0], [a1, b1, z1], [a0, b1, z1]], strip, 1);
      }
    };
    // back to front: car by car, each its cab(s), its body, its flat end, its roof box, the bellows
    const seq = p.rot ? [...cars.keys()].reverse() : [...cars.keys()];
    for (let si = 0; si < seq.length; si++) {
      const ci = seq[si];
      const [c0, c1] = cars[ci];
      const b0 = ci === 0 ? e0 + nose : c0;
      const b1 = ci === n - 1 ? e1 - nose : c1;
      const parts: (() => void)[] = [];
      if (ci === 0) parts.push(() => cab(c0, b0, ci));
      parts.push(() => body(b0, b1, ci));
      if (ci === n - 1) parts.push(() => cab(b1, c1, ci));
      if (p.rot) parts.reverse();
      for (const f of parts) f();
      // the flat end facing the next car, with a door window
      const ea = p.rot ? c0 : c1;
      if (p.rot ? ci > 0 : ci < n - 1) {
        fillPoly(c, section(0).pts.map(([b, z]) => p.P(ea, b, z)), at(TWH, (p.rot ? 0.92 : 0.5) * 6));
        const [ex, ey] = p.P(ea, 0.5, 86);
        px(c, ex - 3, ey - 14, '#1a2440', 6, 18);
      }
      const ra = (c0 + c1) / 2;
      const m2 = solid(TROOF, 4, 2.6, 5.2);
      box(p, ra - 0.55, 0.32, 1.1, 0.36, 94.6, 1.8, { front: m2, side: m2, top: m2, edge: TROOF[0] });
      // the bellows to the next car
      if (si < seq.length - 1) {
        const dir = p.rot ? -1 : 1;
        for (let q = 0; q <= 4; q++) {
          const a = ea + dir * (q / 4) * gap;
          fillPoly(c, [[0.18, 73], [0.82, 73], [0.82, 92], [0.18, 92]].map(([b, z]): V2 => p.P(a, b, z)), q % 2 ? '#2a2e36' : '#3e434e');
        }
      }
    }
    // headlights at both ends (the visible one shows)
    for (const [a, sgn] of [[0.06, -1], [W - 0.06, 1]] as const) {
      const vis = p.rot ? sgn < 0 : sgn > 0;
      if (!vis) continue;
      for (const b of [0.36, 0.64]) {
        const [x, y] = p.P(a, b, 75.6);
        ell(c, x, y, 2.5, 2, '#fff6dc');
        px(c, x - 1, y - 1, '#ffffff', 2, 1);
      }
    }
  },
  lights: (k) => {
    const out: PropLight[] = [];
    for (let a = 1.3; a < k.w - 1; a += 1.4) out.push({ a, b: 0.88, z: 84, r: 0.8, color: '#ffe2b0', kind: 'window' });
    out.push({ a: 0.02, b: 0.5, z: 75.6, r: 1.6, color: '#fff4dc', kind: 'lamp' });
    out.push({ a: k.w - 0.02, b: 0.5, z: 75.6, r: 1.6, color: '#fff4dc', kind: 'lamp' });
    return out;
  },
};

/** The colour of one facet of a slice: body white, roof, stripe, the window band with mullions and doors, the windscreen. */
function facetColour(pi: number, lum: number, a: number, s: number, ci: number, car: [number, number], mz: number): string {
  const kind: Fk = pi < 0 ? 'low' : PROF[pi][2];
  // the windscreen sweeps up over the cab: dark glass, one long glint
  if (s > 0.3 && s < 0.9 && pi >= 5 && pi <= 10 - Math.round((s - 0.3) * 4)) {
    const g = 2.4 + lum * 1.8 + (pi >= 8 ? 0.7 : 0);
    return at(TGLASS, Math.abs(s - 0.6) < 0.035 && pi >= 6 ? g + 2.6 : g);
  }
  const la = a - car[0];
  const len = car[1] - car[0];
  const door = s < 0.05 && [0.3, 0.7].some((f) => Math.abs(la - len * f) < 0.2);
  const doorEdge = s < 0.05 && [0.3, 0.7].some((f) => Math.abs(Math.abs(la - len * f) - 0.2) < 0.025);
  if (kind === 'glass' && s < 0.3) {
    if (doorEdge) return '#e8ebf0';
    const mull = Math.abs(((la / 0.56) % 1) - 0.5) > 0.45;
    if (mull && !door) return '#0a1024';
    let g = 2 + lum * 2.2 + (pi === 6 ? 0.6 : 0);
    const ref = ((la * 1.7 + (pi === 6 ? 0.18 : 0) + ci * 0.37) % 1.6) / 1.6;
    if (ref < 0.07) g += 2.6;
    else if (ref < 0.16) g += 1.2;
    return at(TGLASS, g);
  }
  if (kind === 'stripe') return doorEdge ? '#2a2e36' : at(TSTRIPE, 1 + lum * 4);
  if (kind === 'roof') return at(TROOF, lum * 7);
  if (doorEdge && mz < 89) return '#4a505c';
  return at(TWH, lum * 7.4 - (door ? 0.4 : 0));
}

// ── the canal's edge ────────────────────────────────────────
/** Lamp positions along an edge of length w: about every 4 tiles, centred. */
const lampsAt = (w: number) => {
  const n = Math.max(1, Math.round(w / 4));
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * w) / n);
};

/** Cream coping slabs on top; the water's edge has a rounded nosing (at b = 0, or b = 1 for 'fronte'). */
const copingTop =
  (fronte: boolean): Mat =>
  (_l, _w, lv) =>
  (u, v, x, y) => {
    const t = fronte ? 1 - v / lv : v / lv;
    if (u % 72 < 1.2) return CR[2];
    if (t < 0.05) return CR[3];
    if (t < 0.16) return CR[7];
    if (t < 0.19) return CR[3];
    const i = 5 + (hash(Math.floor(u / 72), 0, 51) - 0.5) * 0.8 - (hash(x, y, 52) < 0.04 ? 0.8 : 0);
    return at(CR, i);
  };

/** The wall into the water (variant 'fronte'): stone courses, a wet dark foot with weed. */
const quayWall: Mat = (light, _w, h) => (u, v, x, y) => {
  const row = Math.floor(v / 12);
  if (v % 12 < 1 || (u + (row & 1) * 30) % 60 < 1) return CR[1];
  let i = light ? 4.2 : 2.6;
  if (v > h - 2) i += 1.2;
  if (v < 6) return hash(x, y, 53) < 0.3 ? '#4a6a3a' : '#5a5a4a';
  if (v < 10 && bayer(x, y) < (10 - v) / 4) i -= 1.5;
  return at(CR, i);
};

function lamp(p: PropPainter, a: number, b: number, z: number) {
  const [x, y] = p.P(a, b, z);
  layer(
    p.c,
    (l) => {
      px(l, x - 1, y - 52, BRONZE[2], 3, 52);
      px(l, x - 1, y - 52, BRONZE[4], 1, 52);
      px(l, x - 3, y - 64, '#fff2cc', 6, 12);
      px(l, x - 3, y - 64, '#ffffff', 2, 12);
      px(l, x - 4, y - 67, BRONZE[1], 8, 3);
      px(l, x - 3, y - 53, BRONZE[1], 6, 2);
    },
    { outline: 0.55, rect: [x - 8, y - 72, x + 8, y + 2] },
  );
}

const bordoCanale: PropArt = {
  draw(p, k) {
    const W = k.w;
    const fronte = k.variant === 'fronte';
    const zt = 1.2;
    const side = solid(CR, 4.2, 2.6, 5);
    if (fronte) box(p, 0, 0, W, 1, -3.4, zt + 3.4, { front: quayWall, side: quayWall, top: copingTop(true), edge: CR[1] });
    else box(p, 0, 0.02, W, 0.98, 0, zt, { front: side, side, top: copingTop(false), edge: CR[1] });
    const bl = 0.85;
    const lamps = lampsAt(W);
    // the balustrade: a steel shoe, glass, slim posts, a rail; lamp posts along it
    const F = front3(p, bl);
    pq(p, F, 0.04, W - 0.04, zt, zt + 0.9, STEEL[1]);
    railing(p, F, 0.04, W - 0.04, zt + 0.9, 8.6, 0.8);
    for (const a of lamps) lamp(p, a, bl, zt);
  },
  lights: (k) => lampsAt(k.w).map((a) => ({ a, b: 0.85, z: 15, r: 1.6, color: WARM, kind: 'lamp' as const })),
};

// ── the footbridge ──────────────────────────────────────────
const ponte: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const rise = clamp(W * 1.2, 4, 9);
    const zd = (a: number) => 1.6 + rise * (1 - ((a - W / 2) / (W / 2)) ** 2);
    const th = 2.6;
    const b0 = 0.1;
    const b1 = D - 0.1;
    // the shadow on the water under the deck
    liftedShadow(p, 0.3, b0, W - 0.3, b1, 6, 0.24);
    // two slim piers under the deck
    const pierM = solid(CR, 4.2, 2.5, 5);
    const piers = [W * 0.27, W * 0.73].sort((m, n) => depth(p, m, D / 2) - depth(p, n, D / 2));
    for (const a of piers) box(p, a - 0.12, b0 + 0.25, 0.24, b1 - b0 - 0.5, -2.5, zd(a) - th + 2.5, { front: pierM, side: pierM, top: pierM, edge: CR[0] });
    // the deck: top segments back to front, the front fascia, the visible end
    const N = Math.max(8, Math.round(W * 3));
    const segs = Array.from({ length: N }, (_, i) => i);
    if (p.rot) segs.reverse();
    const deckTop: Mat = () => (u, v, x, y) => {
      if (v % 26 < 1) return PAVE[1];
      return at(PAVE, 3.8 + (hash(Math.floor(u / 40), Math.floor(v / 26), 61) - 0.5) * 0.7 - (hash(x, y, 62) < 0.03 ? 0.6 : 0));
    };
    for (const i of segs) {
      const a0 = (W * i) / N;
      const a1 = (W * (i + 1)) / N;
      poly3(p, [[a0, b0, zd(a0)], [a1, b0, zd(a1)], [a1, b1, zd(a1)], [a0, b1, zd(a0)]], deckTop, 2);
    }
    // the back balustrade
    const rail = (b: number) => {
      const ga = p.c.globalAlpha;
      for (let i = 0; i < N; i++) {
        const a0 = (W * i) / N;
        const a1 = (W * (i + 1)) / N;
        p.c.globalAlpha = 0.36;
        fillPoly(p.c, [p.P(a0, b, zd(a0) + 0.3), p.P(a1, b, zd(a1) + 0.3), p.P(a1, b, zd(a1) + 9), p.P(a0, b, zd(a0) + 9)], '#d8eef6');
        p.c.globalAlpha = ga;
        const [x0, y0] = p.P(a0, b, zd(a0) + 9.4);
        const [x1, y1] = p.P(a1, b, zd(a1) + 9.4);
        ln(p.c, x0, y0 - 1, x1, y1 - 1, STEEL[6]);
        ln(p.c, x0, y0, x1, y1, STEEL[3]);
      }
      for (let i = 0; i <= Math.round(W / 0.8); i++) {
        const a = (W * i) / Math.round(W / 0.8);
        const [x, y] = p.P(a, b, zd(a));
        const [, y1] = p.P(a, b, zd(a) + 9.4);
        px(p.c, x - 1, y1, STEEL[1], 2, y - y1);
        px(p.c, x - 1, y1, STEEL[4], 1, y - y1);
      }
    };
    rail(b0 + 0.06);
    // the fascia: a cream band following the arch
    const F = front3(p, b1);
    const fascia: [number, number][] = [];
    for (let i = 0; i <= N; i++) fascia.push([(W * i) / N, zd((W * i) / N)]);
    for (let i = N; i >= 0; i--) fascia.push([(W * i) / N, zd((W * i) / N) - th]);
    poly3(p, fascia.map(([u, z]) => F.at(u, z)), (_u: number, v: number, x: number, y: number) => at(CR, (F.light ? 4.6 : 2.8) + (hash(x, y, 63) < 0.03 ? -0.6 : 0) + (v < 3 ? -0.8 : 0)), F.light);
    for (let i = 0; i < N; i++) {
      const a0 = (W * i) / N;
      const a1 = (W * (i + 1)) / N;
      const [x0, y0] = p.P(a0, b1, zd(a0));
      const [x1, y1] = p.P(a1, b1, zd(a1));
      ln(p.c, x0, y0, x1, y1, CR[7]);
      const [u0, v0] = p.P(a0, b1, zd(a0) - th);
      const [u1, v1] = p.P(a1, b1, zd(a1) - th);
      ln(p.c, u0, v0, u1, v1, mix(CR[0], OUTL, 0.5));
    }
    rail(b1 - 0.06);
    // lamps on the four corner posts
    for (const a of [0.12, W - 0.12]) for (const b of [b0 + 0.06, b1 - 0.06]) {
      const [x, y] = p.P(a, b, zd(a) + 9.4);
      px(p.c, x - 2, y - 8, BRONZE[2], 4, 8);
      px(p.c, x - 2, y - 7, '#fff2cc', 4, 5);
      px(p.c, x - 3, y - 9, BRONZE[1], 6, 2);
    }
  },
  lights: (k) => {
    const out: PropLight[] = [];
    for (const a of [0.12, k.w - 0.12]) for (const b of [0.16, k.d - 0.16]) out.push({ a, b, z: 12, r: 1.3, color: WARM, kind: 'lamp' });
    return out;
  },
};

export const CITY_TOWERS: Record<string, PropArt> = { torre, monorotaia, trenoM, bordoCanale, ponte };

export const CITY_TOWERS_META: Record<string, PropMeta> = {
  torre: { w: 12, d: 12, h: 700 },
  monorotaia: { w: 16, d: 1, h: 72 },
  trenoM: { w: 8, d: 1, h: 100, solid: false },
  bordoCanale: { w: 8, d: 1, h: 14 },
  ponte: { w: 6, d: 2, h: 20 },
};


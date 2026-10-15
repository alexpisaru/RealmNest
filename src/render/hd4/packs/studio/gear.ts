// Creative Studio — the working kit at 128×64 (1 z ≈ 10 cm; a person ≈ 17.5 z):
// strip softboxes on light stands, a cinema camera on a fluid-head tripod,
// beech H-frame easels with paintings in progress, the podcast desk with
// broadcast mics, drawing desks with pen displays and edit bays with a
// grading panel.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, px, rng } from '../../kit4';
import { front, pq, side } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { ALU, BEECH, CHAR, CORAL, coat, fabric, felt, GEAR, lighten, MUSTARD, pine, PLY, plyEdge, plyFace, solidFaces, WALNUT, pmod } from './kit';

type V3 = [number, number, number];

/** A thin bar between two prop-local points: a body stroke and a lit hairline. */
export function bar(p: PropPainter, a: V3, b: V3, col: string, hi: string, w = 2) {
  const [x0, y0] = p.P(a[0], a[1], a[2]);
  const [x1, y1] = p.P(b[0], b[1], b[2]);
  ln(p.c, x0, y0, x1, y1, col, w);
  if (w >= 2) ln(p.c, x0, y0, x1, y1, hi, 1);
}

/** A vertical tube (pole) from z0 to z1 at (a, b): shaded body, lit left edge. */
export function pole(p: PropPainter, a: number, b: number, z0: number, z1: number, r: readonly string[], w = 3) {
  const [x, y0] = p.P(a, b, z0);
  const [, y1] = p.P(a, b, z1);
  const xl = Math.round(x - w / 2);
  px(p.c, xl, y1, r[2], w, y0 - y1);
  px(p.c, xl, y1, r[4], 1, y0 - y1);
  if (w > 2) px(p.c, xl + w - 1, y1, r[1], 1, y0 - y1);
}

// ── softbox on a light stand ────────────────────────────────
const softbox: PropArt = {
  draw(p, k) {
    // the two lights flank the paper sweep and aim at the subject
    const left = p.x < 7;
    const phi = left ? 0.45 : 2.0;
    const ca = 0.5;
    const cb = 0.5;
    const c = p.c;
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 14, 0.32);
    // three splayed legs, a hub collar, the centre column
    const hub: V3 = [ca, cb, 6];
    const feet: V3[] = [0, 1, 2].map((i) => {
      const t = phi + Math.PI + (i - 1) * 2.1;
      return [ca + Math.cos(t) * 0.36, cb + Math.sin(t) * 0.36, 0];
    });
    layer(c, (l) => {
      for (const f of feet) {
        const [x0, y0] = p.P(...hub);
        const [x1, y1] = p.P(...f);
        ln(l, x0, y0, x1, y1, ALU[2], 2);
        ln(l, x0, y0 - 1, x1, y1 - 1, ALU[4], 1);
        px(l, x1 - 2, y1 - 1, GEAR[1], 4, 2);
      }
      const [hx, hy] = p.P(...hub);
      px(l, hx - 3, hy - 4, GEAR[2], 6, 5);
      px(l, hx - 3, hy - 4, GEAR[4], 2, 5);
      // a sandbag slung over the leg on the camera side
      const f0 = feet[1];
      const [sx, sy] = p.P((hub[0] + f0[0] * 2) / 3, (hub[1] + f0[1] * 2) / 3, 2);
      fillPoly(l, [[sx - 7, sy - 2], [sx + 7, sy - 2], [sx + 8, sy + 4], [sx - 8, sy + 4]], '#b8432e');
      px(l, sx - 7, sy - 2, '#d86448', 14, 2);
      px(l, sx - 2, sy - 4, GEAR[2], 4, 3);
    });
    layer(c, (l) => {
      const [x, y0] = p.P(ca, cb, 5);
      const [, y1] = p.P(ca, cb, 23);
      px(l, x - 2, y1, ALU[2], 4, y0 - y1);
      px(l, x - 2, y1, ALU[5], 1, y0 - y1);
      for (const z of [12, 19]) {
        const [, yc] = p.P(ca, cb, z);
        px(l, x - 3, yc - 2, GEAR[2], 6, 3);
        px(l, x + 3, yc - 1, GEAR[3], 3, 1);
      }
    });
    // the head: a strip softbox (black nylon, white diffuser), tilted a little down
    const nx = Math.cos(phi);
    const ny = Math.sin(phi);
    const tx = -ny;
    const ty = nx;
    const C: V3 = [ca, cb, 27];
    const hw = 0.3;
    const hh = 8;
    const D = 0.36;
    const fr = (s: number, t: number): V3 => [C[0] + nx * 0.14 + tx * hw * s, C[1] + ny * 0.14 + ty * hw * s, C[2] - 0.8 + hh * t];
    const bk = (s: number, t: number): V3 => [C[0] - nx * D + tx * hw * 0.24 * s, C[1] - ny * D + ty * hw * 0.24 * s, C[2] + 0.8 + hh * 0.26 * t];
    const faces: V3[][] = [
      [fr(-1, -1), fr(1, -1), fr(1, 1), fr(-1, 1)],
      [bk(-1, -1), bk(1, -1), bk(1, 1), bk(-1, 1)],
      [fr(-1, 1), fr(1, 1), bk(1, 1), bk(-1, 1)],
      [fr(-1, -1), fr(1, -1), bk(1, -1), bk(-1, -1)],
      [fr(-1, -1), fr(-1, 1), bk(-1, 1), bk(-1, -1)],
      [fr(1, -1), fr(1, 1), bk(1, 1), bk(1, -1)],
    ];
    const diffuser: Mat = (_l, w, h) => (u, v, x, y) => {
      const U = u / w;
      const V = v / h;
      const e = Math.min(U, 1 - U, V * 0.6, (1 - V) * 0.6);
      if (e < 0.035) return GEAR[2];
      if (e < 0.07) return '#d8d2c8';
      const hot = Math.hypot((U - 0.48) * 1.6, V - 0.55);
      if (hot < 0.22) return '#fffef8';
      if (hot < 0.4) return (x + y) & 1 ? '#fffef8' : '#fbf5e8';
      return hash(x, y, 7) < 0.04 ? '#efe6d6' : '#f8f1e4';
    };
    layer(c, (l) => {
      const q = Object.create(p, { c: { value: l } }) as PropPainter;
      solidFaces(q, faces, (s, fi) => (fi === 0 ? diffuser : GEAR[Math.round(Math.min(6, 1 + s * 0.7))]));
      // the speed ring and the yoke down to the column
      const [rx, ry] = q.P(...bk(0, 0));
      ell(l, rx, ry, 5, 5, GEAR[3]);
      ell(l, rx - 1, ry - 1, 3, 3, ALU[3]);
      const [jx, jy] = q.P(ca, cb, 23);
      ln(l, jx, jy, rx, ry + 2, GEAR[2], 3);
      // the power lead dropping from the head
      const [ex, ey] = q.P(ca + 0.12, cb + 0.1, 0);
      curve(l, rx + 1, ry + 3, rx + 12, (ry + ey) / 2, ex, ey, GEAR[1]);
    }, { outline: 0.6 });
    void k;
  },
  anim(p, k) {
    // a faint warm spill of light in front of the diffuser
    const left = p.x < 7;
    const phi = left ? 0.45 : 2.0;
    const [x, y] = p.P(0.5 + Math.cos(phi) * 0.9, 0.5 + Math.sin(phi) * 0.9, 0);
    const u = p.k / 4;
    p.c.globalAlpha = 0.07 + Math.sin(k.t * 0.9 + k.seed) * 0.005;
    ell(p.c, x, y, 70 * u, 30 * u, '#fff4d8');
    p.c.globalAlpha = 1;
  },
};

// ── cinema camera on a fluid-head tripod ────────────────────
const tripod: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 14, 0.32);
    const head: V3 = [0.5, 0.5, 13];
    const feet: V3[] = [
      [0.5, 0.12, 0],
      [0.18, 0.72, 0],
      [0.82, 0.72, 0],
    ];
    // the leg under the lens first (it is behind), then the camera, then the two by the operator
    const leg = (l: CanvasRenderingContext2D, f: V3) => {
      const mid: V3 = [head[0] + (f[0] - head[0]) * 0.55, head[1] + (f[1] - head[1]) * 0.55, 6];
      const [x0, y0] = p.P(...head);
      const [x1, y1] = p.P(...mid);
      const [x2, y2] = p.P(...f);
      ln(l, x0, y0, x1, y1, GEAR[2], 3);
      ln(l, x0 - 1, y0, x1 - 1, y1, GEAR[4], 1);
      px(l, x1 - 2, y1 - 2, GEAR[3], 5, 4);
      px(l, x1 - 2, y1 - 2, '#c8a040', 2, 1);
      ln(l, x1, y1, x2, y2, ALU[3], 2);
      ln(l, x1 - 1, y1, x2 - 1, y2, ALU[5], 1);
      px(l, x2 - 2, y2 - 1, GEAR[1], 4, 2);
    };
    layer(c, (l) => leg(l, feet[0]), { outline: 0.6 });
    layer(c, (l) => {
      // mid-level spreader
      const s = feet.map((f) => p.P(head[0] + (f[0] - head[0]) * 0.4, head[1] + (f[1] - head[1]) * 0.4, 8));
      for (let i = 0; i < 3; i++) ln(l, s[i][0], s[i][1], p.P(0.5, 0.5, 8)[0], p.P(0.5, 0.5, 8)[1], GEAR[3], 1);
    }, { outline: false });
    // the fluid head and its plate
    lbox(p, 0.4, 0.4, 0.2, 0.2, 12.4, 1.8, mono(coat(GEAR), GEAR[0]));
    lbox(p, 0.42, 0.36, 0.16, 0.3, 14.2, 0.5, mono(coat(GEAR), GEAR[0]));
    // the lens points at the backdrop (−b): rings drawn far to near, so the body overlaps it
    layer(c, (l) => {
      for (let i = 10; i >= 0; i--) {
        const [x, y] = p.P(0.51, 0.42 - i * 0.022, 17.2);
        const r = i > 8 ? 7 : 6;
        ell(l, x, y, r, r, i === 10 ? GEAR[1] : i === 5 ? '#c8382a' : GEAR[i % 2 ? 2 : 3]);
        px(l, x - r + 1, y - 2, i === 5 ? '#e86a50' : GEAR[5], 2, 3);
      }
      const [gx, gy] = p.P(0.51, 0.2, 17.2);
      ell(l, gx, gy, 5, 5, '#24384a');
      px(l, gx - 2, gy - 3, '#6a9ab8', 2, 2);
    }, { outline: 0.6 });
    // the body: a compact black cinema block, a V-mount battery on its back
    lbox(p, 0.39, 0.4, 0.24, 0.26, 14.7, 5.2, { front: coat(GEAR), side: felt(GEAR), top: coat(GEAR), edge: GEAR[0] });
    lbox(p, 0.43, 0.66, 0.16, 0.06, 15.2, 3.6, { front: coat(ALU), side: coat(ALU), top: coat(ALU), edge: ALU[0] });
    const B = front(p, 0.72);
    pq(p, B, 0.45, 0.57, 17.6, 18.2, '#5fd38d');
    pq(p, B, 0.45, 0.5, 17.6, 18.2, '#2a6a3a');
    const S = side(p, 0.63);
    // buttons and the record key on the operator side
    pq(p, S, 0.46, 0.52, 18, 18.8, GEAR[4]);
    pq(p, S, 0.55, 0.6, 18, 18.8, '#c8382a');
    layer(c, (l) => {
      // the top handle, a shotgun mic in a shock mount, the field monitor on an arm
      const [h0x, h0y] = p.P(0.46, 0.62, 19.9);
      const [h1x, h1y] = p.P(0.46, 0.44, 19.9);
      ln(l, h0x, h0y, h0x, h0y - 7, GEAR[2], 2);
      ln(l, h1x, h1y, h1x, h1y - 7, GEAR[2], 2);
      ln(l, h0x, h0y - 7, h1x, h1y - 7, GEAR[3], 3);
      ln(l, h0x, h0y - 8, h1x, h1y - 8, GEAR[5], 1);
      const [m0x, m0y] = p.P(0.58, 0.56, 22);
      const [m1x, m1y] = p.P(0.58, 0.3, 22);
      ln(l, m0x, m0y, m1x, m1y, '#7a7e86', 4);
      ln(l, m0x, m0y - 1, m1x, m1y - 1, '#c4c8ce', 1);
      ell(l, m1x, m1y, 2.5, 2.5, '#5a5e66');
      ell(l, (m0x + m1x) / 2, (m0y + m1y) / 2, 4, 4, 'rgba(0,0,0,0)');
      px(l, (m0x + m1x) / 2 - 3, (m0y + m1y) / 2 + 2, GEAR[2], 6, 3);
      // the field monitor, facing the operator
      const [ax, ay] = p.P(0.34, 0.62, 20);
      ln(l, ax + 6, ay + 3, ax + 2, ay - 2, GEAR[3], 2);
      fillPoly(l, [[ax - 14, ay - 1], [ax + 4, ay - 10], [ax + 4, ay - 24], [ax - 14, ay - 15]], GEAR[1]);
      fillPoly(l, [[ax - 12, ay - 3], [ax + 2, ay - 10], [ax + 2, ay - 22], [ax - 12, ay - 15]], '#f0caa0');
      fillPoly(l, [[ax - 12, ay - 3], [ax + 2, ay - 10], [ax + 2, ay - 13], [ax - 12, ay - 6]], '#e0b488');
      // a cable from the body down a leg to the floor
      const [cx0, cy0] = p.P(0.62, 0.62, 15);
      const [cx1, cy1] = p.P(0.84, 0.76, 0);
      curve(l, cx0, cy0, cx0 + 12, cy0 + 22, cx1, cy1, '#2a2a30');
      // the pan bar reaching back to the operator
      const [b0x, b0y] = p.P(0.56, 0.6, 13.6);
      const [b1x, b1y] = p.P(0.72, 0.96, 11);
      ln(l, b0x, b0y, b1x, b1y, GEAR[3], 3);
      ln(l, b0x, b0y - 1, b1x, b1y - 1, GEAR[5], 1);
      px(l, b1x - 2, b1y - 2, '#3a3a44', 5, 4);
    }, { outline: 0.6 });
    layer(c, (l) => {
      leg(l, feet[1]);
      leg(l, feet[2]);
    }, { outline: 0.6 });
    void k;
  },
  anim(p, k) {
    // the tally light and a live frame on the field monitor: the subject on the paper
    const on = Math.sin(k.t * 3) > -0.2;
    const S = side(p, 0.63);
    const [x, y] = S.F(0.42, 19.4);
    const u = p.k / 4;
    px(p.c, x - u, y - u, on ? '#ff4a3a' : '#5a1e1a', Math.max(1, 2 * u), Math.max(1, 2 * u));
    const [ax, ay] = p.P(0.34, 0.62, 20);
    const t = Math.sin(k.t * 0.8) * 2;
    px(p.c, ax + (-5 + t) * u, ay - 17 * u, '#2a8a86', Math.max(1, 2 * u), Math.max(1, 5 * u));
    px(p.c, ax + (-5 + t) * u, ay - 19 * u, '#e8b090', Math.max(1, 2 * u), Math.max(1, 2 * u));
  },
};

// ── beech H-frame easel with a painting in progress ─────────
/** The painting on a canvas (u across, v up), by subject. */
function painting(kind: number): Mat {
  return (_l, w, h) => (u, v, x, y) => {
    const U = u / w;
    const V = v / h;
    // painterly dabs: colour sampled per little brush cell
    const cx = Math.floor(u / 3);
    const cy = Math.floor(v / 2);
    const j = (hash(cx, cy, 11 + kind) - 0.5) * 0.06;
    const e = Math.min(U, 1 - U, V, 1 - V);
    if (e < 0.012) return '#e8e0d0';
    if (kind === 0) {
      // the bay at noon: sky, a low sun, the sea with crests, a sail, the beach
      const hz = 0.52 + j;
      if (V > hz) {
        const s = Math.hypot((U - 0.72) * 1.4, V - 0.8);
        if (s < 0.1) return s < 0.07 ? '#fff4c8' : '#f8d870';
        if ((V > 0.86 && hash(cx, cy, 3) < 0.4 && U < 0.5) || (Math.abs(V - 0.72 - Math.sin(U * 9) * 0.02) < 0.03 && U > 0.15 && U < 0.45)) return '#fbf8f0';
        return V > 0.75 ? '#8ec4e6' : '#b4dcf0';
      }
      if (V > hz - 0.24) {
        if (Math.abs(U - 0.38) < 0.06 && V > hz - 0.1 && V < hz + 0.18 && (U - 0.32) / 0.12 > (V - hz + 0.1) / 0.28) return '#fbf6ec';
        if (Math.abs(U - 0.38) < 0.008 && V > hz - 0.1) return '#3a2a26';
        if (hash(cx, cy, 5) < 0.12) return '#e8f6fa';
        return V > hz - 0.1 ? '#2e86a8' : '#3aa0b4';
      }
      if (V > hz - 0.3) return hash(cx, cy, 6) < 0.5 ? '#f6f2e6' : '#bfe6e0';
      return hash(cx, cy, 7) < 0.3 ? '#e2c48e' : '#ecd4a2';
    }
    if (kind === 1) {
      // cut-out shapes: a coral sun, teal leaves, a mustard wave on cream
      const s = Math.hypot((U - 0.34) * 1.3, V - 0.66);
      if (s < 0.17) return '#e0603e';
      const lf = Math.abs(U - 0.7 - Math.sin(V * 6) * 0.06) < 0.07 - Math.abs(V - 0.5) * 0.1;
      if (lf && V > 0.2 && V < 0.85) return '#2a7a76';
      if (V < 0.28 + Math.sin(U * 12) * 0.05) return V < 0.12 ? '#2e3e6a' : '#e8b03e';
      if (hash(cx, cy, 9) < 0.02) return '#e0603e';
      return '#f4ead6';
    }
    // a portrait sketch: charcoal lines and a wash of colour, half done
    const head = Math.hypot((U - 0.5) * 1.5, (V - 0.62) * 1.05);
    if (Math.abs(head - 0.2) < 0.012) return '#3a3036';
    if (head < 0.2 && U < 0.5 && V > 0.55) return '#e8b090';
    if (Math.abs(V - 0.3 - (U - 0.5) ** 2 * 1.6) < 0.012 && Math.abs(U - 0.5) < 0.36) return '#3a3036';
    if (V < 0.3 && U > 0.3 && U < 0.7 && hash(cx, cy, 4) < 0.6) return '#5a8ab8';
    void x;
    void y;
    return hash(cx, cy, 8) < 0.05 ? '#e8e0d0' : '#f6f0e4';
  };
}

const easel: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.12, 0.25, 0.88, 0.9, 16, 0.32);
    const wood = pine(BEECH, 'v');
    const beechTop = pine(BEECH);
    // paint spills on the floor round the foot
    layer(c, (l) => {
      const Rn = rng(k.seed * 7 + 1);
      for (let i = 0; i < 7; i++) {
        const [x, y] = p.P(0.2 + Rn() * 0.6, 0.55 + Rn() * 0.42, 0);
        const col = ['#e0603e', '#2a8a86', '#e8b03e', '#5a7ac8', '#f2f0e8'][Math.floor(Rn() * 5)];
        ell(l, x, y, 2 + Rn() * 4, 1 + Rn() * 2, col);
      }
    }, { outline: false });
    // base frame on castors
    lbox(p, 0.14, 0.3, 0.72, 0.08, 0.6, 0.9, mono(wood, BEECH[0]));
    lbox(p, 0.14, 0.78, 0.72, 0.08, 0.6, 0.9, mono(wood, BEECH[0]));
    for (const a of [0.14, 0.78]) lbox(p, a, 0.3, 0.08, 0.56, 0.6, 0.9, mono(wood, BEECH[0]));
    for (const [a, b] of [[0.18, 0.34], [0.82, 0.34], [0.18, 0.82], [0.82, 0.82]] as const) {
      const [x, y] = p.P(a, b, 0.3);
      ell(c, x, y, 2.5, 2, GEAR[1]);
    }
    // the mast behind (it rises above the canvas), uprights, top bar
    lbox(p, 0.47, 0.36, 0.06, 0.06, 1.5, 36, mono(wood, BEECH[0]));
    for (const a of [0.2, 0.74]) lbox(p, a, 0.4, 0.06, 0.06, 1.5, 28.5, mono(wood, BEECH[0]));
    lbox(p, 0.2, 0.4, 0.6, 0.06, 28.5, 1.2, mono(beechTop, BEECH[0]));
    lbox(p, 0.2, 0.4, 0.6, 0.06, 2.4, 1, mono(beechTop, BEECH[0]));
    // the top clamp on the mast
    lbox(p, 0.43, 0.38, 0.14, 0.12, 24.4, 1.2, mono(beechTop, BEECH[0]));
    // the canvas, leaning back a little against the uprights
    const kind = k.variant === 'abstract' ? 1 : k.variant === 'sea' ? 0 : pmod(Math.floor(p.x / 2), 3);
    const a0 = 0.17;
    const a1 = 0.83;
    const z0 = 10.6;
    const z1 = 24.4;
    const bb = 0.56;
    const bt = 0.47;
    // stretcher edge on the right, then the face
    const edge: FaceTex = (_u: number, v: number, x: number, y: number) => (v < 1 || hash(x, y, 4) < 0.05 ? '#d0c4b0' : '#ece4d4');
    void edge;
    const S = side(p, a1);
    pq(p, S, bb - 0.04, bb, z0, z1, '#c8bca6');
    const corners: V3[] = [[a0, bb, z0], [a1, bb, z0], [a1, bt, z1], [a0, bt, z1]];
    layer(c, (l) => {
      const q = Object.create(p, { c: { value: l } }) as PropPainter;
      solidFaces(q, [corners], () => painting(kind));
    }, { outline: 0.55 });
    // the tray with brushes and a rag, the palette hung on the upright
    lbox(p, 0.16, 0.44, 0.68, 0.2, 9.6, 1, mono(beechTop, BEECH[0]));
    layer(c, (l) => {
      for (let i = 0; i < 5; i++) {
        const [x, y] = p.P(0.26 + i * 0.1, 0.56, 10.6);
        ln(l, x, y, x + 8, y - 3, ['#c8382a', '#2a5a8a', '#e8b03e', '#5a4a3a', '#2a8a86'][i], 1);
        px(l, x + 7, y - 4, '#3a3036', 2, 2);
      }
      const [rx, ry] = p.P(0.72, 0.6, 10.6);
      fillPoly(l, [[rx - 6, ry], [rx + 6, ry - 3], [rx + 8, ry + 9], [rx - 3, ry + 12]], '#e8dcc8');
      for (const [dx, dy, col] of [[-2, 3, '#e0603e'], [3, 6, '#2a8a86'], [0, 8, '#e8b03e']] as const) px(l, rx + dx, ry + dy, col, 3, 2);
      const [px0, py0] = p.P(0.79, 0.47, 18);
      ell(l, px0 + 4, py0 + 2, 9, 7, '#c89a62');
      ell(l, px0 + 3, py0 + 1, 8, 6, '#ddb27a');
      ell(l, px0 + 6, py0 + 3, 2, 2, '#a87a46');
      for (const [dx, dy, col] of [[-2, -2, '#e0603e'], [2, -4, '#f2f0e8'], [7, -2, '#2a8a86'], [-3, 3, '#e8b03e'], [3, 5, '#5a7ac8']] as const) ell(l, px0 + dx, py0 + dy, 1.8, 1.4, col);
    }, { outline: 0.55 });
  },
};

// ── the podcast desk ────────────────────────────────────────
/** Pyramid acoustic foam: little lit / shaded facets. */
const foam =
  (r: readonly string[]): Mat =>
  (light) =>
  (u, v) => {
    const s = 6;
    const fu = (u % s) / s - 0.5;
    const fv = (v % s) / s - 0.5;
    const b = light === 0 ? 1 : 2;
    if (Math.abs(fu) > Math.abs(fv)) return r[fu < 0 ? b + 1 : b - 1] ?? r[0];
    return r[fv > 0 ? b + 2 : b - 1] ?? r[0];
  };

/** A broadcast mic on a spring boom, hanging toward a host at (a, bHost). */
function boomMic(p: PropPainter, l: CanvasRenderingContext2D, a: number, foamCol: string) {
  const base: V3 = [a, 0.14, 7.4];
  const elbow: V3 = [a + 0.06, 0.24, 17.5];
  const tip: V3 = [a, 0.56, 14.8];
  const [x0, y0] = p.P(...base);
  const [x1, y1] = p.P(...elbow);
  const [x2, y2] = p.P(...tip);
  px(l, x0 - 3, y0 - 3, GEAR[2], 7, 4);
  ln(l, x0, y0, x1, y1, GEAR[2], 2);
  ln(l, x0 + 3, y0 - 1, x1 + 3, y1 - 1, GEAR[3], 1);
  ln(l, x1, y1, x2, y2, GEAR[2], 2);
  ln(l, x1, y1 + 3, x2 + 1, y2 + 3, GEAR[3], 1);
  // springs
  for (let i = 1; i < 6; i++) px(l, x0 + ((x1 - x0) * i) / 6 + 2, y0 + ((y1 - y0) * i) / 6, '#8a8e96', 2, 1);
  ell(l, x1, y1, 2.5, 2.5, GEAR[4]);
  // the mic body: a chunky dark cylinder, the foam windscreen toward the host
  const [m0x, m0y] = p.P(a, 0.5, 13.6);
  const [m1x, m1y] = p.P(a, 0.66, 13.2);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const x = m0x + (m1x - m0x) * t;
    const y = m0y + (m1y - m0y) * t;
    ell(l, x, y, 6, 7, i > 3 ? foamCol : GEAR[2]);
    if (i <= 3) px(l, x - 5, y - 4, GEAR[4], 2, 6);
  }
  ell(l, m1x - 1, m1y - 1, 4, 5, lighten(foamCol, 0.2));
  ln(l, x2, y2, m0x, m0y - 6, GEAR[2], 2);
}

const podcast: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.05, 0.05, W - 0.05, 0.95, 12, 0.35);
    // an acoustic divider behind the desk: oak frame, grey-teal pyramid foam, the neon sign
    const oak = pine(BEECH, 'v');
    lbox(p, 0.06, 0.02, W - 0.12, 0.08, 0, 17, { front: foam(['#1e3838', '#2a4a4a', '#365c5a', '#466e6a', '#5a8480', '#729a94']), side: oak, top: pine(BEECH), edge: '#1e3030' });
    for (const a of [0.06, W - 0.12]) lbox(p, a, 0.02, 0.06, 0.1, 0, 17.6, mono(oak, BEECH[0]));
    lbox(p, 0.06, 0.02, W - 0.12, 0.1, 17, 0.6, mono(pine(BEECH), BEECH[0]));
    // panel legs and a slatted oak modesty panel in front
    for (const a of [0.1, W - 0.2]) lbox(p, a, 0.16, 0.1, 0.72, 0, 6.8, { front: plyEdge(), side: plyFace(), top: plyFace(), edge: PLY[0] });
    const slats: Mat = (light) => (u, v, x, y) => {
      const f = u % 7;
      let i = (light === 1 ? 3 : 1.6) + (f < 1.4 ? -1.4 : f > 5.6 ? 0.6 : 0);
      if (hash(x, y, 3) < 0.03) i -= 0.6;
      void v;
      return BEECH[Math.max(0, Math.min(5, Math.round(i)))];
    };
    lbox(p, 0.2, 0.8, W - 0.4, 0.04, 0.8, 6, { front: slats, side: slats, top: slats, edge: BEECH[0] });
    // the top: plywood with a felt mat
    lbox(p, 0.06, 0.12, W - 0.12, 0.8, 6.8, 0.6, { front: plyEdge(), side: plyEdge(), top: plyFace(), edge: PLY[1] });
    lbox(p, 0.2, 0.2, W - 0.4, 0.62, 7.4, 0.1, mono(felt(CHAR), CHAR[0]));
    // the show's badge on the front panel: a microphone in a wave
    const F = front(p, 0.84);
    const [bx, by] = F.F(W / 2, 3.8);
    layer(c, (l) => {
      ell(l, bx, by, 13, 13, '#1e2a3a');
      ell(l, bx, by, 11, 11, '#e8b03e');
      ell(l, bx, by - 3, 4, 5, '#1e2a3a');
      px(l, bx - 1, by + 1, '#1e2a3a', 3, 5);
      px(l, bx - 5, by + 6, '#1e2a3a', 11, 2);
      for (let i = -9; i <= 9; i += 3) px(l, bx + i, by + 9 + Math.round(Math.sin(i) * 1), '#2a8a86', 2, 1);
    });
    // the console in the middle: faders, pads, a little screen
    const cz = 7.5;
    lbox(p, W / 2 - 0.3, 0.42, 0.6, 0.3, cz, 0.9, { front: coat(GEAR), side: coat(GEAR), top: felt(GEAR), edge: GEAR[0] });
    for (let i = 0; i < 4; i++) {
      const [fx, fy] = p.P(W / 2 - 0.22 + i * 0.09, 0.6, cz + 0.9);
      ln(c, fx, fy - 5, fx + 5, fy - 2, GEAR[0]);
      px(c, fx + 1 + (i % 2) * 2, fy - 4 + (i % 2), '#e8e4dc', 3, 2);
    }
    // headphones and mugs, a notebook, cables
    layer(c, (l) => {
      for (const [a, col] of [[0.42, '#e05a3e'], [W - 0.42, '#2a8a86']] as const) {
        const [hx, hy] = p.P(a, 0.74, 7.5);
        curve(l, hx - 8, hy, hx - 2, hy - 12, hx + 7, hy - 2, GEAR[2], 2);
        ell(l, hx - 8, hy, 4, 3, GEAR[1]);
        ell(l, hx + 7, hy - 2, 4, 3, GEAR[1]);
        ell(l, hx - 8, hy - 1, 2, 1.5, col);
      }
      const [mx, my] = p.P(0.28, 0.4, 7.5);
      px(l, mx - 4, my - 9, '#f4f0e6', 8, 9);
      px(l, mx - 4, my - 9, '#ffffff', 2, 9);
      px(l, mx + 4, my - 7, '#e4dccc', 3, 5);
      px(l, mx - 3, my - 10, '#4a2e1e', 6, 1);
      const [m2x, m2y] = p.P(W - 0.3, 0.38, 7.5);
      px(l, m2x - 4, m2y - 8, '#2a8a86', 8, 8);
      px(l, m2x - 4, m2y - 8, '#52aaa6', 2, 8);
      px(l, m2x + 4, m2y - 6, '#226e6c', 3, 4);
      const [nx, ny] = p.P(W / 2 + 0.42, 0.66, 7.5);
      fillPoly(l, [[nx - 10, ny], [nx, ny - 5], [nx + 10, ny], [nx, ny + 5]], '#f6f0e4');
      ln(l, nx - 6, ny, nx + 2, ny - 4, '#8a8070');
      ln(l, nx - 4, ny + 2, nx + 4, ny - 2, '#8a8070');
      ln(l, nx - 9, ny + 4, nx + 8, ny - 4, '#e8b03e', 1);
    });
    // the boom mics
    layer(c, (l) => {
      boomMic(p, l, 0.5, '#d8503a');
      boomMic(p, l, W - 0.5, '#24282e');
    }, { outline: 0.6 });
    // the neon on the foam: ON AIR in a rounded red tube
    const NB = front(p, 0.1);
    const [nx0, ny0] = NB.F(W / 2 - 0.36, 13.4);
    const [nx1, ny1] = NB.F(W / 2 + 0.36, 13.4);
    layer(c, (l) => {
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = nx0 + (nx1 - nx0) * t;
        const y = ny0 + (ny1 - ny0) * t;
        px(l, x, y - 12, '#5a1a1a', 2, 2);
        px(l, x, y + 2, '#5a1a1a', 2, 2);
      }
      // letters: O N  A I R as little strokes
      for (let i = 0; i < 5; i++) {
        const t = 0.12 + i * 0.19;
        const x = nx0 + (nx1 - nx0) * t;
        const y = ny0 + (ny1 - ny0) * t;
        px(l, x - 2, y - 8, '#7a2020', 2, 7);
        px(l, x + 2, y - 8, '#7a2020', 2, 7);
        px(l, x - 2, y - 8, '#7a2020', 5, 2);
      }
    }, { outline: false });
  },
  anim(p, k) {
    const W = k.w;
    const u = p.k / 4;
    // the neon breathes; pads on the console glow; a level meter dances
    const NB = front(p, 0.1);
    const [nx0, ny0] = NB.F(W / 2 - 0.36, 13.4);
    const [nx1, ny1] = NB.F(W / 2 + 0.36, 13.4);
    const glow = 0.85 + Math.sin(k.t * 2.3) * 0.1;
    p.c.globalAlpha = 0.14 * glow;
    ell(p.c, (nx0 + nx1) / 2, (ny0 + ny1) / 2 - 5 * u, 34 * u, 16 * u, '#ff5a4a');
    p.c.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const t = 0.12 + i * 0.19;
      const x = nx0 + (nx1 - nx0) * t;
      const y = ny0 + (ny1 - ny0) * t;
      px(p.c, x - 2 * u, y - 8 * u, '#ff6a5a', Math.max(1, u), Math.max(1, 7 * u));
      px(p.c, x + 2 * u, y - 8 * u, '#ff6a5a', Math.max(1, u), Math.max(1, 7 * u));
      px(p.c, x - 2 * u, y - 8 * u, '#ffd0c8', Math.max(1, 5 * u), Math.max(1, u));
    }
    for (let i = 0; i < 4; i++) {
      const [x, y] = p.P(W / 2 + 0.06 + (i % 2) * 0.09, 0.47 + Math.floor(i / 2) * 0.1, 8.4);
      const on = Math.sin(k.t * (2 + i) + i * 1.7) > 0;
      px(p.c, x, y - 2 * u, on ? ['#ff7ab0', '#5ae0d0', '#ffd24a', '#a88aff'][i] : '#3a3a44', Math.max(1, 3 * u), Math.max(1, 2 * u));
    }
    const lv = 0.5 + 0.5 * Math.sin(k.t * 7.3) * Math.sin(k.t * 2.1);
    const [mx, my] = p.P(W / 2 - 0.26, 0.46, 8.4);
    px(p.c, mx, my - 2 * u, '#141418', Math.max(1, 8 * u), Math.max(1, 2 * u));
    px(p.c, mx, my - 2 * u, lv > 0.8 ? '#ff5a3a' : '#5fd38d', Math.max(1, Math.round(8 * lv * u)), Math.max(1, 2 * u));
  },
};

// ── desks: the drawing desk (pen display) and the edit bay ──
/** A moulded shell chair on beech dowel legs, turned toward its desk. */
function shellChair(p: PropPainter, a: number, b: number, col: string, seed: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 7, y + 2, 13, 4, 0.35);
  const sh = fabric(col);
  layer(p.c, (l) => {
    for (const [dx, dy] of [[-8, -2], [7, -4], [-5, 3], [9, 2]] as const) {
      ln(l, x + dx * 0.5, y - 16, x + dx, y + dy, BEECH[3], 2);
      ln(l, x + dx * 0.5 - 1, y - 16, x + dx - 1, y + dy, BEECH[5], 1);
    }
    ln(l, x - 6, y - 6, x + 7, y - 7, '#2a2a30', 1);
    // the shell: seat pan and a curved back
    ell(l, x, y - 18, 12, 6, sh[1]);
    ell(l, x - 1, y - 19, 11, 5, sh[3]);
    ell(l, x - 3, y - 20, 6, 2.5, sh[4]);
    fillPoly(l, [[x - 12, y - 20], [x + 10, y - 23], [x + 11, y - 36], [x + 2, y - 40], [x - 10, y - 37], [x - 13, y - 28]], sh[2]);
    fillPoly(l, [[x - 10, y - 22], [x - 2, y - 23], [x, y - 38], [x - 9, y - 36], [x - 11, y - 28]], sh[3]);
    px(l, x - 8, y - 35, sh[5], 5, 1);
    void seed;
  });
}

/** A swivel chair in tan leather on a four-star base. */
function swivelChair(p: PropPainter, a: number, b: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 7, y + 2, 13, 4, 0.35);
  const tan = ['#4a2a18', '#6a3c20', '#8c5430', '#ac6e40', '#c88a56', '#dca474'];
  layer(p.c, (l) => {
    for (const [dx, dy] of [[-11, 0], [10, -2], [-2, 5], [3, -6]] as const) {
      ln(l, x, y - 3, x + dx, y + dy, ALU[3], 2);
      px(l, x + dx - 1, y + dy - 1, GEAR[1], 3, 3);
    }
    px(l, x - 1, y - 16, ALU[3], 3, 13);
    px(l, x - 1, y - 16, ALU[5], 1, 13);
    ell(l, x, y - 18, 13, 6, tan[1]);
    ell(l, x - 1, y - 19, 12, 5, tan[3]);
    ell(l, x - 4, y - 20, 6, 2, tan[4]);
    // a low curved back
    fillPoly(l, [[x - 12, y - 22], [x + 11, y - 25], [x + 11, y - 32], [x - 12, y - 29]], tan[2]);
    fillPoly(l, [[x - 12, y - 24], [x, y - 26], [x, y - 31], [x - 12, y - 29]], tan[3]);
    px(l, x - 11, y - 29, tan[5], 8, 1);
    for (const s of [-1, 1]) px(l, x + s * 11 - 1, y - 26, ALU[3], 2, 8);
  });
}

/** Live drawing on the pen display: a figure being inked, the pen moving. */
function penScreen(p: PropPainter, t: number, seed: number) {
  // the screen plane: from (0.56, 0.6, 7.9) up to (0.56, 0.36, 11.6), a1 = 1.36
  const P = (U: number, V: number) => p.P(0.6 + U * 0.72, 0.6 - V * 0.22, 7.9 + V * 3.5);
  const u = p.k / 4;
  const ph = (t * 0.18 + seed * 0.37) % 1;
  // the stroke being drawn: a curve that grows, then the pen
  let prev: [number, number] | null = null;
  const n = Math.floor(ph * 18);
  for (let i = 0; i <= n; i++) {
    const s = i / 18;
    const q = P(0.25 + s * 0.5, 0.35 + Math.sin(s * 5 + seed) * 0.18);
    if (prev) {
      p.c.fillStyle = '#2a2430';
      const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - prev[0], q[1] - prev[1])));
      for (let j = 0; j < steps; j++) p.c.fillRect(Math.round(prev[0] + ((q[0] - prev[0]) * j) / steps), Math.round(prev[1] + ((q[1] - prev[1]) * j) / steps), Math.max(1, u), Math.max(1, u));
    }
    prev = q;
  }
  if (prev) {
    ln(p.c, prev[0], prev[1], prev[0] + 6 * u, prev[1] - 10 * u, '#3a3a44', Math.max(1, Math.round(2 * u)));
    px(p.c, prev[0] + 5 * u, prev[1] - 11 * u, '#e05a3e', Math.max(1, 2 * u), Math.max(1, 2 * u));
  }
}

/** Live edit timeline and grading monitor. */
function editScreens(p: PropPainter, t: number, seed: number) {
  const F = front(p, 0.22);
  const u = p.k / 4;
  // ultrawide: viewer on top, tracks below, a playhead sweeping
  const a0 = 0.38;
  const a1 = 1.3;
  pq(p, F, a0, a1, 10.2, 14.4, '#16181e');
  pq(p, F, a0 + 0.28, a1 - 0.28, 12.4, 14.2, '#2a5a7a');
  pq(p, F, a0 + 0.28, a1 - 0.28, 12.4, 13, '#d8b070');
  const tracks = ['#7a5ad8', '#e0603e', '#3ab0a0', '#e8b03e'];
  for (let r = 0; r < 4; r++) {
    let a = a0 + 0.02;
    let i = 0;
    while (a < a1 - 0.04) {
      const len = 0.06 + hash(i, r, seed) * 0.18;
      pq(p, F, a, Math.min(a1 - 0.02, a + len - 0.01), 10.4 + r * 0.45, 10.75 + r * 0.45, tracks[r]);
      a += len;
      i++;
    }
  }
  const ph = a0 + 0.02 + ((t * 0.05 + seed * 0.1) % 1) * (a1 - a0 - 0.04);
  pq(p, F, ph, ph + 0.012, 10.3, 12.2, '#ffffff');
  // the grading monitor: a sunset frame, a vectorscope blip
  pq(p, F, 1.38, 1.66, 10.4, 13.4, '#1a1c22');
  pq(p, F, 1.4, 1.64, 11.6, 13.2, '#f2a060');
  pq(p, F, 1.4, 1.64, 10.6, 11.6, '#2a4a6a');
  const [vx, vy] = F.F(1.56, 12.6 + Math.sin(t * 0.7) * 0.3);
  px(p.c, vx, vy, '#fff6d8', Math.max(1, 2 * u), Math.max(1, u));
}

const desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? 'tablet';
    const c = p.c;
    footShadow(p, 0.1, 0.12, W - 0.1, 0.92, 9, 0.35);
    if (v === 'edit') {
      // ── the edit bay: charcoal panel legs, a walnut top and riser ──
      const wal = pine(WALNUT);
      for (const a of [0.08, W - 0.18]) lbox(p, a, 0.14, 0.1, 0.74, 0, 6.8, { front: coat(CHAR), side: coat(CHAR), top: coat(CHAR), edge: CHAR[0] });
      lbox(p, 0.18, 0.18, W - 0.36, 0.06, 2.2, 3.4, mono(coat(CHAR), CHAR[0]));
      lbox(p, 0.04, 0.1, W - 0.08, 0.82, 6.6, 0.8, { front: wal, side: wal, top: wal, edge: WALNUT[0] });
      lbox(p, 0.12, 0.12, W - 0.24, 0.26, 7.4, 1.6, { front: wal, side: wal, top: wal, edge: WALNUT[0] });
      // the bias light strip glows on the riser
      const RF = front(p, 0.38);
      pq(p, RF, 0.16, W - 0.16, 7.5, 7.8, '#7a6ad8');
      // speakers on the riser ends
      for (const a of [0.12, W - 0.27]) {
        lbox(p, a, 0.14, 0.15, 0.2, 9, 3.2, { front: coat(GEAR), side: coat(GEAR), top: coat(GEAR), edge: GEAR[0] });
        const SF = front(p, 0.34);
        const [sx, sy] = SF.F(a + 0.075, 10.2);
        ell(c, sx, sy, 3.5, 3.5, GEAR[3]);
        ell(c, sx, sy, 2, 2, '#c8ccd2');
        const [tx, ty] = SF.F(a + 0.075, 11.9);
        ell(c, tx, ty, 1.5, 1.5, '#8a8e96');
      }
      // monitors: an ultrawide with the timeline, the grading reference on the right
      lbox(p, 0.78, 0.18, 0.12, 0.08, 9, 1.2, mono(coat(GEAR), GEAR[0]));
      lbox(p, 0.82, 0.2, 0.04, 0.03, 9.4, 1.6, mono(coat(ALU), ALU[0]));
      lbox(p, 0.36, 0.19, 0.96, 0.03, 10, 4.6, { front: coat(GEAR), side: coat(GEAR), top: coat(GEAR), edge: GEAR[0] });
      lbox(p, 1.48, 0.18, 0.06, 0.08, 9, 1.2, mono(coat(GEAR), GEAR[0]));
      lbox(p, 1.36, 0.19, 0.32, 0.03, 10.2, 3.4, { front: coat(GEAR), side: coat(GEAR), top: coat(GEAR), edge: GEAR[0] });
      // the grading panel: three trackballs and a row of rings
      lbox(p, 0.6, 0.44, 0.8, 0.26, 7.4, 0.7, { front: coat(GEAR), side: coat(GEAR), top: felt(GEAR), edge: GEAR[0] });
      for (let i = 0; i < 3; i++) {
        const [bx, by] = p.P(0.76 + i * 0.24, 0.57, 8.1);
        ell(c, bx, by, 7, 4, GEAR[3]);
        ell(c, bx, by - 2, 4.5, 4.5, '#2e2c34');
        ell(c, bx - 1.5, by - 3.5, 1.6, 1.6, '#8a8890');
        px(c, bx - 7, by, ['#e0603e', '#5fd38d', '#5a8ae0'][i], 2, 1);
      }
      // keyboard with coloured edit keys, a jog wheel, headphones, drives, a clapperboard, a coffee
      layer(c, (l) => {
        const [kx, ky] = p.P(0.42, 0.78, 7.4);
        fillPoly(l, [[kx - 16, ky + 2], [kx + 4, ky - 8], [kx + 16, ky - 2], [kx - 4, ky + 8]], GEAR[1]);
        fillPoly(l, [[kx - 14, ky + 2], [kx + 4, ky - 7], [kx + 14, ky - 2], [kx - 4, ky + 7]], GEAR[3]);
        for (let i = 0; i < 7; i++) px(l, kx - 11 + i * 3, ky + 1 - i * 1.5, ['#e0603e', '#5fd38d', '#5a8ae0', '#e8b03e', GEAR[5], GEAR[5], '#c070d0'][i], 2, 1);
        const [jx, jy] = p.P(1.6, 0.74, 7.4);
        ell(l, jx, jy - 1, 6, 3.5, ALU[2]);
        ell(l, jx, jy - 2, 5, 2.8, ALU[4]);
        ell(l, jx - 1, jy - 3, 2, 1, ALU[6]);
        const [dx, dy] = p.P(0.18, 0.6, 7.4);
        for (let i = 0; i < 3; i++) {
          px(l, dx - 6, dy - 4 - i * 4, GEAR[2], 12, 4);
          px(l, dx - 6, dy - 4 - i * 4, GEAR[4], 12, 1);
        }
        const [cx, cy] = p.P(W - 0.2, 0.74, 7.4);
        fillPoly(l, [[cx - 12, cy], [cx, cy - 6], [cx + 12, cy], [cx, cy + 6]], '#1e1e24');
        for (let i = 0; i < 4; i++) fillPoly(l, [[cx - 12 + i * 3, cy - 1 + i * 1.5], [cx - 10 + i * 3, cy - 2 + i * 1.5], [cx - 8 + i * 3, cy - 1 + i * 1.5]], i % 2 ? '#f2f0e8' : '#1e1e24');
        px(l, cx - 4, cy - 1, '#f2f0e8', 6, 1);
        const [mx, my] = p.P(W - 0.42, 0.5, 7.4);
        px(l, mx - 3, my - 8, '#e8b03e', 7, 8);
        px(l, mx - 3, my - 8, '#f6d070', 2, 8);
        px(l, mx + 4, my - 6, '#c8902a', 2, 4);
        // headphones on a hook at the desk edge
        const [hx, hy] = p.P(W - 0.06, 0.6, 6.6);
        curve(l, hx - 2, hy - 2, hx + 6, hy + 6, hx + 2, hy + 14, GEAR[2], 2);
        ell(l, hx + 2, hy + 14, 3, 4, GEAR[1]);
      });
      swivelChair(p, W * 0.52, 1.02);
      return;
    }
    // ── the drawing desk: mustard trestles, a plywood top ──
    for (const a of [0.26, W - 0.26]) {
      layer(c, (l) => {
        const top0 = p.P(a, 0.3, 6.8);
        const top1 = p.P(a, 0.7, 6.8);
        const f0 = p.P(a, 0.14, 0);
        const f1 = p.P(a, 0.86, 0);
        ln(l, top0[0], top0[1], f0[0], f0[1], MUSTARD[3], 3);
        ln(l, top1[0], top1[1], f1[0], f1[1], MUSTARD[3], 3);
        ln(l, top0[0] - 1, top0[1], f0[0] - 1, f0[1], MUSTARD[5], 1);
        ln(l, top1[0] - 1, top1[1], f1[0] - 1, f1[1], MUSTARD[5], 1);
        const m0 = p.P(a, 0.22, 3);
        const m1 = p.P(a, 0.78, 3);
        ln(l, m0[0], m0[1], m1[0], m1[1], MUSTARD[2], 2);
        ln(l, top0[0], top0[1], top1[0], top1[1], MUSTARD[2], 3);
      }, { outline: 0.6 });
    }
    lbox(p, 0.04, 0.1, W - 0.04 - 0.04, 0.82, 6.8, 0.6, { front: plyEdge(), side: plyEdge(), top: plyFace(), edge: PLY[1] });
    const tz = 7.4;
    // the pen display on its stand, tilted toward the artist
    lbox(p, 0.6, 0.36, 0.72, 0.1, tz, 2.4, mono(coat(GEAR), GEAR[0]));
    const scr: V3[] = [[0.56, 0.64, 7.7], [1.36, 0.64, 7.7], [1.36, 0.36, 11.8], [0.56, 0.36, 11.8]];
    const art: Mat = (_l, w, h) => (u, vv, x, y) => {
      const U = u / w;
      const V = vv / h;
      if (U < 0.035 || U > 0.965 || V < 0.05 || V > 0.95) return GEAR[1];
      if (U < 0.12) return V > 0.2 && V < 0.9 && Math.floor(V * 12) % 2 ? GEAR[4] : '#24232c';
      // the canvas: a mascot sketch with flat colour going in
      const dx = (U - 0.55) / 0.3;
      const dy = (V - 0.55) / 0.36;
      const r = dx * dx + dy * dy;
      if (Math.abs(r - 1) < 0.08) return '#2a2430';
      if (r < 1) return U < 0.55 ? '#7ac0b8' : '#f4efe4';
      if (Math.abs(V - 0.25) < 0.03 && Math.abs(U - 0.55) < 0.26) return '#2a2430';
      return hash(x, y, 9) < 0.02 ? '#e8e2d4' : '#f8f4ea';
    };
    layer(c, (l) => {
      const q = Object.create(p, { c: { value: l } }) as PropPainter;
      solidFaces(q, [scr], () => art);
    }, { outline: 0.55 });
    // an architect's lamp clamped to the back-left corner, bent over the display
    const [lx, ly] = p.P(0.16, 0.2, tz);
    layer(c, (l) => {
      px(l, lx - 3, ly - 3, CORAL[2], 6, 5);
      ln(l, lx, ly - 2, lx + 6, ly - 34, CORAL[3], 2);
      ln(l, lx + 6, ly - 34, lx + 28, ly - 30, CORAL[3], 2);
      ln(l, lx + 1, ly - 4, lx + 7, ly - 32, CORAL[5], 1);
      for (let i = 0; i < 4; i++) px(l, lx + 2 + i * 1.2, ly - 10 - i * 6, '#c8ccd2', 2, 1);
      ell(l, lx + 6, ly - 34, 2, 2, GEAR[3]);
      fillPoly(l, [[lx + 24, ly - 34], [lx + 36, ly - 30], [lx + 34, ly - 20], [lx + 22, ly - 24]], CORAL[2]);
      fillPoly(l, [[lx + 24, ly - 34], [lx + 30, ly - 32], [lx + 28, ly - 22], [lx + 22, ly - 24]], CORAL[4]);
      fillPoly(l, [[lx + 23, ly - 23], [lx + 34, ly - 20], [lx + 33, ly - 18], [lx + 22, ly - 21]], '#fff2c8');
    }, { outline: 0.6 });
    // sketches, a sketchbook, a pencil cup, a mug, washi tape, markers
    layer(c, (l) => {
      const Rn = rng(k.seed * 3 + 5);
      for (let i = 0; i < 3; i++) {
        const [sx, sy] = p.P(0.24 + i * 0.12 + Rn() * 0.05, 0.62 + Rn() * 0.2, tz);
        fillPoly(l, [[sx - 10, sy], [sx + 1, sy - 6], [sx + 12, sy], [sx + 1, sy + 6]], i === 1 ? '#fbf3e0' : '#f6f2ea');
        for (let j = 0; j < 3; j++) ln(l, sx - 5 + j * 2, sy + 1 - j, sx + 2 + j * 2, sy - 2 - j, ['#3a3036', '#7ac0b8', '#e0603e'][(i + j) % 3]);
      }
      const [bx, by] = p.P(1.62, 0.66, tz);
      fillPoly(l, [[bx - 13, by], [bx, by - 7], [bx + 13, by], [bx, by + 7]], '#2a3a5a');
      fillPoly(l, [[bx - 11, by], [bx, by - 6], [bx + 11, by], [bx, by + 6]], '#f6f0e2');
      ln(l, bx, by - 6, bx, by + 6, '#c8bca6');
      ell(l, bx - 4, by, 3, 2, '#e0603e');
      ln(l, bx + 2, by - 1, bx + 8, by - 3, '#3a3036');
      const [cx, cy] = p.P(W - 0.22, 0.32, tz);
      fillPoly(l, [[cx - 5, cy - 11], [cx + 5, cy - 11], [cx + 5, cy], [cx - 5, cy]], '#e8b03e');
      px(l, cx - 5, cy - 11, '#f6d070', 2, 11);
      for (let i = 0; i < 6; i++) ln(l, cx - 4 + i * 1.6, cy - 11, cx - 6 + i * 2.4, cy - 21 - (i % 3) * 2, ['#c8382a', '#2a5a8a', '#3a3036', '#2a8a86', '#e8b03e', '#7a5ad8'][i], 1);
      const [mx, my] = p.P(W - 0.18, 0.62, tz);
      px(l, mx - 4, my - 9, '#f4f0e6', 8, 9);
      px(l, mx - 4, my - 9, '#ffffff', 2, 9);
      px(l, mx + 4, my - 7, '#e4dccc', 3, 5);
      px(l, mx - 3, my - 10, '#4a2e1e', 6, 1);
      const [wx, wy] = p.P(0.3, 0.3, tz);
      for (let i = 0; i < 3; i++) {
        ell(l, wx + i * 7, wy - 2 - i * 1, 4, 2.5, ['#f0a6c0', '#7ac7bb', '#eec65c'][i]);
        ell(l, wx + i * 7, wy - 2 - i * 1, 1.5, 1, '#f6f0e4');
      }
      // a tiny succulent in a tin
      const [tx, ty] = p.P(0.14, 0.62, tz);
      px(l, tx - 4, ty - 7, '#a4abb4', 8, 7);
      px(l, tx - 4, ty - 7, '#e0e4e8', 2, 7);
      foliage(l, [{ x: tx, y: ty - 10, rx: 5, ry: 4, z: 1 }], ['#2a5a4a', '#3a7262', '#4e8c78', '#68a690', '#88c0a8', '#aad6c0', '#cce8da'], k.seed + 4, { cell: 2 });
    });
    shellChair(p, W - 0.34, 1.0, pmod(k.seed + p.x, 2) ? '#2a8a86' : '#e06a4a', k.seed);
  },
  anim(p, k) {
    const v = k.variant ?? 'tablet';
    if (v === 'edit') {
      editScreens(p, k.t, k.seed);
    } else {
      penScreen(p, k.t, k.seed);
      const [lx, ly] = p.P(0.16, 0.2, 7.4);
      const u = p.k / 4;
      p.c.globalAlpha = 0.1;
      ell(p.c, lx + 30 * u, ly - 10 * u, 26 * u, 12 * u, '#fff0c0');
      p.c.globalAlpha = 1;
    }
  },
};

export const STUDIO_GEAR: Record<string, PropArt> = { softbox, tripod, easel, podcast, desk };
export { painting, foam, shellChair, swivelChair };

// Dev-only tools for baked scenes (not imported by the app). Load from the
// console of the dev server:
//   const K = await import('/src/dev/bake.ts')
//   await K.plate('farm')
//     → farm_completa.png: the static scene to retouch (nothing that moves)
//     → farm_guida.png: where people and animals move, which props stay cut-outs
//   await K.open('farm', '/baked/farm/scene.webp')        // fit a retouched picture onto the frame
//   await K.grid('x.png', [x0, y0, x1, y1])                 // a crop of it with a frame-px grid
//   await K.preview('y.png', cuts, [x0, y0, x1, y1])        // check cut-outs drawn on the picture
//   await K.bake('farm', '/baked/farm/scene.webp', { keep, fixes, cuts, fx })
//     → masks.png + scene.json, to put in public/baked/farm/ next to the picture
//   await K.bakePixel('farm')                               // the engine's own pixel art as a picture
//     → scene.png, scene_half.png, masks.png, scene.json (PNGs → lossless WebP)
// Files are POSTed to the local receiver on :5199 (see shots.ts). The app side
// is src/render/baked.ts.
import { PROP_META } from '../data/props';
import { WORLDS } from '../data/worlds';
import type { PropPlacement, WorldDef } from '../domain/world';
import { Painter, type V2 } from '../render/iso';
import { sceneFingerprint } from '../render/baked';
import { DEFAULT_RENDER, WorldRenderer, type Img } from '../render/worldRenderer';
import { RECIPES } from './bakeRecipes';

interface Item {
  p: PropPlacement;
  key: number;
  wx0: number;
  wy0: number;
  wx1: number;
  wy1: number;
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
  sprite?: Img;
  lod?: Img;
  sprX?: number;
  wall?: 'ne' | 'nw';
  live: boolean;
  seed: number;
}

/** The renderer internals these tools reach into. */
interface Guts {
  items: Item[];
  bg: Img;
  bgLod?: Img;
  dp: Painter;
  _frame?: HTMLCanvasElement;
  _fctx?: CanvasRenderingContext2D;
  artFor(type: string): { anim?: unknown } | undefined;
  drawProp(it: Item, t: number): void;
}
const guts = (r: WorldRenderer) => r as unknown as Guts;

/** Animations of things that move through the scene (smoke, steam, jets, bees): left out of the plate. */
const MOVING: Record<string, string[]> = {
  farm: ['beehive', 'farmhouse', 'farmFountain'],
  office: ['fontana', 'fontanella', 'counter'],
};
/** How tall (frame px at 128×64) what walks in a critter area is. */
const CRITTER_H: Record<string, number> = { cow: 80, sheep: 56, dog: 48, cat: 36, chicken: 40, rooster: 44, duck: 28, frog: 14, bird: 20, pigeon: 22 };
const PERSON_H = 136;
const CRITTER_IT: Record<string, string> = {
  cow: 'mucca', sheep: 'pecore', dog: 'cane', cat: 'gatto', chicken: 'galline', rooster: 'gallo', duck: 'anatre', frog: 'rane', bird: 'uccellini', pigeon: 'piccioni',
  gull: 'gabbiani', fac_gull: 'gabbiani', std_gull: 'gabbiani', fac_rat: 'ratti', cormorant: 'cormorani', seal: 'foche', std_crab: 'granchi',
  lab_heron: 'airone', lab_rabbit: 'conigli', dc_reindeer: 'renne', dc_fox: 'volpi', dc_raven: 'corvi',
  spc_eva: 'astronauti', spc_crawler: 'robot cingolati', spc_drone: 'droni', rob_drone: 'droni', rob_rover: 'rover', rob_hare: 'lepri',
  res_marmot: 'marmotte', res_ibex: 'stambecchi', res_eagle: 'aquile', res_chough: 'gracchi',
};

const world = (id: string) => WORLDS.find((w) => w.id === id)!;
const post = (name: string, body: Blob | string) => fetch('http://localhost:5199/' + name, { method: 'POST', body });
const png = (c: HTMLCanvasElement) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('cannot load ' + src));
    i.src = src;
  });
}
const alpha = new Map<Img, Uint8ClampedArray>();
function alphaOf(img: Img) {
  let d = alpha.get(img);
  if (!d) {
    d = img.cv ? img.cv.getContext('2d')!.getImageData(0, 0, img.w, img.h).data : new Uint8ClampedArray(img.data!.buffer, img.data!.byteOffset, img.data!.byteLength);
    alpha.set(img, d);
  }
  return d;
}

/** The world's scene with nothing that moves in it: no animals, no people, no smoke or jets. */
function plateRenderer(w: WorldDef) {
  const r = new WorldRenderer(w);
  const g = guts(r);
  const still = new WorldRenderer({ ...w, scene: { ...w.scene, critters: [], walkers: [], vehicles: [] } }, { fw: r.fw, fh: r.fh, ox: r.painter.ox, oy: r.painter.oy, bg: g.bg, bgLod: g.bgLod, items: g.items });
  const s = guts(still);
  const skip = new Set(MOVING[w.id] ?? []);
  const artFor = s.artFor.bind(s);
  s.artFor = (type) => {
    const a = artFor(type);
    return a?.anim && skip.has(type) ? new Proxy(a, { get: (o, k) => (k === 'anim' ? undefined : Reflect.get(o, k)) }) : a;
  };
  still.renderFrame(null, 1.3, { ...DEFAULT_RENDER, labels: false }, []);
  return still;
}

// ── which props must stay cut-outs ──────────────────────────
interface Area {
  x0: number;
  y0: number;
  kind: string;
  diamond: V2[];
  /** the area's floor raised by the height of what walks there */
  poly: V2[];
  o: number;
}

function hull(pts: V2[]): V2[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (q: V2, a: V2, b: V2) => (a[0] - q[0]) * (b[1] - q[1]) - (a[1] - q[1]) * (b[0] - q[0]);
  const lo: V2[] = [];
  const up: V2[] = [];
  for (const p of s) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of s.reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function areasOf(w: WorldDef, r: WorldRenderer): Area[] {
  const P = (x: number, y: number) => r.painter.P(x, y);
  // a pack's own animals stand as tall as their sprite's anchor; flyers are drawn over everything
  const art = r.pack?.critters ?? {};
  const raw = [
    { x0: 0, y0: 0, x1: w.cols, y1: w.rows, h: PERSON_H, kind: 'agents' },
    ...w.scene.critters
      .filter((c) => c.kind !== 'butterfly' && !art[c.kind]?.fly)
      .map((c) => ({ x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.d, h: art[c.kind]?.ay ?? CRITTER_H[c.kind] ?? 40, kind: c.kind as string })),
    // passers-by: every leg of their routes, as wide as they stray from it
    ...(w.scene.walkers ?? []).flatMap((rt) => {
      const pts = rt.loop ? [...rt.path, rt.path[0]] : rt.path;
      return pts.slice(1).map(([x1, y1], i) => {
        const [x0, y0] = pts[i];
        return { x0: Math.min(x0, x1) - 0.45, y0: Math.min(y0, y1) - 0.45, x1: Math.max(x0, x1) + 0.45, y1: Math.max(y0, y1) + 0.45, h: PERSON_H, kind: 'passanti' };
      });
    }),
    // vehicles: their whole line, as tall as their art
    ...(w.scene.vehicles ?? []).map((v) => ({ x0: v.x, y0: v.y, x1: v.x + (v.axis === 'x' ? v.length : (v.d ?? 1)), y1: v.y + (v.axis === 'x' ? (v.d ?? 1) : v.length), h: (PROP_META[v.type]?.h ?? 40) * 1.1, kind: 'mezzi' })),
  ];
  return raw.map((a) => {
    const diamond: V2[] = [P(a.x0, a.y0), P(a.x1, a.y0), P(a.x1, a.y1), P(a.x0, a.y1)];
    const poly = hull([...diamond, ...diamond.map(([x, y]): V2 => [x, y - a.h])]);
    let s = 0;
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      s += p[0] * q[1] - q[0] * p[1];
    });
    return { x0: a.x0, y0: a.y0, kind: a.kind, diamond, poly, o: Math.sign(s) };
  });
}

/** Separating axes: does a convex polygon touch a box? */
function touches(poly: V2[], [x0, y0, x1, y1]: [number, number, number, number]) {
  const box: V2[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const axes: V2[] = [[1, 0], [0, 1], ...poly.map((p, i): V2 => { const q = poly[(i + 1) % poly.length]; return [p[1] - q[1], q[0] - p[0]]; })];
  return axes.every(([ax, ay]) => {
    const span = (pts: V2[]) => pts.reduce(([lo, hi], [x, y]) => [Math.min(lo, x * ax + y * ay), Math.max(hi, x * ax + y * ay)], [Infinity, -Infinity]);
    const [p0, p1] = span(poly);
    const [q0, q1] = span(box);
    return p1 > q0 && q1 > p0;
  });
}
function within(a: Area, x: number, y: number) {
  return a.poly.every((p, i) => {
    const q = a.poly[(i + 1) % a.poly.length];
    return ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) * a.o >= 0;
  });
}

/** Props that something can pass behind: not entirely behind an area, and some of their pixels over it. */
function occluders(r: WorldRenderer, areas: Area[]): Item[] {
  const hits = (it: Item, a: Area) => {
    if (!(it.wx1 > a.x0 && it.wy1 > a.y0)) return false;
    if (!touches(a.poly, [it.bx0, it.by0, it.bx1, it.by1])) return false;
    const img = it.sprite!;
    const d = alphaOf(img);
    const s0 = it.sprX ?? 0;
    const sw = it.sprX !== undefined ? it.bx1 - it.bx0 : img.w;
    for (let y = 0; y < img.h; y += 2) for (let x = s0; x < s0 + sw; x += 2) if (d[(y * img.w + x) * 4 + 3] && within(a, it.bx0 + x - s0, it.by0 + y)) return true;
    return false;
  };
  return guts(r).items.filter((it) => it.sprite && areas.some((a) => hits(it, a)));
}

type Box4 = [number, number, number, number];
/** The part of an item's box that the areas reach (their polygons' boxes): only there can it cover a mover. */
function reach(it: Item, areas: Area[]): Box4 | null {
  let out: Box4 | null = null;
  for (const a of areas) {
    if (!(it.wx1 > a.x0 && it.wy1 > a.y0)) continue;
    const xs = a.poly.map((q) => q[0]);
    const ys = a.poly.map((q) => q[1]);
    const b: Box4 = [Math.max(it.bx0, Math.min(...xs)), Math.max(it.by0, Math.min(...ys)), Math.min(it.bx1, Math.max(...xs)), Math.min(it.by1, Math.max(...ys))];
    if (b[2] <= b[0] || b[3] <= b[1]) continue;
    out = out ? [Math.min(out[0], b[0]), Math.min(out[1], b[1]), Math.max(out[2], b[2]), Math.max(out[3], b[3])] : b;
  }
  return out;
}

// ── the plate and its guide ─────────────────────────────────
/** The static scene to retouch, and a guide showing which props must keep their place and silhouette. */
export async function plate(id: string) {
  const w = world(id);
  const still = plateRenderer(w);
  const { fw, fh } = still;
  await post(`${id}_completa.png`, await png(still.frame));
  const areas = areasOf(w, still);
  const occ = occluders(still, areas);
  // dim the scene, then paint the cut-outs again at full brightness
  const G = canvas(fw, fh);
  const g = G.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(still.frame, 0, 0, fw, fh, 0, 0, fw, fh);
  g.fillStyle = 'rgba(14,10,22,0.64)';
  g.fillRect(0, 0, fw, fh);
  const s = guts(still);
  s._frame = G;
  s._fctx = g;
  s.dp = new Painter(g, still.painter.ox, still.painter.oy, still.k);
  for (const it of occ) s.drawProp(it, 1.3);
  // half size, with the areas and a legend drawn crisp on top
  const S = 0.5;
  const H = canvas(fw * S, fh * S);
  const h = H.getContext('2d')!;
  h.imageSmoothingQuality = 'high';
  h.drawImage(G, 0, 0, fw * S, fh * S);
  const outline = (pts: V2[]) => {
    h.beginPath();
    pts.forEach(([x, y], i) => (i ? h.lineTo(x * S, y * S) : h.moveTo(x * S, y * S)));
    h.closePath();
  };
  h.lineJoin = 'round';
  for (const a of areas.slice(1)) {
    outline(a.diamond);
    h.setLineDash([8, 5]);
    h.lineWidth = 2.5;
    h.strokeStyle = '#ffd84a';
    h.stroke();
  }
  h.setLineDash([]);
  outline(areas[0].diamond);
  h.lineWidth = 4;
  h.strokeStyle = '#5fe0ff';
  h.stroke();
  const placed: V2[] = [];
  const label = (t: string, x: number, y: number, col: string, size: number) => {
    while (placed.some(([px, py]) => Math.abs(px - x) < 70 && Math.abs(py - y) < size + 4)) y += size + 4;
    placed.push([x, y]);
    h.font = `700 ${size}px system-ui, sans-serif`;
    h.textAlign = 'center';
    h.textBaseline = 'middle';
    h.lineWidth = 5;
    h.strokeStyle = 'rgba(8,6,14,0.9)';
    h.strokeText(t, x, y);
    h.fillStyle = col;
    h.fillText(t, x, y);
  };
  const centre = (d: V2[]): V2 => [(d[0][0] + d[2][0]) / 2, (d[0][1] + d[2][1]) / 2];
  label('personaggi', centre(areas[0].diamond)[0] * S, centre(areas[0].diamond)[1] * S, '#5fe0ff', 24);
  for (const a of areas.slice(1)) label(CRITTER_IT[a.kind] ?? a.kind, centre(a.diamond)[0] * S, centre(a.diamond)[1] * S, '#ffd84a', 17);
  const lines: [string, string, number][] = [
    [`${w.name}: guida per il ritocco`, '#ffffff', 22],
    ['Linea azzurra: dove si muovono i personaggi', '#5fe0ff', 16],
    ['Tratteggio giallo: dove girano gli animali (li aggiungo io, animati)', '#ffd84a', 16],
    ['Oggetti a colori: personaggi e animali ci passano dietro o li usano.', '#ffffff', 16],
    ['Tienili più o meno nello stesso punto; il resto arricchiscilo liberamente.', '#ffffff', 16],
    ['Schermi, luci, fumo, vapore e mezzi in movimento li animo io sopra.', '#cfc8e0', 16],
  ];
  const font = (size: number) => `${size > 20 ? 700 : 500} ${size}px system-ui, sans-serif`;
  const wide = Math.max(...lines.map(([t, , size]) => ((h.font = font(size)), h.measureText(t).width)));
  h.fillStyle = 'rgba(10,8,18,0.86)';
  h.beginPath();
  h.roundRect(24, 24, wide + 40, lines.length * 28 + 26, 12);
  h.fill();
  lines.forEach(([t, col, size], i) => {
    h.font = font(size);
    h.textAlign = 'left';
    h.textBaseline = 'middle';
    h.fillStyle = col;
    h.fillText(t, 44, 50 + i * 28);
  });
  await post(`${id}_guida.png`, await png(H));
  return { frame: [fw, fh], cutouts: new Set(occ.map((i) => i.p)).size };
}

// ── fitting the retouched picture onto the frame ────────────
/**
 * The affine map from the picture to the frame. Both are compared at 724 px
 * wide on blurred luminance: blocks of the plate are found in the picture
 * (normalised cross-correlation), then a least-squares fit keeps the blocks
 * that agree (RANSAC). Returns canvas setTransform(a, b, c, d, e, f).
 */
function fit(plate: HTMLCanvasElement, fw: number, fh: number, pic: HTMLImageElement) {
  const tw = 724;
  const th = Math.round((pic.height * tw) / pic.width);
  const bw = 724;
  const bh = Math.round((fh * bw) / fw);
  const lum = (src: CanvasImageSource, sw: number, sh: number, w: number, h: number) => {
    const c = canvas(w, h);
    const x = c.getContext('2d')!;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    // 3×3 box blur
    const o = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x2 = 1; x2 < w - 1; x2++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[(y + dy) * w + x2 + dx];
        o[y * w + x2] = s / 9;
      }
    return o;
  };
  const gT = lum(pic, pic.width, pic.height, tw, th);
  const gB = lum(plate, fw, fh, bw, bh);
  const half = 22;
  const R = 48;
  const n = 4 * half * half;
  const pairs: { cx: number; cy: number; mx: number; my: number }[] = [];
  for (let cy = half + 8; cy < bh - half - 8; cy += 40)
    for (let cx = half + 8; cx < bw - half - 8; cx += 40) {
      const tpl = new Float32Array(n);
      let m = 0;
      let k = 0;
      for (let y = -half; y < half; y++) for (let x = -half; x < half; x++) m += gB[(cy + y) * bw + cx + x];
      m /= n;
      let v = 0;
      for (let y = -half; y < half; y++)
        for (let x = -half; x < half; x++) {
          const d = gB[(cy + y) * bw + cx + x] - m;
          tpl[k++] = d;
          v += d * d;
        }
      const sd = Math.sqrt(v / n);
      if (sd < 6) continue;
      const py = Math.round((cy * th) / bh);
      let best = -2;
      let bx = 0;
      let by = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const ox = cx + dx;
          const oy = py + dy;
          if (ox - half < 0 || oy - half < 0 || ox + half > tw || oy + half > th) continue;
          let s = 0;
          let s2 = 0;
          let st = 0;
          k = 0;
          for (let y = -half; y < half; y++) {
            const row = (oy + y) * tw + ox;
            for (let x = -half; x < half; x++) {
              const t = gT[row + x];
              s += t;
              s2 += t * t;
              st += t * tpl[k++];
            }
          }
          const mt = s / n;
          const vt = s2 / n - mt * mt;
          if (vt <= 1) continue;
          const ncc = st / n / (Math.sqrt(vt) * sd);
          if (ncc > best) {
            best = ncc;
            bx = ox;
            by = oy;
          }
        }
      if (best > 0.6) pairs.push({ cx, cy, mx: bx, my: by });
    }
  // least squares: (mx, my) = A · (cx, cy, 1)
  const lsq = (S: typeof pairs) => {
    const solve = (out: (p: (typeof pairs)[number]) => number) => {
      const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const b = [0, 0, 0];
      for (const p of S) {
        const v = [p.cx, p.cy, 1];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) a[i][j] += v[i] * v[j];
          b[i] += v[i] * out(p);
        }
      }
      const m = a.map((r, i) => [...r, b[i]]);
      for (let c = 0; c < 3; c++) {
        let piv = c;
        for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
        [m[c], m[piv]] = [m[piv], m[c]];
        if (Math.abs(m[c][c]) < 1e-9) return null;
        for (let r = 0; r < 3; r++)
          if (r !== c) {
            const f = m[r][c] / m[c][c];
            for (let q = c; q < 4; q++) m[r][q] -= f * m[c][q];
          }
      }
      return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
    };
    const X = solve((p) => p.mx);
    const Y = solve((p) => p.my);
    return X && Y ? { X, Y } : null;
  };
  type Fit = NonNullable<ReturnType<typeof lsq>>;
  const err = (F: Fit, p: (typeof pairs)[number]) => Math.hypot(F.X[0] * p.cx + F.X[1] * p.cy + F.X[2] - p.mx, F.Y[0] * p.cx + F.Y[1] * p.cy + F.Y[2] - p.my);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let inliers: typeof pairs = [];
  for (let it = 0; it < 4000; it++) {
    const F = lsq([0, 1, 2].map(() => pairs[Math.floor(rnd() * pairs.length)]));
    if (!F) continue;
    const ins = pairs.filter((p) => err(F, p) < 5);
    if (ins.length > inliers.length) inliers = ins;
  }
  let F = lsq(inliers)!;
  inliers = pairs.filter((p) => err(F, p) < 5);
  F = lsq(inliers)!;
  // frame px → picture px, then inverted
  const k0 = bw / fw;
  const kt = pic.width / tw;
  const A = [[kt * k0 * F.X[0], kt * k0 * F.X[1]], [kt * k0 * F.Y[0], kt * k0 * F.Y[1]]];
  const t = [kt * F.X[2], kt * F.Y[2]];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const Ai = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
  const e = -(Ai[0][0] * t[0] + Ai[0][1] * t[1]);
  const f = -(Ai[1][0] * t[0] + Ai[1][1] * t[1]);
  const res = inliers.map((p) => err(F, p)).sort((a, b) => a - b);
  return {
    warp: [Ai[0][0], Ai[1][0], Ai[0][1], Ai[1][1], e, f].map((v) => Math.round(v * 1e6) / 1e6) as [number, number, number, number, number, number],
    blocks: pairs.length,
    inliers: inliers.length,
    /** median distance of the agreeing blocks from the fit, in picture px */
    residual: Math.round((res[res.length >> 1] ?? 0) * kt * 10) / 10,
  };
}

// ── a retouched picture, fitted onto the frame ──────────────
interface Workspace {
  id: string;
  url: string;
  still: WorldRenderer;
  fitted: ReturnType<typeof fit>;
  /** the picture on the frame (frame px) */
  warped: HTMLCanvasElement;
  wctx: CanvasRenderingContext2D;
}
let ws: Workspace | null = null;

/** Fit a retouched picture onto a world's frame (kept for grid, preview and bake). */
export async function open(id: string, pictureUrl: string) {
  if (!ws || ws.id !== id || ws.url !== pictureUrl) {
    const still = plateRenderer(world(id));
    const pic = await loadImage(pictureUrl);
    const fitted = fit(still.frame, still.fw, still.fh, pic);
    const warped = canvas(still.fw, still.fh);
    const wctx = warped.getContext('2d', { willReadFrequently: true })!;
    wctx.imageSmoothingQuality = 'high';
    const [a, b, c, d, e, f] = fitted.warp;
    wctx.setTransform(a, b, c, d, e, f);
    wctx.drawImage(pic, 0, 0);
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    ws = { id, url: pictureUrl, still, fitted, warped, wctx };
  }
  return { frame: [ws.still.fw, ws.still.fh], blocks: ws.fitted.blocks, inliers: ws.fitted.inliers, residual: ws.fitted.residual };
}
function need() {
  if (!ws) throw new Error('open(world, picture) first');
  return ws;
}

type Box = [number, number, number, number];

/** A crop of the fitted picture with a grid in frame px (every `step`, labelled every 2 steps). */
export async function grid(name: string, [x0, y0, x1, y1]: Box, zoom = 2, step = 20) {
  const w = need();
  const c = canvas((x1 - x0) * zoom, (y1 - y0) * zoom);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(w.warped, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,0,0.5)';
  g.fillStyle = '#ff0';
  g.font = '600 13px system-ui';
  for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
    const px = (x - x0) * zoom + 0.5;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, c.height);
    g.stroke();
    if (x % (step * 2) === 0) g.fillText(String(x), px + 2, 13);
  }
  for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) {
    const py = (y - y0) * zoom + 0.5;
    g.beginPath();
    g.moveTo(0, py);
    g.lineTo(c.width, py);
    g.stroke();
    if (y % (step * 2) === 0) g.fillText(String(y), 2, py - 2);
  }
  await post(name, await png(c));
}

/**
 * A crop of the fitted picture with the world's tile grid on it (lines every
 * `step` tiles, labelled with their x and y), to read where things stand.
 */
export async function tileGrid(name: string, [x0, y0, x1, y1]: Box, zoom = 0.5, step = 2) {
  const w = need();
  const P = (x: number, y: number) => w.still.painter.P(x, y);
  const c = canvas(Math.round((x1 - x0) * zoom), Math.round((y1 - y0) * zoom));
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(w.warped, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  // the tile range the crop covers
  const corners = [w.still.unproject(x0, y0), w.still.unproject(x1, y0), w.still.unproject(x0, y1), w.still.unproject(x1, y1)];
  const tx0 = Math.floor(Math.min(...corners.map((p) => p.x)) / step) * step;
  const tx1 = Math.ceil(Math.max(...corners.map((p) => p.x)));
  const ty0 = Math.floor(Math.min(...corners.map((p) => p.y)) / step) * step;
  const ty1 = Math.ceil(Math.max(...corners.map((p) => p.y)));
  const S = (x: number, y: number): V2 => {
    const [fx, fy] = P(x, y);
    return [(fx - x0) * zoom, (fy - y0) * zoom];
  };
  g.lineWidth = 1;
  g.font = '600 12px system-ui';
  for (let x = tx0; x <= tx1; x += step) {
    const [ax, ay] = S(x, ty0);
    const [bx, by] = S(x, ty1);
    g.strokeStyle = x === 0 ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,0,0.45)';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
  }
  for (let y = ty0; y <= ty1; y += step) {
    const [ax, ay] = S(tx0, y);
    const [bx, by] = S(tx1, y);
    g.strokeStyle = y === 0 ? 'rgba(80,160,255,0.9)' : 'rgba(0,255,255,0.4)';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
  }
  // labels at the crossings (every other line)
  for (let x = tx0; x <= tx1; x += step * 2)
    for (let y = ty0; y <= ty1; y += step * 2) {
      const [sx, sy] = S(x, y);
      if (sx < 0 || sy < 0 || sx > c.width || sy > c.height) continue;
      const t = `${x},${y}`;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(sx + 2, sy - 13, g.measureText(t).width + 4, 14);
      g.fillStyle = '#ffff60';
      g.fillText(t, sx + 4, sy - 2);
    }
  await post(name, await png(c));
}

/** An object only the picture has (or one it redrew), cut out of the picture itself. */
export interface PictureCut {
  name: string;
  /** a rough outline of it on the fitted picture (frame px) */
  poly: V2[];
  /** where it touches the ground (frame px): one point for a pole, corners for a box */
  base: V2[];
  /**
   * Separate it from the ground around it by colour: true, or a colour distance
   * (default 40). Only when its colours stand well apart from everything around
   * it: on the Farm it ate dark lamps (cobble joints, shadows) and brown benches
   * (dirt), so the recipe uses tight outlines instead. Check with preview().
   */
  refine?: boolean | number;
}

function trace(g: CanvasRenderingContext2D, poly: V2[], dx: number, dy: number) {
  g.beginPath();
  poly.forEach(([x, y], i) => (i ? g.lineTo(x - dx, y - dy) : g.moveTo(x - dx, y - dy)));
  g.closePath();
}

/** The silhouette of a picture cut-out: its outline, minus what looks like the ground around it. */
function pictureMask(w: Workspace, cut: PictureCut) {
  const R = 12;
  const even = (v: number) => v - (v & 1);
  const x0 = even(Math.floor(Math.min(...cut.poly.map((p) => p[0]))) - R);
  const y0 = even(Math.floor(Math.min(...cut.poly.map((p) => p[1]))) - R);
  let mw = Math.ceil(Math.max(...cut.poly.map((p) => p[0]))) + R - x0;
  let mh = Math.ceil(Math.max(...cut.poly.map((p) => p[1]))) + R - y0;
  mw += mw & 1;
  mh += mh & 1;
  // inside (red) and a ring around it (green)
  const m = canvas(mw, mh);
  const g = m.getContext('2d', { willReadFrequently: true })!;
  trace(g, cut.poly, x0, y0);
  g.lineWidth = R * 2;
  g.strokeStyle = '#0f0';
  g.stroke();
  g.fillStyle = '#f00';
  g.fill();
  const md = g.getImageData(0, 0, mw, mh).data;
  const pd = w.wctx.getImageData(x0, y0, mw, mh).data;
  const n = mw * mh;
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = md[i * 4] > 128 && md[i * 4 + 1] < 128 ? 1 : 0;
  if (cut.refine) {
    const T = typeof cut.refine === 'number' ? cut.refine : 40;
    const ring: number[] = [];
    for (let i = 0; i < n; i++) if (md[i * 4 + 1] > 128 && md[i * 4] < 128) ring.push(i);
    const samples: [number, number, number][] = [];
    for (let k = 0; k < Math.min(900, ring.length); k++) {
      const i = ring[Math.floor((k * ring.length) / Math.min(900, ring.length))];
      samples.push([pd[i * 4], pd[i * 4 + 1], pd[i * 4 + 2]]);
    }
    const T2 = T * T;
    for (let i = 0; i < n; i++) {
      if (!fg[i]) continue;
      const r = pd[i * 4];
      const gg = pd[i * 4 + 1];
      const b = pd[i * 4 + 2];
      for (const [sr, sg, sb] of samples)
        if ((r - sr) ** 2 + (gg - sg) ** 2 + (b - sb) ** 2 < T2) {
          fg[i] = 0;
          break;
        }
    }
    // tidy: majority filter, then fill the holes the ground colours punched in it
    const tmp = fg.slice();
    for (let y = 1; y < mh - 1; y++)
      for (let x = 1; x < mw - 1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += tmp[(y + dy) * mw + x + dx];
        fg[y * mw + x] = s >= 5 ? 1 : 0;
      }
    const seen = new Uint8Array(n);
    const stack: number[] = [];
    for (let x = 0; x < mw; x++) stack.push(x, (mh - 1) * mw + x);
    for (let y = 0; y < mh; y++) stack.push(y * mw, y * mw + mw - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i] || fg[i]) continue;
      seen[i] = 1;
      const x = i % mw;
      if (x > 0) stack.push(i - 1);
      if (x < mw - 1) stack.push(i + 1);
      if (i >= mw) stack.push(i - mw);
      if (i < n - mw) stack.push(i + mw);
    }
    for (let i = 0; i < n; i++) if (!fg[i] && !seen[i] && md[i * 4] > 128) fg[i] = 1;
  }
  return { ox: x0, oy: y0, w: mw, h: mh, fg };
}

/** Footprint (tiles) of a picture cut-out, from where it touches the ground. */
function footOf(w: Workspace, base: V2[]) {
  const pts = base.map(([x, y]) => w.still.unproject(x, y));
  const m = 0.15;
  return [Math.min(...pts.map((p) => p.x)) - m, Math.min(...pts.map((p) => p.y)) - m, Math.max(...pts.map((p) => p.x)) + m, Math.max(...pts.map((p) => p.y)) + m];
}

/** Check picture cut-outs: their silhouettes tinted on the fitted picture, with outlines and ground points. */
export async function preview(name: string, cuts: PictureCut[], [x0, y0, x1, y1]: Box, zoom = 1) {
  const w = need();
  const c = canvas((x1 - x0) * zoom, (y1 - y0) * zoom);
  const g = c.getContext('2d')!;
  g.drawImage(w.warped, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, c.width, c.height);
  cuts.forEach((cut, k) => {
    const mk = pictureMask(w, cut);
    const tint = canvas(mk.w, mk.h);
    const t = tint.getContext('2d')!;
    const id = t.createImageData(mk.w, mk.h);
    const src = w.wctx.getImageData(mk.ox, mk.oy, mk.w, mk.h).data;
    for (let i = 0; i < mk.fg.length; i++)
      if (mk.fg[i]) {
        id.data[i * 4] = src[i * 4];
        id.data[i * 4 + 1] = src[i * 4 + 1];
        id.data[i * 4 + 2] = src[i * 4 + 2];
        id.data[i * 4 + 3] = 255;
      }
    t.putImageData(id, 0, 0);
    g.drawImage(tint, (mk.ox - x0) * zoom, (mk.oy - y0) * zoom, mk.w * zoom, mk.h * zoom);
    g.save();
    g.scale(zoom, zoom);
    trace(g, cut.poly, x0, y0);
    g.restore();
    g.strokeStyle = k % 2 ? '#ff5fd0' : '#5fe0ff';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#ffd84a';
    for (const [bx, by] of cut.base) g.fillRect((bx - x0) * zoom - 3, (by - y0) * zoom - 3, 6, 6);
    g.font = '600 12px system-ui';
    g.fillText(cut.name, (cut.poly[0][0] - x0) * zoom, (cut.poly[0][1] - y0) * zoom - 4);
  });
  await post(name, await png(c));
}

// ── the baked scene ─────────────────────────────────────────
export interface BakeOpts {
  /** prop types that stay cut-outs (default: every prop something can pass behind) */
  keep?: string[];
  /** hand-drawn outlines (frame px) that replace a prop's silhouette, by prop id or type */
  fixes?: Record<string, V2[]>;
  /** objects cut out of the picture itself (see PictureCut) */
  cuts?: PictureCut[];
  /** effects fitted to the picture */
  fx?: {
    /** glints on the picture's water (found by colour inside the world's water areas) */
    water?: boolean;
    /** lit lanterns (frame px) */
    lights?: V2[];
    /** beehives (frame px) */
    bees?: V2[];
  };
  /** prop types whose animation the picture no longer matches */
  noAnim?: string[];
  /** the picture's file name in public/baked/<world>/ (default: the URL's file name) */
  image?: string;
}

/** Glints for the picture's water: points on blue pixels inside the world's water areas (grown a little). */
function waterGlints(w: Workspace) {
  const wd = world(w.id);
  const areas = [...wd.environment.patches.filter((p) => p.style === 'water'), ...wd.scene.ground.filter((g) => g.mat === 'water')];
  const out: [number, number, number][] = [];
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const taken = new Set<string>();
  for (const a of areas) {
    const corners = [w.still.painter.P(a.x - 1.5, a.y - 1.5), w.still.painter.P(a.x + a.w + 1.5, a.y - 1.5), w.still.painter.P(a.x + a.w + 1.5, a.y + a.d + 1.5), w.still.painter.P(a.x - 1.5, a.y + a.d + 1.5)];
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))));
    const x1 = Math.min(w.still.fw, Math.ceil(Math.max(...corners.map((p) => p[0]))));
    const y1 = Math.min(w.still.fh, Math.ceil(Math.max(...corners.map((p) => p[1]))));
    if (x1 <= x0 || y1 <= y0) continue;
    const d = w.wctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const W = x1 - x0;
    const water = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= y1 - y0) return false;
      const i = (y * W + x) * 4;
      return d[i + 2] > 100 && d[i + 2] > d[i] + 40 && d[i + 2] > d[i + 1] + 10;
    };
    for (let y = 6; y < y1 - y0 - 6; y += 15)
      for (let x = 8; x < W - 8; x += 30) {
        const jx = x + Math.round((rnd() - 0.5) * 20);
        const jy = y + Math.round((rnd() - 0.5) * 9);
        const key = `${x0 + jx >> 3},${y0 + jy >> 2}`;
        if (taken.has(key)) continue;
        if (water(jx, jy) && water(jx - 7, jy) && water(jx + 7, jy) && water(jx, jy - 4) && water(jx, jy + 4)) {
          taken.add(key);
          out.push([x0 + jx, y0 + jy, Math.round(rnd() * 300) / 100]);
        }
      }
  }
  return out;
}

// ── stencils: one per sprite placement (slices share it) ────
interface Mask {
  ox: number;
  oy: number;
  w: number;
  h: number;
  src?: HTMLCanvasElement;
  sx?: number;
  sy?: number;
  poly?: V2[];
  fg?: Uint8Array;
  ax?: number;
  ay?: number;
}
type Entry = { p: PropPlacement; key: number; w: number[]; b: number[]; sprX?: number; m: number; seed: number; wall?: 'ne' | 'nw' };
const even = (v: number) => v - (v & 1);

/** An Img's pixels on a canvas (sprites built in a worker carry raw pixels). */
function cnvOf(img: Img): HTMLCanvasElement {
  if (img.cv) return img.cv;
  const d = img.data!;
  const c = canvas(img.w, img.h);
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)), img.w, img.h), 0, 0);
  return c;
}

/**
 * Stencils for the props that stay in depth: the engine's silhouettes, trimmed
 * to their opaque box (even origins, so the half size lines up), or hand
 * outlines (`fixes`, by prop id or type) for props a retouch redrew.
 */
function stencils(occ: Item[], fixes?: Record<string, V2[]>, areas?: Area[]) {
  const masks: Mask[] = [];
  // per sprite placement: the frame box its items can cover movers in, and the areas that reach it
  const clipOf = new Map<string, Box4>();
  const areasOfKey = new Map<string, Area[]>();
  const placeKey = (it: Item) => (it.sprite ? `${it.sprite.w}x${it.sprite.h}|${it.bx0 - (it.sprX ?? 0)}|${it.by0}` : '');
  if (areas)
    for (const it of occ) {
      const r = reach(it, areas);
      if (!r) continue;
      const k = placeKey(it);
      const c = clipOf.get(k);
      clipOf.set(k, c ? [Math.min(c[0], r[0]), Math.min(c[1], r[1]), Math.max(c[2], r[2]), Math.max(c[3], r[3])] : r);
      const list = areasOfKey.get(k) ?? [];
      for (const a of areas) if (it.wx1 > a.x0 && it.wy1 > a.y0 && !list.includes(a) && touches(a.poly, [it.bx0, it.by0, it.bx1, it.by1])) list.push(a);
      areasOfKey.set(k, list);
    }
  const seen = new Map<string, number>();
  const ids = new Map<Img, number>();
  const maskOf = (it: Item) => {
    const fix = fixes?.[it.p.id] ?? fixes?.[it.p.type];
    if (fix) {
      const key = 'fix:' + it.p.type + ':' + it.p.x + ',' + it.p.y;
      if (!seen.has(key)) {
        const x0 = even(Math.floor(Math.min(...fix.map((p) => p[0]))) - 3);
        const y0 = even(Math.floor(Math.min(...fix.map((p) => p[1]))) - 3);
        const ww = Math.ceil(Math.max(...fix.map((p) => p[0]))) + 3 - x0;
        const hh = Math.ceil(Math.max(...fix.map((p) => p[1]))) + 3 - y0;
        masks.push({ ox: x0, oy: y0, w: ww + (ww & 1), h: hh + (hh & 1), poly: fix });
        seen.set(key, masks.length - 1);
      }
      return seen.get(key)!;
    }
    const img = it.sprite!;
    if (!ids.has(img)) ids.set(img, ids.size);
    const ox = it.bx0 - (it.sprX ?? 0);
    const oy = it.by0;
    const key = ids.get(img) + '|' + ox + '|' + oy;
    if (!seen.has(key)) {
      const d = alphaOf(img);
      let tx0 = img.w;
      let ty0 = img.h;
      let tx1 = -1;
      let ty1 = -1;
      // only the part that can cover a mover (whole sprite without areas)
      const c = clipOf.get(placeKey(it));
      const cx0 = c ? Math.max(0, Math.floor(c[0] - ox)) : 0;
      const cy0 = c ? Math.max(0, Math.floor(c[1] - oy)) : 0;
      const cx1 = c ? Math.min(img.w, Math.ceil(c[2] - ox)) : img.w;
      const cy1 = c ? Math.min(img.h, Math.ceil(c[3] - oy)) : img.h;
      // and of that, only the pixels inside an area's shape (long diagonal areas have big boxes)
      const reachers = areasOfKey.get(placeKey(it));
      const inside = (x: number, y: number) => !reachers || reachers.some((a) => within(a, ox + x, oy + y));
      for (let y = cy0; y < cy1; y++)
        for (let x = cx0; x < cx1; x++)
          if (d[(y * img.w + x) * 4 + 3] && inside(x, y)) {
            tx0 = Math.min(tx0, x);
            tx1 = Math.max(tx1, x);
            ty0 = Math.min(ty0, y);
            ty1 = Math.max(ty1, y);
          }
      if (tx1 < 0) seen.set(key, -1);
      else {
        tx0 = even(tx0);
        ty0 = even(ty0);
        const ww = tx1 + 1 - tx0;
        const hh = ty1 + 1 - ty0;
        masks.push({ ox: ox + tx0, oy: oy + ty0, w: ww + (ww & 1), h: hh + (hh & 1), src: cnvOf(img), sx: tx0, sy: ty0 });
        seen.set(key, masks.length - 1);
      }
    }
    return seen.get(key)!;
  };
  const items: Entry[] = [];
  for (const it of occ) {
    const m = maskOf(it);
    if (m < 0) continue;
    const mk = masks[m];
    const e: Entry = { p: it.p, key: it.key, w: [it.wx0, it.wy0, it.wx1, it.wy1], b: [], m, seed: it.seed };
    if (it.sprX !== undefined && !mk.poly) {
      // a column of a long prop: its share of the trimmed cut-out
      const x0 = Math.max(it.bx0, mk.ox);
      const x1 = Math.min(it.bx1, mk.ox + mk.w);
      if (x1 <= x0) continue;
      e.b = [x0, mk.oy, x1, mk.oy + mk.h];
      e.sprX = x0 - mk.ox;
    } else e.b = [mk.ox, mk.oy, mk.ox + mk.w, mk.oy + mk.h];
    items.push(e);
  }
  return { masks, items };
}

/** Pack the stencils on shelves, 2048 px wide; white, alpha = silhouette. */
function atlasOf(masks: Mask[]) {
  const AW = 2048;
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const mk of [...masks].sort((a, b) => b.h - a.h)) {
    if (x + mk.w > AW) {
      x = 0;
      y += rowH + 2;
      rowH = 0;
    }
    mk.ax = x;
    mk.ay = y;
    x += mk.w + 2;
    rowH = Math.max(rowH, mk.h);
  }
  const atlas = canvas(AW, Math.max(1, y + rowH));
  const g = atlas.getContext('2d')!;
  for (const mk of masks) {
    if (mk.poly) {
      trace(g, mk.poly, mk.ox - mk.ax!, mk.oy - mk.ay!);
      g.fillStyle = '#fff';
      g.fill();
      g.lineWidth = 3;
      g.lineJoin = 'round';
      g.strokeStyle = '#fff';
      g.stroke();
    } else if (mk.fg) {
      const id2 = g.createImageData(mk.w, mk.h);
      for (let i = 0; i < mk.fg.length; i++) if (mk.fg[i]) id2.data.set([255, 255, 255, 255], i * 4);
      g.putImageData(id2, mk.ax!, mk.ay!);
    } else if (mk.src) g.drawImage(mk.src, mk.sx!, mk.sy!, mk.w, mk.h, mk.ax!, mk.ay!, mk.w, mk.h);
  }
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, atlas.width, atlas.height);
  return atlas;
}

/**
 * Cut the props that must stay in depth out of the fitted picture: the engine's
 * silhouettes for props the picture kept, hand outlines for props it redrew,
 * and picture cut-outs for objects only it has. POSTs masks.png and scene.json.
 */
export async function bake(id: string, pictureUrl: string, o: BakeOpts = {}) {
  await open(id, pictureUrl);
  const w = need();
  const { still } = w;
  let occ = occluders(still, areasOf(world(id), still));
  if (o.keep) {
    const keep = new Set(o.keep);
    occ = occ.filter((it) => keep.has(it.p.type));
  }
  const { masks, items } = stencils(occ, o.fixes, areasOf(world(id), still));
  // objects cut out of the picture itself, standing where their feet are
  for (const cut of o.cuts ?? []) {
    const pm = pictureMask(w, cut);
    masks.push({ ox: pm.ox, oy: pm.oy, w: pm.w, h: pm.h, fg: pm.fg });
    const [wx0, wy0, wx1, wy1] = footOf(w, cut.base);
    const p: PropPlacement = { id: 'pic:' + cut.name, type: 'picture', x: wx0, y: wy0, w: 1, d: 1, rot: 0 };
    items.push({ p, key: wx1 + wy1, w: [wx0, wy0, wx1, wy1], b: [pm.ox, pm.oy, pm.ox + pm.w, pm.oy + pm.h], m: masks.length - 1, seed: 0 });
  }
  // the engine's draw order: by the front corner of the footprint (a stable sort keeps the slices' order)
  items.sort((a, b) => a.key - b.key || a.w[2] - b.w[2]);
  const atlas = atlasOf(masks);
  const fx = o.fx ? { water: o.fx.water ? waterGlints(w) : undefined, lights: o.fx.lights, bees: o.fx.bees } : undefined;
  const scene = {
    version: 1,
    world: id,
    fw: still.fw,
    fh: still.fh,
    ox: still.painter.ox,
    oy: still.painter.oy,
    image: o.image ?? pictureUrl.slice(pictureUrl.lastIndexOf('/') + 1),
    warp: w.fitted.warp,
    masks: 'masks.png',
    maskRects: masks.map((mk) => [mk.ax, mk.ay, mk.w, mk.h, mk.ox, mk.oy]),
    noAnim: o.noAnim ?? [],
    items,
    fx,
  };
  await post('masks.png', await png(atlas));
  await post('scene.json', JSON.stringify(scene));
  return { items: items.length, stencils: masks.length, pictureCuts: o.cuts?.length ?? 0, glints: fx?.water?.length ?? 0, atlas: [atlas.width, atlas.height], blocks: w.fitted.blocks, inliers: w.fitted.inliers, residual: w.fitted.residual };
}

/**
 * Bake a world's own pixel art into a picture: the scene as the engine paints
 * it, without anything that moves or animates, at full and half resolution
 * (the half one is the engine's own level of detail, so zooming out stays
 * crisp). The props that people or animals can pass behind keep their exact
 * silhouettes; the props with animations are listed so the app animates them
 * on top. POSTs scene.png, scene_half.png, masks.png and scene.json; convert
 * the two scene PNGs to lossless WebP next to the others.
 */
export async function bakePixel(id: string) {
  const w = world(id);
  const r = new WorldRenderer(w);
  const g = guts(r);
  // the still scene: no animals, no animations, no water glints
  const still = new WorldRenderer({ ...w, scene: { ...w.scene, critters: [], walkers: [], vehicles: [] } }, { fw: r.fw, fh: r.fh, ox: r.painter.ox, oy: r.painter.oy, bg: g.bg, bgLod: g.bgLod, items: g.items, fx: { ownWater: true } });
  const s = guts(still);
  const artFor = s.artFor.bind(s);
  s.artFor = (type) => {
    const a = artFor(type);
    return a?.anim ? new Proxy(a, { get: (o, k) => (k === 'anim' ? undefined : Reflect.get(o, k)) }) : a;
  };
  const opts = { ...DEFAULT_RENDER, labels: false };
  const { fw, fh } = still;
  still.renderFrame(null, 0, opts, []);
  const full = canvas(fw, fh);
  full.getContext('2d')!.drawImage(still.frame, 0, 0, fw, fh, 0, 0, fw, fh);
  still.renderFrame(null, 0, opts, [], { x0: 0, y0: 0, x1: fw, y1: fh, zoom: 0.5 });
  const half = canvas(fw / 2, fh / 2);
  half.getContext('2d')!.drawImage(still.frame, 0, 0, fw / 2, fh / 2, 0, 0, fw / 2, fh / 2);
  // cut-outs: every prop something can pass behind, with its exact silhouette
  const occ = occluders(still, areasOf(w, still));
  const { masks, items } = stencils(occ, undefined, areasOf(w, still));
  // the props with animations, drawn on top by the app (no stencil unless they are cut-outs too)
  const inOcc = new Set(occ.map((it) => it.p));
  const seenAnim = new Set<PropPlacement>();
  let anims = 0;
  for (const it of g.items) {
    if (it.wall) {
      // the back walls: their clocks and sconces animate on top (both walls share one placement);
      // a wall that people pass behind is a cut-out too, so it keeps covering them
      const cut = items.find((e) => e.p === it.p && e.key === it.key && e.m >= 0 && !e.wall);
      if (cut) {
        cut.wall = it.wall;
        anims++;
        continue;
      }
      items.push({ p: it.p, key: it.key, w: [it.wx0, it.wy0, it.wx1, it.wy1], b: [it.bx0, it.by0, it.bx1, it.by1], m: -1, seed: it.seed, wall: it.wall });
      anims++;
      continue;
    }
    if (inOcc.has(it.p) || seenAnim.has(it.p) || !artFor(it.p.type)?.anim) continue;
    seenAnim.add(it.p);
    items.push({ p: it.p, key: it.key, w: [it.wx0, it.wy0, it.wx1, it.wy1], b: [it.bx0, it.by0, it.bx1, it.by1], m: -1, seed: it.seed });
    anims++;
  }
  const atlas = atlasOf(masks);
  const scene = {
    version: 1,
    world: id,
    source: sceneFingerprint(w),
    fw,
    fh,
    ox: still.painter.ox,
    oy: still.painter.oy,
    image: 'scene.webp',
    imageHalf: 'scene_half.webp',
    pixel: true,
    warp: [1, 0, 0, 1, 0, 0],
    masks: 'masks.png',
    maskRects: masks.map((mk) => [mk.ax, mk.ay, mk.w, mk.h, mk.ox, mk.oy]),
    noAnim: [],
    items,
  };
  await post('scene.png', await png(full));
  await post('scene_half.png', await png(half));
  await post('masks.png', await png(atlas));
  await post('scene.json', JSON.stringify(scene));
  return { frame: [fw, fh], cutouts: items.length - anims, animOnly: anims, stencils: masks.length, atlas: [atlas.width, atlas.height] };
}

/** Bake a world from its recipe (bakeRecipes.ts). */
export function run(name: string) {
  const r = RECIPES[name];
  if (!r) throw new Error('no bake recipe for ' + name);
  return bake(r.world ?? name, r.picture, r);
}

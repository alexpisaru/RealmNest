// Factory pack — ramps and surface materials of the Albion Works (128×64).
// A red-brick mill estate on a canal: sooty brick, Welsh slate, riveted
// steel, machine-green paint, safety yellow, galvanised sheet, oily concrete.
// Every ramp runs dark → light, shadows leaning purple, lights leaning warm.
import { type FaceTex, type Mat, texPara } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { bayer, hash, type Mass, noise2, type Ramp } from '../../kit4';

/** Ramp lookup, rounded and clamped (never past either end of the ramp). */
export const at = (r: Ramp, i: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];

// ── ramps ───────────────────────────────────────────────────
export const BRICK: Ramp = ['#4a2218', '#653523', '#864832', '#a65a3c', '#bf704e', '#cd8160', '#dc9a78'];
/** blue engineering brick (plinths, copings, bridges) */
export const BLUEBRICK: Ramp = ['#1c1a22', '#26232d', '#322e3a', '#3f3a48', '#4e4858', '#615a6b'];
/** whitewashed brick inside the works */
export const LIME: Ramp = ['#8a8070', '#a89c86', '#c4b89e', '#d6cbb1', '#e6dac2', '#f3e9ce'];
/** grey-green machine enamel */
export const MGREEN: Ramp = ['#152a1c', '#1d3a26', '#264d32', '#2f6040', '#3b7650', '#538c64', '#74a882'];
/** dark green gloss dado paint */
export const DADO: Ramp = ['#14281e', '#1b3426', '#22412f', '#2b5039', '#356046', '#437254'];
export const STEEL: Ramp = ['#26282f', '#373a44', '#4d525c', '#666d77', '#848c96', '#a8afb7', '#d0d5da'];
export const IRON: Ramp = ['#141318', '#1e1c23', '#29262f', '#35323c', '#433f4a', '#544f5c'];
export const YELLOW: Ramp = ['#6a4410', '#966614', '#c48c1a', '#e4ae22', '#f4c834', '#fbe070'];
export const HAZ_BLACK = '#25212a';
export const RED: Ramp = ['#4e1414', '#741c1c', '#a12222', '#c43028', '#dc4a3a', '#ee7458'];
export const ORANGE: Ramp = ['#57230c', '#813611', '#ab4c17', '#d26822', '#ea8730', '#f6a85a', '#fac688'];
export const BLUE: Ramp = ['#14223e', '#1c3260', '#264a86', '#2f5eaa', '#4a78c8', '#7095dc'];
export const CREAM: Ramp = ['#79736a', '#999385', '#b7b09e', '#cec8b4', '#e1dbc7', '#efebdb'];
export const SLATE: Ramp = ['#22232e', '#2a2c38', '#323540', '#3c3e4a', '#464955', '#535762', '#686d7e'];
export const GLASS: Ramp = ['#22303a', '#2f404a', '#41555e', '#566c74', '#6e868c', '#8ea5a8', '#b4c8c8'];
export const SHEET: Ramp = ['#3b3d42', '#525559', '#696d71', '#83878a', '#9da1a2', '#b9bdba'];
export const TIMBER: Ramp = ['#463120', '#62472b', '#816039', '#9f7a49', '#bb945d', '#d4af7b'];
export const OLDWOOD: Ramp = ['#3a332d', '#4e463e', '#655c51', '#7d7366', '#968b7c', '#b0a594'];
export const RUST: Ramp = ['#381910', '#572915', '#773a1b', '#965025', '#b46a33', '#cc894b'];
export const CONC: Ramp = ['#5e5850', '#71695f', '#857c70', '#978d80', '#a69b8c', '#b4a998', '#c6bba8'];
export const STONE: Ramp = ['#5e5040', '#76664f', '#937a62', '#a08c77', '#b39f8a', '#cebda8'];
export const WEED: Ramp = ['#232e0a', '#344212', '#474f1d', '#5d6c22', '#76882c', '#94a23c', '#b3bc72'];
export const BIRCHLEAF: Ramp = ['#26360e', '#354a14', '#47621c', '#5c7c24', '#76962e', '#a1ac3d', '#c4cc78'];
export const BUDDLEIA: Ramp = ['#4a2560', '#653379', '#844896', '#a266b0', '#bf8ccb', '#d9b4e0'];
export const SOOT = '#2b2428';

/** Ramp around a colour (for liveries and per-instance paint). */
export function rampOf(base: string): Ramp {
  const n = parseInt(base.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (k: number, warm: number) => {
    const c = (v: number, w: number) => Math.max(0, Math.min(255, Math.round(v * k + w)));
    return '#' + [c(r, warm * 10), c(g, warm * 6), c(b, -warm * 4 + (k < 1 ? (1 - k) * 18 : 0))].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  return [f(0.42, -1), f(0.58, -0.6), f(0.76, -0.2), f(1, 0), f(1.14, 0.6), f(1.28, 1.1)];
}

const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

// ── brick ───────────────────────────────────────────────────
/**
 * The brick bond as a tile of ramp offsets (one per face pixel), solved once per
 * course height: big facades then cost a table lookup per pixel. NaN marks mortar.
 * 280 × 200 px holds a whole number of bond repeats (14 px, 4 courses), and is
 * wide enough that nobody spots the same brick twice.
 */
const BRICK_TW = 280;
const bondCache = new Map<number, Float32Array>();
function bondTile(ch: number): Float32Array {
  let t = bondCache.get(ch);
  if (t) return t;
  const th = ch * 40;
  t = new Float32Array(BRICK_TW * th);
  for (let v = 0; v < th; v++)
    for (let u = 0; u < BRICK_TW; u++) {
      const row = Math.floor(v / ch);
      const fv = v - row * ch;
      const header = row & 1;
      const bw = header ? 7 : 14;
      const off = header ? (row & 2 ? 3.5 : 0) : row & 2 ? 7 : 0;
      const col = Math.floor((u + off) / bw);
      const fu = u + off - col * bw;
      if (fv < 1 || fu < 1) {
        t[v * BRICK_TW + u] = NaN;
        continue;
      }
      let i = (hash(col, row, 51) - 0.5) * 1.6;
      if (header && hash(col, row, 52) < 0.3) i -= 1; // burnt header ends
      if (fv > ch - 1.6) i += 0.5;
      if (hash(u, v, 53) < 0.06) i -= 0.8;
      if (hash(col, row, 54) < 0.03 && fu < 4) i -= 1.6; // spalled face
      t[v * BRICK_TW + u] = i;
    }
  bondCache.set(ch, t);
  return t;
}

/**
 * Mill brick in English bond (a course of stretchers, a course of headers),
 * colour per brick, burnt headers, soot washing down from the top, a few
 * spalled bricks, mortar raked back a little darker on the shaded side.
 * `soot` 0..1, `course` px per course (mortar included).
 */
export const brick =
  (r: Ramp = BRICK, o: { soot?: number; course?: number; mortar?: string; damp?: number } = {}): Mat =>
  (light, w, h) => {
    // soot washes down in columns: one noise sample per face column, not per pixel
    const soot = o.soot ?? 0;
    const cols = soot > 0 ? new Float32Array(Math.ceil(w) + 2) : null;
    if (cols) for (let i = 0; i < cols.length; i++) cols[i] = noise2(i * 0.06, 0.5, 55) * soot * 1.6;
    const ch = o.course ?? 5;
    const tile = bondTile(ch);
    const th = ch * 40;
    const b0 = base(light, r.length);
    const mortar = light === 0 ? '#7a6a58' : light === 2 ? '#c8b8a0' : (o.mortar ?? '#b8a68e');
    const damp = o.damp ?? 0;
    return (u: number, v: number, x: number, y: number) => {
      const ui = Math.floor(u);
      const vi = Math.floor(v);
      const d = tile[(vi % th) * BRICK_TW + (ui % BRICK_TW)];
      if (d !== d) return mortar;
      let i = b0 + d;
      if (cols) {
        const s = cols[ui < cols.length ? ui : cols.length - 1] - (1 - Math.min(1, (h - v) / (h * 0.7 + 1)));
        if (s > 0.25 && bayer(x, y) < s) i -= 1.2;
      }
      if (damp > 0 && v < damp && bayer(x, y) * damp > v) i -= 1;
      return at(r, i);
    };
  };

/** Brick in section (the cut top of a wall): alternating headers seen end-on. */
export const brickCut =
  (r: Ramp = BRICK): Mat =>
  () =>
  (u, v, x, y) => {
    const row = Math.floor(v / 4);
    const off = row & 1 ? 4 : 0;
    const col = Math.floor((u + off) / 8);
    if (v % 4 < 1 || (u + off) % 8 < 1) return '#8e7e6c';
    return at(r, 3.4 + (hash(col, row, 57) - 0.5) * 1.6 - (hash(x, y, 58) < 0.06 ? 1 : 0));
  };

// ── roofs & cladding ────────────────────────────────────────
/**
 * Welsh slates in courses that read from afar: a 2 px shadow under each course's lip,
 * a lit lip, slates of varied shade (a few much lighter or darker), mossy patches,
 * lichen dots, a few slipped slates.
 */
export const slate =
  (r: Ramp = SLATE, lichen = 0.05): Mat =>
  (light) =>
  (u, v, x, y) => {
    const rh = 8;
    const sw = 13;
    const row = Math.floor(v / rh);
    const fv = v - row * rh;
    const off = row & 1 ? sw / 2 : 0;
    const col = Math.floor((u + off) / sw);
    const fu = u + off - col * sw;
    const hv = hash(col, row, 61);
    let i = (light === 0 ? 2.5 : light === 2 ? 4 : 3.3) + (hv - 0.5) * 1.6 + (hv > 0.93 ? 1.2 : hv < 0.06 ? -1 : 0);
    if (fv < 2) return at(r, i - 2.4);
    if (fv < 3) i += 1.1;
    if (fu < 1) i -= 1.2;
    if (hash(col, row, 62) < 0.03) i -= 1.6; // a slipped slate
    const m = noise2(u * 0.03, v * 0.05, 66);
    if (m > 0.76 && bayer(x, y) < (m - 0.76) * 4) return hash(x, y, 67) < 0.5 ? '#3e4630' : '#545c3a';
    if (hash(x, y, 63) < lichen && noise2(u * 0.05, v * 0.08, 64) > 0.55) return hash(x, y, 65) < 0.5 ? '#8a8a5a' : '#9a9a6a';
    return at(r, i);
  };

/** Corrugated sheet: ribs along v, rust bleeding from the fixings, a lighter crest per rib. */
export const corrugated =
  (r: Ramp = SHEET, rust = 0.25, pitch = 5): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const f = (u % pitch) / pitch;
    let i = base(light, r.length) + (f < 0.35 ? 1 : f > 0.75 ? -1 : 0);
    const sheet = Math.floor(u / (pitch * 9));
    i += (hash(sheet, 1, 71) - 0.5) * 0.8;
    if (rust > 0) {
      const streak = noise2(u * 0.2, v * 0.02, 72);
      if (streak > 1 - rust * 0.6 && bayer(x, y) < (streak - 1 + rust * 0.6) * 4) return at(RUST, (light ? 3 : 2) + (f < 0.35 ? 1 : 0));
    }
    if (Math.abs(v - h + 3) < 0.6 && u % (pitch * 3) < 1.4) return at(IRON, 2);
    if (hash(x, y, 73) < 0.03) i -= 1;
    return at(r, i);
  };

/** Riveted steel plate: plates with a seam every `pw`×`ph` px, a row of rivets along each seam. */
export const riveted =
  (r: Ramp, pw = 30, ph = 22, grime = 0.2): Mat =>
  (light) =>
  (u, v, x, y) => {
    const n = r.length;
    let i = base(light, n);
    const cu = Math.floor(u / pw);
    const cv = Math.floor(v / ph);
    const fu = u - cu * pw;
    const fv = v - cv * ph;
    i += (hash(cu, cv, 81) - 0.5) * 0.5;
    if (fu < 1 || fv < 1) return at(r, i - 1.4);
    if (fv < 2 && light) i += 0.7;
    // rivet heads: a lit dot and its shadow below
    const ru = fu % 5;
    if ((fv > 2 && fv < 4 && ru > 2 && ru < 4) || (fu > 2 && fu < 4 && fv % 5 > 2 && fv % 5 < 4)) return at(r, i + 1.2);
    if ((fv >= 4 && fv < 5 && ru > 2 && ru < 4) || (fu >= 4 && fu < 5 && fv % 5 > 2 && fv % 5 < 4)) return at(r, i - 1);
    if (grime > 0 && bayer(x, y) > 0.5 && noise2(u * 0.08, v * 0.1, 82) < grime * 0.8) i -= 0.8;
    if (hash(x, y, 83) < 0.025) i -= 0.7;
    return at(r, i);
  };

/** Enamel paint on steel with worn edges and grime toward the foot. */
export const enamel =
  (r: Ramp, wear = 0.3): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if (v > h - 1.5) i += 1;
    if (v < 1.5) i -= 1;
    if (v < 6 && bayer(x, y) * 6 > v + 2) i -= 0.7;
    if (wear > 0 && hash(x, y, 86) < 0.5 && noise2(u * 0.15, v * 0.15, 85) > 1 - wear * 0.35) return at(STEEL, light ? 4 : 3);
    if (hash(x, y, 87) < 0.02) i -= 0.7;
    return at(r, i);
  };

/** Diagonal hazard stripes (yellow / black) on a face. */
export const hazard =
  (w = 8, worn = 0.15): Mat =>
  (light) =>
  (u, v, x, y) => {
    const s = Math.floor((u + v) / w) & 1;
    if (worn > 0 && hash(x >> 1, y >> 1, 88) < worn * 0.4) return at(STEEL, light ? 3 : 2);
    return s ? HAZ_BLACK : at(YELLOW, light === 2 ? 4 : light ? 4 : 2.6);
  };

/** Factory glazing: small panes in steel bars, panes of varied grime, a few broken or boarded. */
export const glazing =
  (o: { pw?: number; ph?: number; seed?: number; dark?: boolean; bar?: string; sky?: boolean } = {}): Mat =>
  (light) =>
  (u, v, x, y) => {
    const pw = o.pw ?? 9;
    const ph = o.ph ?? 8;
    const cu = Math.floor(u / pw);
    const cv = Math.floor(v / ph);
    const fu = u - cu * pw;
    const fv = v - cv * ph;
    const s = o.seed ?? 0;
    if (fu < 1.4 || fv < 1.4) return o.bar ?? (light ? '#3a3d44' : '#2a2c32');
    const h = hash(cu, cv, 91 + s);
    if (h < 0.035) return '#141418'; // broken pane: dark hole
    if (h > 0.965) return at(OLDWOOD, light ? 3 : 2); // boarded up
    let i = (o.dark ? 1.4 : o.sky ? 4.4 - v / 90 : 2.4) + (light ? 0.8 : 0) + (hash(cu, cv, 92 + s) - 0.5) * 1.4;
    const d = (u * 0.8 + v) % 34;
    if (d > 4 && d < 9) i += 1.6;
    if (fv < 3 && hash(cu, cv, 93 + s) < 0.5) i -= 0.6;
    if (hash(x, y, 94) < 0.04) i += 1;
    return at(GLASS, i);
  };

/** Weathered timber planks along u (pallets, crates, fencing). */
export const planks =
  (r: Ramp = TIMBER, bh = 6): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / bh);
    const fv = v - row * bh;
    let i = base(light, r.length) + (hash(row, 3, 95) - 0.5) * 1.2;
    if (fv < 1) return at(r, i - 2);
    if (fv > bh - 1.5) i += 0.6;
    if (noise2(u * 0.08 + row * 7, fv * 0.6, 96) > 0.66) i -= 0.8;
    if (hash(x, y, 97) < 0.03) i -= 1;
    return at(r, i);
  };

/** Precast concrete or render: speckle, a few stains, a darker foot. */
export const render =
  (r: Ramp = CONC): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    const sp = hash(x, y, 98);
    if (sp < 0.06) i -= 1;
    else if (sp > 0.97) i += 1;
    if (noise2(u * 0.04, v * 0.06, 99) > 0.64 && bayer(x, y) > 0.45) i -= 1;
    if (v < 8 && bayer(x, y) * 8 > v) i -= 1;
    void h;
    return at(r, i);
  };

/** Solid colour texture (FaceTex) helper. */
export const flat =
  (col: string): FaceTex =>
  () =>
    col;

/** The visible side plane of a prop: a = a1 for rot 0 (shaded), a = a0 for rot 1 (lit). */
export const visA = (p: PropPainter, a0: number, a1: number) => (p.rot === 0 ? a1 : a0);

/** Screen bounds of a set of foliage masses (for a bounded layer). */
export function massRect(ms: Mass[], pad = 14): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of ms) {
    x0 = Math.min(x0, m.x - m.rx);
    y0 = Math.min(y0, m.y - m.ry);
    x1 = Math.max(x1, m.x + m.rx);
    y1 = Math.max(y1, m.y + m.ry);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

type V3 = [number, number, number];
/**
 * A textured parallelogram from prop-local 3D points (origin, U edge, V edge), cut
 * into `n` strips along U. texPara walks the whole screen bounding box of a face,
 * and long iso faces fill only a fifth of theirs; strips keep the walk tight.
 * The texture is solved once for the whole face, so patterns run on seamlessly.
 */
export function face3(p: PropPainter, O: V3, U: V3, V: V3, mat: Mat | FaceTex, light: 0 | 1 | 2, n = 1) {
  const o = p.P(O[0], O[1], O[2]);
  const a = p.P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
  const b = p.P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
  const us: [number, number] = [a[0] - o[0], a[1] - o[1]];
  const vs: [number, number] = [b[0] - o[0], b[1] - o[1]];
  const lu = Math.hypot(us[0], us[1]);
  const lv = Math.hypot(vs[0], vs[1]);
  const probe = (mat as (l: number, w: number, h: number) => unknown)(light, lu, lv);
  const tex = typeof probe === 'function' ? (probe as FaceTex) : (mat as FaceTex);
  const k = Math.max(1, Math.round(n));
  for (let i = 0; i < k; i++) {
    const off = (lu * i) / k;
    const oi: [number, number] = [o[0] + (us[0] * i) / k, o[1] + (us[1] * i) / k];
    texPara(p.c, oi, [us[0] / k, us[1] / k], vs, k === 1 ? tex : (u, v, x, y) => tex(u + off, v, x, y));
  }
}

/** A long textured rectangle on a vertical plane at b (front, along a) or a (side, along b), in strips of ~2 tiles. */
export function frontLong(p: PropPainter, b: number, a0: number, a1: number, z0: number, z1: number, mat: Mat | FaceTex, light: 0 | 1 | 2) {
  face3(p, [a0, b, z0], [a1 - a0, 0, 0], [0, 0, z1 - z0], mat, light, Math.ceil((a1 - a0) / 2));
}
export function sideLong(p: PropPainter, a: number, b0: number, b1: number, z0: number, z1: number, mat: Mat | FaceTex, light: 0 | 1 | 2) {
  face3(p, [a, b0, z0], [0, b1 - b0, 0], [0, 0, z1 - z0], mat, light, Math.ceil((b1 - b0) / 2));
}

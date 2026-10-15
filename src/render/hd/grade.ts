// A world's colour grade, applied to its painted scene (ground and prop
// sprites) when it is built, before the half-resolution copies are made.
// People and animals are drawn at run time and keep their own colours.
//
// Pixels are canvas-order Uint32 (0xAABBGGRR). Pixel art has few distinct
// colours, so each one is graded once and looked up after that.
import type { ColorGrade } from '../../domain/world';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, l, 0];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, l, s];
}

function hslToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hh = h / 360;
  return [ch(hh + 1 / 3), ch(hh), ch(hh - 1 / 3)];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 outside [a, d], 1 inside [b, c], linear in between. */
const band = (x: number, a: number, b: number, c: number, d: number) => (x <= a || x >= d ? 0 : x < b ? (x - a) / (b - a) : x > c ? (d - x) / (d - c) : 1);

/** One colour through the grade (r, g, b in 0..255). */
export function gradeColor(r: number, g: number, b: number, o: ColorGrade): [number, number, number] {
  let [h, l, s] = rgbToHsl(r / 255, g / 255, b / 255);
  s = clamp01(s * (o.saturation ?? 1));
  // greens: toward yellow-green, and more contrast between lit grass and shaded leaves
  const gw = s > 0.06 ? band(h, 50, 70, 150, 175) : 0;
  if (gw > 0) {
    h -= (o.greenHue ?? 0) * gw;
    l = clamp01(l + (l - 0.45) * ((o.greenContrast ?? 1) - 1) * gw);
  }
  // earth and wood (orange to yellow): lift the mid tones
  const ew = s > 0.06 ? band(h, 8, 18, 45, 58) : 0;
  if (ew > 0) l = clamp01(l + (o.earthLift ?? 0) * 4 * l * (1 - l) * ew);
  // a brightness curve: lightness 0, 0.1 … 1 → these values (deeper shadows, brighter lights)
  const t = o.tone;
  if (t && t.length === 11) {
    const f = l * 10;
    const i = Math.min(9, Math.floor(f));
    l = clamp01(t[i] + (t[i + 1] - t[i]) * (f - i));
  }
  const [rr, gg, bb] = hslToRgb(((h % 360) + 360) % 360, l, s);
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}

/** Grade a pixel buffer in place; `cache` can be shared across the buffers of one scene. */
export function gradeBuffer(buf: Uint32Array, o: ColorGrade, cache: Map<number, number>) {
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    if (v >>> 24 === 0) continue;
    const key = v & 0xffffff;
    let out = cache.get(key);
    if (out === undefined) {
      const [r, g, b] = gradeColor(key & 255, (key >> 8) & 255, (key >> 16) & 255, o);
      out = (b << 16) | (g << 8) | r;
      cache.set(key, out);
    }
    buf[i] = ((v & 0xff000000) | out) >>> 0;
  }
}

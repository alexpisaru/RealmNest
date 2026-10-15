// Tiny colour helpers used by the procedural pixel art.

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const cache = new Map<string, string>();

export function mix(a: string, b: string, t: number): string {
  const key = `${a}${b}${t}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const out = toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  cache.set(key, out);
  return out;
}

/** Darken toward a cool purple rather than black — keeps shading cozy. */
export const darken = (c: string, t = 0.22) => mix(c, '#2a1f3d', t);
/** Lighten toward warm cream. */
export const lighten = (c: string, t = 0.22) => mix(c, '#fff8e8', t);

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}

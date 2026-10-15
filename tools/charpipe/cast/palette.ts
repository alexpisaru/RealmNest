// Cast factory: colours. Every asset is drawn once in canonical ramps (below); the app and the
// editor swap each canonical colour for the wearer's at runtime (an exact colour map, so pixel
// art stays pixel art). A ramp is four tones lit from the upper left: hl, base, shade, deep.

export interface Ramp {
  hl: string;
  base: string;
  shade: string;
  deep: string;
}
export const TONES = ['hl', 'base', 'shade', 'deep'] as const;

/** the fixed colours: never recoloured */
export const FIXED = {
  outline: '#1b0810',
  white: '#ffffff',
  eyeWhite: '#f4efe4',
  mouth: '#9c4436',
  lips: '#c8636a',
};

/**
 * Canonical ramps, one per recolourable material. They only have to differ from each other and
 * from the fixed colours: the art is never shown in them.
 */
export const CANON: Record<string, Ramp> = {
  skin: { hl: '#ffd6a6', base: '#f4b986', shade: '#d98d5e', deep: '#a95c43' },
  hair: { hl: '#6f4430', base: '#4a2a20', shade: '#311913', deep: '#220f0d' },
  eyes: { hl: '#56a9b5', base: '#2f7f8c', shade: '#1f5961', deep: '#163f45' },
  main: { hl: '#cfcfe0', base: '#a3a3bd', shade: '#7b7b98', deep: '#575774' },
  second: { hl: '#e2c3a3', base: '#c19a73', shade: '#97724f', deep: '#6c4f35' },
  accent: { hl: '#f2a0a0', base: '#d86a6a', shade: '#a84848', deep: '#783030' },
  metal: { hl: '#e8eaef', base: '#b9bdc8', shade: '#8a8f9e', deep: '#5d6170' },
  under: { hl: '#b8b8c0', base: '#8e8e98', shade: '#6c6c76', deep: '#4e4e58' },
};

// ── a ramp from one colour ───────────────────────────────────

const toHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const toHex = ([h, s, l]: [number, number, number]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0')).join('');
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Four tones from a base colour: lighter and a touch warmer in the light, darker, more saturated
 * and cooler in the shadow (hue shifted toward blue-violet), so shading never looks grey.
 */
export function rampOf(base: string): Ramp {
  const [h, s, l] = toHsl(base);
  const toward = (target: number, amount: number) => {
    let d = ((target - h + 540) % 360) - 180;
    return (h + d * amount + 360) % 360;
  };
  const dark = l < 0.25;
  return {
    // lighter by a share of what is left above it, so a pale colour never turns white
    hl: toHex([toward(50, 0.12), clamp(s * 0.95), Math.min(0.95, l + Math.max(0.03, (1 - l) * (dark ? 0.2 : 0.38)))]),
    base: base.toLowerCase(),
    shade: toHex([toward(250, 0.1), clamp(s * 1.05 + 0.03), clamp(l - (dark ? 0.07 : 0.13))]),
    deep: toHex([toward(260, 0.18), clamp(s * 1.1 + 0.05), clamp(l - (dark ? 0.12 : 0.25))]),
  };
}

/** skin: shadows stay warm (toward red-brown, never violet), the light toward peach */
export function skinRampOf(base: string): Ramp {
  const [h, s, l] = toHsl(base);
  const toward = (target: number, amount: number) => (h + (((target - h + 540) % 360) - 180) * amount + 360) % 360;
  return {
    hl: toHex([toward(35, 0.2), clamp(s * 0.9), Math.min(0.95, l + Math.max(0.03, (1 - l) * 0.35))]),
    base: base.toLowerCase(),
    shade: toHex([toward(12, 0.25), clamp(s * 1.05 + 0.02), clamp(l - 0.1)]),
    deep: toHex([toward(8, 0.4), clamp(s * 1.1 + 0.04), clamp(l - 0.2)]),
  };
}

/** the ramp a material takes for a colour */
export const rampFor = (material: string, base: string): Ramp => (material === 'skin' ? skinRampOf(base) : rampOf(base));

/** a skin ramp from the app's skin tones (base, shade, blush) */
export const skinRamp = (t: { base: string; shade: string }): Ramp => {
  const r = rampOf(t.base);
  return { ...r, shade: t.shade.toLowerCase() };
};

/** canonical colour → wearer's colour, for one material */
export function colourMap(material: keyof typeof CANON, ramp: Ramp): Record<string, string> {
  const c = CANON[material];
  return Object.fromEntries(TONES.map((k) => [c[k], ramp[k]]));
}

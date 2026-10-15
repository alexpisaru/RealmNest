// ─────────────────────────────────────────────────────────────
// Asset override registry — the bridge from procedural placeholders to
// hand-drawn art. Register an image for a prop type (optionally per
// variant) and the renderer uses it instead of the procedural drawer.
//
//   registerPropImage('desk', { url: deskPng, anchorX: 32, anchorY: 40 });
//   registerPropImage('container', { url: redPng, anchorX: 40, anchorY: 30 }, 'red');
//
// Anchor = pixel in the image that sits on the prop's back corner
// (world x, y of the placement) at floor level. See src/assets/README.md.
// ─────────────────────────────────────────────────────────────

export interface PropImage {
  url: string;
  anchorX: number;
  anchorY: number;
}

interface Loaded extends PropImage {
  img: HTMLImageElement;
  ready: boolean;
}

const props = new Map<string, Loaded>();
const listeners = new Set<() => void>();

export function registerPropImage(type: string, image: PropImage, variant?: string) {
  const img = new Image();
  const entry: Loaded = { ...image, img, ready: false };
  img.onload = () => {
    entry.ready = true;
    listeners.forEach((l) => l());
  };
  img.src = image.url;
  props.set(variant ? `${type}:${variant}` : type, entry);
}

export function propImage(type: string, variant?: string): Loaded | undefined {
  const e = (variant && props.get(`${type}:${variant}`)) || props.get(type);
  return e?.ready ? e : undefined;
}

/** Renderers rebuild their caches when new art finishes loading. */
export function onAssetsChanged(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Register project art. Add imports here as PNGs land in src/assets/worlds/*.
 * Example (kept commented so the beta ships with zero binary assets):
 *
 *   import desk from '../assets/worlds/office/desk.png';
 *   registerPropImage('desk', { url: desk, anchorX: 32, anchorY: 44 });
 */
export function registerProjectAssets() {}

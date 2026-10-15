// HD character factory: outlines added after animation, frame by frame.
//
// Each runtime band of each asset (a whole limb, the torso, the head…) gets rings grown around its
// own silhouette in that frame. On the figure's outer edge the rings are the reference's full
// outline (the body: 2 near-black rings and a brown halo; garments and hair, 1 px proud of the
// body: a black ring and the halo, so the outer edge is equally thick everywhere). Where a ring
// falls on the body itself (the chin over the neck, the briefs' hem over the thighs, an arm over
// the torso, a collar over the neck) only the first, 1-px dark line is drawn. Because the outline
// follows the pose, a turned limb keeps a clean edge and joints inside a band show no seam.
//
// Before outlining, the band's silhouette loses the 1-px spurs and notches that rotation leaves
// (a claw-like fringe on a turned hand), so the outline runs smooth.
//
// `suppress` keeps the ring off pixels where it would cut through one continuous piece: the
// body's hips over its thighs, the trousers' hips over the trouser legs, a long mane's crown over the mane behind, the near arm's
// shoulder cap over the shoulder.
import { blank, hex, idx, type Img } from '../img';

/** removes 1-px spurs and fills 1-px notches in a frame's silhouette (colours from neighbours) */
export function cleanSilhouette(im: Img, passes = 2): Img {
  const { w, h } = im;
  let cur = im;
  for (let pass = 0; pass < passes; pass++) {
    const out = { w, h, d: cur.d.slice() };
    const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : cur.d[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n4 = [a(x + 1, y), a(x - 1, y), a(x, y + 1), a(x, y - 1)].filter(Boolean).length;
        const i = (y * w + x) * 4;
        if (a(x, y) && n4 <= 1) out.d[i + 3] = 0;
        else if (!a(x, y) && n4 >= 3) {
          // the most common opaque neighbour's colour
          const counts = new Map<number, number>();
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (!a(nx, ny)) continue;
            const j = (ny * w + nx) * 4;
            const c = ((cur.d[j] << 16) | (cur.d[j + 1] << 8) | cur.d[j + 2]) >>> 0;
            counts.set(c, (counts.get(c) ?? 0) + 1);
          }
          const best = [...counts.entries()].sort((p, q) => q[1] - p[1])[0][0];
          out.d.set([best >> 16, (best >> 8) & 255, best & 255, 255], i);
        }
      }
    cur = out;
  }
  return cur;
}

/**
 * Rings around `im`'s silhouette. `thin`: pixels where only the first ring is drawn (the body
 * underneath). `suppress`: pixels where no ring is drawn at all.
 */
export function outlineFrame(im: Img, colors: string[], suppress: Img[] = [], thin: Img[] = [], exteriorOnly = false): Img {
  const { w, h } = im;
  const cur = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cur[i] = im.d[i * 4 + 3] ? 1 : 0;
  const out = blank(w, h);
  // exteriorOnly: no rings inside enclosed holes (a pair of glasses keeps its lenses clear)
  const outside = new Uint8Array(w * h);
  if (exteriorOnly) {
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (outside[i] || cur[i]) continue;
      outside[i] = 1;
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < w * (h - 1)) stack.push(i + w);
    }
  }
  const on = (list: Img[], i: number) => list.some((s) => s.d[i * 4 + 3]) || (exteriorOnly && !outside[i]);
  colors.forEach((color, k) => {
    const c = hex(color);
    const ring: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i]) continue;
        if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) ring.push(i);
      }
    for (const i of ring) {
      cur[i] = 1;
      if (on(suppress, i) || (k > 0 && on(thin, i))) continue;
      const o = i * 4;
      out.d[o] = c >>> 24;
      out.d[o + 1] = (c >>> 16) & 255;
      out.d[o + 2] = (c >>> 8) & 255;
      out.d[o + 3] = 255;
    }
  });
  // the art over its rings
  for (let i = 0; i < w * h; i++)
    if (im.d[i * 4 + 3]) {
      const o = idx(im, i % w, Math.floor(i / w));
      out.d.set(im.d.subarray(o, o + 4), o);
    }
  return out;
}

/** which bands of an asset its ring must not cross (same continuous piece), by asset slot */
export const MERGE: Record<string, Record<string, string[]>> = {
  // skin to skin: the hips run into the thighs with no line (the briefs carry their own hem)
  body: { torso: ['legL', 'legR'] },
  bottom: { torso: ['legL', 'legR'] },
  hair: { head: ['back'] },
};
/** ring colours for an asset: the body gets the full outline, everything else one ring less */
export const ringsFor = (slot: string, outline: string[]) => (slot === 'body' ? outline : outline.slice(1));

/** a frame keeping only rows ≤ y (for the shoulder cap: the arm's ring stays off the shoulder) */
export function rowsUpTo(im: Img, y: number): Img {
  const out = { w: im.w, h: im.h, d: im.d.slice() };
  for (let yy = y + 1; yy < im.h; yy++) out.d.fill(0, yy * im.w * 4, (yy + 1) * im.w * 4);
  return out;
}

/**
 * Outlines every band frame of every asset the same way, given all fills of a frame set:
 *   fills[asset][band] = the band's fill image (one frame); body = the 'body' asset.
 * Returns the outlined images in the same shape.
 */
export function outlineAll(fills: Record<string, Record<string, Img>>, slotOf: (a: string) => string, outline: string[], shoulderY: number): Record<string, Record<string, Img>> {
  const body = fills.body ?? {};
  const out: Record<string, Record<string, Img>> = {};
  for (const [asset, bands] of Object.entries(fills)) {
    out[asset] = {};
    const slot = slotOf(asset);
    for (const [band, im] of Object.entries(bands)) {
      const clean = cleanSilhouette(im);
      const suppress = (MERGE[slot]?.[band] ?? []).map((b) => bands[b]).filter(Boolean);
      // the near arm's shoulder cap blends into the shoulder (no seam across it), as in the reference
      if (asset === 'body' && band === 'armR' && body.torso) suppress.push(rowsUpTo(body.torso, shoulderY));
      // the body underneath: the body's own other bands, or for a garment every body band
      const thin = Object.entries(body)
        .filter(([b]) => asset !== 'body' || b !== band)
        .map(([, f]) => f);
      out[asset][band] = outlineFrame(clean, ringsFor(slot, outline), suppress, thin);
    }
  }
  return out;
}

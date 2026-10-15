// Cast factory, dev: assets drawn straight into images (ImgPen, no PhotoCraft), composited at
// rest with per-band outlines, for quick looks while authoring.
import { blank, blit, type Img } from '../img';
import { outlineFrame } from '../hd/outline';
import { BAND_ORDER, BANDS, PARTS, type BodyGeometry, type Part } from './body';
import type { Piece } from './draw';
import { FIXED } from './palette';
import { ALL_ASSETS } from './assets';
import { EXTERIOR_ONLY, outlined, type Slot } from './catalog';

const slotOf = (asset: string): Slot => (asset === 'body' ? 'body' : ALL_ASSETS.find((a) => a.id === asset)?.slot ?? 'top');
import { ImgPen } from './pen';

/** each asset's part images, drawn from its pieces */
export function partImages(pieces: Piece[]): Record<string, Partial<Record<Part, Img>>> {
  const out: Record<string, Partial<Record<Part, Img>>> = {};
  for (const p of pieces) {
    const a = (out[p.asset] ??= {});
    const pen = new ImgPen(a[p.part] ?? blank(80, 128));
    p.draw(pen);
    a[p.part] = pen.im;
  }
  return out;
}

/** a rest-pose figure: bands back to front, each asset's band outlined, assets in the given order */
export function compose(_g: BodyGeometry, images: Record<string, Partial<Record<Part, Img>>>, order: string[]): Img {
  const im = blank(80, 128);
  for (const band of BAND_ORDER.default)
    for (const asset of order) {
      const parts = PARTS.filter((p) => BANDS[p] === band && images[asset]?.[p]);
      if (!parts.length) continue;
      const b = blank(80, 128);
      for (const p of parts) blit(b, images[asset]![p]!, 0, 0);
      blit(im, !outlined(asset, slotOf(asset)) ? b : outlineFrame(b, [FIXED.outline], [], [], EXTERIOR_ONLY.includes(slotOf(asset))), 0, 0);
    }
  return im;
}

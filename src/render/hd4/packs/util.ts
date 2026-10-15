// Small drawing helpers shared by the world packs (primitives only — no designs).
import { tbox, type Mat } from '../../hd/kit';
import type { PropPainter } from '../../iso';
import { contactShadow, layer, px, type C } from '../kit4';
import { front, side, type Plane } from '../plane4';

/** Ground point of a prop (local a, b, z) rounded to whole pixels. */
export const anchor = (p: PropPainter, a = 0.5, b = 0.5, z = 0): [number, number] => {
  const [x, y] = p.P(a, b, z);
  return [Math.round(x), Math.round(y)];
};

/**
 * A textured box by local faces: `front` is the face at b0 + bd (the prop's
 * front), `side` the face at a0 + aw — whatever the prop's rotation.
 */
export function lbox(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z0: number, h: number, m: { front?: Mat; side?: Mat; top?: Mat; edge?: string }) {
  if (p.rot === 0) tbox(p, a0, b0, aw, bd, z0, h, { left: m.front, right: m.side, top: m.top, edge: m.edge });
  else tbox(p, a0, b0, aw, bd, z0, h, { left: m.side, right: m.front, top: m.top, edge: m.edge });
}

/** Same material on every face. */
export const mono = (m: Mat, edge?: string) => ({ front: m, side: m, top: m, edge });

/** The prop's front plane at depth b and its right side plane at width a. */
export const planes = (p: PropPainter, b: number, a: number): [Plane, Plane] => [front(p, b), side(p, a)];

/** A soft contact shadow under a footprint, cast to the lower right. */
export function footShadow(p: PropPainter, a0: number, b0: number, a1: number, b1: number, h: number, alpha = 0.28) {
  const [x0, y0] = p.P(a0, b0, 0);
  const [x1, y1] = p.P(a1, b1, 0);
  const [x2, y2] = p.P(a1, b0, 0);
  const [x3, y3] = p.P(a0, b1, 0);
  const cx = (x0 + x1 + x2 + x3) / 4;
  const cy = (y0 + y1 + y2 + y3) / 4;
  const rx = (Math.max(x0, x1, x2, x3) - Math.min(x0, x1, x2, x3)) / 2;
  const ry = (Math.max(y0, y1, y2, y3) - Math.min(y0, y1, y2, y3)) / 2;
  contactShadow(p.c, cx + h * 0.35 * p.k, cy + 2 * p.k, rx + h * 0.3 * p.k, ry + 1.5 * p.k, alpha);
}

/** Draw a set of shapes as one outlined layer. */
export const outlined = (c: C, draw: (l: C) => void, k = 0.62) => layer(c, draw, { outline: k });

/** A tiny pixel cluster (leaf, petal…) */
export const dab = (c: C, x: number, y: number, col: string, w = 2, h = 1) => px(c, x, y, col, w, h);

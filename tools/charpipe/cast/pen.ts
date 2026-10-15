// Cast factory: the drawing calls every piece of art uses. PhotoCraft's Painter (tools/charpipe/
// pcdraw.ts) implements them for the real build; ImgPen draws the same calls straight into an
// image, for quick previews while authoring (same rules: hard edges, lock = only on existing pixels).
import { blank, hex, type Img } from '../img';
import { Mask, type Pt } from '../hd/mask';

export interface Pen {
  poly(pts: Pt[], color: string, lock?: boolean): void;
  rect(x: number, y: number, w: number, h: number, color: string, lock?: boolean): void;
  mask(m: Mask, color: string, lock?: boolean): void;
  line(pts: Pt[], color: string): void;
  dots(pts: Pt[], color: string): void;
  eraseMask(m: Mask): void;
}

/** draws into one image (one layer); `lock` paints only where the image already has pixels */
export class ImgPen implements Pen {
  constructor(readonly im: Img = blank(80, 128)) {}
  private put(x: number, y: number, c: string, lock: boolean) {
    const { w, h, d } = this.im;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (lock && !d[i + 3]) return;
    const v = hex(c);
    d[i] = v >>> 24;
    d[i + 1] = (v >>> 16) & 255;
    d[i + 2] = (v >>> 8) & 255;
    d[i + 3] = 255;
  }
  mask(m: Mask, color: string, lock = false) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) this.put(x, y, color, lock);
  }
  poly(pts: Pt[], color: string, lock = false) {
    this.mask(Mask.poly(this.im.w, this.im.h, pts), color, lock);
  }
  rect(x: number, y: number, w: number, h: number, color: string, lock = false) {
    this.mask(Mask.rect(this.im.w, this.im.h, x, y, w, h), color, lock);
  }
  line(pts: Pt[], color: string) {
    if (pts.length === 1) return this.dots(pts, color);
    for (let i = 1; i < pts.length; i++) {
      // Bresenham, like a 1-px pencil stroke
      let [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.put(x0, y0, color, false);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  }
  dots(pts: Pt[], color: string) {
    for (const [x, y] of pts) this.put(x, y, color, false);
  }
  eraseMask(m: Mask) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) this.im.d.fill(0, (y * this.im.w + x) * 4, (y * this.im.w + x) * 4 + 4);
  }
}

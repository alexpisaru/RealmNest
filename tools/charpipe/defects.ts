// Character pipeline: pixel defects a cut-out rig leaves in rendered frames, and their fixes.
//
//   orphan  an opaque pixel with at most one opaque pixel among its 8 neighbours (a stray dot)
//   hole    a transparent region (4-connected) not touching the frame edge, at most 4 px:
//           a seam that opened between two turning parts
// A fix fills a hole pixel with its most common opaque 4-neighbour and erases an orphan.
import { alpha, px, type Img } from './img';

export interface Fix {
  x: number;
  y: number;
  /** 0xRRGGBBAA to paint, or 0 to erase */
  color: number;
  kind: 'orphan' | 'hole';
}

export function findDefects(im: Img, maxHole = 4): Fix[] {
  const fixes: Fix[] = [];
  const { w, h } = im;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!alpha(im, x, y)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && alpha(im, x + dx, y + dy)) n++;
      if (n <= 1) fixes.push({ x, y, color: 0, kind: 'orphan' });
    }
  const seen = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (alpha(im, x, y) || seen[y * w + x]) continue;
      // flood the transparent region
      const region: [number, number][] = [];
      let edge = false;
      const stack: [number, number][] = [[x, y]];
      seen[y * w + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) edge = true;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || alpha(im, nx, ny)) continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (edge || region.length > maxHole) continue;
      for (const [hx, hy] of region) {
        const count = new Map<number, number>();
        for (const [nx, ny] of [[hx + 1, hy], [hx - 1, hy], [hx, hy + 1], [hx, hy - 1]] as [number, number][]) {
          const c = px(im, nx, ny);
          if (c) count.set(c, (count.get(c) ?? 0) + 1);
        }
        const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best) fixes.push({ x: hx, y: hy, color: best[0], kind: 'hole' });
      }
    }
  return fixes;
}

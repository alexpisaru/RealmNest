// HD character factory: binary pixel masks, the shapes PhotoCraft paints.
//
// A part's fill, its shading bands and every garment are computed as masks (unions, erosions,
// shifts), then traced into exact rectilinear polygons: a hard-edged lasso fill of such a polygon
// covers exactly the mask's pixels, so PhotoCraft reproduces the mask pixel for pixel.
export type Pt = [number, number];

export class Mask {
  readonly d: Uint8Array;
  constructor(readonly w: number, readonly h: number, d?: Uint8Array) {
    this.d = d ?? new Uint8Array(w * h);
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  set(x: number, y: number, v = 1) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v;
  }
  clone() {
    return new Mask(this.w, this.h, this.d.slice());
  }
  count() {
    let n = 0;
    for (const v of this.d) n += v;
    return n;
  }
  map(f: (x: number, y: number, v: number) => number) {
    const m = new Mask(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) m.d[y * this.w + x] = f(x, y, this.get(x, y)) ? 1 : 0;
    return m;
  }
  and(o: Mask) {
    return this.map((x, y, v) => v & o.get(x, y));
  }
  or(o: Mask) {
    return this.map((x, y, v) => v | o.get(x, y));
  }
  sub(o: Mask) {
    return this.map((x, y, v) => v & (1 - o.get(x, y)));
  }
  shift(dx: number, dy: number) {
    return this.map((x, y) => this.get(x - dx, y - dy));
  }
  /** grow by r px (4-neighbour steps) */
  dilate(r = 1) {
    let m: Mask = this;
    for (let i = 0; i < r; i++) m = m.map((x, y, v) => v | m.get(x + 1, y) | m.get(x - 1, y) | m.get(x, y + 1) | m.get(x, y - 1));
    return m;
  }
  erode(r = 1) {
    let m: Mask = this;
    for (let i = 0; i < r; i++) m = m.map((x, y, v) => v & m.get(x + 1, y) & m.get(x - 1, y) & m.get(x, y + 1) & m.get(x, y - 1));
    return m;
  }
  /** keep rows y0..y1 (inclusive) */
  rows(y0: number, y1: number) {
    return this.map((_, y, v) => v && y >= y0 && y <= y1 ? 1 : 0);
  }
  cols(x0: number, x1: number) {
    return this.map((x, _, v) => v && x >= x0 && x <= x1 ? 1 : 0);
  }
  /** remove 1-px spurs and pinholes (open then close) */
  smooth() {
    return this.erode().dilate().dilate().erode().and(this.dilate());
  }
  bbox(): [number, number, number, number] | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.get(x, y)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  static poly(w: number, h: number, pts: Pt[]) {
    // even-odd scanline at pixel centres: the same rule PhotoCraft's hard lasso uses
    const m = new Mask(w, h);
    for (let y = 0; y < h; y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay <= cy !== by <= cy) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x < xs[i + 1] - 0.5; x++) m.set(x, y);
    }
    return m;
  }
  static rect(w: number, h: number, x: number, y: number, rw: number, rh: number) {
    return Mask.poly(w, h, [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]]);
  }
  static ellipse(w: number, h: number, cx: number, cy: number, rx: number, ry: number) {
    const m = new Mask(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m.set(x, y);
    return m;
  }

  /**
   * The mask's boundary as closed rectilinear rings on pixel corners: outer rings counter-
   * clockwise, holes clockwise (filling all rings even-odd reproduces the mask exactly).
   */
  rings(): Pt[][] {
    // directed edges with the mask on the left
    const edges = new Map<string, Pt[]>();
    const add = (a: Pt, b: Pt) => {
      const k = `${a[0]},${a[1]}`;
      (edges.get(k) ?? edges.set(k, []).get(k)!).push(b);
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!this.get(x, y)) continue;
        if (!this.get(x, y - 1)) add([x + 1, y], [x, y]);
        if (!this.get(x, y + 1)) add([x, y + 1], [x + 1, y + 1]);
        if (!this.get(x - 1, y)) add([x, y], [x, y + 1]);
        if (!this.get(x + 1, y)) add([x + 1, y + 1], [x + 1, y]);
      }
    const rings: Pt[][] = [];
    for (;;) {
      const start = edges.keys().next().value as string | undefined;
      if (!start) break;
      const ring: Pt[] = [];
      let cur = start.split(',').map(Number) as Pt;
      let prevDir: Pt = [0, 0];
      for (;;) {
        const k = `${cur[0]},${cur[1]}`;
        const outs = edges.get(k);
        if (!outs?.length) break;
        // at a pinch point prefer turning left, so rings don't cross
        outs.sort((a, b) => turn(prevDir, [a[0] - cur[0], a[1] - cur[1]]) - turn(prevDir, [b[0] - cur[0], b[1] - cur[1]]));
        const next = outs.shift()!;
        if (!outs.length) edges.delete(k);
        const dir: Pt = [next[0] - cur[0], next[1] - cur[1]];
        if (dir[0] !== prevDir[0] || dir[1] !== prevDir[1]) ring.push(cur);
        prevDir = dir;
        cur = next;
        if (`${cur[0]},${cur[1]}` === start) break;
      }
      if (ring.length >= 4) rings.push(ring);
    }
    return rings;
  }
}

function turn(a: Pt, b: Pt) {
  // left turn first (cross > 0 in y-down = clockwise… rank: left, straight, right)
  const c = a[0] * b[1] - a[1] * b[0];
  return c < 0 ? 0 : c === 0 ? 1 : 2;
}

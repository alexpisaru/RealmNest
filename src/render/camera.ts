/** Pan / zoom camera over a world frame. Zoom = device pixels per art pixel. */
export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const LEVELS = [0.25, 0.375, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8];

export class Camera {
  zoom = 3;
  cx = 0;
  cy = 0;

  /** Fit the bounds into the view (largest crisp level that fits). */
  fit(b: Bounds, vw: number, vh: number, preferred = 0) {
    const raw = Math.min(vw / (b.x1 - b.x0), vh / (b.y1 - b.y0));
    const fitLevel = [...LEVELS].reverse().find((l) => l <= raw) ?? LEVELS[0];
    this.zoom = preferred > 0 ? preferred : fitLevel;
    this.cx = (b.x0 + b.x1) / 2;
    this.cy = (b.y0 + b.y1) / 2;
  }

  /** Step zoom in/out keeping the point under (sx, sy) fixed. */
  zoomAt(dir: 1 | -1, sx: number, sy: number, vw: number, vh: number) {
    const i = LEVELS.indexOf(this.zoom);
    const idx = i < 0 ? LEVELS.findIndex((l) => l >= this.zoom) : i;
    const next = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx + dir))];
    if (next === this.zoom) return;
    const wx = this.cx + (sx - vw / 2) / this.zoom;
    const wy = this.cy + (sy - vh / 2) / this.zoom;
    this.zoom = next;
    this.cx = wx - (sx - vw / 2) / this.zoom;
    this.cy = wy - (sy - vh / 2) / this.zoom;
  }

  pan(dx: number, dy: number) {
    this.cx -= dx / this.zoom;
    this.cy -= dy / this.zoom;
  }

  /** Smallest zoom level: the whole scene fits in the visible part of the view (zooming out further shows nothing new). */
  minZoom(scene: Bounds, vw: number, vh: number, insetRight = 0) {
    const all = Math.min((vw - insetRight) / (scene.x1 - scene.x0), vh / (scene.y1 - scene.y0));
    return [...LEVELS].reverse().find((l) => l <= all) ?? LEVELS[0];
  }

  /**
   * Keep the visible area inside the painted scene. `insetRight` = device px
   * covered by a panel on the right: that strip doesn't count as visible, so
   * the pan range is symmetric around the playable area. Zoomed out further
   * than the scene on an axis, the scene is centred on it.
   */
  clamp(scene: Bounds, vw: number, vh: number, insetRight = 0) {
    const min = this.minZoom(scene, vw, vh, insetRight);
    if (this.zoom < min) this.zoom = min;
    const left = vw / 2 / this.zoom;
    const right = (vw / 2 - insetRight) / this.zoom;
    const hh = vh / 2 / this.zoom;
    const lo = scene.x0 + left;
    const hi = scene.x1 - right;
    this.cx = lo <= hi ? Math.max(lo, Math.min(hi, this.cx)) : (scene.x0 + scene.x1) / 2 - (right - left) / 2;
    this.cy = scene.y0 + hh <= scene.y1 - hh ? Math.max(scene.y0 + hh, Math.min(scene.y1 - hh, this.cy)) : (scene.y0 + scene.y1) / 2;
  }

  toFrame(sx: number, sy: number, vw: number, vh: number) {
    const tx = Math.round(vw / 2 - this.cx * this.zoom);
    const ty = Math.round(vh / 2 - this.cy * this.zoom);
    return { x: (sx - tx) / this.zoom, y: (sy - ty) / this.zoom };
  }
}

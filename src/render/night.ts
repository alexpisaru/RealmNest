// Night: the scene darkened and turned blue through a light map, with warm
// pools of light round lamps, lit windows and the glow of indoor rooms. Drawn
// in screen space over the finished frame, so a baked picture and a painted
// scene look the same, and people and animals are lit like everything else.
//
// Props say where they give light (PropArt.lights, in their own local
// coordinates); lamp types that don't are lit at the top from LAMPS below.
import { PROP_META } from '../data/props';
import type { WorldDef } from '../domain/world';
import { type Painter, PropPainter, type V2 } from './iso';
import type { PropArt, PropLight } from './props';

/** One light, in frame px: the light itself, the ground under it, its radius on the ground. */
export interface Light {
  x: number;
  y: number;
  gy: number;
  r: number;
  color: [number, number, number];
  kind: 'lamp' | 'window';
  seed: number;
}

/** Lamps of the worlds' packs that don't declare their lights: lit near their top. */
const LAMPS: Record<string, { r?: number; at?: number; color?: string }> = {
  lanternPost: {},
  streetLamp: {},
  lampione: {},
  lamp: { r: 2 },
  fac_lamp: {},
  lab_lamp: {},
  std_floorLamp: { r: 2 },
  std_lamp: { r: 2 },
  std_ringLight: { r: 1.6, color: '#fff4e0' },
  rob_light: {},
  dc_lamp: {},
  res_lamp: {},
  prt_lamp: {},
  prt_lighthouse: { r: 7, at: 0.95, color: '#fff2c8' },
  spc_beacon: { r: 1.6, color: '#ff8f7a' },
};

/** Full night: what the light map multiplies the unlit scene by. */
const AMBIENT: [number, number, number] = [78, 92, 150];
const WARM = '#ffd49a';

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)})`;

/** Every light a world's props give, in frame px. */
export function worldLights(w: WorldDef, painter: Painter, artFor: (type: string) => PropArt | undefined): Light[] {
  const k = painter.k;
  const out: Light[] = [];
  [...w.props, ...w.scene.props].forEach((p, i) => {
    const art = artFor(p.type);
    let ls: PropLight[] | undefined = art?.lights?.({ w: p.w, d: p.d, variant: p.variant, color: p.color, th: w.theme, t: 0, seed: i + 1 });
    const lamp = LAMPS[p.type];
    if (!ls && lamp) ls = [{ a: p.w / 2, b: p.d / 2, z: (PROP_META[p.type]?.h ?? 40) * (lamp.at ?? 0.9), r: lamp.r ?? 3, color: lamp.color, kind: 'lamp' }];
    if (!ls) return;
    const pp = new PropPainter(painter, p.x, p.y, p.w, p.d, p.rot);
    for (const l of ls) {
      const [x, y] = pp.P(l.a, l.b, l.z);
      const [, gy] = pp.P(l.a, l.b, 0);
      out.push({ x, y, gy, r: l.r * 24 * k, color: rgb(l.color ?? WARM), kind: l.kind ?? 'lamp', seed: i * 7 + out.length });
    }
  });
  return out;
}

/** An indoor room's outline (floor and back walls), in frame px; it glows warm at night. */
export function roomOutline(w: WorldDef, painter: Painter, wallH: number): V2[] | null {
  if (w.environment.backdrop !== 'walls') return null;
  const P = (x: number, y: number, z: number) => painter.P(x, y, z);
  return [P(0, w.rows, 0), P(0, w.rows, wallH), P(0, 0, wallH), P(w.cols, 0, wallH), P(w.cols, 0, 0), P(w.cols, w.rows, 0)];
}

/** Eases between day (0) and night (1) over about a second and a half. */
export class NightLevel {
  level = 0;
  private last = 0;
  step(night: boolean, now: number) {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1;
    this.last = now;
    const target = night ? 1 : 0;
    const d = target - this.level;
    this.level += Math.sign(d) * Math.min(Math.abs(d), dt / 1.4);
    return this.level;
  }
}

/**
 * The lights of a scene, painted once in frame space (they never move): a
 * quarter-resolution map of pools, halos and lit rooms, and a half-resolution
 * map of the bloom on the lights themselves, both at full night.
 */
export class NightMap {
  static readonly LS = 0.25;
  static readonly BS = 0.5;
  readonly light: HTMLCanvasElement;
  readonly bloom: HTMLCanvasElement;
  constructor(fw: number, fh: number, lights: Light[], room: V2[] | null) {
    const mk = (s: number) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(fw * s));
      c.height = Math.max(1, Math.ceil(fh * s));
      return c;
    };
    this.light = mk(NightMap.LS);
    this.bloom = mk(NightMap.BS);
    const S = NightMap.LS;
    const g = this.light.getContext('2d')!;
    g.globalCompositeOperation = 'lighter';
    if (room) {
      // the room is lit from inside: a warm, soft-edged glow over floor and walls
      g.fillStyle = rgba([255, 190, 130], 0.5);
      g.shadowColor = rgba([255, 190, 130], 0.5);
      g.shadowBlur = 40 * S;
      g.beginPath();
      room.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
    }
    for (const l of lights) {
      const rx = l.r * S;
      const cx = l.x * S;
      // a pool of light on the ground (a flat ellipse under the light)
      g.save();
      g.translate(cx, l.gy * S);
      g.scale(1, 0.5);
      const pool = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      pool.addColorStop(0, rgba(l.color, l.kind === 'window' ? 0.55 : 0.95));
      pool.addColorStop(0.5, rgba(l.color, l.kind === 'window' ? 0.25 : 0.45));
      pool.addColorStop(1, rgba(l.color, 0));
      g.fillStyle = pool;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
      // round the light itself: the lamp, the wall round a window
      const cy = l.y * S;
      const rr = rx * (l.kind === 'window' ? 0.5 : 0.42);
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      halo.addColorStop(0, rgba(l.color, 0.9));
      halo.addColorStop(1, rgba(l.color, 0));
      g.fillStyle = halo;
      g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    // bloom: the lamps and windows themselves shine
    const B = NightMap.BS;
    const b = this.bloom.getContext('2d')!;
    b.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const x = l.x * B;
      const y = l.y * B;
      const r = (l.kind === 'window' ? 9 : 14) * (l.r / 72) * B;
      const gr = b.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(l.color, l.kind === 'window' ? 0.55 : 0.6));
      gr.addColorStop(1, rgba(l.color, 0));
      b.fillStyle = gr;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

let view: HTMLCanvasElement | null = null;

/**
 * Darken the screen to night by `k` (0..1): ambient blue light plus the
 * scene's lights (from its NightMap), multiplied over the frame, then the
 * bloom added on top. `tx`, `ty`, `zoom`: screen position of frame px 0,0 and its scale.
 */
export function drawNight(ctx: CanvasRenderingContext2D, vw: number, vh: number, tx: number, ty: number, zoom: number, map: NightMap, k: number) {
  const S = 0.5;
  const lw = Math.max(1, Math.ceil(vw * S));
  const lh = Math.max(1, Math.ceil(vh * S));
  view ??= document.createElement('canvas');
  if (view.width !== lw || view.height !== lh) {
    view.width = lw;
    view.height = lh;
  }
  // the frame rectangle on screen, in frame px
  const fx0 = -tx / zoom;
  const fy0 = -ty / zoom;
  const fw = vw / zoom;
  const fh = vh / zoom;
  const g = view.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = rgba([255 + (AMBIENT[0] - 255) * k, 255 + (AMBIENT[1] - 255) * k, 255 + (AMBIENT[2] - 255) * k].map(Math.round) as [number, number, number], 1);
  g.fillRect(0, 0, lw, lh);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = k;
  g.imageSmoothingEnabled = true;
  const L = NightMap.LS;
  g.drawImage(map.light, fx0 * L, fy0 * L, fw * L, fh * L, 0, 0, lw, lh);
  g.globalAlpha = 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // a little less colour at night, then the light map
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = rgba([128, 128, 128], 0.28 * k);
  ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(view, 0, 0, lw, lh, 0, 0, vw, vh);
  // bloom on the lights themselves
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = k;
  const B = NightMap.BS;
  ctx.drawImage(map.bloom, fx0 * B, fy0 * B, fw * B, fh * B, 0, 0, vw, vh);
  ctx.restore();
}

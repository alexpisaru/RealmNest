// ─────────────────────────────────────────────────────────────
// Ambient city life: passers-by walking routes and vehicles running along
// their lines (a tram, a monorail). Pure functions of time like the critters:
// no state, no simulation impact; they are drawn and depth-sorted with the
// people and animals.
// ─────────────────────────────────────────────────────────────
import { outfitsForWorld } from '../data/outfits';
import { HAIR_COLORS, PRESETS, SIGNATURE_COLORS } from '../data/presets';
import type { VehicleRun, WalkerRoute, WorldDef } from '../domain/world';
import type { Look, SpriteDir } from './sprites';

const hash = (a: number, b: number, s = 0) => {
  let h = Math.imul(a * 374761393 + b * 668265263 + s * 1442695041, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export interface WalkerPose {
  look: Look;
  x: number;
  y: number;
  dir: SpriteDir;
  /** offsets the walk cycle so passers-by don't step in time */
  phase: number;
}

/** Natural hair colours of the palette (no violet, pink or teal on passers-by). */
const NATURAL_HAIR = HAIR_COLORS.slice(1, 9);
const looks = new Map<string, Look>();

/** A passer-by's look: a preset's face and build, a hair colour, an outfit of the world's own collection. */
function walkerLook(w: WorldDef, n: number): Look {
  const key = `${w.id}|${n}`;
  let look = looks.get(key);
  if (!look) {
    const presets = PRESETS.filter((p) => !p.founderPreset);
    const pre = presets[Math.floor(hash(n, 1, 7) * presets.length)];
    const outfits = outfitsForWorld(w.outfitCategory);
    const outfit = outfits[Math.floor(hash(n, 2, 7) * outfits.length)];
    look = {
      profile: { ...pre.profile, hairColor: NATURAL_HAIR[Math.floor(hash(n, 3, 7) * NATURAL_HAIR.length)], hairAccent: undefined },
      outfitId: outfit.id,
      outfitVariant: outfit.variants?.[Math.floor(hash(n, 4, 7) * outfit.variants.length)]?.id,
      signature: SIGNATURE_COLORS[Math.floor(hash(n, 5, 7) * SIGNATURE_COLORS.length)],
    };
    looks.set(key, look);
  }
  return look;
}

/** The facing for a step (dx, dy) in tiles: +x is south-east on screen, +y south-west. */
function facing(dx: number, dy: number): SpriteDir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'se' : 'nw';
  return dy >= 0 ? 'sw' : 'ne';
}

/** Where every passer-by is at time t (seconds). */
export function walkerPoses(w: WorldDef, routes: WalkerRoute[] | undefined, t: number): WalkerPose[] {
  const out: WalkerPose[] = [];
  (routes ?? []).forEach((r, ri) => {
    const pts = r.loop ? [...r.path, r.path[0]] : r.path;
    const segs: { x: number; y: number; dx: number; dy: number; len: number; at: number }[] = [];
    let L = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len <= 0) continue;
      segs.push({ x: x0, y: y0, dx: (x1 - x0) / len, dy: (y1 - y0) / len, len, at: L });
      L += len;
    }
    if (!segs.length) return;
    const period = r.loop ? L : 2 * L;
    for (let i = 0; i < r.count; i++) {
      const n = ri * 37 + i;
      const v = (r.speed ?? 0.55) * (0.85 + hash(n, 9, 3) * 0.3);
      // spread along the route; on a loop some walk it the other way round
      const back = r.loop && hash(n, 10, 3) < 0.4;
      let d = (((i + hash(n, 11, 3) * 0.6) / r.count) * period + t * v) % period;
      let sign = 1;
      if (!r.loop && d > L) {
        d = 2 * L - d;
        sign = -1;
      }
      if (back) {
        d = L - d;
        sign = -1;
      }
      const s = segs.find((g) => d >= g.at && d <= g.at + g.len) ?? segs[segs.length - 1];
      const u = d - s.at;
      // keep to one side of the path, as people do
      const side = (hash(n, 12, 3) - 0.5) * 0.5;
      out.push({
        look: walkerLook(w, n),
        x: s.x + s.dx * u - s.dy * side,
        y: s.y + s.dy * u + s.dx * side,
        dir: facing(s.dx * sign, s.dy * sign),
        phase: hash(n, 13, 3) * 3,
      });
    }
  });
  return out;
}

/** smootherstep: eases in and out of every stop */
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * How far along its line a vehicle's start is at time t (tiles, 0 … length − w):
 * it runs to the far end, waits there, runs back, waits, and stops at its stops
 * on the way in both directions.
 */
export function vehicleAt(v: VehicleRun, t: number): number {
  const end = Math.max(0, v.length - v.w);
  const stops = (v.stops ?? []).filter((s) => s > 0 && s < end).sort((a, b) => a - b);
  const legs: { from: number; to: number; dur: number }[] = [];
  const run = (path: number[]) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      legs.push({ from: a, to: b, dur: Math.abs(b - a) / Math.max(0.01, v.speed) });
      // a stop in between, or the wait at the end of the line
      legs.push({ from: b, to: b, dur: i + 2 < path.length ? (v.dwell ?? 4) : (v.endWait ?? 6) });
    }
  };
  run([0, ...stops, end]);
  run([end, ...[...stops].reverse(), 0]);
  const cycle = legs.reduce((s, l) => s + l.dur, 0);
  let p = (((t + (v.phase ?? 0)) % cycle) + cycle) % cycle;
  for (const l of legs) {
    if (p <= l.dur) return l.from === l.to ? l.from : l.from + (l.to - l.from) * ease(p / l.dur);
    p -= l.dur;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Ambient life: chickens, ducks, butterflies, a cat, small birds.
// Pure functions of time (no state, no simulation impact).
// ─────────────────────────────────────────────────────────────

import type { CritterSpawn } from '../domain/world';
import { rect, OUT } from './iso';
import { vnoise } from './materials';

export interface CritterPose {
  kind: CritterSpawn['kind'];
  x: number;
  y: number;
  /** facing right on screen */
  right: boolean;
  phase: number;
  moving: boolean;
  z: number;
  seed: number;
}

export function critterPoses(spawns: CritterSpawn[], t: number, speeds: Record<string, number> = {}, flyers: Set<string> = new Set()): CritterPose[] {
  const out: CritterPose[] = [];
  spawns.forEach((s, si) => {
    for (let i = 0; i < s.count; i++) {
      const seed = si * 31 + i * 7 + 1;
      const SPEED: Partial<Record<CritterSpawn['kind'], number>> = { butterfly: 0.35, cat: 0.01, duck: 0.07, sheep: 0.02, cow: 0.012, dog: 0.05, frog: 0.002, rooster: 0.08, pigeon: 0.05 };
      const speed = speeds[s.kind] ?? SPEED[s.kind] ?? 0.1;
      const nx = vnoise(t * speed + seed * 3.1, seed, 90);
      const ny = vnoise(seed, t * speed + seed * 5.7, 91);
      const nx2 = vnoise(t * speed + 0.05 + seed * 3.1, seed, 90);
      const ny2 = vnoise(seed, t * speed + 0.05 + seed * 5.7, 91);
      const x = s.x + 0.3 + nx * (s.w - 0.6);
      const y = s.y + 0.3 + ny * (s.d - 0.6);
      const dx = (nx2 - nx) * s.w;
      const dy = (ny2 - ny) * s.d;
      const vScreen = dx - dy; // screen x direction of motion
      out.push({
        kind: s.kind,
        x,
        y,
        right: vScreen >= 0,
        moving: Math.hypot(dx, dy) > 0.004,
        phase: t * (s.kind === 'butterfly' ? 14 : 6) + seed,
        z: s.kind === 'butterfly' || flyers.has(s.kind) ? 8 + Math.sin(t * 2 + seed) * 4 : 0,
        seed,
      });
    }
  });
  return out;
}

type C = CanvasRenderingContext2D;

/** Draw at screen foot position (sx, sy). */
export function drawCritter(c: C, p: CritterPose, sx: number, sy: number) {
  const x = Math.round(sx);
  const y = Math.round(sy - p.z);
  const f = p.right ? 1 : -1;
  const px = (dx: number, dy: number, w: number, h: number, col: string) => rect(c, x + (f > 0 ? dx : -dx - w), y + dy, w, h, col);
  switch (p.kind) {
    case 'chicken': {
      c.globalAlpha = 0.25;
      rect(c, x - 3, y, 7, 1, '#1c1228');
      c.globalAlpha = 1;
      const peck = !p.moving && Math.sin(p.phase) > 0.4;
      const step = p.moving && Math.sin(p.phase * 2) > 0 ? 1 : 0;
      px(-4, -7, 7, 6, OUT);
      px(-3, -6, 5, 4, '#fbf4e4');
      px(-3, -3, 4, 1, '#e4d8c4');
      px(-4, -6, 1, 2, '#e4d8c4');
      const hx = peck ? 2 : 1;
      const hy = peck ? -4 : -8;
      px(hx, hy, 3, 3, OUT);
      px(hx, hy + 1, 2, 2, '#fbf4e4');
      px(hx, hy - 1, 2, 1, '#e2553b');
      px(hx + 2, hy + 1, 1, 1, '#f2a03d');
      px(-2 + step, -1, 1, 2, '#f2a03d');
      px(0 - step, -1, 1, 2, '#f2a03d');
      break;
    }
    case 'duck': {
      const bob = Math.round(Math.sin(p.phase * 0.5));
      px(-4, -4 + bob, 8, 4, OUT);
      px(-3, -3 + bob, 6, 2, '#f4f1ea');
      px(1, -6 + bob, 3, 3, OUT);
      px(1, -5 + bob, 2, 2, '#2f7a4c');
      px(3, -4 + bob, 1, 1, '#f2a03d');
      c.globalAlpha = 0.5;
      rect(c, x - 5, y + 1, 10, 1, '#d8eefc');
      c.globalAlpha = 1;
      break;
    }
    case 'butterfly': {
      const open = Math.sin(p.phase) > 0;
      const col = ['#f2b84b', '#ef9ac0', '#9fd3ee', '#fbf4e4'][p.seed % 4];
      rect(c, x, y - 1, 1, 2, OUT);
      if (open) {
        rect(c, x - 2, y - 2, 2, 2, col);
        rect(c, x + 1, y - 2, 2, 2, col);
      } else {
        rect(c, x - 1, y - 2, 1, 2, col);
        rect(c, x + 1, y - 2, 1, 2, col);
      }
      break;
    }
    case 'cat': {
      c.globalAlpha = 0.25;
      rect(c, x - 4, y, 9, 1, '#1c1228');
      c.globalAlpha = 1;
      const tail = Math.sin(p.phase * 0.4) > 0 ? 1 : 0;
      px(-4, -6, 8, 6, OUT);
      px(-3, -5, 6, 5, '#e8a560');
      px(-3, -2, 6, 1, '#d08a48');
      px(1, -9, 4, 4, OUT);
      px(1, -8, 3, 3, '#e8a560');
      px(1, -10, 1, 1, OUT);
      px(3, -10, 1, 1, OUT);
      px(2, -7, 1, 1, '#2b2236');
      px(-5, -3 - tail, 1, 3, '#e8a560');
      break;
    }
    case 'bird': {
      const hop = p.moving && Math.sin(p.phase * 2) > 0 ? -1 : 0;
      px(-2, -3 + hop, 4, 3, OUT);
      px(-1, -2 + hop, 3, 1, '#7a5a48');
      px(1, -4 + hop, 2, 2, '#5a4038');
      px(3, -3 + hop, 1, 1, '#f2b84b');
      break;
    }
  }
}

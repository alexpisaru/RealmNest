// HD ambient critters for 64×32 worlds: same poses as the base set,
// drawn at double detail with ramps and the warm outline.
import type { CritterPose } from '../critters';
import { ellipse, OUTL, px } from './kit';

type C = CanvasRenderingContext2D;

export function drawCritterHD(c: C, p: CritterPose, sx: number, sy: number) {
  const x = Math.round(sx);
  const y = Math.round(sy - p.z * 2);
  const f = p.right ? 1 : -1;
  // mirrored pixel helper (dx measured toward the facing side)
  const P = (dx: number, dy: number, w: number, h: number, col: string) => px(c, x + (f > 0 ? dx : -dx - w + 1), y + dy, col, w, h);
  const shadow = (rx: number) => {
    c.globalAlpha = 0.25;
    ellipse(c, x + 2, y + 1, rx, rx * 0.35, '#2a1a2a');
    c.globalAlpha = 1;
  };
  switch (p.kind) {
    case 'chicken': {
      shadow(8);
      const peck = !p.moving && Math.sin(p.phase) > 0.4;
      const step = p.moving && Math.sin(p.phase * 2) > 0 ? 1 : 0;
      // legs
      P(-2 + step, -3, 1, 3, '#e08a2a');
      P(1 - step, -3, 1, 3, '#e08a2a');
      // body
      P(-7, -13, 12, 10, OUTL);
      P(-6, -12, 10, 8, '#fbf4e4');
      P(-6, -6, 10, 2, '#e4d8c4');
      P(-8, -13, 3, 5, OUTL);
      P(-7, -12, 2, 4, '#efe4d0'); // tail
      P(-4, -10, 5, 3, '#efe4d0'); // wing
      P(-4, -10, 5, 1, '#d8ccb4');
      // head
      const hx = peck ? 3 : 2;
      const hy = peck ? -8 : -17;
      P(hx - 1, hy - 1, 6, 6, OUTL);
      P(hx, hy, 4, 4, '#fbf4e4');
      P(hx + 1, hy - 2, 3, 2, '#e2553b'); // comb
      P(hx + 4, hy + 1, 2, 1, '#f2a03d'); // beak
      P(hx + 2, hy + 1, 1, 1, '#2a1a14');
      P(hx + 3, hy + 3, 1, 2, '#d8432f'); // wattle
      break;
    }
    case 'duck': {
      const bob = Math.round(Math.sin(p.phase * 0.5));
      c.globalAlpha = 0.45;
      ellipse(c, x, y + 1, 11, 2.5, '#d8eefc');
      c.globalAlpha = 1;
      P(-8, -7 + bob, 15, 8, OUTL);
      P(-7, -6 + bob, 13, 6, '#f4f1ea');
      P(-7, -2 + bob, 13, 2, '#d8d2c4');
      P(-5, -5 + bob, 6, 2, '#e4ded2');
      P(2, -12 + bob, 6, 7, OUTL);
      P(3, -11 + bob, 4, 5, '#2f7a4c');
      P(3, -11 + bob, 2, 1, '#4fa46a');
      P(7, -9 + bob, 3, 2, '#f2a03d');
      P(5, -10 + bob, 1, 1, '#1a1a1a');
      P(2, -6 + bob, 4, 1, '#fbf4e4'); // collar
      break;
    }
    case 'butterfly': {
      const open = Math.sin(p.phase) > 0;
      const col = ['#f2b84b', '#ef9ac0', '#9fd3ee', '#fbf4e4'][p.seed % 4];
      const dark = ['#b07a20', '#c0607e', '#5a9ac0', '#b8ae98'][p.seed % 4];
      px(c, x, y - 3, OUTL, 1, 4);
      if (open) {
        px(c, x - 4, y - 5, dark, 4, 3);
        px(c, x - 3, y - 4, col, 3, 2);
        px(c, x + 1, y - 5, dark, 4, 3);
        px(c, x + 1, y - 4, col, 3, 2);
        px(c, x - 3, y - 2, col, 2, 2);
        px(c, x + 2, y - 2, col, 2, 2);
      } else {
        px(c, x - 2, y - 5, dark, 2, 4);
        px(c, x - 1, y - 5, col, 1, 3);
        px(c, x + 1, y - 5, dark, 2, 4);
        px(c, x + 1, y - 5, col, 1, 3);
      }
      break;
    }
    case 'cat': {
      shadow(10);
      const tail = Math.sin(p.phase * 0.4) > 0 ? 1 : 0;
      P(-8, -10, 15, 10, OUTL);
      P(-7, -9, 13, 9, '#e8a560');
      P(-7, -4, 13, 2, '#d08a48');
      for (let i = 0; i < 4; i++) P(-6 + i * 3, -9, 1, 4, '#d08a48'); // stripes
      P(2, -17, 8, 8, OUTL);
      P(3, -16, 6, 6, '#e8a560');
      P(3, -18, 2, 2, OUTL);
      P(7, -18, 2, 2, OUTL);
      P(3, -17, 1, 1, '#f2b8a0');
      P(4, -14, 1, 1, '#3d6a4a');
      P(7, -14, 1, 1, '#3d6a4a');
      P(5, -12, 2, 1, '#c87060');
      P(-10, -6 - tail * 2, 3, 6, OUTL);
      P(-9, -5 - tail * 2, 1, 5, '#e8a560');
      break;
    }
    case 'bird': {
      const hop = p.moving && Math.sin(p.phase * 2) > 0 ? -2 : 0;
      shadow(4);
      P(-4, -6 + hop, 8, 6, OUTL);
      P(-3, -5 + hop, 6, 4, '#8a6a52');
      P(-3, -3 + hop, 5, 2, '#d8b48a');
      P(1, -8 + hop, 4, 4, OUTL);
      P(2, -7 + hop, 2, 2, '#6a4a3a');
      P(4, -6 + hop, 2, 1, '#f2b84b');
      P(-5, -5 + hop, 2, 2, '#5a4038');
      break;
    }
  }
}

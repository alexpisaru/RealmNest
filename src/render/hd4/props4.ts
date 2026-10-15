// 128×64 farm props and storytelling decor.
// Props: crate · bucket · wateringCan · sack · barrel · tools · basket · signpost ·
//        bench · lanternPost · farmLamp · pots · wheelbarrow · milkCan · firewood · hay ·
//        haystack · ladder · trough
// Decor: laundry · seedBags · potStack · birdhouse · scarecrow · broom · tarpPile ·
//        rainBarrel · picnicBlanket · chopBlock · appleCart · mailbox · cart
import { darken, lighten } from '../color';
import { tbox } from '../hd/kit';
import type { PropPainter } from '../iso';
import type { PropArt } from '../props';
import { contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, R, type Ramp, rng } from './kit4';
import { boards4, siding4 } from './materials4';

type C = CanvasRenderingContext2D;
const anchor = (p: PropPainter, a = 0.5, b = 0.5, z = 0): [number, number] => {
  const [x, y] = p.P(a, b, z);
  return [Math.round(x), Math.round(y)];
};
const wood = (r: Ramp = R.wood, bw = 9) => ({ left: siding4(r, bw), right: siding4(r, bw), top: siding4(r, bw), edge: r[0] });
const plank = (r: Ramp = R.wood) => ({ left: boards4(r, 9, true), right: boards4(r, 9, true), top: siding4(r, 9), edge: r[0] });

/** A vertical cylinder (barrel, bucket, can) lit from the left: banded columns of the ramp. */
function cylinder(c: C, x: number, y: number, rx: number, h: number, ramp: Ramp, staves = 0) {
  const ry = rx * 0.5;
  ell(c, x, y, rx, ry, ramp[0]);
  for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) {
    const t = (i + rx) / (2 * rx);
    if (t < 0 || t > 1) continue;
    const tone = t < 0.18 ? 4 : t < 0.42 ? 3 : t < 0.7 ? 2 : t < 0.88 ? 1 : 0;
    const edge = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * ry;
    px(c, x + i, y - h - edge * 0, ramp[Math.min(ramp.length - 1, tone + 1)], 1, Math.round(h + edge));
    if (staves && (i + 100) % staves === 0) px(c, x + i, y - h, ramp[Math.max(0, tone - 1)], 1, Math.round(h + edge));
  }
}
function rimTop(c: C, x: number, y: number, rx: number, ramp: Ramp, inner?: string) {
  const ry = rx * 0.5;
  ell(c, x, y, rx, ry, ramp[ramp.length - 1]);
  ell(c, x, y + 0.5, rx - 1.5, ry - 1, inner ?? ramp[1]);
}
const hoop = (c: C, x: number, y: number, rx: number, col: string) => {
  for (let i = -Math.round(rx); i <= Math.round(rx); i++) px(c, x + i, y + Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * rx * 0.5, col, 1, 2);
};

const P: Record<string, PropArt['draw']> = {
  crate(p, k) {
    const Rn = rng(k.seed);
    contactShadow(p.c, ...shadowAt(p, 12, 20, 6), 0.3);
    tbox(p, 0.32, 0.34, 0.36, 0.32, 0, 7, plank(R.woodPale));
    const [x, y] = anchor(p, 0.5, 0.5, 7);
    const fill = ['apple', 'carrot', 'potato', 'empty'][k.seed % 4];
    if (fill === 'empty') {
      ell(p.c, x, y, 16, 7, R.wood[1]);
      return;
    }
    const cols = fill === 'apple' ? ['#d4392b', '#e5543a', '#b52a24', '#8ab84a'] : fill === 'carrot' ? ['#f08a3a', '#e07028'] : ['#c8a46a', '#b08a52', '#d8b880'];
    layer(p.c, (l) => {
      for (let i = 0; i < 14; i++) {
        const fx = x + (Rn() - 0.5) * 26;
        const fy = y + (Rn() - 0.5) * 9;
        if (fill === 'carrot') {
          px(l, fx - 4, fy, cols[i & 1], 8, 2);
          px(l, fx + 4, fy - 2, R.birch[4], 3, 2);
        } else dotFruit(l, fx, fy, cols[i % cols.length], fill === 'potato' ? 5 : 6);
      }
    });
  },
  bucket(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 14, 5, 0.3);
    layer(p.c, (l) => {
      cylinder(l, x, y, 9, 16, R.metal);
      hoop(l, x, y - 14, 9, R.metal[1]);
      hoop(l, x, y - 3, 9, R.metal[1]);
      rimTop(l, x, y - 16, 9, R.metal, k.seed % 2 ? R.water[3] : R.metal[0]);
      curve(l, x - 9, y - 16, x, y - 30, x + 9, y - 16, R.metal[1]);
    });
  },
  wateringCan(p, k) {
    const [x, y] = anchor(p);
    const col = k.color ?? '#4f8fa8';
    const r: Ramp = [darken(col, 0.5), darken(col, 0.3), darken(col, 0.12), col, lighten(col, 0.2), lighten(col, 0.4)];
    contactShadow(p.c, x + 8, y + 3, 18, 5, 0.3);
    layer(p.c, (l) => {
      cylinder(l, x, y, 9, 15, r);
      rimTop(l, x, y - 15, 9, r);
      // spout with a rose, handle arc
      for (let i = 0; i < 14; i++) px(l, x + 8 + i, y - 8 - i * 0.8, r[2], 2, 2);
      ell(l, x + 23, y - 20, 3, 3, r[3]);
      px(l, x + 22, y - 21, r[5]);
      curve(l, x - 9, y - 14, x - 2, y - 30, x + 7, y - 15, r[1]);
    });
  },
  sack(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed);
    contactShadow(p.c, x + 10, y + 4, 22, 7, 0.3);
    layer(p.c, (l) => {
      const n = 1 + (k.seed % 3);
      for (let i = 0; i < n; i++) {
        const sx = x - 10 + i * 12 + (Rn() - 0.5) * 3;
        const sy = y + (i & 1 ? 3 : 0);
        const m: Mass[] = [{ x: sx, y: sy - 11, rx: 10, ry: 12, z: i }];
        foliage(l, m, R.canvas, k.seed + i, { cell: 9, tilt: 0.05 });
        // tied neck with a tuft of grain and a stencilled band
        px(l, sx - 3, sy - 25, R.canvas[2], 6, 3);
        px(l, sx - 4, sy - 22, R.wood[1], 8, 2);
        px(l, sx - 2, sy - 28, R.hay[4], 4, 3);
        px(l, sx - 6, sy - 12, i === 1 ? '#a64a3a' : '#4a6aa8', 12, 2);
      }
    });
  },
  barrel(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 4, 18, 7, 0.3);
    layer(p.c, (l) => {
      cylinder(l, x, y, 14, 30, R.wood, 5);
      for (const z of [4, 15, 26]) hoop(l, x, y - z, 14, R.iron[2]);
      rimTop(l, x, y - 30, 14, R.wood, k.seed % 2 ? R.water[2] : R.wood[2]);
    });
  },
  tools(p, k) {
    // rake, spade and pitchfork leaning on a little rack
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 4, 22, 6, 0.26);
    layer(p.c, (l) => {
      tbox(p, 0.25, 0.45, 0.5, 0.1, 0, 3, wood());
      const handles: [number, number, string][] = [[-10, -6, 'rake'], [0, 4, 'spade'], [10, 8, 'fork']];
      for (const [dx, lean, kind] of handles) {
        const bx = x + dx;
        const top = y - 54;
        ln(l, bx, y - 2, bx + lean, top, R.wood[4], 2);
        px(l, bx + lean, top, R.wood[2], 2, 1);
        if (kind === 'rake') {
          px(l, bx - 7, y - 4, R.metal[2], 14, 2);
          for (let i = 0; i < 7; i++) px(l, bx - 7 + i * 2, y - 2, R.metal[1], 1, 3);
        } else if (kind === 'spade') {
          fillPoly(l, [[bx - 4, y - 8], [bx + 4, y - 8], [bx + 3, y + 1], [bx - 3, y + 1]], R.metal[3]);
          px(l, bx - 3, y - 7, R.metal[5], 2, 6);
        } else {
          px(l, bx - 4, y - 9, R.metal[2], 9, 2);
          for (let i = 0; i < 4; i++) px(l, bx - 4 + i * 3, y - 8, R.metal[3], 1, 9);
        }
      }
    });
    void k;
  },
  basket(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 16, 5, 0.28);
    const eggs = k.seed % 2 === 0;
    layer(p.c, (l) => {
      ell(l, x, y - 6, 14, 8, R.hay[1]);
      for (let j = 0; j < 10; j++) for (let i = -13; i <= 13; i += 2) if (((i + j) & 3) === 0) px(l, x + i, y - 10 + j, R.hay[(j & 1) + 2], 2, 1);
      ell(l, x, y - 12, 13, 5, R.hay[3]);
      ell(l, x, y - 12, 11, 4, R.hay[0]);
      for (let i = 0; i < 6; i++) dotFruit(l, x - 8 + i * 3.2, y - 13 + (i & 1), eggs ? '#f4ead8' : '#d4392b', 5);
      curve(l, x - 12, y - 12, x, y - 28, x + 12, y - 12, R.hay[2]);
    });
  },
  signpost(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 12, 4, 0.26);
    layer(p.c, (l) => {
      px(l, x - 2, y - 74, R.wood[3], 4, 74);
      px(l, x - 2, y - 74, R.wood[5], 1, 74);
      const signs: [number, number, string][] = [[-66, 1, 'Farm'], [-54, -1, 'Pond'], [-42, 1, 'Fields']];
      for (const [dy, dir] of signs) {
        const w = 34;
        const x0 = dir > 0 ? x : x - w;
        fillPoly(l, [[x0, y + dy], [x0 + w, y + dy], [x0 + w + dir * 6 * (dir > 0 ? 1 : 0), y + dy + 5], [x0 + w, y + dy + 10], [x0, y + dy + 10], [x0 - (dir < 0 ? 6 : 0), y + dy + 5]], R.woodGrey[3]);
        px(l, x0, y + dy, R.woodGrey[4], w, 1);
        for (let i = 0; i < 6; i++) px(l, x0 + 5 + i * 4, y + dy + 4, R.woodGrey[0], 2, 2);
      }
    });
    void k;
  },
  bench(p, k) {
    const W = k.w;
    // 'back': the bench faces away from the camera (we see its backrest from behind)
    const back = k.variant === 'back';
    contactShadow(p.c, ...shadowAt(p, 14, 30 * W, 8), 0.28);
    for (const a of [0.12, W - 0.18]) tbox(p, a, back ? 0.26 : 0.32, 0.06, 0.4, 0, 4.5, { left: siding4(R.iron), right: siding4(R.iron), top: siding4(R.iron), edge: R.iron[0] });
    if (back) {
      tbox(p, 0.05, 0.26, W - 0.1, 0.42, 4.5, 1.6, wood(R.woodPale));
      tbox(p, 0.05, 0.68, W - 0.1, 0.06, 6, 7, wood(R.woodPale));
      return;
    }
    tbox(p, 0.05, 0.3, W - 0.1, 0.42, 4.5, 1.6, wood(R.woodPale));
    tbox(p, 0.05, 0.24, W - 0.1, 0.06, 6, 7, wood(R.woodPale));
    // a folded cardigan and a mug left behind
    const [x, y] = anchor(p, W * 0.3, 0.5, 6.2);
    px(p.c, x - 6, y - 3, '#c4665a', 12, 4);
    px(p.c, x - 6, y - 3, '#d88070', 12, 1);
    const [mx, my] = anchor(p, W * 0.75, 0.5, 6.2);
    px(p.c, mx - 2, my - 6, '#f2ead8', 5, 6);
    px(p.c, mx + 3, my - 4, '#d8cfb8', 2, 2);
  },
  lanternPost(p) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 12, y + 4, 14, 5, 0.28);
    layer(p.c, (l) => {
      px(l, x - 6, y - 8, R.iron[1], 12, 8);
      px(l, x - 3, y - 128, R.iron[2], 6, 122);
      px(l, x - 3, y - 128, R.iron[4], 2, 122);
      // bracket with a hanging lantern
      px(l, x, y - 130, R.iron[2], 22, 3);
      curve(l, x + 3, y - 112, x + 10, y - 126, x + 20, y - 128, R.iron[2]);
      px(l, x + 13, y - 127, R.iron[1], 2, 6);
      fillPoly(l, [[x + 8, y - 121], [x + 20, y - 121], [x + 18, y - 98], [x + 10, y - 98]], R.iron[1]);
      px(l, x + 10, y - 118, '#ffd77a', 8, 18);
      px(l, x + 11, y - 117, '#fff3c2', 3, 8);
      px(l, x + 13, y - 118, R.iron[1], 1, 18);
      fillPoly(l, [[x + 6, y - 121], [x + 22, y - 121], [x + 14, y - 128]], R.iron[2]);
    });
  },
  /** The Farm's Victorian street lamp: stepped iron plinth, post with collars, a lit four-pane lantern under a pointed hood. */
  farmLamp(p) {
    const [x, y] = anchor(p);
    const I = R.iron;
    contactShadow(p.c, x + 14, y + 4, 18, 6, 0.3);
    layer(p.c, (l) => {
      // plinth: two steps and a flared neck, lit from the left
      px(l, x - 12, y - 8, I[1], 24, 8);
      px(l, x - 12, y - 8, I[3], 24, 2);
      px(l, x - 12, y - 8, I[2], 4, 8);
      px(l, x - 9, y - 16, I[1], 18, 8);
      px(l, x - 9, y - 16, I[3], 18, 1);
      px(l, x - 9, y - 16, I[2], 3, 8);
      fillPoly(l, [[x - 7, y - 16], [x + 7, y - 16], [x + 4, y - 32], [x - 4, y - 32]], I[1]);
      px(l, x - 6, y - 24, I[3], 2, 8);
      // the post
      px(l, x - 4, y - 154, I[1], 8, 124);
      px(l, x - 3, y - 154, I[3], 2, 124);
      px(l, x + 2, y - 154, I[0], 2, 124);
      for (const cy of [y - 62, y - 118]) {
        px(l, x - 6, cy, I[2], 12, 4);
        px(l, x - 6, cy, I[4], 12, 1);
      }
      // the lantern: collar, warm glass in an iron frame, a pointed hood and a finial
      px(l, x - 8, y - 160, I[2], 16, 6);
      px(l, x - 8, y - 160, I[4], 16, 1);
      fillPoly(l, [[x - 10, y - 160], [x + 10, y - 160], [x + 13, y - 190], [x - 13, y - 190]], I[0]);
      fillPoly(l, [[x - 8, y - 162], [x - 1, y - 162], [x - 1, y - 188], [x - 11, y - 188]], '#ffd77a');
      fillPoly(l, [[x + 1, y - 162], [x + 8, y - 162], [x + 11, y - 188], [x + 1, y - 188]], '#f0b24a');
      px(l, x - 7, y - 184, '#fff3c2', 3, 18);
      px(l, x + 3, y - 184, '#ffd77a', 2, 14);
      fillPoly(l, [[x - 16, y - 190], [x + 16, y - 190], [x + 7, y - 202], [x - 7, y - 202]], I[1]);
      px(l, x - 16, y - 191, I[3], 32, 2);
      px(l, x - 14, y - 196, I[3], 6, 2);
      fillPoly(l, [[x - 7, y - 202], [x + 7, y - 202], [x + 2, y - 211], [x - 2, y - 211]], I[2]);
      ell(l, x, y - 213, 3, 3, I[2]);
      px(l, x - 1, y - 215, I[4], 2, 2);
    });
  },
  pots(p, k) {
    const sets: Record<string, string[]> = { pink: ['#e8577a', '#f2b6c8'], purple: ['#a77ad8', '#c49cf2'], yellow: ['#f6d860', '#fbf7ee'], red: ['#d8302a', '#f08a5a'], mixed: ['#f6d860', '#e8577a', '#c49cf2'] };
    const cols = sets[k.variant ?? 'mixed'] ?? sets.mixed;
    const spots: [number, number, number][] = [[0.3, 0.35, 1.1], [0.72, 0.42, 0.85], [0.48, 0.74, 1.3]];
    for (const [a, b, s] of spots) pot(p, a, b, s, cols, Math.floor(a * 100 + k.seed));
  },
  wheelbarrow(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 4, 26, 8, 0.28);
    layer(p.c, (l) => {
      ell(l, x + 18, y - 8, 9, 9, R.iron[1]);
      ell(l, x + 18, y - 8, 7, 7, R.iron[3]);
      ell(l, x + 18, y - 8, 2, 2, R.metal[4]);
      fillPoly(l, [[x - 22, y - 26], [x + 16, y - 26], [x + 10, y - 10], [x - 16, y - 10]], '#a64a3a');
      fillPoly(l, [[x - 22, y - 26], [x + 16, y - 26], [x + 14, y - 22], [x - 20, y - 22]], '#c8664a');
      ell(l, x - 3, y - 26, 18, 5, R.soil[2]);
      for (let i = 0; i < 5; i++) dotFruit(l, x - 12 + i * 5, y - 28, ['#f08a3a', '#8ab84a', '#d4392b'][i % 3], 5);
      ln(l, x - 16, y - 12, x - 38, y - 2, R.wood[4], 2);
      ln(l, x - 12, y - 10, x - 34, y + 2, R.wood[3], 2);
      px(l, x - 10, y - 10, R.iron[2], 2, 10);
    });
    void k;
  },
  milkCan(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 14, 5, 0.28);
    layer(p.c, (l) => {
      cylinder(l, x, y, 9, 22, R.metal);
      fillPoly(l, [[x - 9, y - 22], [x + 9, y - 22], [x + 5, y - 30], [x - 5, y - 30]], R.metal[3]);
      cylinder(l, x, y - 30, 5, 5, R.metal);
      rimTop(l, x, y - 35, 6, R.metal);
      px(l, x - 12, y - 24, R.metal[2], 3, 2);
      px(l, x + 10, y - 24, R.metal[1], 3, 2);
    });
    void k;
  },
  firewood(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 12, y + 4, 30, 9, 0.3);
    layer(p.c, (l) => {
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < 5 - row; i++) {
          const cx = x - 22 + i * 11 + row * 5.5;
          const cy = y - 6 - row * 9;
          ell(l, cx, cy, 6, 5, R.bark[1]);
          ell(l, cx - 0.5, cy - 0.5, 5, 4.2, '#d8b07e');
          ell(l, cx - 0.5, cy - 0.5, 2.6, 2.2, '#c09060');
          px(l, cx - 1, cy - 1, '#b07e4e', 1, 1);
        }
    });
    void k;
  },
  hay(p, k) {
    contactShadow(p.c, ...shadowAt(p, 16, 30, 9), 0.3);
    const straw = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => {
      let i = light === 2 ? 4.4 : light === 1 ? 3.4 : 2.2;
      if (hash(Math.floor(u / 2), Math.floor(v / 3), 4) < 0.35) i += 1;
      if (hash(x, y, 5) < 0.18) i -= 1;
      return R.hay[Math.max(0, Math.min(6, Math.round(i)))];
    };
    tbox(p, 0.2, 0.3, 0.6, 0.4, 0, 7, { left: straw, right: straw, top: straw, edge: R.hay[0] });
    for (const a of [0.38, 0.62]) {
      const [tx0, ty0] = p.P(a, 0.7, 0);
      const [tx1, ty1] = p.P(a, 0.7, 7);
      ln(p.c, tx0, ty0, tx1, ty1, '#7a5a2a');
    }
    void k;
  },
  haystack(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 16, y + 5, 40, 13, 0.32);
    layer(p.c, (l) => {
      foliage(l, [{ x, y: y - 26, rx: 38, ry: 30, z: 1 }, { x: x - 6, y: y - 46, rx: 22, ry: 18, z: 2 }], R.hay, k.seed, { cell: 3, stretch: 2.4, tilt: 0.18 });
      const Rn = rng(k.seed);
      for (let i = 0; i < 30; i++) px(l, x - 40 + Rn() * 80, y - 2 + Rn() * 6, R.hay[3 + Math.floor(Rn() * 3)], 4, 1);
    });
  },
  ladder(p, k) {
    const [x, y] = anchor(p);
    layer(p.c, (l) => {
      ln(l, x - 8, y, x - 2, y - 80, R.wood[3], 3);
      ln(l, x + 8, y, x + 14, y - 80, R.wood[2], 3);
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        ln(l, x - 8 + 6 * t, y - 80 * t, x + 8 + 6 * t, y - 80 * t, R.wood[4], 2);
      }
    });
    void k;
  },
  trough(p, k) {
    contactShadow(p.c, ...shadowAt(p, 12, 60, 10), 0.28);
    // still water: a shadowed far rim, a calm body, a few short ripple glints (no glassy streaks)
    const water = () => (u: number, v: number, x: number, y: number) => {
      if (v < 2.5 || u < 2.5) return R.water[1];
      if (hash(Math.floor(u / 8), Math.floor(v / 2.5), 31) < 0.14 && Math.floor(u) % 8 < 4) return R.water[5];
      return hash(x, y, 32) < 0.06 ? R.water[3] : R.water[2];
    };
    tbox(p, 0.08, 0.3, 1.84, 0.4, 0, 6, { ...plank(), top: water });
    void k;
  },
  // ── storytelling decor ───────────────────────────────────
  laundry(p, k) {
    // two posts, a sagging line and the week's washing
    const [x0, y0] = anchor(p, 0.1, 0.5);
    const [x1, y1] = anchor(p, Math.max(1.6, k.w - 0.1), 0.5);
    contactShadow(p.c, (x0 + x1) / 2 + 20, (y0 + y1) / 2 + 6, Math.abs(x1 - x0) / 2 + 20, 12, 0.22);
    const cloths = ['#e8e2d6', '#9ab8d8', '#e8a0a0', '#f2d27a', '#ffffff', '#b8d0a8'];
    layer(p.c, (l) => {
      for (const [px0, py0] of [[x0, y0], [x1, y1]]) {
        px(l, px0 - 2, py0 - 92, R.wood[3], 4, 92);
        px(l, px0 - 8, py0 - 92, R.wood[2], 16, 3);
      }
      const n = 5;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const sag = Math.sin(t * Math.PI) * 10;
        px(l, x0 + (x1 - x0) * t, y0 - 90 + (y1 - y0) * t + sag, '#d8d0c0');
      }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.6) / (n + 0.4);
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 - 90 + (y1 - y0) * t + Math.sin(t * Math.PI) * 10;
        const col = cloths[(i + k.seed) % cloths.length];
        const w = 12 + hash(i, 1, k.seed) * 8;
        const h = 14 + hash(i, 2, k.seed) * 10;
        fillPoly(l, [[cx - w / 2, cy], [cx + w / 2, cy + 1], [cx + w / 2 - 1, cy + h], [cx - w / 2 + 2, cy + h + 2]], col);
        px(l, cx - w / 2, cy, lighten(col, 0.2), Math.round(w), 1);
        ln(l, cx + w / 2 - 1, cy + 1, cx + w / 2 - 1, cy + h, darken(col, 0.2));
        px(l, cx - 3, cy - 1, '#8a6a4a', 2, 3);
        px(l, cx + 2, cy - 1, '#8a6a4a', 2, 3);
      }
    });
  },
  seedBags(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 20, 6, 0.26);
    layer(p.c, (l) => {
      const cols = ['#c8a46a', '#a8c8a0', '#e8c890'];
      for (let i = 0; i < 4; i++) {
        const bx = x - 14 + i * 9;
        const by = y - (i & 1 ? 2 : 0);
        px(l, bx, by - 14, cols[i % 3], 8, 14);
        px(l, bx, by - 14, lighten(cols[i % 3], 0.2), 2, 14);
        px(l, bx + 1, by - 16, darken(cols[i % 3], 0.2), 6, 2);
        px(l, bx + 2, by - 9, ['#d4392b', '#4a8a3a', '#f08a3a', '#6a5ab8'][i], 4, 4);
      }
    });
    void k;
  },
  potStack(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 16, 5, 0.26);
    layer(p.c, (l) => {
      for (let i = 0; i < 4; i++) {
        const py = y - i * 5;
        fillPoly(l, [[x - 8, py - 10], [x + 8, py - 10], [x + 6, py], [x - 6, py]], i % 2 ? '#c07448' : '#b0623a');
        px(l, x - 9, py - 12, '#d6915e', 18, 2);
        px(l, x - 7, py - 9, '#d6915e', 2, 8);
      }
      const [tx, ty] = anchor(p, 0.75, 0.6);
      fillPoly(l, [[tx - 6, ty - 3], [tx + 6, ty - 6], [tx + 7, ty + 1], [tx - 5, ty + 3]], '#b0623a');
    });
    void k;
  },
  birdhouse(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 10, 4, 0.24);
    layer(p.c, (l) => {
      px(l, x - 2, y - 76, R.wood[3], 4, 76);
      tbox(p, 0.36, 0.38, 0.28, 0.24, 18, 7, plank(['#3a5a8a', '#4a6aa8', '#5a82c4', '#7aa2d8', '#9ab8e6', '#c0d4f0']));
      const [rx, ry] = anchor(p, 0.5, 0.5, 26);
      fillPoly(l, [[rx - 14, ry + 3], [rx, ry - 9], [rx + 14, ry + 3], [rx, ry + 9]], R.roofRed[3]);
      fillPoly(l, [[rx - 14, ry + 3], [rx, ry - 9], [rx, ry - 6], [rx - 12, ry + 4]], R.roofRed[5]);
      const [hx, hy] = anchor(p, 0.5, 0.62, 21);
      ell(l, hx, hy, 2.4, 2.4, '#1a1418');
      px(l, hx - 1, hy + 4, R.wood[2], 3, 1);
    });
    void k;
  },
  scarecrow(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 14, y + 4, 18, 6, 0.26);
    const shirt = k.seed % 2 ? R.red : R.blue;
    layer(p.c, (l) => {
      px(l, x - 2, y - 104, R.wood[3], 4, 104);
      px(l, x - 30, y - 80, R.wood[2], 60, 4);
      // plaid shirt with straw cuffs, patched trousers on one leg
      fillPoly(l, [[x - 16, y - 82], [x + 16, y - 82], [x + 14, y - 46], [x - 14, y - 46]], shirt[3]);
      for (let j = 0; j < 36; j += 6) px(l, x - 15, y - 82 + j, shirt[1], 30, 2);
      for (let i = 0; i < 30; i += 7) px(l, x - 15 + i, y - 82, shirt[1], 2, 36);
      px(l, x - 30, y - 82, shirt[2], 14, 8);
      px(l, x + 16, y - 82, shirt[2], 14, 8);
      for (const sx of [-34, 30]) for (let i = 0; i < 5; i++) px(l, x + sx + i, y - 80 + (i & 1) * 2, R.hay[4], 1, 6);
      px(l, x - 4, y - 50, '#6a5a3a', 8, 22);
      px(l, x - 3, y - 38, '#a8884a', 4, 4);
      // sack head with stitched face, straw hat
      ell(l, x, y - 92, 11, 11, '#d8c08e');
      ell(l, x - 2, y - 95, 7, 6, '#e8d4a6');
      px(l, x - 5, y - 95, '#3b2a26', 2, 2);
      px(l, x + 3, y - 95, '#3b2a26', 2, 2);
      for (let i = -4; i <= 4; i += 2) px(l, x + i, y - 88, '#8a5a3a');
      ell(l, x, y - 101, 20, 5, R.hay[2]);
      ell(l, x - 2, y - 102, 17, 3.5, R.hay[4]);
      fillPoly(l, [[x - 10, y - 102], [x + 10, y - 102], [x + 7, y - 116], [x - 7, y - 116]], R.hay[3]);
      px(l, x - 10, y - 106, '#c8443a', 20, 3);
      // a crow on the arm
      px(l, x + 24, y - 88, '#1e1a22', 8, 5);
      px(l, x + 30, y - 91, '#1e1a22', 4, 4);
      px(l, x + 34, y - 90, '#e8b830', 2, 1);
    });
  },
  broom(p, k) {
    const [x, y] = anchor(p);
    layer(p.c, (l) => {
      ln(l, x, y - 6, x + 12, y - 70, R.wood[4], 2);
      fillPoly(l, [[x - 6, y], [x + 6, y], [x + 4, y - 14], [x - 2, y - 14]], R.hay[3]);
      for (let i = -5; i < 6; i += 2) px(l, x + i, y - 6, R.hay[1], 1, 6);
      px(l, x - 2, y - 14, '#8a3a2a', 6, 2);
    });
    void k;
  },
  tarpPile(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 14, y + 5, 40, 12, 0.3);
    layer(p.c, (l) => {
      foliage(l, [{ x: x - 8, y: y - 18, rx: 30, ry: 18, z: 1 }, { x: x + 14, y: y - 12, rx: 22, ry: 12, z: 2 }], ['#2a3a4a', '#344a5c', '#40596c', '#4e6a7e', '#62808e', '#7c98a4'], k.seed, { cell: 12, tilt: 0.06 });
      for (let i = 0; i < 4; i++) px(l, x - 26 + i * 16, y - 4, '#c8b088', 1, 6);
      px(l, x + 22, y - 6, R.wood[3], 14, 4);
    });
  },
  rainBarrel(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 4, 20, 7, 0.3);
    layer(p.c, (l) => {
      cylinder(l, x, y, 15, 34, R.wood, 5);
      for (const z of [5, 18, 30]) hoop(l, x, y - z, 15, R.iron[2]);
      rimTop(l, x, y - 34, 15, R.wood, R.water[2]);
      px(l, x - 9, y - 36, R.water[5], 6, 1);
      // tap and a downpipe feeding it
      px(l, x - 4, y - 10, R.metal[3], 4, 3);
      px(l, x - 3, y - 7, R.metal[1], 2, 3);
      px(l, x + 6, y - 90, R.metal[2], 4, 58);
      px(l, x + 6, y - 90, R.metal[4], 1, 58);
    });
    void k;
  },
  picnicBlanket(p, k) {
    const [x, y] = anchor(p);
    layer(p.c, (l) => {
      for (let j = -10; j <= 10; j++)
        for (let i = -34; i <= 34; i++) {
          const u = i + j * 2;
          const v = j - i * 0.5 * 0.5;
          if (Math.abs(u) > 30 || Math.abs(v * 2.2) > 20) continue;
          const check = (Math.floor(u / 6) + Math.floor(v / 3)) & 1;
          px(l, x + i, y + j, check ? '#c8443a' : '#f2ead8');
        }
      // basket, a bottle and an open book
      ell(l, x - 8, y - 6, 9, 5, R.hay[2]);
      px(l, x - 14, y - 12, R.hay[3], 12, 6);
      px(l, x + 10, y - 14, '#4a7a4a', 4, 12);
      px(l, x + 11, y - 17, '#2a4a2a', 2, 3);
      px(l, x + 2, y + 4, '#fbf7ee', 10, 4);
      px(l, x + 7, y + 4, '#d8d0c0', 1, 4);
    });
    void k;
  },
  chopBlock(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 18, 6, 0.3);
    layer(p.c, (l) => {
      cylinder(l, x, y, 12, 14, R.bark);
      rimTop(l, x, y - 14, 12, ['#7a5a3a', '#a07a4e', '#c09a6a', '#d8b48a', '#e8caa0', '#f0dab8'], '#c8a070');
      for (let i = 1; i < 4; i++) {
        ell(l, x, y - 14, 12 - i * 3, 6 - i * 1.5, i & 1 ? '#b8905e' : '#c8a070');
      }
      // axe buried in the block, chips around
      ln(l, x + 2, y - 16, x + 18, y - 44, R.wood[4], 2);
      fillPoly(l, [[x - 4, y - 20], [x + 6, y - 22], [x + 6, y - 14], [x - 2, y - 13]], R.metal[3]);
      px(l, x - 3, y - 19, R.metal[5], 2, 5);
      const Rn = rng(k.seed);
      for (let i = 0; i < 10; i++) px(l, x - 20 + Rn() * 40, y - 1 + Rn() * 6, '#d8b07e', 3, 1);
    });
  },
  appleCart(p, k) {
    contactShadow(p.c, ...shadowAt(p, 16, 50, 12), 0.3);
    tbox(p, 0.1, 0.25, 1.4, 0.5, 6, 6, plank());
    const [x, y] = anchor(p, 0.75, 0.5, 12);
    layer(p.c, (l) => {
      const Rn = rng(k.seed);
      for (let i = 0; i < 40; i++) dotFruit(l, x + (Rn() - 0.5) * 70, y - 2 + (Rn() - 0.5) * 14 - Rn() * 6, ['#d4392b', '#e5543a', '#8ab84a', '#f08a3a'][i % 4], 5);
      for (const a of [0.2, 1.3]) {
        const [wx, wy] = anchor(p, a, 0.78, 4);
        ell(l, wx, wy, 9, 9, R.wood[1]);
        ell(l, wx, wy, 7, 7, R.wood[3]);
        for (let i = 0; i < 6; i++) ln(l, wx, wy, wx + Math.cos(i) * 7, wy + Math.sin(i) * 7, R.wood[1]);
      }
      const [hx, hy] = anchor(p, 1.5, 0.5, 8);
      ln(l, hx, hy, hx + 30, hy + 12, R.wood[3], 2);
    });
  },
  mailbox(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 10, 4, 0.24);
    layer(p.c, (l) => {
      px(l, x - 2, y - 48, R.wood[3], 4, 48);
      fillPoly(l, [[x - 10, y - 62], [x + 12, y - 58], [x + 12, y - 46], [x - 10, y - 50]], '#4a7aa8');
      ell(l, x + 1, y - 58, 11, 4, '#5a8ac0');
      px(l, x + 12, y - 62, '#c8443a', 2, 9);
      px(l, x - 6, y - 53, '#f2ead8', 6, 2);
    });
    void k;
  },
};

function pot(p: PropPainter, a: number, b: number, s: number, cols: string[], seed: number) {
  const [x, y] = anchor(p, a, b);
  const w = Math.round(9 * s);
  const h = Math.round(9 * s);
  contactShadow(p.c, x + 5, y + 2, w + 3, 4, 0.28);
  layer(p.c, (l) => {
    fillPoly(l, [[x - w, y - h], [x + w, y - h], [x + w * 0.75, y], [x - w * 0.75, y]], '#b8643c');
    fillPoly(l, [[x - w, y - h], [x - w * 0.4, y - h], [x - w * 0.3, y], [x - w * 0.75, y]], '#d07a4c');
    fillPoly(l, [[x + w * 0.5, y - h], [x + w, y - h], [x + w * 0.75, y], [x + w * 0.4, y]], '#94502e');
    px(l, x - w - 1, y - h - 3, '#dc9466', w * 2 + 2, 3);
    px(l, x - w - 1, y - h - 3, '#ecb084', w * 2 + 2, 1);
    const masses: Mass[] = [{ x, y: y - h - 6 * s, rx: 9 * s, ry: 7 * s, z: 1 }];
    foliage(l, masses, R.apple, seed, { cell: 3, dots: cols, dotChance: 0.55, dotSize: 3 });
  });
}

/** contact shadow centred under a prop footprint, pushed to the lower right */
function shadowAt(p: PropPainter, h: number, rx: number, ry: number): [number, number, number, number] {
  const [x, y] = p.P(p.pw / 2, p.pd / 2, 0);
  return [x + h * 0.6, y + 4, rx, ry];
}

export const PROP_VARIANTS = Object.keys(P);
export const PROPS4: Record<string, PropArt> = Object.fromEntries(Object.entries(P).map(([k, draw]) => [k, { draw }]));
// at night the lantern lights the ground round it
PROPS4.farmLamp.lights = () => [{ a: 0.5, b: 0.5, z: 44, r: 3.2 }];
// the street lamp's lantern breathes a warm glow
PROPS4.farmLamp.anim = (p, k) => {
  const u = p.k / 4;
  const [x, y] = anchor(p);
  const cy = y - 176 * u;
  const r = 36 * u;
  const a = 0.16 + Math.sin(k.t * 2.6 + k.seed) * 0.03 + Math.sin(k.t * 9.3 + k.seed * 2) * 0.015;
  const c = p.c;
  const prev = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, cy, 0, x, cy, r);
  g.addColorStop(0, `rgba(255,214,130,${a.toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,214,130,0)');
  c.fillStyle = g;
  c.fillRect(x - r, cy - r, r * 2, r * 2);
  c.globalCompositeOperation = prev;
};

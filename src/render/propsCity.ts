// ─────────────────────────────────────────────────────────────
// Surroundings for indoor worlds (campus / street / harbour / station)
// and interior density props. Prop-local coords, b = d is the front.
// ─────────────────────────────────────────────────────────────

import { darken, lighten, withAlpha } from './color';
import { OUT, rect } from './iso';
import { disc, foliage, type PropArt } from './props';

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const FACADES: Record<string, { wall: string; trim: string; glass: string; roof: string }> = {
  brick: { wall: '#b5654a', trim: '#e8dcc6', glass: '#7fb2cc', roof: '#5a4a52' },
  cream: { wall: '#efe3cf', trim: '#8a6a4f', glass: '#8fc4e0', roof: '#6b5a62' },
  glass: { wall: '#9fb4c8', trim: '#3a4a5c', glass: '#5f88aa', roof: '#3a4558' },
  industrial: { wall: '#7d8794', trim: '#f2a03d', glass: '#5f7a92', roof: '#4b5568' },
  lab: { wall: '#dfe9ec', trim: '#4fae9f', glass: '#8fd0d6', roof: '#7d8e94' },
  warm: { wall: '#e2b08a', trim: '#7a4e33', glass: '#8fc4e0', roof: '#5a4232' },
};

/** A neighbouring building: storeys of windows, a parapet roof, rooftop details. */
const facade: PropArt = {
  draw(p, k) {
    const [style, st] = (k.variant ?? 'brick-3').split('-');
    const f = FACADES[style] ?? FACADES.brick;
    const storeys = Math.max(2, Math.min(5, st ? +st : 3));
    const H = 18 + storeys * 22;
    p.shadow();
    p.box(0, 0, k.w, k.d, 0, H, f.wall);
    if (style === 'brick')
      for (let z = 3; z < H; z += 3) {
        p.face(0, k.w, k.d, z, z + 0.5, darken(f.wall, 0.12));
        p.side(k.w, 0, k.d, z, z + 0.5, darken(f.wall, 0.3));
      }
    for (let s = 0; s < storeys; s++) {
      const z = 10 + s * 22;
      for (let a = 0.3; a < k.w - 0.5; a += 1) {
        const lit = hash(Math.round(a * 10), s, k.seed) > 0.55;
        p.face(a, a + 0.6, k.d, z, z + 14, f.trim);
        p.face(a + 0.06, a + 0.54, k.d, z + 1, z + 13, lit ? '#ffe2a0' : f.glass);
        p.face(a + 0.06, a + 0.54, k.d, z + 8, z + 13, lit ? '#fff0c8' : lighten(f.glass, 0.18));
        p.face(a + 0.28, a + 0.32, k.d, z + 1, z + 13, f.trim);
        if (style === 'warm' && s > 0) p.box(a - 0.05, k.d, 0.7, 0.18, z - 1, 2, '#7a4e33');
      }
      for (let b = 0.3; b < k.d - 0.5; b += 1) {
        p.side(k.w, b, b + 0.6, z, z + 14, darken(f.trim, 0.2));
        p.side(k.w, b + 0.06, b + 0.54, z + 1, z + 13, darken(f.glass, 0.2));
      }
    }
    p.box(-0.05, -0.05, k.w + 0.1, k.d + 0.1, H, 4, f.roof);
    p.top(0.2, 0.2, k.w - 0.2, k.d - 0.2, H + 1, darken(f.roof, 0.1));
    if (k.w > 3) {
      p.box(k.w * 0.6, k.d * 0.3, 0.8, 0.6, H + 1, 8, '#9aa4b8');
      p.box(0.4, 0.4, 0.4, 0.4, H + 1, 12, f.roof);
    }
    // street-level door
    p.face(k.w / 2 - 0.4, k.w / 2 + 0.4, k.d, 0, 16, darken(f.trim, 0.1));
    p.face(k.w / 2 - 0.34, k.w / 2 + 0.34, k.d, 0, 14, darken(f.glass, 0.25));
  },
};

/** Half-height cutaway wall on the front edges of indoor rooms. */
const lowWall: PropArt = {
  draw(p, k) {
    const c = k.color ?? '#efe3cf';
    p.box(0, 0, k.w, 0.22, 0, 16, c);
    p.face(0, k.w, 0.22, 0, 5, darken(c, 0.3));
    p.top(0, 0, k.w, 0.22, 16, lighten(c, 0.2));
    for (let a = 1; a < k.w; a += 2) p.face(a - 0.02, a + 0.02, 0.22, 5, 16, darken(c, 0.08));
  },
};

const streetLamp: PropArt = {
  draw(p) {
    p.box(0.42, 0.42, 0.16, 0.16, 0, 4, '#3a3f5a');
    p.ln(0.5, 0.5, 4, 0.5, 0.5, 44, '#2b2236');
    p.ln(0.52, 0.5, 4, 0.52, 0.5, 44, '#3a3f5a');
    p.ln(0.5, 0.5, 44, 0.7, 0.5, 46, '#2b2236');
    p.box(0.6, 0.42, 0.24, 0.16, 42, 4, '#2b2236');
  },
  anim(p, k) {
    const [x, y] = p.P(0.72, 0.5, 41);
    p.c.globalAlpha = 0.2 + Math.sin(k.t + k.seed) * 0.03;
    disc(p.c, x, y + 4, 9, '#ffe2a0', 1);
    p.c.globalAlpha = 1;
    rect(p.c, x - 2, y, 4, 1, '#fff4c8');
  },
};

const planter: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.05, 0.15, k.w - 0.1, 0.7, 0, 9, '#8a8f99');
    p.face(0.05, k.w - 0.05, 0.85, 7, 9, '#a0a6b0');
    for (let i = 0; i < k.w * 2; i++) foliage(p, 0.3 + i * 0.5, 0.5, 14, 4, i % 2 ? '#4f9a55' : '#5fae5a', i + k.seed);
    for (let i = 0; i < k.w * 3; i++) {
      const [x, y] = p.P(0.25 + i * 0.33, 0.5, 15);
      if (hash(i, k.seed) > 0.5) rect(p.c, x, y - 3, 2, 2, ['#ef9ac0', '#f2d06b', '#fbf4e4'][i % 3]);
    }
  },
};

const bikeRack: PropArt = {
  draw(p, k) {
    for (let i = 0; i < k.w * 2; i++) {
      const a = 0.25 + i * 0.5;
      p.ln(a, 0.3, 0, a, 0.3, 9, '#9aa4b8');
      p.ln(a, 0.7, 0, a, 0.7, 9, '#9aa4b8');
      p.ln(a, 0.3, 9, a, 0.7, 9, '#9aa4b8');
      if (hash(i, k.seed) > 0.4) {
        const col = ['#c0392b', '#3f6fb5', '#3fb68b', '#f2b84b'][i % 4];
        const [x, y] = p.P(a + 0.1, 0.5, 5);
        disc(p.c, x - 4, y + 2, 4, OUT, 1);
        disc(p.c, x + 4, y - 2, 4, OUT, 1);
        disc(p.c, x - 4, y + 2, 3, '#cfd5dc', 1);
        disc(p.c, x + 4, y - 2, 3, '#cfd5dc', 1);
        p.ln(a - 0.05, 0.4, 6, a + 0.2, 0.6, 9, col);
      }
    }
  },
};

const bin: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#3f6f62';
    p.box(0.3, 0.3, 0.4, 0.4, 0, 12, col);
    p.box(0.27, 0.27, 0.46, 0.46, 12, 2, darken(col, 0.2));
  },
};

const car: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#5b8def';
    p.shadow(0, 0.1, k.w, 0.8);
    p.box(0.05, 0.15, k.w - 0.1, 0.7, 3, 9, col);
    p.box(0.45, 0.2, k.w - 1, 0.6, 12, 8, lighten(col, 0.05));
    p.face(0.5, k.w - 0.6, 0.8, 13, 19, '#2b3a4a');
    p.side(k.w - 0.55, 0.25, 0.75, 13, 19, '#24323f');
    p.face(0.55, 0.9, 0.8, 17, 19, '#8fb2cc');
    for (const a of [0.35, k.w - 0.5]) {
      const [x, y] = p.P(a, 0.85, 3);
      disc(p.c, x, y, 3, OUT, 1);
      disc(p.c, x, y, 2, '#5a6378', 1);
    }
    p.face(k.w - 0.15, k.w - 0.05, 0.85, 7, 9, '#fff1c8');
  },
};

const fountain: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0.1, k.w - 0.2, k.d - 0.2, 0, 7, '#c4baa9');
    p.top(0.25, 0.25, k.w - 0.25, k.d - 0.25, 6, '#5aa0dc');
    p.box(k.w / 2 - 0.15, k.d / 2 - 0.15, 0.3, 0.3, 6, 12, '#d2c8b6');
    p.box(k.w / 2 - 0.35, k.d / 2 - 0.35, 0.7, 0.7, 18, 3, '#d2c8b6');
  },
  anim(p, k) {
    for (let i = 0; i < 8; i++) {
      const s = (k.t * 1.2 + i / 8) % 1;
      const ang = (i / 8) * Math.PI * 2;
      const r = s * 0.45;
      p.dot(k.w / 2 + Math.cos(ang) * r, k.d / 2 + Math.sin(ang) * r, 22 + Math.sin(s * Math.PI) * 6 - s * 4, '#d8eefc');
    }
  },
};

const flowerPatch: PropArt = {
  draw(p, k) {
    const sets = [['#ef9ac0', '#fbf4e4'], ['#f2d06b', '#fff1a8'], ['#b48ae8', '#fbf4e4'], ['#e2553b', '#f2d06b']];
    const set = sets[k.seed % sets.length];
    for (let i = 0; i < 7; i++) {
      const [x, y] = p.P(0.2 + hash(i, k.seed) * 0.6, 0.2 + hash(k.seed, i) * 0.6, 0);
      rect(p.c, x, y - 4, 1, 4, '#4f8a3c');
      rect(p.c, x - 1, y - 6, 3, 2, set[i % 2]);
      rect(p.c, x, y - 6, 1, 1, '#fff6c8');
    }
  },
};

const tallGrass: PropArt = {
  draw(p, k) {
    for (let i = 0; i < 12; i++) {
      const [x, y] = p.P(0.15 + hash(i, k.seed) * 0.7, 0.15 + hash(k.seed, i) * 0.7, 0);
      const h = 4 + Math.floor(hash(i, i, k.seed) * 5);
      rect(p.c, x, y - h, 1, h, i % 3 ? '#5f9a45' : '#7cb85a');
    }
  },
};

const filingCabinet: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#8a93a8';
    p.shadow(0.15, 0.2, 0.7, 0.7);
    p.box(0.2, 0.3, 0.6, 0.6, 0, 26, col);
    for (const z of [3, 11, 19]) {
      p.face(0.25, 0.75, 0.9, z, z + 6, lighten(col, 0.1));
      p.face(0.45, 0.55, 0.9, z + 4, z + 5, OUT);
    }
    p.box(0.3, 0.4, 0.3, 0.2, 26, 4, '#e8dcc4');
  },
};

const coatRack: PropArt = {
  draw(p) {
    p.ln(0.5, 0.5, 0, 0.5, 0.5, 36, '#5e3c28');
    p.ln(0.35, 0.5, 0, 0.65, 0.5, 0, '#5e3c28');
    p.box(0.38, 0.4, 0.26, 0.22, 20, 12, '#3f6fb5');
    p.box(0.42, 0.55, 0.2, 0.15, 24, 8, '#c0533f');
    const [x, y] = p.P(0.5, 0.5, 36);
    disc(p.c, x, y, 2, '#5e3c28', 1);
  },
};

const fridge: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.12, 0.2, 0.76, 0.7, 0, 40, '#e4e7ec');
    p.face(0.15, 0.85, 0.9, 26, 27, '#9aa4b8');
    p.face(0.75, 0.8, 0.9, 30, 37, '#9aa4b8');
    p.face(0.2, 0.4, 0.9, 30, 33, '#f2d06b');
    p.face(0.45, 0.6, 0.9, 32, 35, '#ef9ac0');
  },
};

const sideTable: PropArt = {
  draw(p, k) {
    p.box(0.25, 0.25, 0.5, 0.5, 0, 12, '#8a5a3c');
    if (hash(k.seed, 1) > 0.5) {
      p.box(0.4, 0.35, 0.2, 0.2, 12, 6, '#c0603f');
      foliage(p, 0.5, 0.45, 22, 3, '#4f9a55', k.seed);
    } else {
      p.ln(0.5, 0.5, 12, 0.5, 0.5, 22, '#2b2236');
      p.box(0.35, 0.35, 0.3, 0.3, 22, 5, '#f2d06b');
    }
  },
};

const boxes: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0.2, 0.55, 0.55, 0, 10, '#c08a55');
    p.box(0.45, 0.4, 0.45, 0.45, 0, 8, '#b07a48');
    p.box(0.2, 0.3, 0.4, 0.4, 10, 7, '#d09a65');
    p.face(0.3, 0.5, 0.7, 13, 14, '#fbf4e4');
    void k;
  },
};

// ── station exterior ─────────────────────────────────────────

const solarPanel: PropArt = {
  draw(p, k) {
    p.ln(k.w / 2, k.d / 2, 0, k.w / 2, k.d / 2, 10, '#9aa4b8');
    p.box(0, 0, k.w, k.d, 10, 2, '#1d2c5a');
    for (let a = 0.25; a < k.w; a += 0.25) p.ln(a, 0, 12, a, k.d, 12, '#3a5a9a');
    for (let b = 0.5; b < k.d; b += 0.5) p.ln(0, b, 12, k.w, b, 12, '#3a5a9a');
    p.ln(0, 0.1, 12, k.w, 0.1, 12, withAlpha('#9fd3ee', 0.8));
  },
};

const truss: PropArt = {
  draw(p, k) {
    const col = '#9aa4b8';
    for (const z of [6, 16]) {
      p.ln(0, 0.3, z, k.w, 0.3, z, col);
      p.ln(0, 0.7, z, k.w, 0.7, z, darken(col, 0.2));
    }
    for (let a = 0; a <= k.w; a += 0.5) {
      p.ln(a, 0.3, 6, a, 0.3, 16, col);
      p.ln(a, 0.3, 6, a + 0.5, 0.3, 16, darken(col, 0.15));
    }
  },
};

const module_: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.1, k.w, k.d - 0.2, 0, 26, '#c9d0dc');
    for (let a = 0.5; a < k.w; a += 1) p.face(a - 0.03, a + 0.03, k.d - 0.1, 0, 26, '#9aa4b8');
    for (let a = 0.7; a < k.w - 0.3; a += 1.5) {
      const [x, y] = p.P(a, k.d - 0.1, 14);
      disc(p.c, x, y, 3, '#3a3f5a', 1);
      disc(p.c, x, y, 2, '#ffe2a0', 1);
    }
    p.top(0.1, 0.2, k.w - 0.1, k.d - 0.3, 26, '#dfe4ec');
    p.face(0.1, 0.4, k.d - 0.1, 22, 24, '#e2553b');
  },
};

const antenna: PropArt = {
  draw(p) {
    p.box(0.35, 0.35, 0.3, 0.3, 0, 6, '#9aa4b8');
    p.ln(0.5, 0.5, 6, 0.5, 0.5, 40, '#c9d0dc');
    const [x, y] = p.P(0.5, 0.5, 34);
    disc(p.c, x - 4, y, 7, '#dfe4ec', 0.6);
    disc(p.c, x - 4, y, 5, '#b8c0cc', 0.6);
  },
  anim(p, k) {
    p.dot(0.5, 0.5, 41, Math.sin(k.t * 3) > 0 ? '#e2553b' : '#5a2a22', 2, 2);
  },
};

export const CITY_ART: Record<string, PropArt> = {
  facade,
  lowWall,
  streetLamp,
  planter,
  bikeRack,
  bin,
  car,
  fountain,
  flowerPatch,
  tallGrass,
  filingCabinet,
  coatRack,
  fridge,
  sideTable,
  boxes,
  solarPanel,
  truss,
  module: module_,
  antenna,
};


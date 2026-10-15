// Creative Studio — the boathouse's own street walls, cut low: teal
// weatherboard over a white lattice skirt, white corner boards, the sills of
// the big windows surviving the cut, window boxes of geraniums, and a few
// hand-painted fish swimming along the boards. The cut top shows the wall's
// make-up: inner shiplap, pine studs with wool between, the outer boards.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { at, foliage, hash, layer, type Mass, px, rng } from '../../kit4';
import { front, pq } from '../../plane4';
import { lbox } from '../util';
import { clap, CREAM, LEAF, PINE, TEAL, WALLW } from './kit';

const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7;
    const T = 0.3;
    const boards = clap(TEAL, 9, 0.35);
    // the facade: a lattice skirt at the foot, weatherboard above
    const fac: Mat = (light, w, h) => {
      const b = boards(light, w, h);
      return (u, v, x, y) => {
        if (v < 6) {
          // white lattice over a dark crawl space
          const d1 = (u + v) % 6;
          const d2 = (u - v + 600) % 6;
          if (d1 < 1.3 || d2 < 1.3) return CREAM[light ? 4 : 2];
          return '#2a2226';
        }
        if (v < 7.4) return CREAM[light ? 5 : 3];
        return b(u, v, x, y);
      };
    };
    const top: Mat = (light) => (u, v, x, y) => {
      if (v < 3) return WALLW[light === 2 ? 5 : 4];
      if (v > 17.5) return v > 19.5 ? TEAL[5] : TEAL[3];
      if (u % 43 < 6) return at(PINE, 3.4 + (u % 43 < 1 ? -1 : 0));
      return hash(x >> 1, y >> 1, 44) < 0.3 ? '#e8cf86' : '#f2dc9a';
    };
    lbox(p, 0, 0, W, T, 0, Z, { front: fac, side: fac, top, edge: '#1c3c3e' });
    const F = front(p, T);
    // white corner boards at both ends
    pq(p, F, 0, 0.1, 1.5, Z, CREAM[F.light ? 5 : 3]);
    pq(p, F, W - 0.1, W, 1.5, Z, CREAM[F.light ? 5 : 3]);
    // the sills of the big windows, every three tiles, with a strip of their glass
    for (let a = 1.6; a < W - 1; a += 3.1) {
      pq(p, F, a - 0.9, a + 0.9, Z - 0.9, Z, CREAM[F.light ? 5 : 3]);
      pq(p, F, a - 0.9, a + 0.9, Z - 1.3, Z - 0.9, '#3a5a5c');
      pq(p, F, a - 0.8, a + 0.8, Z - 0.4, Z, '#2e4a5a');
    }
    // hand-painted fish along the boards
    const Rn = rng(k.seed * 13 + 7);
    const fish: FaceTex = () => null;
    void fish;
    for (let a = 0.8; a < W - 0.6; a += 2.4 + Rn() * 2) {
      if (Rn() < 0.5) continue;
      const [x, y] = F.F(a, 3.8);
      const col = ['#f2c84a', '#f0a6c0', '#fbf6ec', '#e0603e'][Math.floor(Rn() * 4)];
      layer(p.c, (l) => {
        l.fillStyle = col;
        for (let i = 0; i < 12; i++) {
          const w = Math.round(Math.sin((i / 12) * Math.PI) * 3);
          l.fillRect(Math.round(x - 6 + i), Math.round(y - w + i * 0.5), 1, w * 2 + 1);
        }
        l.fillRect(Math.round(x + 6), Math.round(y + 1), 1, 6);
        l.fillRect(Math.round(x + 7), Math.round(y), 1, 2);
        l.fillRect(Math.round(x + 7), Math.round(y + 6), 1, 2);
        l.fillStyle = '#1e2a3a';
        l.fillRect(Math.round(x - 3), Math.round(y - 1), 1, 1);
      }, { outline: false });
    }
    // window boxes of geraniums hung under some of the sills
    for (let a = 1.6; a < W - 1; a += 3.1) {
      if (hash(Math.round(a * 10), k.seed, 5) < 0.4) continue;
      pq(p, F, a - 0.62, a + 0.62, 3.2, 5.2, PINE[F.light ? 3 : 2]);
      pq(p, F, a - 0.62, a + 0.62, 5, 5.2, PINE[F.light ? 5 : 3]);
      pq(p, F, a - 0.62, a + 0.62, 3.2, 3.4, PINE[1]);
      layer(p.c, (l) => {
        const masses: Mass[] = [];
        for (let i = 0; i < 6; i++) {
          const [x, y] = p.P(a - 0.55 + i * 0.22, T + 0.08, 5.6);
          masses.push({ x, y, rx: 5.5, ry: 4.5, z: i });
        }
        foliage(l, masses, LEAF, Math.round(a * 31) + k.seed, { cell: 2.6, dots: ['#e8402a', '#f06a7a', '#fbf6ec'], dotChance: 0.7, dotSize: 3 });
        for (let i = 0; i < 4; i++) {
          const [x, y] = p.P(a - 0.45 + i * 0.3, T + 0.1, 3.4);
          for (let j = 0; j < 4 + (i % 2) * 3; j++) px(l, x + (j % 3 === 2 ? 1 : 0), y + j, LEAF[3 + (j & 1)]);
        }
      }, { outline: 0.6 });
    }
  },
};

export const STUDIO_FACADE: Record<string, PropArt> = { lowWall };

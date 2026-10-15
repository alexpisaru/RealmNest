// Character pipeline prototype: review images for docs/charpipe/REPORT.md.
//
//   npx vite-node tools/charpipe/compare.ts [alex]      (after npm run character:build)
//
// Writes docs/charpipe/img/:
//   walk_compare.png   rows: production rig (composeTemplate se) · EffectCraft x1 · rotsprite · rotsprite walk_planar
//   work_compare.png   the same rows for work (production has 2 frames)
//   idle_compare.png   EffectCraft x1 · rotsprite idle (production has no idle: 1 standing frame)
//   outfits.png        rows: default · navy · default+beanie · navy+beanie; columns: idle 0, idle 3, walk 0–7, work 0
//   zoom_walk.png      walk frame 0, production vs x1 vs rotsprite at 8×
// and the shipped rig's frames to art/charpipe/build/<id>/production/ for gifs.py.
// All at 4× (nearest neighbour) on a neutral background with the ground line at the anchor.
import { join } from 'node:path';
import { composeTemplate } from '../../src/render/hd4/peopleTemplate';
import type { PoseMode } from '../../src/render/sprites';
import { contactSheet } from './frames';
import { blank, hex, readPng, setPx, writePng, type Img } from './img';
import { BUILD, ROOT } from './spec';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--')) ?? 'alex';
const out = join(ROOT, 'docs/charpipe/img');
const build = join(BUILD, id);

const prod = (mode: PoseMode, frame: number): Img => {
  const g = composeTemplate({ dir: 'se', mode, frame });
  const im = blank(80, 128);
  g.forEach((c, i) => c && setPx(im, i % 80, Math.floor(i / 80), hex(c)));
  return im;
};
const ec = (mode: string, combo: string, anim: string, n: number) =>
  Array.from({ length: n }, (_, i) => readPng(join(build, mode, combo, anim, `frame_${String(i).padStart(3, '0')}.png`)));

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
writePng(join(out, 'walk_compare.png'), contactSheet([range(8).map((f) => prod('walk', f)), ec('x1', 'default', 'walk', 8), ec('rotsprite', 'default', 'walk', 8), ec('rotsprite', 'default', 'walk_planar', 8)], 4, 120));
writePng(join(out, 'work_compare.png'), contactSheet([range(2).map((f) => prod('work', f)), ec('x1', 'default', 'work', 4), ec('rotsprite', 'default', 'work', 4)], 4, 120));
writePng(join(out, 'idle_compare.png'), contactSheet([ec('x1', 'default', 'idle', 8), ec('rotsprite', 'default', 'idle', 8)], 4, 120));
const combos = ['default', 'navy', 'default+beanie', 'navy+beanie'];
writePng(
  join(out, 'outfits.png'),
  contactSheet(
    combos.map((c) => {
      const idle = ec('rotsprite', c, 'idle', 8);
      return [idle[0], idle[3], ...ec('rotsprite', c, 'walk', 8), ec('rotsprite', c, 'work', 4)[0]];
    }),
    3,
    120,
  ),
);
writePng(join(out, 'zoom_walk.png'), contactSheet([[prod('walk', 0), ec('x1', 'default', 'walk', 1)[0], ec('rotsprite', 'default', 'walk', 1)[0]]], 8, 120));
// the shipped rig's frames as PNGs too, for the GIFs (tools/charpipe/gifs.py)
for (const [mode, n] of [['walk', 8], ['work', 2], ['stand', 1]] as [PoseMode, number][])
  range(n).forEach((f) => writePng(join(build, 'production', mode, `frame_${String(f).padStart(3, '0')}.png`), prod(mode, f)));
console.log(`review images in ${out}`);

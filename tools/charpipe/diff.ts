// Character pipeline prototype: how far EffectCraft's frames are from the shipped rig's, in pixels.
//
//   npx vite-node tools/charpipe/diff.ts [alex]
import { join } from 'node:path';
import { composeTemplate } from '../../src/render/hd4/peopleTemplate';
import type { PoseMode } from '../../src/render/sprites';
import { hex, px, readPng } from './img';
import { BUILD } from './spec';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--')) ?? 'alex';
const filled = (g: (string | null)[]) => g.filter(Boolean).length;
for (const [anim, mode, n] of [['walk', 'walk', 8], ['work', 'work', 2]] as [string, PoseMode, number][])
  for (const m of ['x1', 'rotsprite']) {
    const row: string[] = [];
    for (let f = 0; f < n; f++) {
      const g = composeTemplate({ dir: 'se', mode, frame: f });
      const im = readPng(join(BUILD, id, m, 'default', anim, `frame_${String(f).padStart(3, '0')}.png`));
      let d = 0;
      for (let i = 0; i < 80 * 128; i++) if ((g[i] ? hex(g[i]!) : 0) !== px(im, i % 80, Math.floor(i / 80))) d++;
      row.push(`${d} (${((d / filled(g)) * 100).toFixed(1)}%)`);
    }
    console.log(`${anim} ${m}: px differing from production per frame: ${row.join(', ')}`);
  }

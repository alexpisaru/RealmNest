// Cast factory, dev: checks PhotoCraft's painted parts against the same pieces drawn with ImgPen,
// pixel for pixel (a stray layer left visible, a lasso that fills differently, a missed piece…).
//
//   npx vite-node tools/charpipe/cast/_check-paint.ts [shape ...]     (default: masc-regular-regular)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPng, type Img } from '../img';
import { ALL_ASSETS } from './assets';
import { BANDS, LEG_BANDS, bodyGeometry, type BodyShape } from './body';
import { bodyPieces } from './draw';
import { CAST_ART } from './paths';
import { ImgPen } from './pen';

const shapes = process.argv.slice(2).filter((a) => a !== '--');
let bad = 0;
for (const id of shapes.length ? shapes : ['masc-regular-regular']) {
  const [kind, build, height] = id.split('-') as [BodyShape['kind'], BodyShape['build'], BodyShape['height']];
  const g = bodyGeometry({ kind, build, height });
  let pieces = [...bodyPieces(g), ...ALL_ASSETS.flatMap((a) => a.pieces(g))];
  if (height !== 'regular') pieces = pieces.filter((p) => LEG_BANDS.includes(BANDS[p.part]));
  const want = new Map<string, Img>();
  for (const p of pieces) {
    const k = `${p.asset}/${p.part}`;
    const pen = new ImgPen(want.get(k) ?? blank(80, 128));
    p.draw(pen);
    want.set(k, pen.im);
  }
  for (const [k, im] of want) {
    const [asset, part] = k.split('/');
    const file = join(CAST_ART, id, 'parts', asset.replace(':', '-'), `${part}.png`);
    if (!existsSync(file)) {
      console.log(`${id} ${k}: missing`);
      bad++;
      continue;
    }
    const got = readPng(file);
    let diff = 0;
    for (let i = 0; i < im.d.length; i += 4) {
      const a = im.d[i + 3] ? (im.d[i] << 16) | (im.d[i + 1] << 8) | im.d[i + 2] : -1;
      const b = got.d[i + 3] ? (got.d[i] << 16) | (got.d[i + 1] << 8) | got.d[i + 2] : -1;
      if (a !== b) diff++;
    }
    if (diff) {
      console.log(`${id} ${k}: ${diff} px differ`);
      bad++;
    }
  }
  console.log(`${id}: ${want.size} parts checked`);
}
console.log(bad ? `${bad} parts differ` : 'PhotoCraft matches the drawing everywhere');

// dev: every hair style's head, large, on one body, with the face rows marked
import { blank, blit, upscale, writePng } from '../img';
import { ALL_ASSETS } from './assets';
import { bodyGeometry } from './body';
import { bodyPieces } from './draw';
import { compose, partImages } from './preview';
const g = bodyGeometry({ kind: (process.argv[3] as never) ?? 'masc', build: 'regular', height: 'regular' });
const ids = ['', ...ALL_ASSETS.filter((a) => a.slot === 'hair').map((a) => a.id)];
const sheet = blank(ids.length * 44, 48);
for (let i = 0; i < sheet.d.length; i += 4) sheet.d.set([58, 63, 74, 255], i);
ids.forEach((id, i) => {
  const def = ALL_ASSETS.find((a) => a.id === id);
  const im = compose(g, partImages([...bodyPieces(g), ...(def ? def.pieces(g) : [])]), def ? ['body', id] : ['body']);
  const crop = blank(44, 48);
  blit(crop, im, -18, 0);
  blit(sheet, crop, i * 44, 0);
});
writePng(process.argv[2], upscale(sheet, 5));
console.log(ids.join(' '));

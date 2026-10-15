// Cast factory, dev: a quick look at assets on several bodies, drawn with ImgPen (no PhotoCraft),
// at rest, outlined per band, recoloured with random colours (as the app will).
//
//   npx vite-node tools/charpipe/cast/_assets.ts <out.png> <asset id | family:*> ... [--scale 3] [--seed 1] [--plain]
//
// The base body is always under. With --plain the canonical colours are kept. Bodies: masc
// regular, fem slim, neutral broad, masc broad tall, fem regular short (left to right).
import { blank, blit, upscale, writePng, type Img } from '../img';
import { bodyGeometry, type BodyShape } from './body';
import { ALL_ASSETS } from './assets';
import { SLOTS } from './catalog';
import { bodyPieces } from './draw';
import { CANON, TONES, rampOf } from './palette';
import { compose, partImages } from './preview';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const out = argv[0];
const wanted = argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--scale') && !all[i - 1]?.startsWith('--seed'));
const ids = ALL_ASSETS.filter((a) => wanted.some((w) => (w.endsWith(':*') ? a.id.startsWith(w.slice(0, -1)) : a.id === w))).map((a) => a.id);
if (!ids.length) throw new Error(`no assets match ${wanted.join(' ')} (have ${ALL_ASSETS.map((a) => a.id).join(', ')})`);
const shapes: BodyShape[] = [
  { kind: 'masc', build: 'regular', height: 'regular' },
  { kind: 'fem', build: 'slim', height: 'regular' },
  { kind: 'neutral', build: 'broad', height: 'regular' },
  { kind: 'masc', build: 'broad', height: 'tall' },
  { kind: 'fem', build: 'regular', height: 'short' },
];
let seed = Number(opt('seed', '1'));
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const randomHex = () => '#' + [0, 0, 0].map(() => Math.floor(40 + rnd() * 200).toString(16).padStart(2, '0')).join('');
function recolour(im: Img, map: Map<number, number>) {
  for (let i = 0; i < im.d.length; i += 4) {
    if (!im.d[i + 3]) continue;
    const k = (im.d[i] << 16) | (im.d[i + 1] << 8) | im.d[i + 2];
    const v = map.get(k);
    if (v !== undefined) im.d.set([v >> 16, (v >> 8) & 255, v & 255], i);
  }
}
const toKey = (h: string) => parseInt(h.slice(1), 16);

// one row per asset: the asset on every body
const rows = ids.length;
const sheet = blank(80 * shapes.length, 128 * rows);
ids.forEach((id, r) => {
  const def = ALL_ASSETS.find((a) => a.id === id)!;
  const map = new Map<number, number>();
  if (!flag('plain'))
    for (const m of def.materials) {
      const ramp = rampOf(m === 'skin' ? '#c98d5e' : randomHex());
      for (const t of TONES) map.set(toKey(CANON[m][t]), toKey(ramp[t]));
    }
  shapes.forEach((s, c) => {
    const g = bodyGeometry(s);
    const images = partImages([...bodyPieces(g), ...def.pieces(g)]);
    for (const a of Object.keys(images)) if (a === id) for (const im of Object.values(images[a])) if (im) recolour(im, map);
    const order = ['body', id].sort((x, y) => SLOTS.indexOf(x === 'body' ? 'body' : def.slot) - SLOTS.indexOf(y === 'body' ? 'body' : def.slot));
    const bg = blank(80, 128);
    bg.d.fill(0);
    for (let i = 0; i < bg.d.length; i += 4) bg.d.set([58, 63, 74, 255], i);
    blit(bg, compose(g, images, order), 0, 0);
    blit(sheet, bg, c * 80, r * 128);
  });
});
writePng(out, upscale(sheet, Number(opt('scale', '3'))));
console.log(`${ids.length} assets: ${ids.join(', ')}`);

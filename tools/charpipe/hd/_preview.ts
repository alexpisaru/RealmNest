import { blank, setPx, upscale, writePng, hex } from '../img';
import { bodyGeometry, PARTS, W, H } from './body';
const g = bodyGeometry();
const cols = ['#ff6b6b', '#4dabf7', '#74c0fc', '#ffd43b', '#fab005', '#69db7c', '#38d9a9', '#e599f7', '#ffa94d', '#a9e34b', '#63e6be'];
const im = blank(W * 2 + 8, H);
PARTS.forEach((p, i) => {
  const m = g.parts[p];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.get(x, y)) setPx(im, x, y, hex(cols[i]));
});
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (g.interior.get(x, y)) setPx(im, W + 8 + x, y, hex('#e08f5a')); if (g.briefs.get(x, y)) setPx(im, W + 8 + x, y, hex('#7d7e80')); }
writePng(process.argv[2], upscale(im, 3));
console.log(PARTS.map((p) => `${p}:${g.parts[p].count()}`).join(' '));

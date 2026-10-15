// Cast factory, dev: animated frames composited from the published atlases (cast.json), exactly as
// the editor and the app do it, for frame-by-frame review.
//
//   npx vite-node tools/charpipe/cast/_anim.ts <out.png> <preset[@outfit]>,... [--anims idle,walk,work,sit] [--scale 2] [--mirror]
//     e.g. founder spiky@factory.operator long@chemlab.cleanroom
// One row per look and animation, frames left to right (seated rows on a plain bench line).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS } from '../../../src/data/presets';
import { blank, blit, decodePng, upscale, writePng, type Img } from '../img';
import { castLookFor, type CastLook } from './looks';
import { CANON, TONES, rampFor } from './palette';
import { CAST_OUT } from './paths';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opt = (n: string, d: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const out = argv[0];
const specs = argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
const anims = opt('anims', 'idle,walk,work,sit').split(',');
const mirror = argv.includes('--mirror');
const M = JSON.parse(readFileSync(join(CAST_OUT, 'cast.json'), 'utf8'));
const atlasCache = new Map<string, Img>();
const atlas = (name: string) => atlasCache.get(name) ?? atlasCache.set(name, decodePng(readFileSync(join(CAST_OUT, name)))).get(name)!;

function frame(L: CastLook, anim: string, f: number): Img {
  const im = blank(80, 128);
  const shape = `${L.shape.kind}-${L.shape.build}`;
  const S = M.shapes[shape];
  const hDy = M.heightDy[L.shape.height];
  for (const band of M.bandOrder[anim] ?? M.bandOrder.default)
    for (const la of L.assets) {
      const fr = S.frames[la.asset]?.[band];
      if (!fr) continue;
      const leg = M.legBands.includes(band);
      const e = (leg ? fr[L.shape.height] : fr.all)?.[anim]?.[f];
      if (!e) continue;
      const [ai, sx, sy, w, h, dx, dy] = e;
      const src = atlas(S.atlases[ai]);
      const c = blank(w, h);
      blit(c, src, -sx, -sy);
      const map = new Map<number, number>();
      for (const [m, col] of Object.entries(la.colors)) {
        if (!col || !CANON[m]) continue;
        const r = rampFor(m, col);
        for (const t of TONES) map.set(parseInt(CANON[m][t].slice(1), 16), parseInt(r[t].slice(1), 16));
      }
      for (let i = 0; i < c.d.length; i += 4) {
        if (!c.d[i + 3]) continue;
        const v = map.get((c.d[i] << 16) | (c.d[i + 1] << 8) | c.d[i + 2]);
        if (v !== undefined) c.d.set([v >> 16, (v >> 8) & 255, v & 255], i);
      }
      blit(im, c, dx, dy + (leg ? 0 : hDy));
    }
  if (!mirror) return im;
  const m = blank(80, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 80; x++) m.d.set(im.d.subarray((y * 80 + x) * 4, (y * 80 + x) * 4 + 4), (y * 80 + 79 - x) * 4);
  return m;
}

const rows: Img[][] = [];
for (const s of specs) {
  const [pid, outfit] = s.split('@');
  const p = PRESETS.find((x) => x.id === pid)!;
  const prof = { ...p.profile };
  delete prof.art;
  const L = castLookFor(prof, p.signature, outfit ?? p.outfitId ?? 'office.tech_casual');
  for (const a of anims) {
    const def = M.anims.find((x: { id: string }) => x.id === a);
    rows.push(Array.from({ length: def.frames }, (_, f) => frame(L, a, f)));
  }
}
const cols = Math.max(...rows.map((r) => r.length));
const sheet = blank(cols * 82, rows.length * 130);
for (let i = 0; i < sheet.d.length; i += 4) sheet.d.set([58, 63, 74, 255], i);
rows.forEach((r, y) => r.forEach((im, x) => blit(sheet, im, x * 82, y * 130)));
writePng(out, upscale(sheet, Number(opt('scale', '2'))));
console.log(`${rows.length} rows × up to ${cols} frames`);

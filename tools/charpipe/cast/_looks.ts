// Cast factory, dev: the app's looks in the cast model, at rest (ImgPen, no PhotoCraft), for review.
//
//   npx vite-node tools/charpipe/cast/_looks.ts <out-dir>
//
// Writes presets.png (the 12 presets, each in its world's default outfit and in a second one),
// outfits-<world>.png (every outfit of every world, worn by a few presets) and hair.png (every hair
// style and face extra on a few bodies).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUTFITS, outfitLayers } from '../../../src/data/outfits';
import { PRESETS, SKIN_TONES } from '../../../src/data/presets';
import { WORLDS } from '../../../src/data/worlds';
import type { VisualProfile } from '../../../src/domain/character';
import { blank, blit, upscale, writePng, type Img } from '../img';
import { ALL_ASSETS, assetById } from './assets';
import { bodyGeometry } from './body';
import { bodyPieces } from './draw';
import { castLook, type CastLook } from './looks';
import { CANON, TONES, rampFor } from './palette';
import { compose, partImages } from './preview';

const outDir = process.argv.slice(2).find((a) => a !== '--')!;
mkdirSync(outDir, { recursive: true });
const BG = [58, 63, 74, 255];

function recolourMap(materials: Record<string, string | undefined>) {
  const map = new Map<number, number>();
  for (const [m, c] of Object.entries(materials)) {
    if (!c || !CANON[m]) continue;
    const r = rampFor(m, c);
    for (const t of TONES) map.set(parseInt(CANON[m][t].slice(1), 16), parseInt(r[t].slice(1), 16));
  }
  return map;
}
function recolour(im: Img, map: Map<number, number>) {
  for (let i = 0; i < im.d.length; i += 4) {
    if (!im.d[i + 3]) continue;
    const v = map.get((im.d[i] << 16) | (im.d[i + 1] << 8) | im.d[i + 2]);
    if (v !== undefined) im.d.set([v >> 16, (v >> 8) & 255, v & 255], i);
  }
}

/** one figure at rest, as the app would show it */
export function figure(look: CastLook): Img {
  const g = bodyGeometry(look.shape);
  const ids = look.assets.map((a) => a.asset).filter((id) => id === 'body' || assetById(id));
  const images = partImages([...bodyPieces(g), ...ids.filter((id) => id !== 'body').flatMap((id) => assetById(id)!.pieces(g))]);
  for (const la of look.assets) for (const im of Object.values(images[la.asset] ?? {})) if (im) recolour(im, recolourMap(la.colors));
  const bg = blank(80, 128);
  for (let i = 0; i < bg.d.length; i += 4) bg.d.set(BG, i);
  blit(bg, compose(g, images, ids), 0, 0);
  return bg;
}

const grid = (figs: Img[], cols: number) => {
  const rows = Math.ceil(figs.length / cols);
  const im = blank(cols * 80, rows * 128);
  for (let i = 0; i < im.d.length; i += 4) im.d.set(BG, i);
  figs.forEach((f, i) => blit(im, f, (i % cols) * 80, Math.floor(i / cols) * 128));
  return upscale(im, 2);
};
const missing = new Set<string>();
const look = (p: VisualProfile, sig: string, outfit: string) => {
  const l = castLook(p, sig, outfitLayers(outfit));
  for (const a of l.assets) if (a.asset !== 'body' && !assetById(a.asset)) missing.add(a.asset);
  return l;
};

// the presets, each in its world default and in the universal tee
const presetFigs = PRESETS.flatMap((pr) => [figure(look(pr.profile, pr.signature, pr.outfitId ?? 'office.tech_casual')), figure(look(pr.profile, pr.signature, 'universal.hoodie'))]);
writePng(join(outDir, 'presets.png'), grid(presetFigs, 8));

// every outfit, worn by presets in turn
for (const w of ['universal', ...WORLDS.map((x) => x.id)]) {
  const list = OUTFITS.filter((o) => o.worldCategory === w);
  const figs = list.map((o, i) => {
    const pr = PRESETS[(i * 5 + w.length) % PRESETS.length];
    return figure(look(pr.profile, pr.signature, o.id));
  });
  writePng(join(outDir, `outfits-${w}.png`), grid(figs, 8));
}

// every hair style and face extra on three bodies
const hairIds = ALL_ASSETS.filter((a) => a.slot === 'hair' || a.slot === 'face').map((a) => a.id);
const bodies: Pick<VisualProfile, 'body' | 'build' | 'height' | 'skin'>[] = [
  { body: 'masc', build: 'regular', height: 'regular', skin: 'warm' },
  { body: 'fem', build: 'slim', height: 'regular', skin: 'brown' },
  { body: 'neutral', build: 'broad', height: 'tall', skin: 'porcelain' },
];
const hairColors = ['#3b2418', '#f0cf72', '#1c1b24', '#bc5730', '#6a5bd6'];
const hairFigs = hairIds.flatMap((id, i) =>
  bodies.map((b, j) => {
    const p: VisualProfile = { ...b, hair: 'shaved', hairColor: hairColors[(i + j) % hairColors.length], eyeColor: '#6b3b22' };
    const l = castLook(p, '#5b8def', outfitLayers('universal.tee'));
    l.assets = l.assets.filter((a) => !a.asset.startsWith('hair:'));
    l.assets.push({ asset: id, slot: assetById(id)!.slot, colors: { hair: p.hairColor, accent: '#e2553b', skin: SKIN_TONES[b.skin].base } });
    return figure(l);
  }),
);
if (hairFigs.length) writePng(join(outDir, 'hair.png'), grid(hairFigs, 9));
console.log(`written to ${outDir}${missing.size ? `; missing assets: ${[...missing].join(', ')}` : ''}`);

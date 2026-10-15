// Cast factory, step 3: pack the animated, outlined frames into atlases and write the manifest
// the editor and the app read.
//
//   npx vite-node tools/charpipe/cast/cast-pack.ts
//
// Every frame is cropped to its pixels and shelf-packed into a few atlases per upper body (kind ×
// build) and family (body, hair, head, legs, wear). An entry per asset, band, height key and
// animation lists its frames as [atlas, sx, sy, w, h, dx, dy] (or null when empty): draw the crop
// at (dx, dy) in the 80×128 frame, plus HEIGHT_DY for upper bands on a short or tall body.
//
// Writes src/assets/characters/cast/<upper>/<family>-<n>.png and src/assets/characters/cast/cast.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bbox, blank, blit, readPng, writePng, type Img } from '../img';
import { loadAnimations } from '../spec';
import { ALL_ASSETS } from './assets';
import { BAND_ORDER, BUILDS, FOOT, HEIGHT_DY, KINDS, LEG_BANDS, upperId } from './body';
import { SLOTS, type Slot } from './catalog';
import { CANON, FIXED } from './palette';
import { CAST_BUILD, CAST_OUT as OUT } from './paths';

const anims = loadAnimations(['idle', 'walk', 'work', 'sit']);
const FAMILY: Partial<Record<Slot, string>> = { body: 'body', hair: 'hair', face: 'hair', headgear: 'head', glasses: 'head', accessory: 'head', pants: 'legs', shoes: 'legs', boots: 'legs', skirt: 'legs' };
const familyOf = (slot: Slot) => FAMILY[slot] ?? 'wear';
const slotOf = (asset: string): Slot => (asset === 'body' ? 'body' : ALL_ASSETS.find((a) => a.id === asset)!.slot);
const ATLAS_W = 1024;
const ATLAS_MAX_H = 2048;

type Entry = [number, number, number, number, number, number, number] | null;
rmSync(OUT, { recursive: true, force: true });
const shapes: Record<string, { atlases: string[]; frames: Record<string, Record<string, Record<string, Record<string, Entry[]>>>> }> = {};
let total = 0;

for (const u of KINDS.flatMap((kind) => BUILDS.map((build) => ({ kind, build })))) {
  const up = upperId(u);
  const dir = join(CAST_BUILD, up);
  if (!existsSync(dir)) continue;
  const assetDirs = readdirSync(dir).filter((d) => d !== '_work' && existsSync(join(dir, d, 'done.json')));
  // every frame of this body, cropped, grouped by family
  const crops: Record<string, { key: [string, string, string, string, number]; im: Img; dx: number; dy: number }[]> = {};
  const frames: (typeof shapes)[string]['frames'] = {};
  for (const ad of assetDirs) {
    const { asset, bands } = JSON.parse(readFileSync(join(dir, ad, 'done.json'), 'utf8')) as { asset: string; bands: Record<string, string[]> };
    const fam = familyOf(slotOf(asset));
    for (const [band, keys] of Object.entries(bands))
      for (const hk of keys)
        for (const a of anims) {
          const strip = readPng(join(dir, ad, band, hk, `${a.id}.png`));
          const list: Entry[] = [];
          ((frames[asset] ??= {})[band] ??= {})[hk] ??= {};
          frames[asset][band][hk][a.id] = list;
          for (let f = 0; f < a.frames; f++) {
            const fr = blank(80, 128);
            for (let y = 0; y < 128; y++) fr.d.set(strip.d.subarray((y * strip.w + f * 80) * 4, (y * strip.w + f * 80 + 80) * 4), y * 80 * 4);
            const b = bbox(fr);
            if (!b) {
              list.push(null);
              continue;
            }
            const [x0, y0, x1, y1] = b;
            const im = blank(x1 - x0 + 1, y1 - y0 + 1);
            blit(im, fr, -x0, -y0);
            (crops[fam] ??= []).push({ key: [asset, band, hk, a.id, f], im, dx: x0, dy: y0 });
            list.push(null);
          }
        }
  }
  // shelf packing, tallest first
  const atlases: string[] = [];
  for (const [fam, list] of Object.entries(crops)) {
    list.sort((a, b) => b.im.h - a.im.h);
    let sheet = blank(ATLAS_W, ATLAS_MAX_H);
    let x = 0, y = 0, rowH = 0, used = 0, n = 0;
    const flush = () => {
      const im = blank(ATLAS_W, used);
      blit(im, sheet, 0, 0);
      const name = `${up}/${fam}-${n++}.png`;
      writePng(join(OUT, name), im);
      atlases.push(name);
    };
    for (const c of list) {
      if (x + c.im.w > ATLAS_W) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      if (y + c.im.h > ATLAS_MAX_H) {
        flush();
        sheet = blank(ATLAS_W, ATLAS_MAX_H);
        x = y = rowH = used = 0;
      }
      blit(sheet, c.im, x, y);
      const [asset, band, hk, anim, f] = c.key;
      frames[asset][band][hk][anim][f] = [atlases.length, x, y, c.im.w, c.im.h, c.dx, c.dy];
      x += c.im.w;
      rowH = Math.max(rowH, c.im.h);
      used = Math.max(used, y + rowH);
      total++;
    }
    flush();
  }
  shapes[up] = { atlases, frames };
  console.log(`${up}: ${assetDirs.length} assets, ${atlases.length} atlases`);
}

mkdirSync(OUT, { recursive: true });
const manifest = {
  generator: 'tools/charpipe/cast (PhotoCraft paints, EffectCraft animates, outlines per band after animation)',
  frame: { w: 80, h: 128 },
  anchor: { x: FOOT[0], y: FOOT[1] },
  heightDy: HEIGHT_DY,
  legBands: LEG_BANDS,
  bandOrder: BAND_ORDER,
  slots: SLOTS,
  anims: anims.map((a) => ({ id: a.id, label: a.label, frames: a.frames, fps: a.fps, loop: a.loop, anchorDy: a.anchorDy ?? 0 })),
  canon: CANON,
  fixed: FIXED,
  assets: Object.fromEntries([['body', { slot: 'body', label: 'Body', materials: ['skin', 'eyes', 'hair'] }], ...ALL_ASSETS.map((a) => [a.id, { slot: a.slot, label: a.label, materials: a.materials }])]),
  shapes,
};
writeFileSync(join(OUT, 'cast.json'), JSON.stringify(manifest));
console.log(`cast.json: ${Object.keys(shapes).length} bodies, ${total} frames, ${(JSON.stringify(manifest).length / 1024).toFixed(0)} KB`);

// HD character studio, step 2: animate every asset on the standard rig in EffectCraft and publish
// layered sprite sheets the studio composites at runtime.
//
//   npx vite-node tools/charpipe/hd/studio-build.ts [base | base-f]     (after studio-photocraft.ts)
//
// Every asset (the body, each hair, top, bottom, shoes) is rendered band by band (back hair, far
// arm, far leg, near leg, torso, head, near arm) with the same rig and animations, RotSprite
// quality (8×, sampled back). Each band frame is then outlined around its own silhouette
// (outline.ts). Drawing the bands back to front, each band's assets in slot order (body, shoes,
// bottom, top, hair), gives the finished frame.
//
// Writes src/assets/characters/studio/<id>/: <asset>/<band>/<anim>.png strips + studio.json, and
// a defect report (stray pixels, seam holes) for every preset look and animation.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findDefects } from '../defects';
import { buildTemplate, effectcraftVersion, render } from '../effectcraft';
import { normalise, pack, paletteOf } from '../frames';
import { blank, blit, readPng, writePng, type Img } from '../img';
import { enlarge8 } from '../parts';
import { ART, BUILD, ROOT, loadRig, type AnimationSpec, type CharacterSpec } from '../spec';
import { BAND_ORDER, BANDS, FOOT, H, JOINT, PARTS, REACH, W, at, bodyGeometry, pivots, soles } from './body';
import type { StudioSpec } from './draw';
import { outlineAll } from './outline';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--')) ?? 'base';
const src = join(ART, 'studio', id);
const spec = JSON.parse(readFileSync(join(src, 'studio.spec.json'), 'utf8')) as StudioSpec;
const { parts: partsOf } = JSON.parse(readFileSync(join(src, 'studio-parts.json'), 'utf8')) as { parts: Record<string, string[]> };
const build = join(BUILD, `studio-${id}`);
const out = join(ROOT, 'src/assets/characters/studio', id);
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
const dirOf = (asset: string) => asset.replace(':', '-');
const SLOTS = ['body', 'shoes', 'bottom', 'top', 'hair'];
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

const geo = bodyGeometry(spec.body ?? 'm');
const rig = loadRig('humanoid-3q');
// the HD bodies' own animations (art/charpipe/studio/animations), in this frame's pixels
const anims = ['idle', 'walk', 'work'].map((a) => JSON.parse(readFileSync(join(ART, 'studio/animations', `${a}.json`), 'utf8')) as AnimationSpec);
rmSync(build, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
const assets = ['body', ...spec.assets.map((a) => a.id)];
const slotOf = (a: string) => (a === 'body' ? 'body' : spec.assets.find((x) => x.id === a)!.slot);
// one palette for the checks: everything any asset may contain, outlines included
const palette = paletteOf(...assets.flatMap((a) => partsOf[a].map((p) => readPng(join(src, 'parts', dirOf(a), `${p}.png`)))));
for (const c of spec.outline) palette.add(((parseInt(c.slice(1), 16) << 8) | 0xff) >>> 0);
log(`${spec.name}: body ${geo.kind}, ${assets.length} assets, ${effectcraftVersion()}`);

const manifest = {
  id,
  name: spec.name,
  body: geo.kind,
  generator: 'tools/charpipe/hd (PhotoCraft draws, EffectCraft animates, outlines per band after animation)',
  frame: { w: W, h: H },
  anchor: { x: FOOT[0], y: FOOT[1] },
  bands: BAND_ORDER,
  slots: SLOTS,
  outline: spec.outline,
  animations: anims.map((a) => ({ id: a.id, label: a.label, frames: a.frames, fps: a.fps, loop: a.loop })),
  assets: {} as Record<string, { slot: string; label: string; ramps: Record<string, Record<string, string>>; sheets: Record<string, Record<string, string>> }>,
  outfits: spec.outfits,
};
const ch0 = { id, name: spec.name, rig: rig.id, view: 'se', source: { file: '' }, pivots: pivots(geo), soles: soles(geo), reach: REACH, variants: { default: { label: '' } }, accessories: {}, frame: { w: W, h: H }, foot: FOOT };
const frames: Record<string, Record<string, Record<string, Img[]>>> = {};
let corrections = 0;
const allFills: Record<string, Record<string, Record<string, Img[]>>> = {};
for (const asset of assets) {
  const meta = spec.assets.find((a) => a.id === asset);
  manifest.assets[asset] = {
    slot: slotOf(asset),
    label: meta?.label ?? 'Base body',
    ramps: meta ? { main: meta.colors as unknown as Record<string, string> } : { skin: spec.skin as unknown as Record<string, string>, briefs: spec.briefs as unknown as Record<string, string> },
    sheets: {},
  };
  // 1. every band of this asset, animated and sampled back (fills only)
  const fills: Record<string, Record<string, Img[]>> = (allFills[asset] = {});
  for (const band of BAND_ORDER) {
    const parts = PARTS.filter((p) => BANDS[p] === band && partsOf[asset].includes(p));
    if (!parts.length) continue;
    const parts8: Record<string, string> = {};
    for (const p of parts) {
      parts8[p] = join(build, 'parts8', dirOf(asset), `${p}.png`);
      writePng(parts8[p], enlarge8(readPng(join(src, 'parts', dirOf(asset), `${p}.png`))));
    }
    const ch: CharacterSpec = { ...ch0, id: `${id}-${dirOf(asset)}-${band}`, layers: parts.map((p) => ({ id: p, joint: JOINT[p] })) };
    const project = join(build, dirOf(asset), band, 'template.ecproj');
    buildTemplate({ rig, ch, anims, k: 8, parts: parts8, accessories: {}, out: project }, join(build, dirOf(asset), band, 'build.jsx'));
    fills[band] = {};
    for (const a of anims) {
      const raw = join(build, dirOf(asset), band, a.id, 'raw');
      render(project, a.id, raw);
      const r = normalise(raw, join(build, dirOf(asset), band, a.id), { anim: a.id, mode: `${asset}/${band}`, k: 8, w: W, h: H, palette });
      corrections += r.report.frames.reduce((n, f) => n + f.partialAlpha + f.offPalette, 0);
      fills[band][a.id] = r.frames;
    }
  }
  log(`${asset}: ${Object.keys(fills).join(', ')}`);
}

// 2. outline every band frame around its own silhouette, knowing what lies under it (the body: a
// ring falling on it is a 1-px line), then pack
const shoulderY = at(0, 98)[1];
for (const a of anims)
  for (let f = 0; f < a.frames; f++) {
    const one = Object.fromEntries(Object.entries(allFills).map(([asset, bands]) => [asset, Object.fromEntries(Object.entries(bands).map(([band, byAnim]) => [band, byAnim[a.id][f]]))]));
    const done = outlineAll(one, slotOf, spec.outline, shoulderY);
    for (const [asset, bands] of Object.entries(done)) for (const [band, im] of Object.entries(bands)) (((frames[asset] ??= {})[band] ??= {})[a.id] ??= [])[f] = im;
  }
for (const [asset, bands] of Object.entries(frames))
  for (const [band, byAnim] of Object.entries(bands))
    for (const [anim, list] of Object.entries(byAnim)) {
      const sheet = `${dirOf(asset)}/${band}/${anim}.png`;
      writePng(join(out, sheet), pack(list));
      (manifest.assets[asset].sheets[band] ??= {})[anim] = sheet;
    }

// the check: every preset look, every animation, every frame, composited as the studio does it
const compose = (chosen: string[], anim: string, f: number) => {
  const im = blank(W, H);
  for (const band of BAND_ORDER) for (const slot of SLOTS) for (const a of chosen) if (slotOf(a) === slot && frames[a][band]) blit(im, frames[a][band][anim][f], 0, 0);
  return im;
};
const looks: Record<string, string[]> = { body: ['body'] };
for (const [o, v] of Object.entries(spec.outfits)) for (const hair of spec.assets.filter((a) => a.slot === 'hair')) looks[`${o}+${hair.id}`] = ['body', v.shoes, v.bottom, v.top, hair.id];
const report: Record<string, Record<string, number>> = {};
for (const [name, look] of Object.entries(looks)) {
  report[name] = {};
  for (const a of anims) {
    let n = 0;
    for (let f = 0; f < a.frames; f++) n += findDefects(compose(look, a.id, f)).length;
    report[name][a.id] = n;
  }
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'studio.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(build, 'defects.json'), JSON.stringify(report, null, 2) + '\n');
log(`defects (stray pixels + holes ≤ 4 px) per look: ${Object.entries(report).map(([k, v]) => `${k} ${Object.values(v).join('/')}`).join(', ')}`);
log(`done: ${corrections} pixels needed correction; published ${rel(out)}`);

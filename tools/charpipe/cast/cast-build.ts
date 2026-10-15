// Cast factory, step 2: animate every asset band by band in EffectCraft, on every body shape, and
// outline each band frame after animation.
//
//   npx vite-node tools/charpipe/cast/cast-build.ts [--shard 0/3] [--assets body,hair:*] [--uppers masc-regular]
//
// For each upper body (kind × build) and asset: every band the asset has is rendered with the
// standard rig and the shared animations (idle, walk, work, sit) at RotSprite quality (8×, sampled
// back). Upper bands are rendered once (on the regular height; the runtime offsets them for other
// heights); leg bands once per height. Each frame then gets the 1-px outline around its own
// silhouette, except across the same asset's other bands where it is one continuous piece
// (trousers' waist into their legs, skin into skin, hair over the head into the hair behind it).
// Several shards can run at once (one EffectCraft process each).
//
// Writes art/charpipe/build/cast/<upper>/<asset>/<band>/<height|all>/<anim>.png (frame strips).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTemplate, effectcraftVersion, render } from '../effectcraft';
import { normalise, pack, paletteOf } from '../frames';
import { cleanSilhouette, outlineFrame } from '../hd/outline';
import { blank, blit, readPng, writePng, type Img } from '../img';
import { enlarge8 } from '../parts';
import { loadAnimations, loadRig, type CharacterSpec } from '../spec';
import { CAST_ART, CAST_BUILD } from './paths';
import { BANDS, BUILDS, FOOT, HEIGHT_DY, HEIGHTS, JOINT, KINDS, LEG_BANDS, PARTS, bodyGeometry, shapeId, upperId, type Part } from './body';
import { FIXED } from './palette';
import { ALL_ASSETS } from './assets';
import { EXTERIOR_ONLY, outlined } from './catalog';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const [shard, shards] = (opt('shard') ?? '0/1').split('/').map(Number);
const pick = opt('assets')?.split(',');
const wanted = (id: string) => !pick || pick.some((w) => (w.endsWith('*') ? id.startsWith(w.slice(0, -1)) : id === w));
const uppers = KINDS.flatMap((kind) => BUILDS.map((build) => ({ kind, build }))).filter((u, i) => (opt('uppers') ? opt('uppers')!.split(',').includes(upperId(u)) : i % shards === shard));
const dirOf = (asset: string) => asset.replace(':', '-');
const rig = loadRig('humanoid-3q');
const anims = loadAnimations(['idle', 'walk', 'work', 'sit']);
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
log(`shard ${shard}/${shards}: ${uppers.map(upperId).join(', ')}; ${effectcraftVersion()}`);

/** bands of one asset that are one continuous piece (no outline between them) */
const MERGE: Record<string, string[]> = { torso: ['legL', 'legR'], legL: ['torso'], legR: ['torso'], head: ['back'], back: ['head'] };

for (const u of uppers) {
  const up = upperId(u);
  const regular = shapeId({ ...u, height: 'regular' });
  const partsOf = (shape: string) => JSON.parse(readFileSync(join(CAST_ART, shape, 'parts.json'), 'utf8')).parts as Record<string, Part[]>;
  const partsReg = partsOf(regular);
  const assets = Object.keys(partsReg).filter(wanted);
  // one palette for every asset of this body: anything painted, and the outline
  const palette = paletteOf(...Object.entries(partsReg).flatMap(([a, ps]) => ps.map((p) => readPng(join(CAST_ART, regular, 'parts', dirOf(a), `${p}.png`)))));
  palette.add(((parseInt(FIXED.outline.slice(1), 16) << 8) | 0xff) >>> 0);

  for (const asset of assets) {
    const slot = asset === 'body' ? 'body' : ALL_ASSETS.find((a) => a.id === asset)!.slot;
    const exterior = EXTERIOR_ONLY.includes(slot);
    const bare = !outlined(asset, slot);
    // 1. fills: band → height key (all | short | regular | tall) → anim → frames
    const fills: Record<string, Record<string, Record<string, Img[]>>> = {};
    const bands = [...new Set(partsReg[asset].map((p) => BANDS[p]))];
    for (const band of bands) {
      const keys = LEG_BANDS.includes(band) ? HEIGHTS : (['all'] as const);
      for (const hk of keys) {
        const shape = { ...u, height: hk === 'all' ? ('regular' as const) : hk };
        const sid = shapeId(shape);
        const parts = (hk === 'all' ? partsReg : partsOf(sid))[asset]?.filter((p) => BANDS[p] === band) ?? [];
        if (!parts.length) continue;
        const g = bodyGeometry(shape);
        const work = join(CAST_BUILD, '_work', up, dirOf(asset), band, hk);
        const parts8: Record<string, string> = {};
        for (const p of parts) {
          parts8[p] = join(work, 'parts8', `${p}.png`);
          writePng(parts8[p], enlarge8(readPng(join(CAST_ART, sid, 'parts', dirOf(asset), `${p}.png`))));
        }
        const ch: CharacterSpec = {
          id: `${sid}-${dirOf(asset)}-${band}`,
          name: asset,
          rig: rig.id,
          view: 'se',
          source: { file: '' },
          pivots: g.pivots,
          soles: g.soles,
          reach: g.reach,
          variants: { default: { label: '' } },
          accessories: {},
          frame: { w: 80, h: 128 },
          foot: FOOT,
          layers: PARTS.filter((p) => parts.includes(p)).map((p) => ({ id: p, joint: JOINT[p] })),
        };
        const project = join(work, 'template.ecproj');
        buildTemplate({ rig, ch, anims, k: 8, parts: parts8, accessories: {}, out: project }, join(work, 'build.jsx'));
        for (const a of anims) {
          const raw = join(work, a.id, 'raw');
          render(project, a.id, raw);
          ((fills[band] ??= {})[hk] ??= {})[a.id] = normalise(raw, join(work, a.id), { anim: a.id, mode: `${asset}/${band}`, k: 8, w: 80, h: 128, palette }).frames;
        }
      }
    }
    // 2. outline every frame (not across the asset's own continuous bands), write strips
    const shift = (im: Img, dy: number) => {
      if (!dy) return im;
      const out = blank(im.w, im.h);
      blit(out, im, 0, dy);
      return out;
    };
    for (const [band, byH] of Object.entries(fills))
      for (const [hk, byAnim] of Object.entries(byH))
        for (const a of anims) {
          const frames = byAnim[a.id].map((im, f) => {
            const suppress: Img[] = [];
            for (const other of MERGE[band] ?? []) {
              const o = fills[other];
              if (!o) continue;
              if (LEG_BANDS.includes(other)) {
                // legs at this height (an upper band: the regular legs)
                const legs = o[hk === 'all' ? 'regular' : hk]?.[a.id]?.[f];
                if (legs) suppress.push(legs);
              } else {
                // an upper band next to legs of another height: move it as the runtime will
                const upper = o.all?.[a.id]?.[f];
                if (upper) suppress.push(shift(upper, hk === 'all' ? 0 : HEIGHT_DY[hk as keyof typeof HEIGHT_DY]));
              }
            }
            return bare ? im : outlineFrame(cleanSilhouette(im), [FIXED.outline], suppress, [], exterior);
          });
          const dir = join(CAST_BUILD, up, dirOf(asset), band, hk);
          mkdirSync(dir, { recursive: true });
          writePng(join(dir, `${a.id}.png`), pack(frames));
        }
    writeFileSync(join(CAST_BUILD, up, dirOf(asset), 'done.json'), JSON.stringify({ asset, bands: Object.fromEntries(Object.entries(fills).map(([b, h]) => [b, Object.keys(h)])) }) + '\n');
    log(`${up} ${asset}: ${Object.keys(fills).join(', ')}`);
  }
}
if (!existsSync(CAST_BUILD)) mkdirSync(CAST_BUILD, { recursive: true });
log('done');

// Cast factory, step 4: the editor page, self-contained (atlases embedded, the look logic bundled).
//
//   npx vite-node tools/charpipe/cast/cast-html.ts            (after cast-pack.ts)
//
// Writes docs/charpipe/cast/cast-studio.html (page content, as published) and cast-studio.local.html
// (the same with a document shell, to open from disk).
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORLDS } from '../../../src/data/worlds';
import { ROOT } from '../spec';
import { CAST_OUT } from './paths';

const manifest = JSON.parse(readFileSync(join(CAST_OUT, 'cast.json'), 'utf8'));
const atlases: Record<string, string> = {};
for (const s of Object.values(manifest.shapes) as { atlases: string[] }[]) for (const a of s.atlases) atlases[a] = `data:image/png;base64,${readFileSync(join(CAST_OUT, a)).toString('base64')}`;
const api = buildSync({ entryPoints: [join(ROOT, 'tools/charpipe/cast/page-api.ts')], bundle: true, format: 'iife', globalName: 'Cast', write: false, minify: true, target: 'es2020' }).outputFiles[0].text;
const data = {
  manifest,
  atlases,
  worlds: [{ id: 'universal', name: 'Universali', defaultOutfit: 'universal.tee' }, ...WORLDS.map((w) => ({ id: w.id, name: w.name, defaultOutfit: w.defaultOutfitId }))],
  hairStyles: Object.keys(manifest.assets).filter((a) => a.startsWith('hair:')).map((a) => a.slice(5)),
};
const page = readFileSync(join(ROOT, 'tools/charpipe/cast/cast-page.html'), 'utf8').replace('/*__CAST_API__*/', () => api.replace(/<\/script/gi, '<\\/script')).replace('/*__DATA__*/null', () => JSON.stringify(data));
const out = join(ROOT, 'docs/charpipe/cast');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'cast-studio.html'), page);
writeFileSync(join(out, 'cast-studio.local.html'), `<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${page}\n</body></html>\n`);
console.log(`cast-studio.html: ${(page.length / 1024 / 1024).toFixed(2)} MB, ${Object.keys(atlases).length} atlases, ${Object.keys(manifest.shapes).length} bodies`);

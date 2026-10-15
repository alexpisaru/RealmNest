// HD character studio, end to end: PhotoCraft draws each base body (male `base`, female `base-f`)
// and every asset, EffectCraft animates them band by band on the standard rig with the HD
// animations (art/charpipe/studio/animations), then the editor page is generated with both bodies.
//
//   npm run character:studio              (both bodies)
//   npm run character:studio -- base-f    (one body; the page still includes both)
//
// Needs PhotoCraft 0.7+ and EffectCraft 0.8+. Each step is its own script and can be rerun alone.
import { execFileSync } from 'node:child_process';

const ids = process.argv.slice(2).filter((a) => a !== '--' && !a.startsWith('--'));
const studios = ids.length ? ids : ['base', 'base-f'];
const t0 = Date.now();
const run = (label: string, script: string, args: string[]) => {
  const t = Date.now();
  console.log(`── ${label}`);
  execFileSync(process.execPath, ['node_modules/vite-node/vite-node.mjs', script, ...args], { stdio: 'inherit' });
  console.log(`   ${((Date.now() - t) / 1000).toFixed(1)} s`);
};
for (const id of studios) {
  run(`${id}: PhotoCraft, draw the body and the assets`, 'tools/charpipe/hd/studio-photocraft.ts', [id]);
  run(`${id}: EffectCraft, animate every asset band by band`, 'tools/charpipe/hd/studio-build.ts', [id]);
}
run('Editor page', 'tools/charpipe/hd/studio-html.ts', []);
console.log(`studio ${studios.join(', ')}: built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// Character factory, end to end: CharacterSpec → PhotoCraft → EffectCraft → cleanup → RealmNest sheets.
//
//   npm run character:create -- maya
//
// 1. tools/charpipe/photocraft-build.ts  draw the character in PhotoCraft from <id>.spec.json
//                                         (parts, outfits, accessory, character.json)
// 2. tools/charpipe/build.ts             rig + animate + render in EffectCraft, normalise, pack
// 3. tools/charpipe/cleanup.ts           PhotoCraft cleanup pass, measured; final <id>_<anim>.png
// Every step is its own script and can be rerun alone. Needs PhotoCraft 0.7+ and EffectCraft 0.8+.
import { execFileSync } from 'node:child_process';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--'));
if (!id) {
  console.log('usage: npm run character:create -- <id>   (art/charpipe/characters/<id>/<id>.spec.json)');
  process.exit(1);
}
const t0 = Date.now();
for (const [label, script] of [
  ['PhotoCraft: draw', 'tools/charpipe/photocraft-build.ts'],
  ['EffectCraft: rig, animate, render', 'tools/charpipe/build.ts'],
  ['PhotoCraft: cleanup', 'tools/charpipe/cleanup.ts'],
]) {
  const t = Date.now();
  console.log(`── ${label}`);
  execFileSync(process.execPath, ['node_modules/vite-node/vite-node.mjs', script, id], { stdio: 'inherit' });
  console.log(`   ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
console.log(`${id}: created in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

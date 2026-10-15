// Cast factory, end to end: the Maya/Teo character model for every body, hair style, outfit piece,
// headgear and accessory of the app.
//
//   npm run character:cast                 (everything; PhotoCraft 0.7+, EffectCraft 0.8+)
//   npm run character:cast -- --fast       (paint with ImgPen instead of PhotoCraft)
//   npm run character:cast -- --shards 3   (EffectCraft processes in parallel; default 3)
//
// 1. cast-paint.ts  paint every asset on every body shape (27: kind × build × height)
// 2. cast-build.ts  animate every asset band by band (idle, walk, work, sit), outline each frame
// 3. cast-pack.ts   crop and pack the frames into atlases, write cast.json
// 4. cast-html.ts   the editor page (docs/charpipe/cast/cast-studio.html)
import { execFileSync, spawn } from 'node:child_process';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const shards = Number(argv.includes('--shards') ? argv[argv.indexOf('--shards') + 1] : 3);
const node = (script: string, args: string[] = []) => [process.execPath, ['node_modules/vite-node/vite-node.mjs', `tools/charpipe/cast/${script}`, ...args]] as const;
const t0 = Date.now();
const step = (label: string) => console.log(`── ${label} [${((Date.now() - t0) / 1000).toFixed(0)} s]`);

step('PhotoCraft: paint every asset on every body');
execFileSync(...node('cast-paint.ts', argv.includes('--fast') ? ['--fast'] : []), { stdio: 'inherit' });
step(`EffectCraft: animate, ${shards} processes`);
await Promise.all(
  Array.from({ length: shards }, (_, i) =>
    new Promise<void>((ok, fail) => {
      const [cmd, args] = node('cast-build.ts', ['--shard', `${i}/${shards}`]);
      const p = spawn(cmd, [...args], { stdio: 'inherit' });
      p.on('exit', (code) => (code ? fail(new Error(`shard ${i} exited ${code}`)) : ok()));
    }),
  ),
);
step('Pack atlases');
execFileSync(...node('cast-pack.ts'), { stdio: 'inherit' });
step('Editor page');
execFileSync(...node('cast-html.ts'), { stdio: 'inherit' });
step('done');

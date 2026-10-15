// HD character studio, step 3: the editor page, self-contained (sheets embedded), for viewing and
// mixing the base, hair and outfits with live recolouring.
//
//   npx vite-node tools/charpipe/hd/studio-html.ts [base]       (after studio-build.ts)
//
// Writes docs/charpipe/studio/character-studio.html (page content, as published) and
// character-studio.local.html (the same with a document shell, to open from disk).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ART, ROOT } from '../spec';

// the bodies: one studio build each (male `base`, female `base-f`)
const ids = process.argv.slice(2).filter((a) => a !== '--' && !a.startsWith('--'));
const studios = ids.length ? ids : ['base', 'base-f'];
const png = (p: string) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const bodies: Record<string, { manifest: any; sheets: Record<string, string> }> = {};
for (const id of studios) {
  const dir = join(ROOT, 'src/assets/characters/studio', id);
  const m = JSON.parse(readFileSync(join(dir, 'studio.json'), 'utf8'));
  const sheets: Record<string, string> = {};
  for (const a of Object.values(m.assets) as { sheets: Record<string, Record<string, string>> }[])
    for (const band of Object.values(a.sheets)) for (const rel of Object.values(band)) sheets[rel] = png(join(dir, rel));
  bodies[(m.body as string) ?? "m"] = { manifest: m, sheets };
}
const manifest = Object.values(bodies)[0].manifest;

type Ramp = Record<string, string>;
const r = (hl: string, base: string, shade: string, deep: string): Ramp => ({ hl, base, shade, deep });
const ramp = (asset: string) => manifest.assets[asset].ramps.main as Ramp;
// colour choices per asset: the drawn ramp first, then alternatives with the same keys
const palettes: Record<string, { name: string; ramp: Ramp }[]> = {
  body: [
    { name: 'Ambra', ramp: manifest.assets.body.ramps.skin },
    { name: 'Chiara', ramp: r('#ffdcbc', '#f4c39c', '#dca27c', '#b98060') },
    { name: 'Oliva', ramp: r('#d9a272', '#c08654', '#a06a40', '#7e5030') },
    { name: 'Scura', ramp: r('#a36a46', '#8a5434', '#6e3f26', '#522c1a') },
  ],
  'hair:short': [],
  'hair:long': [],
  'top:tee': [
    { name: 'Bianca', ramp: ramp('top:tee') },
    { name: 'Teal', ramp: r('#6fc4bf', '#47a39e', '#317b78', '#215654') },
    { name: 'Senape', ramp: r('#f0c25a', '#d6a33c', '#a97b29', '#7a561c') },
    { name: 'Rosa', ramp: r('#f2a7a0', '#d9827a', '#b0605a', '#80403c') },
  ],
  'top:jacket': [
    { name: 'Oliva', ramp: ramp('top:jacket') },
    { name: 'Blu notte', ramp: r('#5a6f9a', '#3e5276', '#2b3a58', '#1d283e') },
    { name: 'Ruggine', ramp: r('#d27a4c', '#b05c34', '#874426', '#5e2f1a') },
  ],
  'bottom:jeans': [
    { name: 'Denim', ramp: ramp('bottom:jeans') },
    { name: 'Nero', ramp: r('#55525e', '#3b3944', '#2a2832', '#1c1b22') },
  ],
  'bottom:chinos': [
    { name: 'Kaki', ramp: ramp('bottom:chinos') },
    { name: 'Oliva', ramp: r('#9aa06a', '#7d834f', '#60653b', '#454a2a') },
    { name: 'Grigio', ramp: r('#a7a6a2', '#8a8984', '#6b6a66', '#4e4d4a') },
  ],
  'shoes:sneakers': [
    { name: 'Bianche', ramp: ramp('shoes:sneakers') },
    { name: 'Nere', ramp: r('#55525e', '#3b3944', '#2a2832', '#1c1b22') },
  ],
  'shoes:boots': [
    { name: 'Cuoio', ramp: ramp('shoes:boots') },
    { name: 'Nero', ramp: r('#4a4550', '#34303a', '#24212a', '#17151b') },
  ],
};
const hairs = [
  { name: 'Castano', ramp: ramp('hair:short') },
  { name: 'Nero', ramp: r('#3d3a44', '#25222b', '#16141b', '#0d0b10') },
  { name: 'Ramato', ramp: r('#d9763e', '#b4552a', '#86391e', '#5e2614') },
  { name: 'Biondo', ramp: r('#f3d38a', '#d9b061', '#b08744', '#80612e') },
  { name: 'Argento', ramp: r('#e4e2e6', '#bdbbc4', '#94929e', '#6c6a76') },
];
palettes['hair:short'] = hairs;
palettes['hair:long'] = hairs;

const data = { bodies, ref: png(join(ART, 'reference/base_body_ref_native.png')), palettes };
const page = readFileSync(join(ROOT, 'tools/charpipe/hd/studio-page.html'), 'utf8').replace('/*__DATA__*/null', JSON.stringify(data));
const out = join(ROOT, 'docs/charpipe/studio');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'character-studio.html'), page);
writeFileSync(join(out, 'character-studio.local.html'), `<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${page}\n</body></html>\n`);
console.log(`character-studio.html: ${(page.length / 1024).toFixed(0)} KB, bodies ${Object.keys(bodies).join(', ')}, ${Object.values(bodies).reduce((n, b) => n + Object.keys(b.sheets).length, 0)} sheets`);

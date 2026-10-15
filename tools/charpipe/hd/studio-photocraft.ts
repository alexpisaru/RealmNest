// HD character studio, step 1: paint a base body (male or female) and every asset in PhotoCraft
// (headless, MCP, sandboxed to art/charpipe/studio/<id>) and export them part by part.
//
//   npx vite-node tools/charpipe/hd/studio-photocraft.ts [base | base-f]
//
// Writes art/charpipe/studio/<id>/:
//   <id>.pcraft                         every layer: <asset>/<part>/<material>
//   parts/<asset>/<part>.png            160×256, shared coordinates, one per asset and rig part
//   previews/*.png                      the body, then each outfit, at rest, outlined as in the game
//   studio-parts.json                   which asset has which parts (for the EffectCraft step)
// Outlines are not painted: they are added after animation, per band (outline.ts).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blank, blit, readPng, writePng, type Img } from '../img';
import { McpClient } from '../mcp';
import { Painter } from '../pcdraw';
import { ART } from '../spec';
import { assetPieces } from './assets';
import { BAND_ORDER, BANDS, H, PARTS, W, at, bodyGeometry } from './body';
import { bodyPieces, type Piece, type StudioSpec } from './draw';
import { outlineAll } from './outline';

const id = process.argv.slice(2).find((a) => a !== '--' && !a.startsWith('--')) ?? 'base';
const dir = join(ART, 'studio', id);
const spec = JSON.parse(readFileSync(join(dir, 'studio.spec.json'), 'utf8')) as StudioSpec;
const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/');
const assetDir = (asset: string) => asset.replace(':', '-');
const SLOT_ORDER = ['body', 'shoes', 'bottom', 'top', 'hair'];
const slotOf = (asset: string) => (asset === 'body' ? 'body' : spec.assets.find((a) => a.id === asset)!.slot);

const geo = bodyGeometry(spec.body ?? 'm');
const pieces: Piece[] = [...bodyPieces(geo, spec), ...assetPieces(geo, spec)];
// paint in compositing order: band by band, body first, then shoes, bottoms, tops, hair
const order = (p: Piece) => BAND_ORDER.indexOf(BANDS[p.part]) * 100 + SLOT_ORDER.indexOf(slotOf(p.asset)) * 10 + PARTS.indexOf(p.part) / 20;
pieces.sort((a, b) => order(a) - order(b));
const groups = [...new Set(pieces.map((p) => `${p.asset}/${p.part}`))];

rmSync(join(dir, 'parts'), { recursive: true, force: true });
rmSync(join(dir, 'previews'), { recursive: true, force: true });
for (const g of groups) mkdirSync(join(dir, 'parts', assetDir(g.split('/')[0])), { recursive: true });
mkdirSync(join(dir, 'previews'), { recursive: true });

const mcp = new McpClient(process.env.PHOTOCRAFT_CLI ?? 'C:/Program Files/PhotoCraft/photocraft-cli.exe', ['mcp', '--automation-read-root', rel(dir), '--automation-write-root', rel(dir)]);
await mcp.init('nestra-studio');
const pt = new Painter(mcp);
const t0 = Date.now();
try {
  await mcp.tool('doc_new', { width: W, height: H, background: 'transparent', name: spec.name });
  for (const p of pieces) {
    await pt.layer(`${p.asset}/${p.part}/${p.material}`);
    p.draw(pt);
    await pt.flush();
  }
  await mcp.tool('doc_save', { path: `${id}.pcraft` });
  for (const g of groups) {
    const [asset, part] = g.split('/');
    await pt.showOnly([`${g}/`]);
    await mcp.tool('doc_save', { path: `parts/${assetDir(asset)}/${part}.png` });
  }
  await pt.showOnly(null);
} finally {
  writeFileSync(join(dir, 'build-log.txt'), mcp.log.join('\n') + '\n');
  await mcp.close();
}

// previews at rest, composited and outlined exactly as the studio does it with animated frames
const partsOf: Record<string, string[]> = {};
for (const g of groups) (partsOf[g.split('/')[0]] ??= []).push(g.split('/')[1]);
function bandImage(asset: string, band: string): Img | null {
  const parts = PARTS.filter((p) => BANDS[p] === band && partsOf[asset]?.includes(p));
  if (!parts.length) return null;
  const im = blank(W, H);
  for (const p of parts) blit(im, readPng(join(dir, 'parts', assetDir(asset), `${p}.png`)), 0, 0);
  return im;
}
function compose(assets: string[]) {
  const fills: Record<string, Record<string, Img>> = {};
  for (const a of assets) for (const band of BAND_ORDER) { const b = bandImage(a, band); if (b) (fills[a] ??= {})[band] = b; }
  const done = outlineAll(fills, slotOf, spec.outline, at(0, 98)[1]);
  const im = blank(W, H);
  for (const band of BAND_ORDER) for (const slot of SLOT_ORDER) for (const a of assets) if (slotOf(a) === slot && done[a]?.[band]) blit(im, done[a][band], 0, 0);
  return im;
}
writePng(join(dir, 'previews', 'body.png'), compose(['body']));
for (const [o, v] of Object.entries(spec.outfits))
  for (const hair of spec.assets.filter((a) => a.slot === 'hair'))
    writePng(join(dir, 'previews', `${o}_${assetDir(hair.id)}.png`), compose(['body', v.shoes, v.bottom, v.top, hair.id]));
writeFileSync(join(dir, 'studio-parts.json'), JSON.stringify({ id, body: geo.kind, parts: partsOf, layers: pt.layers.size, mcpCalls: mcp.log.length, seconds: (Date.now() - t0) / 1000 }, null, 2) + '\n');
console.log(`${spec.name}: ${pieces.length} painted layers, ${mcp.log.length} MCP calls in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

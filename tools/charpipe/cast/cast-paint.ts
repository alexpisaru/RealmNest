// Cast factory, step 1: paint the base body and every asset on every body shape, part by part.
//
//   npx vite-node tools/charpipe/cast/cast-paint.ts [--fast] [--shapes masc-regular-regular,...] [--assets hair:*,top:long]
//
// PhotoCraft paints (headless MCP, sandboxed to art/charpipe/cast/<shape>): one document per body
// shape, one layer per piece (`<asset>/<part>/<material>`), every asset/part exported as a
// 80×128 PNG in shared coordinates. --fast draws the same calls with ImgPen instead (no
// PhotoCraft; for quick iterations).
//
// Heights only change the legs, so short and tall shapes paint only the leg parts.
// Writes art/charpipe/cast/<shape>/parts/<asset>/<part>.png and art/charpipe/cast/<shape>/parts.json.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blank, writePng, type Img } from '../img';
import { McpClient } from '../mcp';
import { Painter } from '../pcdraw';
import { CAST_ART } from './paths';
import { ALL_ASSETS } from './assets';
import { BANDS, BUILDS, HEIGHTS, KINDS, LEG_BANDS, PARTS, bodyGeometry, shapeId, type BodyShape, type Part } from './body';
import { SLOTS } from './catalog';
import { bodyPieces, type Piece } from './draw';
import { ImgPen } from './pen';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1]?.split(',') : undefined);
const fast = argv.includes('--fast');
const all: BodyShape[] = KINDS.flatMap((kind) => BUILDS.flatMap((build) => HEIGHTS.map((height) => ({ kind, build, height }))));
const shapes = opt('shapes') ? all.filter((s) => opt('shapes')!.includes(shapeId(s))) : all;
const pick = opt('assets');
const wanted = (id: string) => id === 'body' || !pick || pick.some((w) => (w.endsWith('*') ? id.startsWith(w.slice(0, -1)) : id === w));
const dirOf = (asset: string) => asset.replace(':', '-');
const slotOf = (asset: string) => (asset === 'body' ? 'body' : ALL_ASSETS.find((a) => a.id === asset)!.slot);
const t0 = Date.now();

for (const shape of shapes) {
  const id = shapeId(shape);
  const dir = join(CAST_ART, id);
  const g = bodyGeometry(shape);
  const legsOnly = shape.height !== 'regular';
  let pieces: Piece[] = [...bodyPieces(g), ...ALL_ASSETS.filter((a) => wanted(a.id)).flatMap((a) => a.pieces(g))];
  if (legsOnly) pieces = pieces.filter((p) => LEG_BANDS.includes(BANDS[p.part]));
  // paint in compositing order (band, then slot), so the document reads like the figure
  const order = (p: Piece) => PARTS.indexOf(p.part) * 100 + SLOTS.indexOf(slotOf(p.asset));
  pieces.sort((a, b) => order(a) - order(b));
  const groups = [...new Set(pieces.map((p) => `${p.asset}/${p.part}`))];
  if (!pick) rmSync(join(dir, 'parts'), { recursive: true, force: true });
  for (const grp of groups) mkdirSync(join(dir, 'parts', dirOf(grp.split('/')[0])), { recursive: true });

  if (fast) {
    const images = new Map<string, Img>();
    for (const p of pieces) {
      const key = `${p.asset}/${p.part}`;
      const pen = new ImgPen(images.get(key) ?? blank(80, 128));
      p.draw(pen);
      images.set(key, pen.im);
    }
    for (const [key, im] of images) writePng(join(dir, 'parts', dirOf(key.split('/')[0]), `${key.split('/')[1]}.png`), im);
  } else {
    const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/');
    const mcp = new McpClient(process.env.PHOTOCRAFT_CLI ?? 'C:/Program Files/PhotoCraft/photocraft-cli.exe', ['mcp', '--automation-read-root', rel(dir), '--automation-write-root', rel(dir)]);
    await mcp.init('nestra-cast');
    const pt = new Painter(mcp);
    try {
      await mcp.tool('doc_new', { width: 80, height: 128, background: 'transparent', name: id });
      // every layer gets its own name (an asset may paint several layers of one material on a
      // part): showOnly can only hide the layers it knows by name
      for (const [i, p] of pieces.entries()) {
        await pt.layer(`${p.asset}/${p.part}/${p.material}~${i}`);
        p.draw(pt);
        await pt.flush();
      }
      if (!pick) await mcp.tool('doc_save', { path: `${id}.pcraft` });
      for (const grp of groups) {
        await pt.showOnly([`${grp}/`]);
        await mcp.tool('doc_save', { path: `parts/${dirOf(grp.split('/')[0])}/${grp.split('/')[1]}.png` });
      }
    } finally {
      await mcp.close();
    }
  }
  // which asset has which parts (merged into the existing list when only some assets were painted)
  const file = join(dir, 'parts.json');
  const parts: Record<string, Part[]> = pick && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).parts : {};
  for (const grp of groups) parts[grp.split('/')[0]] = [];
  for (const grp of groups) parts[grp.split('/')[0]].push(grp.split('/')[1] as Part);
  writeFileSync(file, JSON.stringify({ shape, parts }, null, 1) + '\n');
  console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${id}: ${pieces.length} pieces, ${groups.length} part images${fast ? ' (fast)' : ''}`);
}

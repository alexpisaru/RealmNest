// Character pipeline: draw a character from its CharacterSpec in PhotoCraft (headless, over MCP),
// sandboxed to art/charpipe/characters/<id>, and export its source, previews and rig parts.
//
//   npx vite-node tools/charpipe/photocraft-build.ts maya [--stop flat|shade|detail]
//
// Writes characters/<id>/:
//   <id>.pcraft                    layered PhotoCraft source (default outfit)
//   <id>_<outfit>.pcraft           the same document after each outfit swap
//   base.png, base_<outfit>.png    the composed sprite
//   previews/NN_<pass>.png         the figure after each pass (flat, shade, detail, outline)
//   parts/<outfit>/<part>.png      rig parts, full 80×128 canvas, shared coordinates
//   parts/accessories/<id>.png     accessories, same canvas
//   photocraft-report.json         calls, timings, which layers/parts an outfit swap replaced
//   build-log.txt                  every MCP call
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { McpClient } from './mcp';
import { Painter } from './pcdraw';
import { JOINT, PARTS, PIVOTS, REACH, SEAMS, SOLES, accessory, pieces, type Piece } from './factory/standard';
import { loadSpec, withOutfit } from './factory/spec';
import { charDir } from './spec';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const id = argv.find((a) => !a.startsWith('--')) ?? 'maya';
const stop = argv.includes('--stop') ? argv[argv.indexOf('--stop') + 1] : null;
const dir = charDir(id);
const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/');
const cli = process.env.PHOTOCRAFT_CLI ?? 'C:/Program Files/PhotoCraft/photocraft-cli.exe';
rmSync(join(dir, 'parts'), { recursive: true, force: true });
rmSync(join(dir, 'previews'), { recursive: true, force: true });
mkdirSync(join(dir, 'previews'), { recursive: true });
// PhotoCraft's doc_save does not create folders: make them first
for (const o of [loadSpec(id).outfit.id, ...Object.keys(loadSpec(id).outfits ?? {}), 'accessories']) mkdirSync(join(dir, 'parts', o), { recursive: true });

const spec = loadSpec(id);
// the same sandbox as the workspace's .mcp.json: reads and writes only inside this character's folder
const mcp = new McpClient(cli, ['mcp', '--automation-read-root', rel(dir), '--automation-write-root', rel(dir)]);
await mcp.init('nestra-character-factory');
const pt = new Painter(mcp);
const t0 = Date.now();
const report: Record<string, unknown> = { character: id, photocraft: 'photocraft-cli 0.7.0' };
const save = (path: string) => mcp.tool('doc_save', { path });

async function exportParts(outfit: string) {
  for (const part of PARTS) {
    await pt.showOnly([`${part}/`]);
    await save(`parts/${outfit}/${part}.png`);
  }
  await pt.showOnly(null);
}

try {
  await mcp.tool('doc_new', { width: 80, height: 128, background: 'transparent', name: spec.name });
  const all: Piece[] = pieces(spec);
  const acc = accessory(spec);

  // pass 1: flat silhouettes, back to front
  for (const p of all) {
    await pt.layer(p.layer);
    p.fill(pt);
  }
  await pt.flush();
  await save('previews/01_flat.png');
  // pass 2: shading (Lock Transparency fills); pass 3: details (pencil)
  for (const [n, pass] of [[2, 'shade'], [3, 'detail']] as const) {
    if (stop === (n === 2 ? 'flat' : 'shade')) break;
    for (const p of all) {
      const f = p[pass];
      if (!f) continue;
      await pt.use(p.layer);
      f(pt);
    }
    await pt.flush();
    await save(`previews/0${n}_${pass}.png`);
  }
  if (!stop) {
    if (acc) {
      await pt.use(all[all.length - 1].layer);
      await pt.layer(acc.layer);
      acc.fill(pt);
      await pt.flush();
    }
    // pass 4: outlines, part by part, erased across the joints
    for (const part of PARTS) await pt.outline(part, spec.outline, SEAMS[part] ?? []);
    await save('previews/04_outline.png');
    await save(`${id}.pcraft`);
    await save('base.png');
    await exportParts(spec.outfit.id);
    if (acc) {
      await pt.showOnly([acc.layer]);
      await save(`parts/accessories/${acc.layer.split('/')[1]}.png`);
      await pt.showOnly(null);
    }
    report.layers = pt.layers.size;
    report.drawSeconds = (Date.now() - t0) / 1000;

    // outfit swaps: redraw only the outfit pieces that differ, in place, re-outline their parts
    const swaps: Record<string, unknown> = {};
    for (const outfit of Object.keys(spec.outfits ?? {})) {
      const t1 = Date.now();
      const alt = pieces(withOutfit(spec, outfit));
      const changed: string[] = [];
      for (const piece of alt) {
        const was = all.find((p) => p.layer === piece.layer)!;
        if (piece.layer.endsWith('/jacket') && (spec.outfits![outfit].top || was.fill.toString() !== piece.fill.toString())) {
          await pt.replace(piece.layer, () => {
            piece.fill(pt);
            piece.shade?.(pt);
            piece.detail?.(pt);
          });
          changed.push(piece.layer);
        }
      }
      const parts = [...new Set(changed.map((l) => l.split('/')[0]))];
      for (const part of parts) {
        await pt.remove(`${part}/outline`);
        await pt.outline(part, spec.outline, SEAMS[part] ?? []);
      }
      await save(`${id}_${outfit}.pcraft`);
      await save(`base_${outfit}.png`);
      await exportParts(outfit);
      swaps[outfit] = { layersRedrawn: changed, partsChanged: parts, seconds: (Date.now() - t1) / 1000 };
    }
    report.outfitSwaps = swaps;
  }
  // the hand-off to the EffectCraft pipeline (tools/charpipe/build.ts): same rig, this body's numbers
  if (!stop) {
    const acc = accessory(spec);
    const character = {
      id,
      name: spec.name,
      role: spec.role,
      generator: 'tools/charpipe/photocraft-build.ts (PhotoCraft, from ' + id + '.spec.json)',
      rig: 'humanoid-3q',
      view: spec.view,
      source: { file: 'base.png' },
      pivots: PIVOTS,
      soles: SOLES,
      reach: REACH,
      layers: PARTS.map((p) => ({ id: p, joint: JOINT[p], ...(p === 'hair_back' ? { folder: 'hair' } : {}) })),
      variants: Object.fromEntries([[spec.outfit.id, { label: `${spec.outfit.top.style} (${spec.outfit.id})` }], ...Object.entries(spec.outfits ?? {}).map(([o, v]) => [o, { label: `${v.top?.style ?? 'outfit'} (${o})` }])]),
      accessories: acc ? { [acc.layer.split('/')[1]]: { label: spec.accessory!.style, file: `parts/accessories/${acc.layer.split('/')[1]}.png`, joint: JOINT.accessory } } : {},
    };
    writeFileSync(join(dir, 'character.json'), JSON.stringify(character, null, 2) + '\n');
  }
} finally {
  report.mcpCalls = mcp.log.length;
  report.seconds = (Date.now() - t0) / 1000;
  writeFileSync(join(dir, 'build-log.txt'), mcp.log.join('\n') + '\n');
  writeFileSync(join(dir, 'photocraft-report.json'), JSON.stringify(report, null, 2) + '\n');
  await mcp.close();
}
console.log(`${spec.name}: ${mcp.log.length} MCP calls in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${rel(dir)}`);

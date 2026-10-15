// Character pipeline: the PhotoCraft cleanup pass over rendered frames, measured.
//
//   npx vite-node tools/charpipe/cleanup.ts maya [--mode rotsprite] [--canonical field+glasses]
//
// For every outfit/accessory combination and animation (idle, walk, work, sit) of a built character:
//   1. copy the normalised frames into the character's workspace (cleanup/<combo>/<anim>/), the
//      only place the PhotoCraft MCP server may read or write
//   2. find the defects the rig introduced: orphans and seam holes that the rest pose doesn't have
//   3. fix them in PhotoCraft (doc_open → paint.pencil / select.rect + edit.clear → doc_save)
//   4. check again, count every changed pixel, pack the strips over the published sheets
//   5. write <id>_<anim>.png for the canonical look, and cleanup-report.json
// Manual fixes (an artist's judgement) go in characters/<id>/cleanup.json as
// { "<combo>/<anim>/<frame>": [[x, y, "#rrggbb" | null], …] } and are applied and counted the same way.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findDefects, type Fix } from './defects';
import { pack } from './frames';
import { blank, blit, px, readPng, toHex, writePng } from './img';
import { McpClient } from './mcp';
import { ASSETS, BUILD, charDir, loadCharacter } from './spec';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const id = argv.find((a) => !a.startsWith('--')) ?? 'maya';
const opt = (n: string, d: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const mode = opt('mode', 'rotsprite');
const ch = loadCharacter(id);
const dir = charDir(id);
const build = join(BUILD, id);
const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/');
const fwd = (p: string) => p.replace(/\\/g, '/');
const ANIMS = ['idle', 'walk', 'work', 'sit'];
const accs = Object.keys(ch.accessories);
const combos = Object.keys(ch.variants).flatMap((v) => [v, ...accs.map((a) => `${v}+${a}`)]);
const canonical = opt('canonical', accs.length ? `${Object.keys(ch.variants)[0]}+${accs[0]}` : Object.keys(ch.variants)[0]);
const manual: Record<string, [number, number, string | null][]> = existsSync(join(dir, 'cleanup.json')) ? JSON.parse(readFileSync(join(dir, 'cleanup.json'), 'utf8')) : {};

const key = (x: number, y: number) => `${x},${y}`;
/** the rest pose's own gaps and dots are art, not defects */
function restDefects(combo: string): Set<string> {
  const [variant, ...acc] = combo.split('+');
  const rest = blank(80, 128);
  blit(rest, readPng(join(build, 'parts', variant, '_sprite.png')), 0, 0);
  for (const a of acc) blit(rest, readPng(join(build, 'parts', 'accessories', `${a}.png`)), 0, 0);
  return new Set(findDefects(rest).map((f) => key(f.x, f.y)));
}

rmSync(join(dir, 'cleanup'), { recursive: true, force: true });
const pc = new McpClient(process.env.PHOTOCRAFT_CLI ?? 'C:/Program Files/PhotoCraft/photocraft-cli.exe', ['mcp', '--automation-read-root', rel(dir), '--automation-write-root', rel(dir)]);
await pc.init('nestra-cleanup');
const report: Record<string, Record<string, unknown>> = {};
let ops = 0;
try {
  for (const combo of combos) {
    const baseline = restDefects(combo);
    for (const anim of ANIMS) {
      const src = join(build, mode, combo, anim);
      const work = join(dir, 'cleanup', combo, anim);
      mkdirSync(work, { recursive: true });
      const files = readdirSync(src).filter((f) => /^frame_\d+\.png$/.test(f)).sort();
      let auto = 0;
      let hand = 0;
      let touched = 0;
      let left = 0;
      const frames = [];
      for (const [i, f] of files.entries()) {
        copyFileSync(join(src, f), join(work, f));
        const before = readPng(join(work, f));
        const fixes: Fix[] = findDefects(before).filter((d) => !baseline.has(key(d.x, d.y)));
        const handFixes = (manual[`${combo}/${anim}/${i}`] ?? []).map(([x, y, c]) => ({ x, y, color: c ? (parseInt(c.slice(1), 16) * 256 + 255) >>> 0 : 0, kind: 'hole' as const }));
        if (fixes.length || handFixes.length) {
          await pc.tool('doc_open', { path: fwd(relative(dir, join(work, f))) });
          const steps: { id: string; params: Record<string, unknown> }[] = [];
          for (const fx of [...fixes, ...handFixes]) {
            if (fx.color) steps.push({ id: 'paint.pencil', params: { points: [[fx.x, fx.y]], size: 1, color: toHex(fx.color) } });
            else steps.push({ id: 'select.rect', params: { x: fx.x, y: fx.y, width: 1, height: 1, antiAlias: false } }, { id: 'edit.clear', params: {} }, { id: 'select.deselect', params: {} });
          }
          await pc.tool('command_batch', { steps });
          await pc.tool('doc_save', { path: fwd(relative(dir, join(work, f))) });
          await pc.tool('doc_close', {});
          ops += steps.length;
          auto += fixes.length;
          hand += handFixes.length;
          touched++;
        }
        const after = readPng(join(work, f));
        let changed = 0;
        for (let y = 0; y < 128; y++) for (let x = 0; x < 80; x++) if (px(after, x, y) !== px(before, x, y)) changed++;
        left += findDefects(after).filter((d) => !baseline.has(key(d.x, d.y))).length;
        frames.push(after);
        (report[`${combo}/${anim}`] ??= {}).pixelsChanged = ((report[`${combo}/${anim}`].pixelsChanged as number) ?? 0) + changed;
      }
      Object.assign(report[`${combo}/${anim}`], { frames: files.length, framesTouched: touched, autoFixes: auto, manualFixes: hand, defectsLeft: left });
      // the cleaned strip replaces the published one
      writePng(join(ASSETS, id, mode, combo, `${anim}.png`), pack(frames));
      if (combo === canonical) writePng(join(ASSETS, id, `${id}_${anim}.png`), pack(frames));
    }
  }
} finally {
  await pc.close();
}
writeFileSync(join(dir, 'cleanup-report.json'), JSON.stringify({ mode, canonical, photocraftOps: ops, sequences: report }, null, 2) + '\n');
const tot = Object.values(report).reduce<{ px: number; auto: number; hand: number; left: number }>((a, r) => ({ px: a.px + (r.pixelsChanged as number), auto: a.auto + (r.autoFixes as number), hand: a.hand + (r.manualFixes as number), left: a.left + (r.defectsLeft as number) }), { px: 0, auto: 0, hand: 0, left: 0 });
console.log(`${id} cleanup (${mode}): ${Object.keys(report).length} sequences, ${tot.auto} automatic + ${tot.hand} manual fixes, ${tot.px} px changed, ${tot.left} defects left, ${ops} PhotoCraft ops`);
console.log(`sheets: ${rel(join(ASSETS, id))}/${id}_{${ANIMS.join(',')}}.png (${canonical})`);

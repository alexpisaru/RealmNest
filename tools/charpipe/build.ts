// Character pipeline prototype (EffectCraft feasibility study, docs/charpipe/REPORT.md).
//
//   npm run character:build -- alex [--refresh-source] [--modes x1,rotsprite] [--anims idle,walk]
//
// 1. prepare     cut each outfit's rest-pose sprite into the rig's parts (+ 8× Scale2x copies)
// 2. template    build the EffectCraft template project from rig + animations (JSX via effectcraft-cli)
// 3. variants    swap outfit footage / switch accessories with EffectCraft engine commands
// 4. render      transparent PNG sequences per animation comp
// 5. normalise   check size, alpha, palette, anchor; harden / snap; sample back from 8×
// 6. pack        horizontal strip per animation + one manifest per character
// 7. publish     sheets and manifest into src/assets/characters/prototype/<id>/ (dev preview only)
//
// Needs EffectCraft 0.8+ (effectcraft-cli): $EFFECTCRAFT_CLI, the default Windows install folder, or PATH.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { composeTemplate } from '../../src/render/hd4/peopleTemplate';
import { blank, blit, hex, readPng, setPx, upscale, writePng, type Img } from './img';
import { buildTemplate, effectcraftVersion, makeVariant, render } from './effectcraft';
import { contactSheet, normalise, pack, paletteOf, type SequenceReport } from './frames';
import { prepare } from './parts';
import { groundLock } from './rigmath';
import { ASSETS, BUILD, ROOT, charDir, loadAnimations, loadCharacter, loadRig, type AnimationSpec } from './spec';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const id = argv.find((a) => !a.startsWith('--')) ?? 'alex';
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1]?.split(',') : undefined;
};
const MODES: Record<string, number> = { x1: 1, rotsprite: 8 };
const modes = opt('modes') ?? Object.keys(MODES);
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');

const rig = loadRig('humanoid-3q');
const ch = loadCharacter(id);
const dir = charDir(id);
const build = join(BUILD, id);
log(`character ${id} (${ch.name}), rig ${rig.id}, ${effectcraftVersion()}`);

// ── 0. source: a copy of the shipped art, never the art itself ──
const sourcePath = join(dir, ch.source.file);
if (argv.includes('--refresh-source') || !existsSync(sourcePath)) {
  if (id !== 'alex') throw new Error(`${sourcePath} is missing and only alex can be copied from production`);
  const grid = composeTemplate({ dir: 'se', mode: 'stand', frame: 0 });
  const im = blank(rig.frame.w, rig.frame.h);
  grid.forEach((c, i) => c && setPx(im, i % im.w, Math.floor(i / im.w), hex(c)));
  writePng(sourcePath, im);
  log(`source copied from production composeTemplate(se, stand) → ${rel(sourcePath)}`);
}

// ── 1. parts ──
rmSync(build, { recursive: true, force: true });
const prepared = prepare(rig, ch, build);
log(`parts cut for outfits ${prepared.map((p) => p.variant).join(', ')}`);

// ── animations, with the pelvis solved for ground contact ──
const anims: AnimationSpec[] = loadAnimations(opt('anims')).map((a) => {
  if (!a.groundLock) return a;
  const dy = groundLock(rig, ch, a);
  const pel = a.tracks.pelvis ?? {};
  log(`${a.id}: groundLock pelvis dy = [${dy.join(', ')}]`);
  return { ...a, tracks: { ...a.tracks, pelvis: { ...pel, dy: dy.map((v, f) => v + (pel.dy?.[f] ?? 0)) } } };
});

// outfit × accessories: every combination is the same template with footage swapped
const combos = Object.keys(ch.variants).flatMap((variant) => [[], ...Object.keys(ch.accessories).map((a) => [a])].map((acc) => ({ variant, acc, key: [variant, ...acc].join('+') })));

const reports: SequenceReport[] = [];
const manifest = {
  id,
  name: ch.name,
  generator: 'tools/charpipe/build.ts (EffectCraft)',
  effectcraft: effectcraftVersion(),
  rig: rig.id,
  view: ch.view,
  frameWidth: rig.frame.w,
  frameHeight: rig.frame.h,
  anchor: { x: rig.foot[0], y: rig.foot[1] },
  layout: 'horizontal strip, no padding, frame i at x = i * frameWidth',
  modes: {} as Record<string, string>,
  outfits: Object.fromEntries(Object.entries(ch.variants).map(([k, v]) => [k, v.label])),
  accessories: Object.fromEntries(Object.entries(ch.accessories).map(([k, v]) => [k, v.label])),
  animations: anims.map((a) => ({ id: a.id, label: a.label, frames: a.frames, fps: a.fps, loop: a.loop, ...(a.anchorDy ? { anchorDy: a.anchorDy } : {}) })),
  /** sheets[mode][combo][anim] = path relative to this file */
  sheets: {} as Record<string, Record<string, Record<string, string>>>,
};
const sheetsByMode: Record<string, Record<string, Img[]>> = {};

for (const mode of modes) {
  const k = MODES[mode];
  if (!k) throw new Error(`unknown mode ${mode} (x1, rotsprite)`);
  manifest.modes[mode] = k === 1 ? 'parts rendered at 1×, Draft (nearest-neighbour) layers' : `parts enlarged ${k}× with Scale2x, rendered at ${k}×, sampled back (RotSprite)`;
  const def = prepared[0];
  // ── 2. template ──
  const template = join(build, mode, 'nestra-character-template.ecproj');
  buildTemplate({ rig, ch, anims, k, parts: k === 1 ? def.parts1 : def.parts8, accessories: k === 1 ? def.accessories1 : def.accessories8, out: template }, join(build, mode, 'build-template.jsx'));
  log(`${mode}: template ${rel(template)}`);
  manifest.sheets[mode] = {};
  for (const c of combos) {
    // ── 3. variant project through engine commands ──
    const p = prepared.find((v) => v.variant === c.variant)!;
    const project = join(build, mode, `${id}_${c.key}.ecproj`);
    // an outfit swap replaces only the footage that differs (layered characters say which)
    const swap = c.variant === def.variant ? null : Object.fromEntries(Object.entries(k === 1 ? p.parts1 : p.parts8).filter(([part]) => !p.changed || p.changed.includes(part)));
    if (swap && mode === modes[0] && !c.acc.length) log(`${c.variant}: replaceFootage on ${Object.keys(swap).length} of ${Object.keys(p.parts1).length} parts (${Object.keys(swap).join(', ')})`);
    makeVariant(template, project, swap, anims.map((a) => a.id), c.acc);
    const sprite = readPng(join(build, 'parts', c.variant, '_sprite.png'));
    const accIms = c.acc.map((a) => readPng(join(build, 'parts', 'accessories', `${a}.png`)));
    const rest = blank(sprite.w, sprite.h);
    blit(rest, sprite, 0, 0);
    accIms.forEach((a) => blit(rest, a, 0, 0));
    const palette = paletteOf(sprite, ...accIms);
    manifest.sheets[mode][c.key] = {};
    for (const a of anims) {
      // ── 4. render, 5. normalise ──
      const raw = join(build, mode, c.key, a.id, 'raw');
      const out = join(build, mode, c.key, a.id);
      render(project, a.id, raw);
      const { report, frames } = normalise(raw, out, { anim: a.id, mode: `${mode}/${c.key}`, k, w: rig.frame.w, h: rig.frame.h, palette, rest: a.id === 'idle' ? rest : undefined });
      reports.push(report);
      // ── 6. pack ──
      const sheetRel = `${mode}/${c.key}/${a.id}.png`;
      writePng(join(build, 'sheets', sheetRel), pack(frames));
      manifest.sheets[mode][c.key][a.id] = sheetRel;
      (sheetsByMode[mode] ??= {})[`${c.key}/${a.id}`] = frames;
      const w = report.warnings.length ? ` ⚠ ${report.warnings.join('; ')}` : '';
      log(`${mode} ${c.key} ${a.id}: ${frames.length} frames${report.restDiff !== undefined ? `, rest diff ${report.restDiff} px` : ''}${w}`);
    }
  }
}

// ── 7. publish ──
writeFileSync(join(build, 'sheets', `${id}.anims.json`), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(build, 'report.json'), JSON.stringify(reports, null, 2) + '\n');
const dest = join(ASSETS, id);
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(build, 'sheets'), dest, { recursive: true });
log(`published ${rel(dest)}`);

// review sheets: every animation of the default outfit, per mode, 4× with the ground line
for (const mode of modes) {
  const rows = anims.map((a) => sheetsByMode[mode][`${prepared[0].variant}/${a.id}`]);
  writePng(join(build, `review_${mode}.png`), contactSheet(rows, 4, rig.foot[1]));
}
writePng(join(build, 'source_4x.png'), upscale(readPng(sourcePath), 4));
const bad = reports.filter((r) => r.frames.some((f) => f.partialAlpha || f.offPalette) || !r.sizeOk);
log(`done: ${reports.length} sequences, ${bad.length} needed correction (see ${rel(join(build, 'report.json'))})`);

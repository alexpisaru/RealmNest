// The character pipeline prototype's pixel maths (tools/charpipe, docs/charpipe/REPORT.md).
// EffectCraft itself is not needed: these cover what our side of the pipeline promises.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blank, colours, decodePng, encodePng, hex, opaque, px, readPng, sampleDown, setPx } from '../../tools/charpipe/img';
import { pack } from '../../tools/charpipe/frames';
import { cutParts, enlarge8, recolour } from '../../tools/charpipe/parts';
import { decompose, groundLock, stepMatrix, worldMatrices } from '../../tools/charpipe/rigmath';
import { ART, loadAnimations, loadCharacter, loadRig } from '../../tools/charpipe/spec';

const rig = loadRig('humanoid-3q');
const alex = loadCharacter('alex');
const sprite = readPng(join(ART, 'characters/alex', alex.source.file));

describe('charpipe images', () => {
  it('round-trips a PNG exactly, alpha included', () => {
    const im = blank(3, 2);
    setPx(im, 0, 0, hex('#f80202'));
    setPx(im, 2, 1, 0x12345680);
    const back = decodePng(encodePng(im));
    expect([...back.d]).toEqual([...im.d]);
  });

  it('compares colours with red ≥ 0x80 correctly (unsigned)', () => {
    const c = hex('#f80202');
    expect(c).toBeGreaterThan(0);
    expect(opaque(c)).toBe(c);
    expect(colours(recolour(sprite, { '#fdb86e': '#ff0000' })).has(hex('#ff0000'))).toBe(true);
  });

  it('enlarging 8× with Scale2x and sampling back gives the sprite again (RotSprite at rest)', () => {
    const back = sampleDown(enlarge8(sprite), 8);
    let d = 0;
    for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) if (px(back, x, y) !== px(sprite, x, y)) d++;
    expect(d).toBe(0);
  });

  it('cuts parts that put the rest pose back together pixel for pixel', () => {
    const parts = cutParts(rig, alex, sprite);
    const out = blank(sprite.w, sprite.h);
    for (const j of rig.drawOrder) {
      const p = parts.get(j)!;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (px(p, x, y)) setPx(out, x, y, px(p, x, y));
    }
    let d = 0;
    for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) if (px(out, x, y) !== px(sprite, x, y)) d++;
    expect(d).toBe(0);
  });

  it('packs frames into a horizontal strip with no padding', () => {
    const sheet = pack([sprite, sprite, sprite]);
    expect([sheet.w, sheet.h]).toEqual([240, 128]);
    expect(px(sheet, 160 + 40, 100)).toBe(px(sprite, 40, 100));
  });
});

describe('charpipe rig maths', () => {
  it('decomposes a ground step into rotate · scale · rotate (what EffectCraft layers can do)', () => {
    for (const step of [-9, -5, -3.54, 0, 3.54, 5, 9]) {
      const m = stepMatrix(step, 38, 0.5);
      const { r1, sx, sy, r2 } = decompose(m); // throws if it does not rebuild m
      expect(sx).toBeGreaterThan(0);
      expect(sy).toBeGreaterThan(0);
      if (step === 0) expect([r1 + r2, sx, sy]).toEqual([0, 100, 100]);
    }
  });

  it('keeps a foot on the ground in the planar walk', () => {
    const planar = loadAnimations(['walk_planar'])[0];
    const dy = groundLock(rig, alex, planar);
    expect(dy).toHaveLength(planar.frames);
    expect(dy.every((v) => Number.isInteger(v) && Math.abs(v) <= 4)).toBe(true);
  });

  it('sits on the seat point with both feet on the floor, inside the frame', () => {
    const sit = loadAnimations(['sit'])[0];
    // the figure moves as a whole by anchorDy, so the app can anchor the seat point
    expect(sit.tracks.root.dy!.every((v) => v === sit.anchorDy)).toBe(true);
    expect([...sit.drawOrder!].sort()).toEqual([...rig.drawOrder].sort());
    for (const id of ['maya', 'teo']) {
      const ch = loadCharacter(id);
      const ms = worldMatrices(rig, ch, sit, 0);
      const at = (j: string, [x, y]: [number, number]) => {
        const m = ms.get(j)!;
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      };
      const seat = rig.foot[1] + sit.anchorDy!;
      // the hips a shin's height above the seat point, the soles below it (in front of the seat) and in the frame
      const [, hip] = at('upper_leg_R', ch.pivots.upper_leg_R);
      expect(seat - hip).toBeGreaterThan(15);
      for (const leg of ['lower_leg_R', 'lower_leg_L'] as const) {
        const [, sole] = at(leg, ch.soles[leg][0]);
        expect(sole, `${id} ${leg}`).toBeGreaterThan(seat);
        expect(sole, `${id} ${leg}`).toBeLessThan(rig.frame.h - 2);
      }
    }
  });
});

describe('character factory', () => {
  it('applies an alternative outfit over the default, piece by piece', async () => {
    const { loadSpec, withOutfit } = await import('../../tools/charpipe/factory/spec');
    const maya = loadSpec('maya');
    const lab = withOutfit(maya, 'lab');
    expect(lab.outfit.id).toBe('lab');
    expect(lab.outfit.top.style).toBe('tech-jacket');
    expect(lab.outfit.trousers).toEqual(maya.outfit.trousers);
  });

  it('names every layer <part>/<material> and puts only jackets in the outfit swap', async () => {
    const { pieces, PARTS } = await import('../../tools/charpipe/factory/standard');
    const { loadSpec, withOutfit } = await import('../../tools/charpipe/factory/spec');
    const a = pieces(loadSpec('maya')).map((p) => p.layer);
    const b = pieces(withOutfit(loadSpec('maya'), 'lab')).map((p) => p.layer);
    expect(a).toEqual(b);
    expect(a.every((l) => (PARTS as readonly string[]).includes(l.split('/')[0]))).toBe(true);
    expect(a.filter((l) => l.endsWith('/jacket'))).toHaveLength(5);
  });

  it('finds a stray pixel and a seam hole, but not the open background', async () => {
    const { findDefects } = await import('../../tools/charpipe/defects');
    const im = blank(12, 12);
    for (let y = 2; y < 9; y++) for (let x = 2; x < 9; x++) if (!(x === 5 && y === 5)) setPx(im, x, y, hex('#806040'));
    setPx(im, 11, 0, hex('#ffffff'));
    const d = findDefects(im);
    expect(d.filter((f) => f.kind === 'hole').map((f) => [f.x, f.y, f.color])).toEqual([[5, 5, hex('#806040')]]);
    expect(d.filter((f) => f.kind === 'orphan').map((f) => [f.x, f.y])).toEqual([[11, 0]]);
  });
});

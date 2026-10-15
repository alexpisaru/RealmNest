import { describe, expect, it } from 'vitest';
import { WORLD_BY_ID } from '../data/worlds';
import { BAKED_WORLDS, sceneFingerprint } from '../render/baked';
import { gradeColor } from '../render/hd/grade';

// every baked scene shipped in public/baked/<world>/scene.json
const files = import.meta.glob('../../public/baked/*/scene.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// the Home previews cut from them (tools/bake_previews.py)
const previews = Object.keys(import.meta.glob('../../public/baked/*/preview.webp'));
const sceneOf = (id: string) => {
  const raw = Object.entries(files).find(([path]) => path.includes(`/baked/${id}/`))?.[1];
  return raw ? JSON.parse(raw) : null;
};

describe('baked scenes', () => {
  it('ships a scene for every world the app loads baked', () => {
    for (const id of BAKED_WORLDS) expect(sceneOf(id), id).not.toBeNull();
  });

  it('ships a Home preview for every baked world (python tools/bake_previews.py after a bake)', () => {
    for (const id of BAKED_WORLDS) expect(previews.some((p) => p.includes(`/baked/${id}/preview.webp`)), id).toBe(true);
  });

  for (const id of BAKED_WORLDS)
    describe(id, () => {
      it(`was baked from its current layout (re-bake with bakePixel('${id}') after layout changes)`, () => {
        const scene = sceneOf(id);
        expect(scene.pixel).toBe(true);
        expect(scene.source).toBe(sceneFingerprint(WORLD_BY_ID[id]));
      });

      it('keeps every cut-out pointing at a stencil, and animation-only props without one', () => {
        const scene = sceneOf(id);
        for (const it of scene.items) expect(it.m === -1 || (it.m >= 0 && it.m < scene.maskRects.length), it.p.id).toBe(true);
        expect(scene.items.some((it: { m: number }) => it.m === -1)).toBe(true);
      });
    });
});

describe('colour grade', () => {
  const g = { saturation: 1.4, greenHue: 9, greenContrast: 1.35, earthLift: 0.05 };
  it('leaves greys alone', () => {
    expect(gradeColor(128, 128, 128, g)).toEqual([128, 128, 128]);
  });
  it('makes a grass green more saturated and more yellow', () => {
    const [r, gg, b] = gradeColor(110, 160, 70, g);
    expect(gg - b).toBeGreaterThan(160 - 70);
    expect(r / gg).toBeGreaterThan(110 / 160);
  });
});

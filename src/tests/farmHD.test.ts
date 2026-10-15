import { describe, expect, it } from 'vitest';
import { PROP_META } from '../data/props';
import { WORLD_BY_ID, WORLDS } from '../data/worlds';
import { sceneTileRange, tileScale } from '../domain/world';
import { downsampleMode, SoftCtx } from '../render/hd/soft';
import { HD4_ART } from '../render/hd4';
import { ANIMAL_VARIANTS } from '../render/hd4/animals';
import { CROP_FAMILIES } from '../render/hd4/crops';
import { DECAL_VARIANTS } from '../render/hd4/decals';
import { FENCE_VARIANTS, WALL_VARIANTS } from '../render/hd4/fences';
import { BUSH_VARIANTS, FLOWER_VARIANTS } from '../render/hd4/plants';
import { PROP_VARIANTS } from '../render/hd4/props4';
import { TREE_SPECIES } from '../render/hd4/trees';
import { REED_VARIANTS, ROCK_VARIANTS } from '../render/hd4/water4';

describe('Farm at 128×64 (2× fidelity vertical slice)', () => {
  const farm = WORLD_BY_ID.farm;
  const all = [...farm.props, ...farm.scene.props];

  it('runs the Farm at 128×64 tiles (other worlds at 128×64 or still 32×16)', () => {
    expect(tileScale(farm)).toBe(4);
    for (const w of WORLDS) expect([1, 4], w.id).toContain(tileScale(w));
  });

  it('keeps the world framing: the same scenic tile range as at 64×32', () => {
    expect(sceneTileRange(22, 18, true, 4)).toEqual(sceneTileRange(22, 18, true, 2));
    const base = sceneTileRange(22, 18, true, 1);
    const hd = sceneTileRange(22, 18, true, 4);
    expect(hd.u1 - hd.u0).toBeLessThan(base.u1 - base.u0);
  });

  it('has 128×64 art for every prop the Farm uses (playable and scenery)', () => {
    const missing = [...new Set(all.map((p) => p.type))].filter((t) => !HD4_ART[t]);
    expect(missing).toEqual([]);
  });

  it('meets the asset library minimums', () => {
    expect(TREE_SPECIES.filter((s) => s !== 'sapling').length).toBeGreaterThanOrEqual(6);
    expect(BUSH_VARIANTS.length).toBeGreaterThanOrEqual(4);
    expect(FLOWER_VARIANTS.length).toBeGreaterThanOrEqual(8);
    expect(FENCE_VARIANTS).toEqual(expect.arrayContaining(['rail', 'picket', 'wattle', 'broken']));
    expect(HD4_ART.gate).toBeDefined();
    expect(WALL_VARIANTS.length).toBeGreaterThanOrEqual(4);
    expect(DECAL_VARIANTS.filter((v) => v.startsWith('edge.')).length).toBeGreaterThanOrEqual(6);
    expect(DECAL_VARIANTS.filter((v) => v.startsWith('trans.')).length).toBeGreaterThanOrEqual(6);
    expect(DECAL_VARIANTS.filter((v) => v.startsWith('clutter.')).length).toBeGreaterThanOrEqual(4);
    expect(CROP_FAMILIES.length).toBeGreaterThanOrEqual(5);
    expect(PROP_VARIANTS.length).toBeGreaterThanOrEqual(20);
    expect(ROCK_VARIANTS.length).toBeGreaterThanOrEqual(4);
    expect(REED_VARIANTS.length).toBeGreaterThanOrEqual(4);
    for (const b of ['farmhouse', 'greenhouse2', 'barn', 'shed', 'well', 'pergola', 'trellis', 'coop', 'dock']) expect(HD4_ART[b], b).toBeDefined();
    for (const a of ['chicken', 'rooster', 'duck', 'cat', 'dog', 'sheep', 'cow', 'frog']) expect(ANIMAL_VARIANTS[a], a).toBeGreaterThanOrEqual(1);
    // the animals you see most come in two hand-drawn variants
    for (const a of ['chicken', 'duck', 'cat', 'sheep']) expect(ANIMAL_VARIANTS[a], a).toBeGreaterThanOrEqual(2);
  });

  it('dresses the scene from the library in variants, not clones', () => {
    const trees = all.filter((p) => p.type === 'tree' || p.type === 'fruitTree');
    expect(new Set(trees.map((p) => p.variant)).size).toBeGreaterThanOrEqual(9);
    const flowers = all.filter((p) => p.type === 'flowerPatch');
    expect(new Set(flowers.map((p) => p.variant)).size).toBeGreaterThanOrEqual(8);
    const decals = all.filter((p) => p.type === 'decal');
    expect(decals.length).toBeGreaterThan(300);
    expect(new Set(decals.map((p) => p.variant)).size).toBeGreaterThanOrEqual(14);
    const fences = all.filter((p) => p.type === 'fenceRow');
    expect(new Set(fences.map((p) => p.variant)).size).toBeGreaterThanOrEqual(3);
  });

  it('fills the scenic frame densely (no empty countryside)', () => {
    expect(farm.scene.props.length).toBeGreaterThan(1500);
    expect(farm.scene.props.filter((p) => p.type === 'tree' || p.type === 'fruitTree').length).toBeGreaterThan(300);
  });

  it('brings the farm to life: hens and a rooster, ducks and frogs, sheep and a cow, a dog and a cat', () => {
    const kinds = new Set(farm.scene.critters.map((c) => c.kind));
    for (const k of ['chicken', 'rooster', 'duck', 'frog', 'sheep', 'cow', 'dog', 'cat'] as const) expect(kinds.has(k), k).toBe(true);
  });

  it('keeps decoration off the water except water plants and the jetty', () => {
    const water = farm.scene.ground.filter((g) => g.mat === 'water');
    const onWater = (x: number, y: number) => water.some((g) => x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.d);
    const ok = new Set(['lilies', 'reeds', 'dock', 'rowboat']);
    const bad = farm.scene.props.filter((p) => !ok.has(p.type) && onWater(p.x, p.y));
    expect(bad.map((p) => `${p.type}@${p.x},${p.y}`).join(' ')).toBe('');
  });

  it('bakes flat decals into the ground: they never block walking', () => {
    for (const p of all) if (PROP_META[p.type].flat) expect(PROP_META[p.type].solid, p.type).toBe(false);
  });
});

describe('SoftCtx (CPU raster for HD sprites)', () => {
  it('fills opaque rects and clips to the buffer', () => {
    const c = new SoftCtx(4, 3);
    c.fillStyle = '#ff0000';
    c.fillRect(-2, 1, 10, 1);
    const row = Array.from(c.data.slice(4, 8));
    expect(row.every((v) => v === 0xff0000ff)).toBe(true);
    expect(c.data[0]).toBe(0);
  });

  it('blends translucent paint over existing pixels and keeps alpha on empty ones', () => {
    const c = new SoftCtx(2, 1);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 1, 1);
    c.globalAlpha = 0.5;
    c.fillStyle = '#000000';
    c.fillRect(0, 0, 2, 1);
    const [a, b] = Array.from(c.data);
    expect(a >>> 24).toBe(255); // opaque stays opaque
    expect(a & 255).toBeGreaterThan(120);
    expect(a & 255).toBeLessThan(135);
    expect(b >>> 24).toBeGreaterThan(120); // shadow on transparent keeps its own alpha
    expect(b >>> 24).toBeLessThan(135);
  });

  it('parses rgba() and short hex colours', () => {
    const c = new SoftCtx(1, 1);
    c.fillStyle = 'rgba(42,26,42,0.3)';
    c.fillRect(0, 0, 1, 1);
    expect(c.data[0] >>> 24).toBeGreaterThan(70);
    c.globalAlpha = 1;
    c.fillStyle = '#0f0';
    c.fillRect(0, 0, 1, 1);
    expect(c.data[0]).toBe(0xff00ff00);
  });

  it('tracks the box it has drawn into (layers only visit that box)', () => {
    const c = new SoftCtx(20, 10);
    expect(c.dirty).toBe(false);
    c.fillStyle = '#123456';
    c.fillRect(3, 2, 4, 3);
    c.put(15, 8, 0xff000000);
    expect([c.dx0, c.dy0, c.dx1, c.dy1]).toEqual([3, 2, 16, 9]);
  });
});

describe('downsampleMode (the half-resolution level of detail)', () => {
  const A = 0xff0000ff;
  const B = 0xffff0000; // darker than A by luminance
  const C = 0xff00ff00;
  it('keeps uniform blocks and takes the majority colour of a 2×2 block', () => {
    expect(Array.from(downsampleMode(new Uint32Array([A, A, A, A]), 2, 2))).toEqual([A]);
    expect(Array.from(downsampleMode(new Uint32Array([A, C, A, A]), 2, 2))).toEqual([A]);
  });
  it('breaks ties toward the darker colour (thin dark outlines survive) and drops mostly-empty blocks', () => {
    expect(Array.from(downsampleMode(new Uint32Array([A, B, B, A]), 2, 2))).toEqual([B]);
    expect(Array.from(downsampleMode(new Uint32Array([A, 0, 0, 0]), 2, 2))).toEqual([0]);
  });
});

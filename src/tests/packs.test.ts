import { describe, expect, it } from 'vitest';
import { PROP_META } from '../data/props';
import { WORLDS } from '../data/worlds';
import { tileScale } from '../domain/world';
import { PACKS } from '../render/hd4/packs';

// Every world drawn at 128×64 (other than the Farm, whose art is HD4_ART) owns a
// pack with art for everything it places: props, scenery, wall props, critters.
describe('world packs (128×64)', () => {
  for (const w of WORLDS) {
    if (w.id === 'farm' || tileScale(w) < 4) continue;
    describe(w.name, () => {
      const pack = PACKS[w.id];
      it('has a pack', () => expect(pack, w.id).toBeDefined());
      it('has art for every prop and scenic prop it places', () => {
        const used = new Set([...w.props, ...w.scene.props].map((p) => p.type));
        expect([...used].filter((t) => !pack.props[t])).toEqual([]);
      });
      it('has art for every wall prop', () => {
        if (w.environment.backdrop !== 'walls') return;
        expect(pack.walls, 'walls').toBeDefined();
        const used = new Set(w.environment.wallProps.map((p) => p.type));
        expect([...used].filter((t) => !pack.walls!.art[t])).toEqual([]);
      });
      it('draws the cut front walls of an indoor room', () => {
        if (!w.scene.frontWalls) return;
        expect(pack.props.lowWall, 'lowWall').toBeDefined();
      });
      it('only uses known critters (built-in or its own)', () => {
        const builtIn = new Set(['chicken', 'butterfly', 'duck', 'cat', 'bird', 'rooster', 'sheep', 'dog', 'frog', 'cow', 'pigeon']);
        const bad = w.scene.critters.filter((c) => !builtIn.has(c.kind) && !pack.critters?.[c.kind]).map((c) => c.kind);
        expect(bad).toEqual([]);
      });
      it('fills its surroundings (no empty frame)', () => {
        expect(w.scene.props.length).toBeGreaterThan(60);
      });
    });
  }

  it('keeps world-specific prop types unique (no shared asset names between packs)', () => {
    const owner = new Map<string, string>();
    for (const [id, pack] of Object.entries(PACKS))
      for (const t of Object.keys(pack.props)) {
        if (PROP_META[t] && !t.includes('_')) continue; // shared catalogue names (desk, console…) are drawn per pack
        expect(owner.get(t), `${t} in ${id} and ${owner.get(t)}`).toBeUndefined();
        owner.set(t, id);
      }
  });
});

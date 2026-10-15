import { describe, expect, it } from 'vitest';
import { OUTFIT_BY_ID, OUTFITS } from '../data/outfits';
import { PROP_META } from '../data/props';
import { WORLDS } from '../data/worlds';
import { breakPoints, interactionPoints, workPoints } from '../domain/world';
import { footprint, NavGrid } from '../engine/nav';

describe('world data integrity', () => {
  it('has the 10 expected worlds with unique ids', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(['office', 'factory', 'farm', 'space', 'chemlab', 'studio', 'robotics', 'datacenter', 'research', 'port']);
  });

  for (const w of WORLDS) {
    describe(w.name, () => {
      const grid = NavGrid.fromWorld(w);
      const spawn = w.spawnPoints[0];

      it('has spawn points on walkable tiles', () => {
        expect(w.spawnPoints.length).toBeGreaterThan(0);
        for (const s of w.spawnPoints) expect(grid.walkable(s.x, s.y), `${s.x},${s.y}`).toBe(true);
      });

      it('has enough stations, break and meeting points', () => {
        expect(workPoints(w).length).toBeGreaterThanOrEqual(6);
        expect(breakPoints(w).length).toBeGreaterThanOrEqual(2);
        expect(interactionPoints(w).length).toBeGreaterThanOrEqual(4);
      });

      it('uses unique point ids, known props and non-overlapping footprints inside the map', () => {
        expect(new Set(w.points.map((p) => p.id)).size).toBe(w.points.length);
        const taken = new Map<string, string>();
        for (const p of w.props) {
          expect(PROP_META[p.type], p.type).toBeDefined();
          if (PROP_META[p.type].solid === false) continue;
          for (const t of footprint(p)) {
            expect(t.x >= 0 && t.y >= 0 && t.x < w.cols && t.y < w.rows, `${p.id} out of bounds at ${t.x},${t.y}`).toBe(true);
            const k = `${t.x},${t.y}`;
            expect(taken.get(k), `${p.id} overlaps ${taken.get(k)} at ${k}`).toBeUndefined();
            taken.set(k, p.id);
          }
        }
      });

      it('places every interaction point on a usable, reachable tile', () => {
        for (const p of w.points) {
          const tx = Math.floor(p.x);
          const ty = Math.floor(p.y);
          expect(grid.inside(tx, ty), `${p.id} (${p.label}) outside map`).toBe(true);
          if (!p.sit) expect(grid.walkable(tx, ty), `${p.id} (${p.label}) on blocked tile ${tx},${ty}`).toBe(true);
          expect(grid.findPath(spawn.x, spawn.y, tx, ty), `${p.id} (${p.label}) unreachable`).not.toBeNull();
        }
      });

      it('keeps scenery outside the playable grid', () => {
        expect(w.scene.ext).toBeGreaterThan(0);
        for (const p of w.scene.props) {
          expect(PROP_META[p.type], p.type).toBeDefined();
          for (const t of footprint(p)) expect(grid.inside(t.x, t.y), `${p.id} (${p.type}) intrudes at ${t.x},${t.y}`).toBe(false);
        }
      });

      it('points to an outfit collection of 6–9 outfits that includes its default', () => {
        const coll = OUTFITS.filter((o) => o.worldCategory === w.outfitCategory);
        expect(coll.length).toBeGreaterThanOrEqual(6);
        expect(coll.length).toBeLessThanOrEqual(9);
        expect(OUTFIT_BY_ID[w.defaultOutfitId]?.worldCategory).toBe(w.outfitCategory);
      });
    });
  }
});

import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { isOutfitCompatible, outfitsForWorld } from '../data/outfits';
import { RealmNestRepository, migrate } from '../persistence/repository';
import { MemoryAdapter } from '../persistence/storage';
import { AppStore } from '../store/appStore';
import { createCharacter, duplicate, moveToWorld, ValidationError } from '../store/characters';

describe('character creation', () => {
  it('uses the user-chosen name and role, trims, and validates', () => {
    const c = createCharacter({ name: '  Mario ', role: 'Researcher', visualPresetId: 'curly', worldId: 'research' });
    expect(c.name).toBe('Mario');
    expect(c.role).toBe('Researcher');
    expect(c.outfitId.startsWith('research.')).toBe(true);
    expect(() => createCharacter({ name: '   ', role: 'x', visualPresetId: 'curly', worldId: 'office' })).toThrow(ValidationError);
    expect(() => createCharacter({ name: 'A', role: 'x', visualPresetId: 'curly', worldId: 'nowhere' })).toThrow(ValidationError);
  });

  it('marks the founder preset and allows any number of characters', () => {
    const many = Array.from({ length: 50 }, (_, i) => createCharacter({ name: `N${i}`, role: 'R', visualPresetId: 'founder', worldId: 'office' }));
    expect(new Set(many.map((c) => c.id)).size).toBe(50);
    expect(many[0].metadata.founder).toBe(true);
    expect(many[0].profile.hair).toBe('mane');
  });

  it('keeps outfits world-compatible when moving and duplicating', () => {
    const c = createCharacter({ name: 'Zoe', role: 'Grower', visualPresetId: 'afro', worldId: 'farm', outfitId: 'farm.rain' });
    expect(c.outfitId).toBe('farm.rain');
    const moved = moveToWorld(c, 'space');
    expect(moved.outfitId.startsWith('space.')).toBe(true);
    const universal = moveToWorld({ ...c, outfitId: 'universal.hoodie' }, 'space');
    expect(universal.outfitId).toBe('universal.hoodie');
    const copy = duplicate(c);
    expect(copy.id).not.toBe(c.id);
    expect(copy.metadata.founder).toBe(false);
  });

  it('rejects outfits from another collection', () => {
    expect(isOutfitCompatible('farm.classic', 'office')).toBe(false);
    expect(isOutfitCompatible('office.formal', 'office')).toBe(true);
    expect(outfitsForWorld('office').every((o) => o.worldCategory === 'office' || o.worldCategory === 'universal')).toBe(true);
  });
});

describe('persistence', () => {
  it('round-trips save data and fills defaults for old saves', async () => {
    const repo = new RealmNestRepository(new MemoryAdapter());
    expect(await repo.load()).toBeUndefined();
    await repo.save({ characters: [], settings: migrate({}).settings, currentWorldId: 'farm', seenIntro: true });
    const loaded = await repo.load();
    expect(loaded?.currentWorldId).toBe('farm');
    const m = migrate({ settings: { language: 'en' } as never });
    expect(m.settings.language).toBe('en');
    expect(m.settings.volume.master).toBeGreaterThan(0);
  });

  it('AppStore seeds a demo crew, persists edits and reloads them', async () => {
    const adapter = new MemoryAdapter();
    const bus = new EventBus();
    const store = new AppStore(new RealmNestRepository(adapter), bus);
    await store.init();
    const n = store.getState().characters.length;
    expect(n).toBeGreaterThan(0);
    const c = store.createCharacter({ name: 'Mario', role: 'Researcher', visualPresetId: 'spiky', worldId: 'research' });
    store.updateCharacter(c.id, { role: 'Lead researcher' });
    store.setWorld('research');
    await store.persistNow();
    const again = new AppStore(new RealmNestRepository(adapter), new EventBus());
    await again.init();
    const st = again.getState();
    expect(st.characters).toHaveLength(n + 1);
    expect(st.characters.find((x) => x.id === c.id)?.role).toBe('Lead researcher');
    expect(st.currentWorldId).toBe('research');
    expect(bus.log.map((e) => e.type)).toEqual(expect.arrayContaining(['character.created', 'character.updated', 'world.changed']));
  });
});

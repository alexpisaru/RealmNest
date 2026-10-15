import { describe, expect, it } from 'vitest';
import { WORLDS } from '../data/worlds';
import { ambienceFor } from '../audio/ambience';
import { AudioEngine, sceneFor } from '../audio/engine';
import { composeBar, MOODS, moodFor, scaleNotes } from '../audio/music';
import { rng } from '../audio/synth';

// Generated audio (docs/AUDIO.md): every world has its own music and ambience, the composer
// stays in key, the night changes the ambience, and nothing breaks where Web Audio is missing.

describe('audio', () => {
  it('every world has its own mood and ambience; the night puts the birds to sleep and wakes the crickets', () => {
    for (const w of WORLDS) {
      expect(moodFor(w.id)).toBe(MOODS[w.id]);
      expect(ambienceFor(w.id, false)).not.toBe(ambienceFor('home', false));
    }
    const day = ambienceFor('farm', false);
    const night = ambienceFor('farm', true);
    expect(day.spots.map((s) => s.kind)).toContain('birds');
    expect(night.spots.map((s) => s.kind)).not.toContain('birds');
    expect(night.spots.map((s) => s.kind)).toContain('crickets');
    // the day's table is not changed by asking for the night
    expect(ambienceFor('farm', false).spots.map((s) => s.kind)).toContain('birds');
  });

  it('the composer stays in key and in range, changes chord every two bars, and is repeatable', () => {
    for (const [id, m] of Object.entries(MOODS)) {
      const scale = new Set(scaleNotes(m, m.root + 7, m.root + 26));
      const voice = { degree: 5 };
      const rand = rng(7);
      const bars = Array.from({ length: 32 }, (_, i) => composeBar(m, i, rand, voice, i > 16));
      for (const b of bars) for (const n of b.melody) expect(scale.has(n.note), `${id} ${n.note}`).toBe(true);
      expect(bars.filter((b) => b.change)).toHaveLength(16);
      expect(bars.some((b) => b.melody.length > 0)).toBe(true);
      expect(bars[0].chord).toEqual(m.progression[0].map((o) => m.root + o));
      expect(bars[2].chord).toEqual(m.progression[1].map((o) => m.root + o));
    }
    const a = composeBar(MOODS.farm, 3, rng(1), { degree: 5 });
    const b = composeBar(MOODS.farm, 3, rng(1), { degree: 5 });
    expect(a).toEqual(b);
  });

  it('a world sounds in Simulation, the islands on Home and Worlds, only music elsewhere', () => {
    expect(sceneFor('simulation', 'port', true)).toEqual({ music: 'port', ambience: 'port', ambienceLevel: 1, night: true });
    expect(sceneFor('home', 'port', false)).toMatchObject({ music: 'home', ambience: 'home' });
    expect(sceneFor('chat', 'port', false)).toMatchObject({ music: 'home', ambience: null, ambienceLevel: 0 });
  });

  it('without Web Audio the engine does nothing and never throws', () => {
    const e = new AudioEngine(() => null);
    e.start();
    e.setVolumes({ master: 1, music: 1, ambient: 1, effects: 1 });
    e.setScene(sceneFor('simulation', 'farm', false));
    e.setHidden(true);
    e.play('taskDone');
    expect(e.running).toBe(false);
  });
});

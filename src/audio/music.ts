// Generative music (docs/AUDIO.md): soft pads on a slow chord progression, a round bass and a
// plucked melody that wanders over a pentatonic scale. Each world has its own key and mood; the
// night is slower and sparser. The composer is pure (seeded) so it can be tested; MusicPlayer
// turns its bars into Web Audio notes a little ahead of time.

import { hz, rng, tone } from './synth';

export interface Mood {
  /** MIDI note of the key's root, around the 4th octave */
  root: number;
  minor: boolean;
  /** chords as semitone offsets from the root, two bars each */
  progression: number[][];
  bpm: number;
  /** 0..1: how often the melody plays */
  density: number;
  /** 0..1: how open the pads' filter is */
  brightness: number;
}

const MAJ = { I: [0, 4, 7, 11], ii: [2, 5, 9, 12], iii: [4, 7, 11, 14], IV: [5, 9, 12, 16], V: [-5, -1, 2, 5], vi: [-3, 0, 4, 7] };
const MIN = { i: [0, 3, 7, 10], iv: [5, 8, 12, 15], VI: [-4, 0, 3, 7], III: [3, 7, 10, 14], VII: [-2, 2, 5, 9], v: [-5, -2, 2, 5] };

export const MOODS: Record<string, Mood> = {
  home: { root: 60, minor: false, progression: [MAJ.I, MAJ.vi, MAJ.IV, MAJ.V], bpm: 72, density: 0.32, brightness: 0.55 },
  farm: { root: 55, minor: false, progression: [MAJ.I, MAJ.IV, MAJ.vi, MAJ.V], bpm: 76, density: 0.38, brightness: 0.65 },
  office: { root: 65, minor: false, progression: [MAJ.I, MAJ.iii, MAJ.vi, MAJ.IV], bpm: 80, density: 0.34, brightness: 0.6 },
  port: { root: 62, minor: false, progression: [MAJ.I, MAJ.IV, MAJ.I, MAJ.V], bpm: 70, density: 0.3, brightness: 0.55 },
  studio: { root: 57, minor: false, progression: [MAJ.I, MAJ.V, MAJ.vi, MAJ.IV], bpm: 78, density: 0.4, brightness: 0.7 },
  chemlab: { root: 58, minor: false, progression: [MAJ.I, MAJ.ii, MAJ.IV, MAJ.I], bpm: 74, density: 0.3, brightness: 0.5 },
  robotics: { root: 63, minor: false, progression: [MAJ.I, MAJ.vi, MAJ.ii, MAJ.V], bpm: 84, density: 0.45, brightness: 0.6 },
  factory: { root: 57, minor: true, progression: [MIN.i, MIN.iv, MIN.VI, MIN.v], bpm: 76, density: 0.3, brightness: 0.45 },
  datacenter: { root: 64, minor: true, progression: [MIN.i, MIN.VI, MIN.III, MIN.VII], bpm: 66, density: 0.26, brightness: 0.4 },
  research: { root: 52, minor: true, progression: [MIN.i, MIN.VI, MIN.III, MIN.VII], bpm: 64, density: 0.24, brightness: 0.45 },
  space: { root: 62, minor: true, progression: [MIN.i, MIN.VI, MIN.iv, MIN.VII], bpm: 60, density: 0.18, brightness: 0.35 },
};

export const moodFor = (worldId: string | undefined) => MOODS[worldId ?? ''] ?? MOODS.home;

const PENTA_MAJ = [0, 2, 4, 7, 9];
const PENTA_MIN = [0, 3, 5, 7, 10];

/** one bar: the chord (MIDI), the bass and the melody's notes by eighth (0..7) */
export interface Bar {
  chord: number[];
  /** a new chord starts on this bar (the pads change) */
  change: boolean;
  bass: number;
  melody: { step: number; note: number; vel: number }[];
}

/** the melody's position in scale steps, kept between bars */
export interface Voice {
  degree: number;
}

/** the notes of the scale from `lo` to `hi` (MIDI) */
export function scaleNotes(m: Mood, lo: number, hi: number): number[] {
  const steps = m.minor ? PENTA_MIN : PENTA_MAJ;
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (steps.includes((((n - m.root) % 12) + 12) % 12)) out.push(n);
  return out;
}

export function composeBar(m: Mood, bar: number, rand: () => number, voice: Voice, night = false): Bar {
  const chordOffsets = m.progression[Math.floor(bar / 2) % m.progression.length];
  const chord = chordOffsets.map((o) => m.root + o);
  const lowest = Math.min(...chord);
  const bass = lowest - 24 + (bar % 2 === 1 && rand() < 0.4 ? 7 : 0);
  const notes = scaleNotes(m, m.root + 7, m.root + 26);
  const density = m.density * (night ? 0.55 : 1) * (bar % 4 === 3 ? 0.35 : 1);
  const melody: Bar['melody'] = [];
  voice.degree = Math.max(0, Math.min(notes.length - 1, voice.degree));
  for (let step = 0; step < 8; step++) {
    const strong = step % 4 === 0;
    if (rand() > density * (strong ? 1.5 : step % 2 ? 0.55 : 1)) continue;
    const moves = [-2, -1, -1, 0, 1, 1, 2];
    voice.degree = Math.max(0, Math.min(notes.length - 1, voice.degree + moves[Math.floor(rand() * moves.length)]));
    let note = notes[voice.degree];
    // on the strong beats lean on the chord: the nearest chord tone in the scale
    if (strong) {
      const pcs = chord.map((c) => (((c - m.root) % 12) + 12) % 12);
      const near = notes.map((n, i) => ({ n, i })).filter(({ n }) => pcs.includes((((n - m.root) % 12) + 12) % 12)).sort((a, b) => Math.abs(a.i - voice.degree) - Math.abs(b.i - voice.degree))[0];
      if (near) ((note = near.n), (voice.degree = near.i));
    }
    melody.push({ step, note, vel: (strong ? 0.9 : 0.65) + rand() * 0.15 });
  }
  return { chord, change: bar % 2 === 0, bass, melody };
}

/** plays the composer's bars on a bus; call tick() often (it schedules ~0.4 s ahead) */
export class MusicPlayer {
  private mood: Mood = MOODS.home;
  private pending: Mood | null = null;
  private night = false;
  private bar = 0;
  private nextBarAt = 0;
  private rand = rng(Date.now() & 0xffff);
  private voice: Voice = { degree: 5 };
  private pad: { gain: GainNode; stop: (t: number) => void } | null = null;
  private padFilter: BiquadFilterNode;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private reverb: AudioNode,
  ) {
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.Q.value = 0.4;
    this.padFilter.connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    this.padFilter.connect(send).connect(reverb);
  }

  setMood(m: Mood, night: boolean) {
    if (m !== this.mood) this.pending = m;
    this.night = night;
  }

  private get barSeconds() {
    return (60 / (this.mood.bpm - (this.night ? 6 : 0))) * 4;
  }

  tick() {
    const now = this.ctx.currentTime;
    if (this.nextBarAt < now) this.nextBarAt = now + 0.1;
    while (this.nextBarAt < now + 0.4) {
      // a new world's key starts with a new chord
      if (this.pending && this.bar % 2 === 0) ((this.mood = this.pending), (this.pending = null), (this.bar = 0));
      this.playBar(composeBar(this.mood, this.bar, this.rand, this.voice, this.night), this.nextBarAt);
      this.nextBarAt += this.barSeconds;
      this.bar++;
    }
  }

  private playBar(b: Bar, t: number) {
    const bar = this.barSeconds;
    const eighth = bar / 8;
    if (b.change) this.playChord(b.chord, t, bar * 2);
    tone(this.ctx, this.out, t, { freq: hz(b.bass), partials: [[1, 1], [2, 0.25]], attack: 0.06, decay: bar * 0.9, gain: 0.16, filter: 380 });
    const send = this.ctx.createGain();
    send.gain.value = 0.7;
    send.connect(this.reverb);
    for (const n of b.melody) {
      const at = t + n.step * eighth + (this.rand() - 0.5) * 0.012;
      const pan = (this.rand() - 0.5) * 0.5;
      tone(this.ctx, this.out, at, { freq: hz(n.note), partials: [[1, 1], [2, 0.22], [3, 0.06]], attack: 0.004, decay: 1.5, gain: 0.075 * n.vel, pan, filter: 3200 });
      tone(this.ctx, send, at, { freq: hz(n.note), partials: [[1, 1]], attack: 0.004, decay: 1.2, gain: 0.05 * n.vel, pan });
    }
  }

  private playChord(chord: number[], t: number, length: number) {
    const ctx = this.ctx;
    const bright = this.mood.brightness * (this.night ? 0.7 : 1);
    this.padFilter.frequency.setTargetAtTime(500 + bright * 1600, t, 1.5);
    this.pad?.stop(t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 1.6);
    gain.connect(this.padFilter);
    const oscs: OscillatorNode[] = [];
    for (const note of chord) {
      for (const [type, detune, g] of [['triangle', -6, 0.03], ['sine', 7, 0.035]] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = hz(note);
        o.detune.value = detune;
        const og = ctx.createGain();
        og.gain.value = g;
        o.connect(og).connect(gain);
        o.start(t);
        oscs.push(o);
      }
    }
    const stop = (at: number) => {
      gain.gain.cancelScheduledValues(at);
      gain.gain.setTargetAtTime(0, at, 0.8);
      for (const o of oscs) o.stop(at + 5);
    };
    // a chord that is never replaced (the player stopped) ends by itself
    for (const o of oscs) o.stop(t + length + 8);
    this.pad = { gain, stop };
  }

  stop(at: number) {
    this.pad?.stop(at);
    this.pad = null;
    this.nextBarAt = 0;
  }
}

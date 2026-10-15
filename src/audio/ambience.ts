// The sound of each world (docs/AUDIO.md): beds that never stop (wind, sea, a stream, machines,
// fans, a city) and sounds that come and go (birds, crickets, gulls, beeps, bubbles, presses,
// servos). Day and night differ: birds sleep, crickets start. Everything is synthesised.

import { hz, noise, noiseSource, tone } from './synth';

export type BedKind = 'wind' | 'coldWind' | 'waves' | 'stream' | 'fountain' | 'city' | 'hum' | 'fans' | 'drone';
export type SpotKind = 'birds' | 'crickets' | 'gulls' | 'beeps' | 'bubbles' | 'press' | 'servo' | 'horn' | 'tram';

export interface Ambience {
  beds: { kind: BedKind; level: number; freq?: number }[];
  /** sounds that come and go: on average `rate` times a minute */
  spots: { kind: SpotKind; rate: number; level: number }[];
  /** evens out the worlds: measured offline to about -22 dBFS RMS each (docs/AUDIO.md) */
  gain: number;
}

const A = (beds: Ambience['beds'], spots: Ambience['spots'], gain: number): Ambience => ({ beds, spots, gain });

const DAY: Record<string, Ambience> = {
  // Home and the Worlds screen: the islands on the map
  home: A([{ kind: 'waves', level: 0.5 }, { kind: 'wind', level: 0.35 }], [{ kind: 'birds', rate: 5, level: 0.5 }, { kind: 'gulls', rate: 1.2, level: 0.35 }], 1.27),
  farm: A([{ kind: 'wind', level: 0.45 }, { kind: 'stream', level: 0.25 }], [{ kind: 'birds', rate: 14, level: 0.7 }], 3.3),
  office: A([{ kind: 'city', level: 0.5 }, { kind: 'fountain', level: 0.4 }], [{ kind: 'birds', rate: 5, level: 0.45 }, { kind: 'tram', rate: 0.8, level: 0.4 }], 1.68),
  port: A([{ kind: 'waves', level: 0.8 }, { kind: 'wind', level: 0.4 }], [{ kind: 'gulls', rate: 5, level: 0.6 }, { kind: 'horn', rate: 0.4, level: 0.45 }], 0.82),
  studio: A([{ kind: 'waves', level: 0.55 }, { kind: 'wind', level: 0.25 }], [{ kind: 'birds', rate: 6, level: 0.5 }, { kind: 'gulls', rate: 2, level: 0.4 }], 1.19),
  chemlab: A([{ kind: 'hum', level: 0.3, freq: 120 }, { kind: 'wind', level: 0.2 }], [{ kind: 'bubbles', rate: 7, level: 0.55 }, { kind: 'beeps', rate: 2, level: 0.3 }, { kind: 'birds', rate: 3, level: 0.3 }], 3.9),
  robotics: A([{ kind: 'hum', level: 0.35, freq: 100 }], [{ kind: 'servo', rate: 6, level: 0.5 }, { kind: 'beeps', rate: 4, level: 0.35 }, { kind: 'birds', rate: 2, level: 0.25 }], 3.76),
  factory: A([{ kind: 'hum', level: 0.5, freq: 60 }, { kind: 'city', level: 0.25 }], [{ kind: 'press', rate: 9, level: 0.55 }, { kind: 'servo', rate: 2, level: 0.3 }], 2.16),
  datacenter: A([{ kind: 'fans', level: 0.55 }, { kind: 'hum', level: 0.3, freq: 100 }], [{ kind: 'beeps', rate: 3, level: 0.3 }], 2.95),
  research: A([{ kind: 'coldWind', level: 0.6 }], [{ kind: 'beeps', rate: 1, level: 0.25 }, { kind: 'birds', rate: 1.5, level: 0.25 }], 4.0),
  space: A([{ kind: 'drone', level: 0.6, freq: 55 }, { kind: 'fans', level: 0.2 }], [{ kind: 'beeps', rate: 4, level: 0.4 }], 0.94),
};

/** the ambience of a world (or of the map), by day or night */
export function ambienceFor(worldId: string | undefined, night: boolean): Ambience {
  const day = DAY[worldId ?? ''] ?? DAY.home;
  if (!night) return day;
  return {
    gain: day.gain,
    beds: day.beds.map((b) => (b.kind === 'city' ? { ...b, level: b.level * 0.5 } : b)),
    spots: [
      ...day.spots.filter((s) => s.kind !== 'birds' && s.kind !== 'gulls' && s.kind !== 'tram').map((s) => (s.kind === 'press' || s.kind === 'servo' ? { ...s, rate: s.rate * 0.5 } : s)),
      // crickets wherever birds sang
      ...(day.spots.some((s) => s.kind === 'birds') ? [{ kind: 'crickets' as const, rate: 10, level: 0.4 }] : []),
    ],
  };
}

/** a running ambience: its beds play until stop(); spots are scheduled by tick() */
export class AmbiencePlayer {
  readonly gain: GainNode;
  private stops: (() => void)[] = [];
  private next = new Map<number, number>();
  private wobble: { param: AudioParam; base: number; depth: number }[] = [];
  private lastWobble = 0;
  private stopped = false;

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private reverb: AudioNode,
    readonly spec: Ambience,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
    for (const b of spec.beds) this.bed(b.kind, b.level, b.freq);
  }

  fadeIn(seconds: number) {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(this.spec.gain, t + seconds);
  }

  stop(seconds: number) {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + seconds);
    setTimeout(() => (this.stops.forEach((s) => s()), this.gain.disconnect()), seconds * 1000 + 200);
    this.stopped = true;
  }

  private bed(kind: BedKind, level: number, freq = 60) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.gain);
    const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      return n;
    };
    const src = (color: 'white' | 'pink' | 'brown') => {
      const s = noiseSource(ctx, color, Math.random() * 4);
      this.stops.push(() => s.stop());
      return s;
    };
    const osc = (f: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.start();
      this.stops.push(() => o.stop());
      return o;
    };
    switch (kind) {
      case 'wind':
      case 'coldWind': {
        const bp = filter('bandpass', kind === 'wind' ? 500 : 900, kind === 'wind' ? 0.6 : 1.2);
        src('pink').connect(bp).connect(g);
        g.gain.value = level * 0.5;
        this.wobble.push({ param: bp.frequency, base: bp.frequency.value, depth: 0.45 }, { param: g.gain, base: level * 0.5, depth: 0.5 });
        break;
      }
      case 'waves': {
        const lp = filter('lowpass', 700);
        src('brown').connect(lp).connect(g);
        g.gain.value = level * 0.6;
        // the swell of the sea: a slow LFO on the level
        const lfo = osc(0.11);
        const depth = ctx.createGain();
        depth.gain.value = level * 0.35;
        lfo.connect(depth).connect(g.gain);
        const hiss = filter('highpass', 2500);
        const hg = ctx.createGain();
        hg.gain.value = level * 0.05;
        src('white').connect(hiss).connect(hg).connect(g);
        break;
      }
      case 'stream':
      case 'fountain': {
        const bp = filter('bandpass', kind === 'stream' ? 1800 : 2600, 0.5);
        src('white').connect(bp).connect(g);
        g.gain.value = level * (kind === 'stream' ? 0.25 : 0.3);
        this.wobble.push({ param: bp.frequency, base: bp.frequency.value, depth: 0.2 });
        break;
      }
      case 'city': {
        const lp = filter('lowpass', 320);
        src('brown').connect(lp).connect(g);
        g.gain.value = level * 0.55;
        this.wobble.push({ param: g.gain, base: level * 0.55, depth: 0.3 });
        break;
      }
      case 'hum':
      case 'drone': {
        const lp = filter('lowpass', kind === 'hum' ? 400 : 260);
        lp.connect(g);
        for (const [m, a] of kind === 'hum' ? [[1, 0.5], [2, 0.25], [3, 0.08]] : [[1, 0.5], [1.5, 0.3], [2.01, 0.2]]) {
          const og = ctx.createGain();
          og.gain.value = a;
          osc(freq * m).connect(og).connect(lp);
        }
        const rumble = ctx.createGain();
        rumble.gain.value = 0.4;
        src('brown').connect(filter('lowpass', 200)).connect(rumble).connect(lp);
        g.gain.value = level * (kind === 'hum' ? 0.14 : 0.3);
        if (kind === 'drone') this.wobble.push({ param: lp.frequency, base: 260, depth: 0.5 });
        break;
      }
      case 'fans': {
        const bp = filter('bandpass', 1100, 0.4);
        src('pink').connect(bp).connect(g);
        g.gain.value = level * 0.35;
        break;
      }
    }
  }

  /** schedule the spots due in the next half second, and drift the beds */
  tick() {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.spec.spots.forEach((s, i) => {
      let at = this.next.get(i) ?? now + Math.random() * (60 / s.rate);
      while (at < now + 0.5) {
        if (at >= now - 0.1) this.spot(s.kind, s.level, Math.max(at, now));
        // a Poisson process: on average `rate` a minute
        at += -Math.log(1 - Math.random()) * (60 / s.rate);
      }
      this.next.set(i, at);
    });
    if (now - this.lastWobble > 2.5) {
      this.lastWobble = now;
      for (const w of this.wobble) w.param.setTargetAtTime(w.base * (1 + (Math.random() * 2 - 1) * w.depth), now, 1.8);
    }
  }

  private spot(kind: SpotKind, level: number, t: number) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.gain);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    out.connect(wet).connect(this.reverb);
    const pan = (Math.random() * 2 - 1) * 0.8;
    const r = Math.random;
    switch (kind) {
      case 'birds': {
        // a short phrase of chirps
        const base = 2400 + r() * 1800;
        const n = 2 + Math.floor(r() * 5);
        const up = r() < 0.6;
        for (let i = 0; i < n; i++) {
          const f = base * (1 + (r() - 0.5) * 0.2);
          tone(ctx, out, t + i * (0.09 + r() * 0.07), { freq: up ? f : f * 1.4, glideTo: up ? f * 1.45 : f, glideTime: 0.06, attack: 0.008, decay: 0.07, gain: 0.05, pan });
        }
        break;
      }
      case 'crickets': {
        const f = 4300 + r() * 600;
        const n = 3 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) tone(ctx, out, t + i * 0.055, { freq: f, attack: 0.004, decay: 0.03, gain: 0.025, pan });
        break;
      }
      case 'gulls': {
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const f = 1100 + r() * 300;
          tone(ctx, out, t + i * 0.32, { freq: f, glideTo: f * 0.62, glideTime: 0.28, type: 'sawtooth', attack: 0.03, decay: 0.28, gain: 0.018, pan, filter: 1800 });
        }
        break;
      }
      case 'beeps': {
        const f = [880, 1175, 1320, 1568][Math.floor(r() * 4)];
        tone(ctx, out, t, { freq: f, attack: 0.005, decay: 0.12, gain: 0.03, pan });
        if (r() < 0.4) tone(ctx, out, t + 0.14, { freq: f * 1.25, attack: 0.005, decay: 0.12, gain: 0.025, pan });
        break;
      }
      case 'bubbles': {
        const n = 2 + Math.floor(r() * 5);
        for (let i = 0; i < n; i++) {
          const f = 220 + r() * 380;
          tone(ctx, out, t + i * (0.06 + r() * 0.12), { freq: f, glideTo: f * 2.4, glideTime: 0.05, attack: 0.003, decay: 0.05, gain: 0.05, pan });
        }
        break;
      }
      case 'press': {
        tone(ctx, out, t, { freq: 70, glideTo: 45, glideTime: 0.2, attack: 0.004, decay: 0.25, gain: 0.22, pan: pan * 0.5 });
        const hit = ctx.createBufferSource();
        hit.buffer = noise(ctx, 'white');
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2200;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.06, t);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        hit.connect(bp).connect(hg).connect(out);
        hit.start(t, r() * 3);
        hit.stop(t + 0.15);
        break;
      }
      case 'servo': {
        const f = 300 + r() * 250;
        tone(ctx, out, t, { freq: f, glideTo: f * (r() < 0.5 ? 1.6 : 0.65), glideTime: 0.35, type: 'sawtooth', attack: 0.03, decay: 0.38, gain: 0.012, pan, filter: 1400 });
        break;
      }
      case 'horn': {
        tone(ctx, out, t, { freq: hz(38), partials: [[1, 1], [2, 0.5], [3, 0.2]], type: 'sawtooth', attack: 0.35, decay: 2.2, gain: 0.03, filter: 500, pan: pan * 0.4 });
        break;
      }
      case 'tram': {
        // the tram's two-note bell
        tone(ctx, out, t, { freq: 1568, partials: [[1, 1], [2.76, 0.3]], attack: 0.002, decay: 0.5, gain: 0.03, pan });
        tone(ctx, out, t + 0.22, { freq: 1568, partials: [[1, 1], [2.76, 0.3]], attack: 0.002, decay: 0.6, gain: 0.03, pan });
        break;
      }
    }
    setTimeout(() => out.disconnect(), (t - ctx.currentTime + 4) * 1000);
  }
}

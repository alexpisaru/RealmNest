// Small Web Audio building blocks shared by the music, the ambience and the effects
// (docs/AUDIO.md). Everything RealmNest plays is synthesised here: no audio files.

/** a seeded random source (mulberry32), so the music can be tested */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MIDI note → Hz */
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** a slider's 0..1 as a gain that sounds even across its travel */
export const loudness = (v: number) => Math.max(0, Math.min(1, v)) ** 1.5;

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** a looping noise buffer: white, pink (softer highs) or brown (rumble) */
export function noise(ctx: BaseAudioContext, color: 'white' | 'pink' | 'brown'): AudioBuffer {
  let byCtx = buffers.get(ctx);
  if (!byCtx) buffers.set(ctx, (byCtx = new Map()));
  const hit = byCtx.get(color);
  if (hit) return hit;
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(17 + ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
    // the loop's seam: fade the first and last 50 ms into each other
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[len - f + i] * (1 - k);
    }
  }
  byCtx.set(color, buf);
  return buf;
}

/** a reverb tail: stereo noise decaying over `seconds` */
export function impulse(ctx: BaseAudioContext, seconds: number, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(101 + ch);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

/** a looping noise source started now */
export function noiseSource(ctx: BaseAudioContext, color: 'white' | 'pink' | 'brown', offset = 0): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx, color);
  s.loop = true;
  s.start(ctx.currentTime, offset % 4);
  return s;
}

/** one note: oscillators summed into an envelope, then into `out`; returns its end time */
export function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  o: { freq: number; type?: OscillatorType; partials?: [number, number][]; attack?: number; decay: number; gain: number; glideTo?: number; glideTime?: number; pan?: number; filter?: number },
): number {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack ?? 0.005) + o.decay);
  let node: AudioNode = env;
  if (o.filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.filter;
    env.connect(lp);
    node = lp;
  }
  if (o.pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan;
    node.connect(p);
    node = p;
  }
  node.connect(out);
  const end = t + (o.attack ?? 0.005) + o.decay + 0.05;
  for (const [mult, g] of o.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq * mult, t);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo * mult, t + (o.glideTime ?? o.decay));
    const pg = ctx.createGain();
    pg.gain.value = g;
    osc.connect(pg).connect(env);
    osc.start(t);
    osc.stop(end);
  }
  return end;
}

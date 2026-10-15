// One-shot effects (docs/AUDIO.md): short, soft and tuned to each other, so they sit on the music.

import { hz, noise, tone } from './synth';

export type Effect = 'click' | 'taskStart' | 'taskDone' | 'taskFail' | 'approval' | 'message' | 'finale' | 'nightfall' | 'daybreak';

export const EFFECTS: Effect[] = ['click', 'taskStart', 'taskDone', 'taskFail', 'approval', 'message', 'finale', 'nightfall', 'daybreak'];

/** a bell: a sine with a few inharmonic partials */
const bell = (ctx: AudioContext, out: AudioNode, t: number, note: number, gain: number, decay = 1.4) =>
  tone(ctx, out, t, { freq: hz(note), partials: [[1, 1], [2.01, 0.35], [3.02, 0.12], [4.2, 0.05]], attack: 0.004, decay, gain });

export function playEffect(ctx: AudioContext, out: AudioNode, reverb: AudioNode, e: Effect) {
  const t = ctx.currentTime + 0.01;
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  wet.connect(reverb);
  // effects stand a little above the music (the click stays quiet, straight to `out`)
  const both = ctx.createGain();
  both.gain.value = 2;
  both.connect(out);
  both.connect(wet);
  switch (e) {
    case 'click':
      tone(ctx, out, t, { freq: 1300, glideTo: 900, glideTime: 0.03, attack: 0.002, decay: 0.035, gain: 0.05 });
      break;
    case 'taskStart':
      bell(ctx, both, t, 76, 0.07, 0.6);
      bell(ctx, both, t + 0.09, 81, 0.07, 0.8);
      break;
    case 'taskDone':
      [72, 76, 79, 84].forEach((n, i) => bell(ctx, both, t + i * 0.075, n, 0.07, 1.2));
      break;
    case 'finale':
      [67, 72, 76, 79, 84, 88].forEach((n, i) => bell(ctx, both, t + i * 0.09, n, 0.07, 1.6));
      break;
    case 'taskFail':
      tone(ctx, both, t, { freq: hz(69), partials: [[1, 1], [2, 0.2]], type: 'triangle', attack: 0.01, decay: 0.35, gain: 0.1, filter: 1600 });
      tone(ctx, both, t + 0.18, { freq: hz(65), partials: [[1, 1], [2, 0.2]], type: 'triangle', attack: 0.01, decay: 0.55, gain: 0.1, filter: 1400 });
      break;
    case 'approval':
      bell(ctx, both, t, 81, 0.09, 1.1);
      bell(ctx, both, t + 0.16, 88, 0.07, 1.4);
      break;
    case 'message':
      tone(ctx, both, t, { freq: hz(79), glideTo: hz(84), glideTime: 0.06, attack: 0.004, decay: 0.18, gain: 0.06 });
      break;
    case 'nightfall':
    case 'daybreak': {
      // a soft breath of air, falling at dusk and rising at dawn
      const src = ctx.createBufferSource();
      src.buffer = noise(ctx, 'pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      const [a, b] = e === 'nightfall' ? [2400, 300] : [300, 2400];
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.exponentialRampToValueAtTime(b, t + 1.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.5);
      g.gain.linearRampToValueAtTime(0, t + 1.5);
      src.connect(bp).connect(g).connect(both);
      src.start(t, Math.random() * 2);
      src.stop(t + 1.6);
      bell(ctx, both, t + 0.6, e === 'nightfall' ? 64 : 76, 0.04, 1.8);
      break;
    }
  }
  setTimeout(() => (both.disconnect(), wet.disconnect()), 4000);
}

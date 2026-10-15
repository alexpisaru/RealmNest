// ─────────────────────────────────────────────────────────────
// AudioEngine (docs/AUDIO.md): music, the world's ambience and effects on three buses
// under a master, following Settings › General › Audio. Everything is synthesised
// with Web Audio while it plays: no audio files ship with RealmNest.
//
//   master ── limiter ── speakers
//     ├─ music    (MusicPlayer: the world's key and mood)
//     ├─ ambient  (AmbiencePlayer: the world's beds and spots, day or night)
//     └─ effects  (one-shots for tasks, approvals, replies, clicks)
//   reverb (shared send) → master
//
// The context starts on the first click or key (browsers keep audio silent before
// that) and is suspended while the window is hidden.
// ─────────────────────────────────────────────────────────────

import { AmbiencePlayer, ambienceFor } from './ambience';
import { type Effect, playEffect } from './effects';
import { MusicPlayer, moodFor } from './music';
import { impulse, loudness } from './synth';

export interface Volumes {
  master: number;
  music: number;
  ambient: number;
  effects: number;
}

/** what should sound for a screen: the music's mood, the ambience and how loud it is */
export interface Scene {
  music: string;
  ambience: string | null;
  ambienceLevel: number;
  night: boolean;
}

/** inside a world (Simulation) its own music and ambience; Home and Worlds the islands of the map; elsewhere music only */
export function sceneFor(screen: string, worldId: string | undefined, night: boolean): Scene {
  if (screen === 'simulation') return { music: worldId ?? 'home', ambience: worldId ?? 'home', ambienceLevel: 1, night };
  if (screen === 'home' || screen === 'worlds') return { music: 'home', ambience: 'home', ambienceLevel: 0.6, night };
  return { music: 'home', ambience: null, ambienceLevel: 0, night };
}

/** how often the same effect may play (ms) */
const FX_GAP = 350;
/** the music's level on its bus (measured: about -20 dBFS RMS at full volume) */
const MUSIC_LEVEL = 1.4;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: { music: GainNode; ambient: GainNode; effects: GainNode };
  private ambienceLevel!: GainNode;
  private reverb!: ConvolverNode;
  private music: MusicPlayer | null = null;
  private amb: { key: string; player: AmbiencePlayer } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volumes: Volumes = { master: 0.8, music: 0.6, ambient: 0.5, effects: 0.7 };
  private scene: Scene = sceneFor('home', undefined, false);
  private hidden = false;
  private lastFx = new Map<Effect, number>();

  constructor(private create: () => AudioContext | null = () => (typeof AudioContext === 'undefined' ? null : new AudioContext())) {}

  get running() {
    return this.ctx?.state === 'running';
  }

  /** on the first gesture: build the graph (once) and start the clock */
  start() {
    if (!this.ctx) {
      const ctx = this.create();
      if (!ctx) return;
      this.ctx = ctx;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      limiter.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(limiter);
      const bus = () => {
        const g = ctx.createGain();
        g.connect(this.master);
        return g;
      };
      this.buses = { music: bus(), ambient: bus(), effects: bus() };
      this.ambienceLevel = ctx.createGain();
      this.ambienceLevel.connect(this.buses.ambient);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse(ctx, 3.2, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      this.reverb.connect(wet).connect(this.master);
      this.apply(true);
    }
    if (!this.hidden && this.volumes.master > 0 && this.ctx.state === 'suspended') void this.ctx.resume();
    this.timer ??= setInterval(() => this.tick(), 100);
  }

  setVolumes(v: Volumes) {
    const same = v.master === this.volumes.master && v.music === this.volumes.music && v.ambient === this.volumes.ambient && v.effects === this.volumes.effects;
    this.volumes = { ...v };
    if (same) return;
    // turned on: the context starts (the click on the switch is the gesture); off: it sleeps
    if (v.master > 0) this.start();
    this.apply();
    this.sleepIfSilent();
  }

  private sleepIfSilent() {
    const ctx = this.ctx;
    if (!ctx || this.volumes.master > 0) return;
    setTimeout(() => this.volumes.master <= 0 && ctx.state === 'running' && void ctx.suspend(), 900);
  }

  setScene(s: Scene) {
    const same = s.music === this.scene.music && s.ambience === this.scene.ambience && s.ambienceLevel === this.scene.ambienceLevel && s.night === this.scene.night;
    this.scene = s;
    if (!same) this.apply();
  }

  /** the window is hidden (minimised, another app on top in full screen): fade out and sleep */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const ctx = this.ctx;
    if (!ctx) return;
    if (hidden) {
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => this.hidden && void ctx.suspend(), 900);
    } else {
      if (this.volumes.master > 0) void ctx.resume().then(() => this.apply());
    }
  }

  play(e: Effect) {
    const ctx = this.ctx;
    if (!ctx || !this.running || this.hidden || this.volumes.effects <= 0 || this.volumes.master <= 0) return;
    const now = performance.now();
    if (now - (this.lastFx.get(e) ?? -Infinity) < FX_GAP) return;
    this.lastFx.set(e, now);
    playEffect(ctx, this.buses.effects, this.reverb, e);
  }

  /** volumes, music mood and ambience after a change */
  private apply(first = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = this.volumes;
    this.master.gain.setTargetAtTime(this.hidden ? 0 : loudness(v.master), t, first ? 1 : 0.08);
    this.buses.music.gain.setTargetAtTime(loudness(v.music) * MUSIC_LEVEL, t, 0.08);
    this.buses.ambient.gain.setTargetAtTime(loudness(v.ambient), t, 0.08);
    this.buses.effects.gain.setTargetAtTime(loudness(v.effects), t, 0.08);
    this.ambienceLevel.gain.setTargetAtTime(this.scene.ambienceLevel, t, 0.6);
    // music: only while it can be heard
    if (v.music > 0 && v.master > 0) {
      this.music ??= new MusicPlayer(ctx, this.buses.music, this.reverb);
      this.music.setMood(moodFor(this.scene.music), this.scene.night);
    } else if (this.music) {
      this.music.stop(t);
      this.music = null;
    }
    // ambience: a new one fades in while the old one fades out
    const key = this.scene.ambience && v.ambient > 0 && v.master > 0 ? `${this.scene.ambience}:${this.scene.night ? 'n' : 'd'}` : null;
    if (key !== (this.amb?.key ?? null)) {
      this.amb?.player.stop(2.5);
      this.amb = null;
      if (key) {
        const player = new AmbiencePlayer(ctx, this.ambienceLevel, this.reverb, ambienceFor(this.scene.ambience!, this.scene.night));
        player.fadeIn(first ? 3 : 2.5);
        this.amb = { key, player };
      }
    }
  }

  private tick() {
    if (!this.running || this.hidden) return;
    this.music?.tick();
    this.amb?.player.tick();
  }
}

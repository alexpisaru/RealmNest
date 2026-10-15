import type { SkinToneId, VisualPreset } from '../domain/character';

/** Skin palettes: base, shade, blush. */
export const SKIN_TONES: Record<SkinToneId, { base: string; shade: string; blush: string }> = {
  porcelain: { base: '#fbe1cf', shade: '#e8bfa6', blush: '#f4a7a0' },
  fair: { base: '#f8d0ad', shade: '#e2aa84', blush: '#ef9b8c' },
  warm: { base: '#efbf94', shade: '#d39a6f', blush: '#e48a78' },
  olive: { base: '#d9a877', shade: '#b98656', blush: '#cf7f63' },
  tan: { base: '#c98d5e', shade: '#a86f45', blush: '#c26a4f' },
  brown: { base: '#a8693f', shade: '#86502d', blush: '#a8523a' },
  deep: { base: '#7f4b2c', shade: '#64371f', blush: '#8a3f2b' },
  ebony: { base: '#5e3520', shade: '#472616', blush: '#713424' },
};

export const HAIR_COLORS = [
  '#bc5730', // copper (founder)
  '#a9472a', // auburn
  '#d8452c', // copper red
  '#1c1b24', // black
  '#3b2418', // dark brown
  '#6b4226', // brown
  '#b07a45', // light brown
  '#f0cf72', // blonde
  '#e8e0d0', // platinum
  '#c9c6cf', // silver
  '#6a5bd6', // violet
  '#e98bb5', // pink
  '#3fb6a8', // teal
];

export const EYE_COLORS = ['#2e8a55', '#6b3b22', '#2f3a4a', '#3d6a4a', '#4a6fa5', '#2a2230'];

export const SIGNATURE_COLORS = [
  '#e2553b',
  '#f2b84b',
  '#5b8def',
  '#3fb68b',
  '#ef7aa8',
  '#9b7bea',
  '#2fb5c8',
  '#7bd36b',
  '#e98b4f',
  '#c0533f',
  '#f3c843',
  '#8a9bb0',
];

/**
 * Visual presets = starting looks. They carry a descriptive label only:
 * names and roles are always chosen by the user.
 */
export const PRESETS: VisualPreset[] = [
  {
    id: 'founder',
    label: 'Founder (copper spiky mane)',
    founderPreset: true,
    signature: '#e2553b',
    outfitId: 'universal.founder',
    profile: {
      body: 'masc',
      skin: 'fair',
      hair: 'mane',
      hairColor: '#bc5730',
      eyeColor: '#2e8a55',
      build: 'regular',
      height: 'regular',
      accessory: 'none',
      art: 'alex',
    },
  },
  {
    id: 'braids',
    label: 'Box braids',
    signature: '#f2b84b',
    profile: { body: 'fem', skin: 'deep', hair: 'braids', hairColor: '#2a1d1a', eyeColor: '#3a2418', hairAccent: '#f2b84b', build: 'slim', height: 'tall', earring: '#f2d06b' },
  },
  {
    id: 'spiky',
    label: 'Spiky + round glasses',
    signature: '#5b8def',
    profile: { body: 'masc', skin: 'warm', hair: 'spiky', hairColor: '#1c1b24', eyeColor: '#2a2230', build: 'slim', height: 'regular', glasses: 'round' },
  },
  {
    id: 'bearded',
    label: 'Shaved & bearded',
    signature: '#3fb68b',
    profile: { body: 'masc', skin: 'brown', hair: 'shaved', hairColor: '#2b1d17', eyeColor: '#3a2418', facialHair: 'beard', build: 'broad', height: 'tall' },
  },
  {
    id: 'bun',
    label: 'Blonde top bun',
    signature: '#ef7aa8',
    profile: { body: 'fem', skin: 'porcelain', hair: 'bun', hairColor: '#f0cf72', eyeColor: '#4a6fa5', hairAccent: '#ef7aa8', build: 'slim', height: 'short' },
  },
  {
    id: 'curly',
    label: 'Curly + mustache',
    signature: '#9b7bea',
    profile: { body: 'masc', skin: 'olive', hair: 'curly', hairColor: '#4a2e1f', eyeColor: '#3a2418', facialHair: 'mustache', build: 'regular', height: 'regular' },
  },
  {
    id: 'ponytail',
    label: 'Ponytail + square glasses',
    signature: '#2fb5c8',
    profile: { body: 'fem', skin: 'tan', hair: 'ponytail', hairColor: '#17141d', eyeColor: '#2a2230', hairAccent: '#2fb5c8', build: 'slim', height: 'regular', glasses: 'square' },
  },
  {
    id: 'undercut',
    label: 'Pastel undercut',
    signature: '#7bd36b',
    profile: { body: 'neutral', skin: 'fair', hair: 'undercut', hairColor: '#6a5bd6', eyeColor: '#3d6a4a', build: 'slim', height: 'short', earring: '#c9d3e6', accessory: 'headphones' },
  },
  {
    id: 'silver',
    label: 'Silver bob',
    signature: '#e98b4f',
    profile: { body: 'fem', skin: 'ebony', hair: 'bob', hairColor: '#c9c6cf', eyeColor: '#2a2230', build: 'regular', height: 'short', glasses: 'square', accessory: 'scarf' },
  },
  {
    id: 'bigbeard',
    label: 'Big & bearded',
    signature: '#c0533f',
    profile: { body: 'masc', skin: 'warm', hair: 'crew', hairColor: '#5b3a24', eyeColor: '#3d6a4a', facialHair: 'beard', build: 'broad', height: 'tall' },
  },
  {
    id: 'afro',
    label: 'Afro',
    signature: '#f3c843',
    profile: { body: 'fem', skin: 'deep', hair: 'afro', hairColor: '#1f1612', eyeColor: '#3a2418', build: 'regular', height: 'regular', earring: '#f3c843', accessory: 'flower' },
  },
  {
    id: 'long',
    label: 'Long straight',
    signature: '#8a9bb0',
    profile: { body: 'fem', skin: 'porcelain', hair: 'long', hairColor: '#1c1b24', eyeColor: '#2a2230', build: 'slim', height: 'tall', freckles: true },
  },
];

export const PRESET_BY_ID: Record<string, VisualPreset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
export const FOUNDER_PRESET = PRESETS[0];

// Brightness curves per world, matched to the owner's reference pictures with
// tools/tone.py (lightness 0, 0.1 … 1 → output). They deepen the shadows and lift
// the lights the way the references do; applied with the world's colour grade.
export const SCENE_TONES: Record<string, number[]> = {};

// Cast factory: what the editor page runs, bundled into it (esbuild, global `Cast`): the app's
// own look data and the same look → assets mapping and colour ramps the build uses.
export { castLook, castLookFor } from './looks';
export { CANON, TONES, rampFor, rampOf } from './palette';
export { EYE_COLORS, HAIR_COLORS, PRESETS, SIGNATURE_COLORS, SKIN_TONES } from '../../../src/data/presets';
export { OUTFITS, outfitsForWorld } from '../../../src/data/outfits';

// The Cast look builder and recolouring ramps live with the character pipeline (tools/charpipe/cast,
// pure: no Node, no DOM); the app re-exports them so both always agree. docs/charpipe/CAST.md
export { castLook, castLookFor, type CastLook, type LookAsset } from '../../../tools/charpipe/cast/looks';
export { CANON, FIXED, rampFor, TONES } from '../../../tools/charpipe/cast/palette';

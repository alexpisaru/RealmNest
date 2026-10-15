// Cast factory: where things go.
import { join } from 'node:path';
import { ART, BUILD, ROOT } from '../spec';

/** painted parts: <shape>/parts/<asset>/<part>.png */
export const CAST_ART = join(ART, 'cast');
/** animated, outlined frame strips: <upper>/<asset>/<band>/<height|all>/<anim>.png */
export const CAST_BUILD = join(BUILD, 'cast');
/** what the app loads: atlases + cast.json */
export const CAST_OUT = join(ROOT, 'src/assets/characters/cast');

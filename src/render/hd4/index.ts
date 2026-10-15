// 128×64 Farm art set (2× fidelity). Same prop ids as the base set; the
// renderer picks these when a world runs at tile 128.
import type { PropArt } from '../props';
import { BUILDINGS4 } from './buildings4';
import { CROPS } from './crops';
import { DECALS } from './decals';
import { STRUCTURES } from './fences';
import { PLANTS } from './plants';
import { PROPS4 } from './props4';
import { TREES } from './trees';
import { WATER4 } from './water4';

export const HD4_ART: Record<string, PropArt> = { ...TREES, ...PLANTS, ...STRUCTURES, ...DECALS, ...CROPS, ...PROPS4, ...BUILDINGS4, ...WATER4 };

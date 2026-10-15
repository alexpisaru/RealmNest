// HD art set for the Farm vertical slice (64×32 tiles). Same prop ids as the
// base set; the renderer picks these when a world runs at tile 64.
import type { PropArt } from '../props';
import { FARM_BUILDINGS } from './farmBuildings';
import { FARM_NATURE } from './farmNature';
import { FARM_SMALL } from './farmSmall';

export const HD_ART: Record<string, PropArt> = { ...FARM_BUILDINGS, ...FARM_NATURE, ...FARM_SMALL };

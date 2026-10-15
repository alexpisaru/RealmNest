// Cast factory: every asset, from the family files in cast/assets/.
import type { AssetDef } from './catalog';
import { GARMENTS } from './assets/garments';
import { HAIR } from './assets/hair';
import { HEADWEAR } from './assets/headwear';

export const ALL_ASSETS: AssetDef[] = [...GARMENTS, ...HAIR, ...HEADWEAR];
export const assetById = (id: string) => ALL_ASSETS.find((a) => a.id === id);

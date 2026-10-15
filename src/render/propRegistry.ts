// Single lookup for every prop drawer (keeps the art modules free of import cycles).
import { PROP_ART, type PropArt } from './props';
import { CITY_ART } from './propsCity';
import { FARM_ART } from './propsFarm';

export const ART: Record<string, PropArt> = { ...PROP_ART, ...FARM_ART, ...CITY_ART, cropRow: PROP_ART.crops };

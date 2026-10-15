// Office pack: a design studio on the ground floor of a palazzo, on a piazza.
import type { WorldPack } from '../types';
import { OFFICE_FLOORS, officePatch } from './ground';
import { OFFICE_PALAZZI } from './palazzi';
import { OFFICE_PIAZZA } from './piazza';
import { OFFICE_ROOM } from './room';
import { OFFICE_WALLS } from './walls';
import { CITY_BLOCKS } from './city_blocks';
import { CITY_PLAZA } from './city_plaza';
import { CITY_TOWERS } from './city_towers';

export const OFFICE: WorldPack = {
  props: { ...OFFICE_ROOM, ...OFFICE_PALAZZI, ...OFFICE_PIAZZA, ...CITY_BLOCKS, ...CITY_TOWERS, ...CITY_PLAZA },
  floors: OFFICE_FLOORS,
  crisp: ['wood', 'sidewalk', 'paving', 'asphalt'],
  walls: OFFICE_WALLS,
  patch: officePatch,
};

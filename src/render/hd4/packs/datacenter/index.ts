// Data Center pack (128×64): a data hall on a snowy northern shore by a fjord.
//
// Palette sampled from the owner's reference (docs/worlds-bake/ritocchi/datacenter.webp),
// the ramps in palette.ts and ground.ts are built on these codes:
//   snow        #f0f7fd #e3ebf8 #ccd9eb #b6c6d9 #9ab7d6 · blue shadow #51708f #707e8c
//   spruce      #031317 #0a1d1f #0c2626 #1b3635 #2b4c47 (deep green, almost black in the shade)
//   fjord       #0a2941 #0f324b #132d3e #213d4c · floes #bfd9f2 #97bddd #8fb5d6 #638bac
//   pond ice    #cfe1f8 #b9cfeb #86abce #507597
//   rock        #242d39 #464d5a #788292 · birch crowns #827664 #a48b69
//   road        #363a3a #46474d #5b595c #6b6f71 · slush #bcb8b4 #dfe3ea
//   hall        cladding #1c232c #26303a #2e333c #3a4249 #4a545b · roof #e4eff8 · coolers #a8b0bd #6e7783
//   wing        charred timber #1e150f #342316 #483829 · windows #ebbe64 #f7d37d #fcf0a9
//   cabins      falu red #440d08 #561e14 #6c2317 #873a25 · container #7b231a
//   gensets     #434f42 #4e584b #5f6959 #6f7b6c · plough orange #cc5e1a / yellow #e8b330
//   room floor  #b7bac4 #bfc2cc lit #d1d4db shaded #6e7581 #808691 · warm pools #c2b7a6 #e6e0d5
//   room walls  #ced2d6 #eaf0f3 · racks #090f18 #161b23 · rack tops #3e7198 #557fa9 / #e8b330
// room.ts      the hall's furniture, its extras and the cut front walls
// walls.ts     the back walls and their wall props
// ground.ts    floors, snow, ice, water, roads, and the floor patches
// hall.ts      the data hall's main block and the admin wing
// site.ts      generator yard, substation, fences, gate, street furniture, vehicles
// nature.ts    spruces, pines, birches, shrubs, rocks, crags, drifts, the turbine ridge
// shore.ts     cabins, sauna, jetty, boat, woodpile, ground decals
// vehicles.ts  cars, the gritter-plough (parked and on the road), snowmobile, the moored boat
// critters.ts  arctic foxes, reindeer, ravens
import type { WorldPack } from '../types';
import { DC_CRITTERS } from './critters';
import { DC_CRISP, DC_FLOORS, dcPatch } from './ground';
import { DC_HALL } from './hall';
import { DC_NATURE } from './nature';
import { DC_ROOM } from './room';
import { DC_SHORE } from './shore';
import { DC_SITE } from './site';
import { DC_VEHICLES } from './vehicles';
import { DC_WALLS } from './walls';

export const DATACENTER: WorldPack = {
  props: { ...DC_ROOM, ...DC_HALL, ...DC_SITE, ...DC_VEHICLES, ...DC_NATURE, ...DC_SHORE },
  floors: DC_FLOORS,
  crisp: DC_CRISP,
  walls: DC_WALLS,
  patch: dcPatch,
  critters: DC_CRITTERS,
  reuse: {
    dc_spruce: 8,
    dc_pine: 6,
    dc_birch: 6,
    dc_shrub: 6,
    dc_mound: 6,
    dc_rock: 6,
    dc_snowbank: 4,
    dc_reeds: 4,
    dc_lamp: 2,
    dc_bollard: 2,
    dc_fence: 3,
  },
  // the floor shaders shade their own soft cloud shadows (see own() in ground.ts)
  groundFx: { clouds: false, bank: false },
};

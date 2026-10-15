// Palette measured on the owner's retouch (docs/worlds-bake/ritocchi/research.webp):
//   sky        #3778c9 overhead → #7db5ea over the peaks; cumulus #ffffff / #dde8f5 / #b2c8e6
//   peaks      lit snow #fafcfe #eef4fa, shaded snow #8faad0 #a3bcdc, rock #566278 #6282ac, fog #c6d5e8 #eef6fb
//   meadow     #233412 #4c5f28 #5f7630 #707e36 #7a8e3c #93a64c, flowers #d84a5c #e27aa2 #b27ada #f2d240
//   spruce     #132210 #283f1e #486a32 #7e9e4c, boulders #535355 #727273 #898685 #b0adaa
//   cobbles    #877a65 #9b9081 #a4998b #b0a594; slate roof #373135 #454955 #555964 #70737c
//   lodge      larch logs #502b13 #764926 #985a26 #b3743a, shutters #2e5a24, geraniums #d02a26
//   frozen lake water #347093 #3e7899 #4481a2 #6fa1ba, ice #d7e5f2 #eff6fd, thin ice #7a9599 #90abad
//   room       honey floor #7c471f #90592b #a0632e #b37a46, night frieze #121d36, star rug #3a2d5e #272147,
//              purple sofa #7b5398 #562d68, braided rug #87452c #cda177, green tables #4d573b
// Research Hub pack (128×64): an observatory library on a mountain summit.
//   room.ts         the library's furniture and the lodge's facade cut low
//   library.ts      plan chest, telescope, orrery, trolley, tiled stove, archive boxes
//   walls.ts        the panelled back walls with the star frieze, wall props
//   ground.ts       floors, the summit's ground, the far peaks and the valley below
//   observatory.ts  domes, the radio dish, the weather station, solar rack, hut
//   lodge.ts        the lodge, the chapel, the cable car, the summit cross
//   meadow.ts       stone steps, rock outcrops, the pond's waterfall, flower drifts, alpenrose, hummocks
//   nature.ts       larches, arolla pines, boulders, wildflowers, shrubs, cairns
//   outside.ts      walls, poles, signs, benches, the viewpoint, the jeep, decals
//   critters.ts     marmots, ibex, a golden eagle, choughs
import type { WorldPack } from '../types';
import { RESEARCH_CRITTERS } from './critters';
import { RESEARCH_FLOORS, researchPatch } from './ground';
import { RESEARCH_LIBRARY } from './library';
import { RESEARCH_LODGE } from './lodge';
import { RESEARCH_MEADOW } from './meadow';
import { RESEARCH_NATURE } from './nature';
import { RESEARCH_OBSERVATORY } from './observatory';
import { RESEARCH_OUTSIDE } from './outside';
import { RESEARCH_ROOM } from './room';
import { RESEARCH_WALLS } from './walls';

export const RESEARCH: WorldPack = {
  props: { ...RESEARCH_ROOM, ...RESEARCH_LIBRARY, ...RESEARCH_OBSERVATORY, ...RESEARCH_LODGE, ...RESEARCH_NATURE, ...RESEARCH_MEADOW, ...RESEARCH_OUTSIDE },
  floors: RESEARCH_FLOORS,
  crisp: ['planks', 'roof', 'paving'],
  walls: RESEARCH_WALLS,
  patch: researchPatch,
  critters: RESEARCH_CRITTERS,
  groundFx: { clouds: false },
  reuse: {
    res_spruce: 8,
    res_planter: 3,
    res_larch: 6,
    res_pine: 6,
    res_snag: 3,
    res_boulder: 4,
    res_flowers: 4,
    res_grass: 6,
    res_shrub: 6,
    res_cairn: 4,
    res_snowpole: 4,
    res_railing: 3,
    res_drywall: 4,
    res_bloom: 8,
    res_rhodo: 6,
    res_hummock: 6,
    res_outcrop: 5,
  },
};

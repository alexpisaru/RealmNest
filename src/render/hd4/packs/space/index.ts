// Space pack: a command module on the hull of an orbital station, over a planet.
//
// Palette sampled from the owner's reference (docs/worlds-bake/ritocchi/space.webp):
//   void        #00020b #02040f #040817 #070b1e #0c1029
//   Milky Way   violet #170c3e #1f1347 #2d1d5e #3f2c76 #4e3a89 #6c59aa · blue #0f1a61 #1d2f75 #2d3d8f #425bb7
//   stars       #ffffff #b4bee6 #9ab8ff #6a6e89
//   sun flare   #fef7d0 #f8ca6f #e4a24e #b67a3b
//   ocean       #031e46 #042550 #012e5f #013970 #0b437b #0d578f #1e6aa6
//   land        #183925 #20452c #2f4730 #365437 #4a6844 · dry #5c4229 #796d51 #977e5f #aa936f
//   clouds      #9aaccc #b6c2d8 #cdd7e7 #dfe8f4 #eff3f9 #fafcfd
//   atmosphere  #064b96 #0e7ad2 #1e9aec #46b4f7 #89e3fb
//   night/city  #020a1c #030f26 · #f1bd3c #e59733 #fef7d0
//   hull deck   #1a1d27 #353c4e #454d66 #565f74 #68708a #7f8494 #959aaa #b0b4bf
//   solar cells #07195b #0e236d #122b7c #1f398b #293f8f #324a9c #475fb0 (frames #e59733 #f1bd3c)
//   lights      amber #e59733 #f1bd3c #fbd262 #fef7d0 · red #a70b1f #cc292d · cyan #61cfda #387c8d
//   room floor  #1a2440 (grid) #33426a #3f4f78 #4a5a84 #53658e #6274a0 · dots #cde1ea #61cfda
//   room walls  #3a4250 #4c5664 #5e6878 #727d8e #8a94a4 · pads #424c5a #566475 #676c7e #a6aab6
//   lounge      mat #a0562c · sofa #6a68c8 · crates white #e9edf2 / yellow #e3b755 #eec65e
import type { WorldPack } from '../types';
import { SPACE_CRITTERS } from './critters';
import { SPACE_DECK } from './deck';
import { SPACE_FLOORS, spacePatch } from './ground';
import { SPACE_ROOM } from './room';
import { SPACE_SPINE } from './spine';
import { SPACE_STATION } from './station';
import { SPACE_WALLS } from './walls';

export const SPACE: WorldPack = {
  props: { ...SPACE_ROOM, ...SPACE_STATION, ...SPACE_DECK, ...SPACE_SPINE },
  floors: SPACE_FLOORS,
  crisp: ['metal', 'grate', 'hull', 'deck', 'raised', 'roof', 'hazard', 'space'],
  walls: SPACE_WALLS,
  patch: spacePatch,
  critters: SPACE_CRITTERS,
  reuse: { spc_solar: 1, spc_edge: 1, spc_truss: 1, spc_box: 6, spc_beacon: 4, spc_vent: 3, spc_rail: 4, spc_mast: 2, spc_tank: 2, spc_antenna: 3, spc_rack: 6, spc_cabinet: 6 },
  // no weather in orbit
  groundFx: { clouds: false },
};

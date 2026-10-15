// Creative Studio pack: a converted boathouse studio on the boardwalk of a
// seaside arts district (beach houses with murals, a pier, a surf shop, a
// food truck, palms, dunes, the beach and the sea).
//
// Palette measured on the owner's improved picture (docs/worlds-bake/ritocchi/studio.webp):
//   sand      #f7d49a #fbdea7 #eec98e #ddb884 #cda674 (light #fde9c7)
//   sea       turquoise #79dde1 #51cfdc #2bbdd1 · blue #0fa6c4 #078cb4 #0773a5 · deep #045c92 #094970
//   foam      #ffffff #f0fafa #bae9ee
//   roofs     red #973227 #b44943 · coral #f08068 #e4664a · green #1c6057 · turquoise #58b4ac
//             ochre #fabf5e #f3ba4f · blue #6d98d1 · grey #9d9da0 #888b88
//   walls     yellow #f8d564 · teal #56a9a1 #77c6c1 · pink #f291b6 #c15984 · lilac #b5abe1 #6d5aa2
//             blue #6d98d1 · coral #e4664a · white #f4ece3
//   foliage   palms #5d742d #455e15 #2a430d #7a8934 #b0b85f · shrubs #4a9836 · bougainvillea #e0408a #c15984 #f291b6
//   timber    boardwalk #986d3e #ab8053 #bc9263 #755028 · pier #b3967b #927052 · lamps navy #1e2c4a
//   room      floor #c88437 #dc964f #e59e61 (joints #755028) · walls cream #f8e6c6 #fdf0d8
//             dado coral #e4664a #f08068 · front walls teal #1e8a90 #2aa4a6
//             rainbow rug #ec4b39 #f59a3a #f7d760 #5cb87a #3a8ad8 #8a5ac8 · pink rug #ef7aa8
import type { WorldPack } from '../types';
import { STUDIO_BEACH } from './beach';
import { STUDIO_BOARDWALK } from './boardwalk';
import { STUDIO_CRITTERS } from './critters';
import { STUDIO_FACADE } from './facade';
import { STUDIO_EXTRAS } from './extras';
import { STUDIO_GARDEN } from './garden';
import { STUDIO_GEAR } from './gear';
import { STUDIO_FLOORS, studioPatch } from './ground';
import { STUDIO_HOUSES } from './houses';
import { STUDIO_LOUNGE } from './lounge';
import { STUDIO_VEHICLES } from './vehicles';
import { STUDIO_WALLS } from './walls';

export const STUDIO: WorldPack = {
  props: { ...STUDIO_GEAR, ...STUDIO_LOUNGE, ...STUDIO_FACADE, ...STUDIO_HOUSES, ...STUDIO_BEACH, ...STUDIO_BOARDWALK, ...STUDIO_GARDEN, ...STUDIO_EXTRAS, ...STUDIO_VEHICLES },
  floors: STUDIO_FLOORS,
  crisp: ['planks', 'deck'],
  groundFx: { bank: false },
  walls: STUDIO_WALLS,
  patch: studioPatch,
  critters: STUDIO_CRITTERS,
  reuse: {
    std_palm: 8,
    std_marram: 8,
    std_bush: 6,
    std_deckchair: 6,
    std_umbrella: 6,
    std_dune: 3,
    std_lamp: 2,
    std_festoon: 3,
    std_buoy: 2,
    std_sandFence: 4,
    std_ropeFence: 3,
    std_bench: 4,
    std_castle: 2,
    std_picket: 3,
    std_laundry: 3,
    std_shower: 2,
    std_tree: 6,
    std_windbreak: 4,
    std_bin: 2,
    std_aboard: 3,
  },
};

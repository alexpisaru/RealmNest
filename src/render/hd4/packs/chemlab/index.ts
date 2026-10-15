// Chemical Lab pack (128×64): a wet lab on the ground floor of a research
// building on a green science-park campus in a pine and birch forest.
//   room / room2  the lab's furniture, safety kit, clean-zone corner, cut façade
//   walls         back walls and wall props (incl. the decorateWalls kinds)
//   ground        floors (lab tiles, hazard striping, campus ground) and patches
//   campus        the research buildings (wildflower roofs, green walls, the logo) and the distant blocks
//   nature        birches, Scots pines, round-crowned trees, flower beds, shrubs, the reed pond, the boardwalk
//   site          street furniture, pergolas, bikes, EV carports and cars, the shuttle, the hazmat yard, decals
//   vehicles      the cars, the supplier's box van, bicycles and the moving shuttle, modelled as solids
//   critters      heron, rabbits, dragonflies
//
// Palette sampled from the owner's retouched picture (docs/worlds-bake/ritocchi/chemlab.webp):
//   lab floor     #eaeff1 #eff3f5 #f5f9fa, grout #cdd0d3 · lane teal #24a291 #45b1a4 #84d1c8, chevrons #f4faf8
//   lab walls     #f1f8f3 #cddbd5 · teal band #6ca69e · resin worktops #1d2026 #25252b
//   lawn          #2a4a14 #365c1c #456e22 #56822a #68942e #7aa63a #90b848 · forest floor #1a4022 … #4e823a
//   birch crowns  #244113 #466f1b #557d24 #68922c #7ea93a #a3ca5a · bark #424c31 #959686 #d7d2cf #f1ede6
//   pine          #082b23 #164432 #285a37 #2d6a40 #3f7c3e #5a9040 · trunks #713620 #8a4a28 #a8622f #dc9552
//   pond          #0d4453 #10505f #165b6a #1c6874 #2a7a82 · lily pads #669456 #89b450
//   paving        #e0d2c3 #e4d5c7 #ebddcf #f2e6da · cycle path #874d49 #905251 #9e5e58, dashes #e4dcd4
//   asphalt       #22252c #2a2e36 #32363f · hazmat slab #a8a5a3 #b6b2b0 #c2c1c2
//   buildings     white #e7ebe6 #f2f5f0 #c4cac5 · glass #356778 #508897 · lit windows #efc765 #f4d888
//   timber        #855222 #a8743c #c88e52 #d8a56e #e8c486 · roof membrane #d4d6d8 #bbbcbc
//   green roofs   #3e5612 #526813 #69841b #798c2b #849c30 · blooms #f4f6e4 #f2d24a #b07ad8 #e88ab0
//   solar panels  roof #1e387a #263f80 #3d548f · canopies #193781 #1e3f89 #294996 #7289c0
//   chargers      #0f1a20 #2c4945 · screens #3dd656 #a7e2ab · logo navy #1d4f7a, banners #1d3550
import type { WorldPack } from '../types';
import { CHEMLAB_CAMPUS } from './campus';
import { CHEMLAB_CRITTERS } from './critters';
import { CHEMLAB_FLOORS, chemlabPatch } from './ground';
import { CHEMLAB_NATURE } from './nature';
import { CHEMLAB_ROOM } from './room';
import { CHEMLAB_ROOM2 } from './room2';
import { CHEMLAB_SITE } from './site';
import { CHEMLAB_VEHICLES } from './vehicles';
import { CHEMLAB_WALLS } from './walls';

export const CHEMLAB: WorldPack = {
  props: { ...CHEMLAB_ROOM, ...CHEMLAB_ROOM2, ...CHEMLAB_CAMPUS, ...CHEMLAB_NATURE, ...CHEMLAB_SITE, ...CHEMLAB_VEHICLES },
  floors: CHEMLAB_FLOORS,
  crisp: ['lab', 'hazard', 'paving', 'sidewalk', 'cobble', 'asphalt', 'concrete'],
  walls: CHEMLAB_WALLS,
  patch: chemlabPatch,
  critters: CHEMLAB_CRITTERS,
  reuse: {
    lab_birch: 10,
    lab_pine: 8,
    lab_tree: 6,
    lab_flowerbed: 8,
    lab_shrub: 6,
    lab_reeds: 6,
    lab_lily: 6,
    lab_rock: 4,
    lab_meadow: 6,
    lab_lamp: 2,
    lab_bin: 2,
    lab_bench: 4,
    lab_banner: 2,
    lab_ibc: 2,
  },
};

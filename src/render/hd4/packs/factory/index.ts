// Factory pack: the Albion Works press shop, in a red-brick mill estate on a canal.
//   room.ts       the press shop's machines and furniture, the cut front walls
//   walls.ts      the back walls (whitewashed brick, stanchions, lattice girder) and wall props
//   ground.ts     the slab, the yards, cobbles, ballast, waste ground, the canal; the painted lane
//   buildings.ts  the weaving shed, the mill, boiler house, chimney, water tower, neighbours
//   estate.ts     the estate's blocks to the frame's edge
//   canal.ts      quays, crane, bollards, waste-ground plants, fence
//   barge.ts      the coal boat (bow first both ways) and the raised footbridge it passes under
//   stock.ts      containers, pipe stacks, bulk bags, the sycamores, patches of yard clutter
//   yard.ts       track, pallets, gas cage, skip, scrap, lamps, gatehouse, stores, clutter
//   vehicles.ts   lorries, the works van, cars, the forklift (true scale)
//   rolling.ts    bogie wagons on the siding and the top-and-tailed trip working on the spur
//   decals.ts     flat details baked into the ground
//   critters.ts   gulls over the canal, a rat by the skip
//
// Palette, sampled from the owner's retouched picture (docs/worlds-bake/ritocchi/factory.webp):
//   brick        lit #bf704e #c97d5a #d28967 · shade #864832 #653523 · mortar #b8a68e
//   slate roofs  #2a2c38 #323540 #3e3c46 #454752 #535762 · tar roofs #4f4e51 #58575a #626164
//   corrugated   #7c7c82 #8c8b90 #9e9da2 · north-light glass #4b585f #65737c #798b8e #9dafb2
//   lit windows  #f4c858 #ffe6a0 #c8923a · stone sills and coping #a08c77 #b39f8a #cebda8
//   room floor   #9f9682 #a69a8b #ad9d8b #b1a391 #c4b59c · room walls #d6cbb1 #e9ddc5 #f3e9ce
//   green dado   #22412f #2b5039 #356046 · safety yellow #e4ae22 #f4c834 · hazard black #2a2622
//   canal water  #142721 #1c3027 #213730 #2c4238 · glints #b8c8b0 #7a9a88
//   wharf setts  #6d6154 #7b6c5b #8d8070 #a79887 · yard asphalt #444140 #4f4c4c #5a5758 #666262
//   grass        #4a5226 #58622c #667232 #76823a · leaves #3c5618 #64882a #80a236 #a2bc52 #b3bc72
//   gasholder    #3a5642 #46684e #55785c #7f9a7e #93ab8e · water tank #46696f #557b80 #85aaae
//   liveries     Hilson blue #2f5eaa · red #c43028 · containers #46784e #a84332 #4a74a0
//   second pass  estate slate #1e2029 #30333f #4a4e5c #737a8a #8e95a4 · setts #2e2a28 #6a645c #918879 #cbc0aa
//                towpath flags #5e5850 #8a8174 #b2a898 · water glints #7a9a88 #a8b8a8 #d8e0d0
//                contact shadow #120c16 (alpha .42–.5) · lit stone #ddd0b6 · world tone curve in factory.ts
import type { WorldPack } from '../types';
import { FACTORY_BUILDINGS } from './buildings';
import { FACTORY_CANAL } from './canal';
import { FACTORY_CRITTERS } from './critters';
import { FACTORY_DECALS } from './decals';
import { ESTATE_VARIANTS, FACTORY_ESTATE } from './estate';
import { FACTORY_FLOORS, factoryPatch } from './ground';
import { FACTORY_ROOM } from './room';
import { FACTORY_STOCK } from './stock';
import { FACTORY_WALLS } from './walls';
import { FACTORY_VEHICLES } from './vehicles';
import { FACTORY_YARD } from './yard';

export const FACTORY: WorldPack = {
  props: { ...FACTORY_ROOM, ...FACTORY_BUILDINGS, ...FACTORY_ESTATE, ...FACTORY_CANAL, ...FACTORY_YARD, ...FACTORY_STOCK, ...FACTORY_VEHICLES, ...FACTORY_DECALS },
  floors: FACTORY_FLOORS,
  crisp: ['concrete', 'hazard', 'sidewalk', 'cobble', 'asphalt', 'paving', 'gravel', 'water'],
  walls: FACTORY_WALLS,
  patch: factoryPatch,
  critters: FACTORY_CRITTERS,
  reuse: {
    fac_roofs: ESTATE_VARIANTS,
    fac_quay: 3,
    fac_fence: 3,
    fac_buddleia: 6,
    fac_birch: 5,
    fac_bollard: 3,
    fac_pallets: 5,
    fac_drums: 3,
    fac_ibc: 3,
    fac_lamp: 2,
    fac_reeds: 3,
    fac_tyres: 2,
    fac_tree: 6,
    fac_bags: 3,
  },
};

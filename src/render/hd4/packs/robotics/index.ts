// Robotics pack: a robotics workshop in a hangar at a small airfield.
//   rkit / mesh   palette, materials and a small mesh rasteriser (aircraft, tanks, glass cab)
//   room / room2  the workshop: benches, instruments, the assembly stand, the printer, storage
//   walls         the hangar's back walls and their wall props
//   facade        the front walls cut low, with the big sliding doors open
//   ground        workshop slab, apron, runway asphalt, dry grass, fields; the test pad
//   airfield      paint, lights, signs, windsock, fence, verges, trees, drone pads, clutter
//   planes        light aircraft (meshes with glazed cabins, airfoil wings, gear), a glider trailer, steps
//   vehicles      cars, the fuel bowser, tow tractors, the baggage train, GPUs, chocks, tow bars
//   buildings     hangars, the control tower, the aero club, T-hangars, fuel farm, far farms
//   critters      quadcopters, a rover, hares, swans
//   countryside   pines, hay bales, reeds, rail fence, the fuel compound, lamps, crates
//
// Palette sampled from the owner's retouched picture (docs/worlds-bake/ritocchi/robotics.webp):
//   grass        #3e5a1c #628226 #7e9426 #9aa121 #abaa2c #bcc25c   (lime summer grass)
//   pine         #08270d #174014 #2b4d21 #43692a #679b2e           deciduous #315217 #48611d #648415 #a3bc40
//   cypress      #0c2815 #113315 #29420e #37520e
//   wheat        #b9952f #dea640 #f1b44d #ffd57b                   sunflowers #c7b341 #edd93c on #3d6f1c #4c892c
//   pond         #356870 #4c93b9 #5395bc #5b9fbe                   ploughed #9a6d31 #ae8450
//   apron        #aea598 #c2b9ac #ccc0b4 #cec5b6 #d2c7b8           asphalt #3c3d44 #403f46 #4e4f53 #55565a
//   green hangar #4b705f #527768 #587d6a #789f84 (roof) #4c6c5b #597766 (walls)
//   red hangar   #7b2f24 (roof) #bd442b #c14937 #d95844 (walls)   farm roof #b7392d #bd4436 #d16356
//   terminal     roof #8e8989 #979390 · timber #9d5c2b #b97435 #d39055 · glass #0c3f52 #0f5d75 #23789f #4595ae
//   tower        #bcb6af #c0bbb3 #f7f1ea                           container #0e436a #166bba #1c71bf
//   room         floor #b0a69a #b5ac9f #beb4a8 · panels #868a8d #979999 · dado #37576f #495c6f #526678 · trim #edc45e
import type { WorldPack } from '../types';
import { ROBOTICS_AIRFIELD } from './airfield';
import { ROBOTICS_BUILDINGS } from './buildings';
import { ROBOTICS_COUNTRY } from './countryside';
import { ROBOTICS_CRITTERS } from './critters';
import { ROBOTICS_FACADE } from './facade';
import { ROBOTICS_FLOORS, roboticsPatch } from './ground';
import { ROBOTICS_PLANES } from './planes';
import { ROBOTICS_VEHICLES } from './vehicles';
import { ROBOTICS_ROOM } from './room';
import { ROBOTICS_ROOM2 } from './room2';
import { ROBOTICS_WALLS } from './walls';

export const ROBOTICS: WorldPack = {
  props: { ...ROBOTICS_ROOM, ...ROBOTICS_ROOM2, ...ROBOTICS_FACADE, ...ROBOTICS_AIRFIELD, ...ROBOTICS_PLANES, ...ROBOTICS_VEHICLES, ...ROBOTICS_BUILDINGS, ...ROBOTICS_COUNTRY },
  floors: ROBOTICS_FLOORS,
  crisp: ['concrete', 'hazard', 'paving', 'asphalt', 'sidewalk'],
  walls: ROBOTICS_WALLS,
  patch: roboticsPatch,
  critters: ROBOTICS_CRITTERS,
  reuse: {
    rob_light: 4,
    rob_fence: 5,
    rob_cone: 4,
    rob_tuft: 8,
    rob_flowers: 8,
    rob_bush: 6,
    rob_tree: 6,
    rob_poplar: 6,
    rob_hedge: 5,
    rob_approach: 3,
    rob_drums: 2,
    rob_bins: 2,
    rob_pine: 8,
    rob_bale: 4,
    rob_reeds: 5,
    rob_rail: 3,
    rob_kiosk: 3,
    rob_lamp: 2,
    rob_crates: 4,
  },
};

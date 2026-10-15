// Port pack: a working harbour — the quay, the container terminal, the old
// fish harbour, the breakwater and its lighthouse, the open sea.
//
// Palette sampled from the owner's reference (docs/worlds-bake/ritocchi/port.webp),
// applied in palette.ts, ground.ts and the props:
//   water      basin #00547e #07618b #0d6790 #257aa0 · open sea #015a8f #22779e
//              ripples #52a7ab · foam #b8cdd2 → #f2f9fb
//   quay       room/apron concrete #aaa290 #b2a995 #c7c4a2 · old setts #817a79 #9a908a
//              (joints #32343a) · granite coping, breakwater #b7ab99 #d2c4ab
//   road       asphalt #4c4e58 · pavement #c2b19b #d3c6af · rail ballast #5a4840 #4a2b22
//   lanes      walkway green #3b7c4c #4b8c5a, edges #f9d042 · hazard yellow #f2c228
//   brick      lit #b86a4a #bc5a3c · shade #712a22 #4c221d · trim cream #eadab6
//   roofs      copper green #274d39 #377159 #407d64 #48846b · slate #6c7282 #7c818f #868b99
//   cold store white #e9e9e1 #f2ede5, band #15509e, roof #8f96a0
//   containers red #f55646 #ca2c2a · blue #3b7de6 · green #31884f · yellow #f2af1c
//              orange #e96023 · grey #747b88 · teal, white, brown, navy, sky
//   steel      gantry cranes #1251a0 #2468c0 #4699e7 (shade #0d3269) · ship hull #153572
//              · ferry / tugs red #cc2e2a #c93d45 · lighthouse red #c01f2b
//   shore      sand #cfc49c #f4e1b6 · turf #7a9330 #819a34 #90a54c · cottage roofs #a13725 #c85f4c
//   greenery   conifers #2a5a3a #3e7a4e #5a9462 · tanks #ebe6df #f3eee6
import type { WorldPack } from '../types';
import { PORT_BUILDINGS } from './buildings';
import { PORT_CRITTERS } from './critters';
import { PORT_EDGE } from './edge';
import { PORT_FLOORS, portPatch } from './ground';
import { PORT_QUAY } from './quay';
import { PORT_SEA } from './sea';
import { PORT_TERMINAL } from './terminal';
import { PORT_VEHICLES } from './vehicles';

export const PORT: WorldPack = {
  props: { ...PORT_QUAY, ...PORT_EDGE, ...PORT_BUILDINGS, ...PORT_TERMINAL, ...PORT_VEHICLES, ...PORT_SEA },
  floors: PORT_FLOORS,
  crisp: ['concrete', 'paving', 'asphalt', 'sidewalk', 'hazard', 'gravel'],
  patch: portPatch,
  critters: PORT_CRITTERS,
  reuse: {
    bollard: 6,
    prt_lamp: 4,
    prt_mast: 3,
    prt_fishbox: 5,
    prt_pallets: 4,
    prt_drums: 4,
    prt_nets: 4,
    prt_pots: 4,
    prt_cone: 2,
    prt_bin: 2,
    prt_buoy: 4,
    prt_pine: 5,
    prt_bush: 6,
    prt_cottage: 4,
    prt_lifebuoy: 2,
    prt_tree: 4,
    prt_planter: 3,
  },
};

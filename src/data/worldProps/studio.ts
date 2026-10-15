// Studio (128×64 pack): metadata of this world's own props (the art is in
// src/render/hd4/packs/studio). w/d footprint in tiles, h = art height (z) for picking.
import type { PropMeta } from '../props';

export const STUDIO_META: Record<string, PropMeta> = {
  // the studio's clutter
  std_shelf: { w: 1, d: 1, h: 24 },
  std_canvases: { w: 1, d: 1, h: 22 },
  std_paintCart: { w: 1, d: 1, h: 16 },
  std_rail: { w: 2, d: 1, h: 22 },
  std_reflector: { w: 1, d: 1, h: 32 },
  std_stool: { w: 1, d: 1, h: 10, solid: false },
  std_ringLight: { w: 1, d: 1, h: 32 },
  std_beanbag: { w: 1, d: 1, h: 10 },
  std_dogbed: { w: 1, d: 1, h: 6 },
  std_flamingo: { w: 1, d: 1, h: 14 },
  std_cases: { w: 1, d: 1, h: 12 },
  std_records: { w: 1, d: 1, h: 12 },
  std_floorLamp: { w: 1, d: 1, h: 22 },
  std_boxes: { w: 1, d: 1, h: 14 },
  std_planChest: { w: 1, d: 1, h: 12 },
  std_surfboards: { w: 1, d: 1, h: 30 },
  /** flat details baked into the ground: paint, cables, towels, footprints, shells… */
  std_decal: { w: 1, d: 1, h: 2, solid: false, flat: true },
  // the arts district
  std_house: { w: 6, d: 6, h: 100 },
  std_hut: { w: 1, d: 1, h: 34 },
  std_lifeguard: { w: 3, d: 3, h: 56 },
  std_roofs: { w: 8, d: 8, h: 140 },
  // the beach and the dunes
  std_palm: { w: 2, d: 2, h: 176 },
  std_marram: { w: 1, d: 1, h: 18, solid: false },
  std_dune: { w: 4, d: 3, h: 22 },
  std_sandFence: { w: 4, d: 1, h: 12 },
  std_ropeFence: { w: 4, d: 1, h: 8 },
  std_deckchair: { w: 1, d: 1, h: 10 },
  std_umbrella: { w: 1, d: 1, h: 26 },
  std_castle: { w: 1, d: 1, h: 8, solid: false },
  std_bush: { w: 1, d: 1, h: 26 },
  std_groyne: { w: 6, d: 1, h: 14 },
  std_buoy: { w: 1, d: 1, h: 10 },
  /** the wash of the waves along the shore (live animation) */
  std_surf: { w: 4, d: 6, h: 2, solid: false },
  // the boardwalk, the pier and the boats
  std_pier: { w: 26, d: 3, h: 40 },
  std_boat: { w: 3, d: 1, h: 64 },
  /** the water taxi that shuttles between the pier and the bay (a moving vehicle) */
  std_ferry: { w: 3, d: 1, h: 20 },
  std_foodTruck: { w: 3, d: 2, h: 40 },
  std_festoon: { w: 4, d: 1, h: 22 },
  std_lamp: { w: 1, d: 1, h: 32 },
  std_bench: { w: 2, d: 1, h: 10 },
  std_surfRack: { w: 2, d: 1, h: 42 },
  std_picnic: { w: 2, d: 1, h: 10 },
  std_signpost: { w: 1, d: 1, h: 18 },
  std_bikes: { w: 2, d: 1, h: 16 },
  std_planter: { w: 2, d: 1, h: 12 },
  std_pleinAir: { w: 1, d: 1, h: 16 },
  // back gardens
  std_shed: { w: 2, d: 2, h: 26 },
  std_laundry: { w: 3, d: 1, h: 18 },
  std_shower: { w: 1, d: 1, h: 30 },
  std_picket: { w: 3, d: 1, h: 7 },
  // more life
  std_tree: { w: 2, d: 2, h: 100 },
  std_windbreak: { w: 2, d: 1, h: 10 },
  std_volley: { w: 3, d: 1, h: 14 },
  /** the roped-off beach volleyball court: raked sand, tapes, the net across the middle */
  std_court: { w: 5, d: 5, h: 28 },
  std_camper: { w: 3, d: 2, h: 34 },
  std_bin: { w: 1, d: 1, h: 8 },
  std_aboard: { w: 1, d: 1, h: 9, solid: false },
  std_muralWall: { w: 4, d: 1, h: 16 },
  std_totem: { w: 1, d: 1, h: 30 },
};

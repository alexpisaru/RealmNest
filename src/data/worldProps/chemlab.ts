// Chemical Lab (128×64 pack): metadata of this world's own props. The art is in
// src/render/hd4/packs/chemlab. w/d footprint in tiles, h = art height (base px)
// used for the sprite bounds and picking.
import type { PropMeta } from '../props';

export const CHEMLAB_META: Record<string, PropMeta> = {
  // lab clutter inside the room
  lab_cart: { w: 1, d: 1, h: 26 },
  lab_waste: { w: 1, d: 1, h: 18 },
  lab_gas: { w: 1, d: 1, h: 34 },
  lab_freezer: { w: 1, d: 1, h: 30 },
  lab_fridge: { w: 1, d: 1, h: 30 },
  lab_sink: { w: 2, d: 1, h: 20 },
  lab_board: { w: 1, d: 1, h: 30 },
  lab_spill: { w: 1, d: 1, h: 18 },
  lab_desk: { w: 2, d: 1, h: 26 },
  lab_glovebox: { w: 2, d: 1, h: 26 },
  lab_rotavap: { w: 1, d: 1, h: 34 },
  lab_boxes: { w: 1, d: 1, h: 16 },
  // the campus buildings
  lab_building: { w: 8, d: 8, h: 210 },
  lab_skyline: { w: 10, d: 10, h: 220 },
  // landscape
  lab_birch: { w: 1, d: 1, h: 120 },
  lab_pine: { w: 1, d: 1, h: 140 },
  lab_tree: { w: 1, d: 1, h: 100 },
  lab_flowerbed: { w: 2, d: 1, h: 14 },
  lab_shrub: { w: 1, d: 1, h: 20 },
  lab_hedge: { w: 3, d: 1, h: 14 },
  lab_reeds: { w: 1, d: 1, h: 24, solid: false },
  lab_lily: { w: 1, d: 1, h: 2, solid: false, flat: true },
  lab_rock: { w: 1, d: 1, h: 8 },
  lab_meadow: { w: 1, d: 1, h: 6, solid: false },
  lab_boardwalk: { w: 4, d: 1, h: 12 },
  // site furniture
  lab_bench: { w: 2, d: 1, h: 10 },
  lab_lamp: { w: 1, d: 1, h: 40 },
  lab_bin: { w: 1, d: 1, h: 10 },
  lab_bikes: { w: 3, d: 1, h: 10 },
  lab_sign: { w: 1, d: 1, h: 22 },
  lab_planter: { w: 3, d: 1, h: 40 },
  lab_pergola: { w: 4, d: 2, h: 34 },
  lab_bikeshare: { w: 3, d: 1, h: 14 },
  lab_banner: { w: 1, d: 1, h: 60 },
  lab_shuttle: { w: 3, d: 1, h: 30 },
  // cars and charging
  lab_car: { w: 1, d: 3, h: 28 },
  lab_charger: { w: 1, d: 1, h: 10 },
  lab_carport: { w: 13, d: 5, h: 32 },
  // the hazmat yard
  lab_fence: { w: 4, d: 1, h: 22 },
  lab_lntank: { w: 3, d: 2, h: 90 },
  lab_tank: { w: 3, d: 2, h: 36 },
  lab_drumstore: { w: 2, d: 1, h: 12 },
  lab_cylcage: { w: 2, d: 1, h: 22 },
  lab_store: { w: 3, d: 2, h: 26 },
  lab_ibc: { w: 1, d: 1, h: 14 },
  // flat ground details
  lab_decal: { w: 1, d: 1, h: 2, solid: false, flat: true },
};

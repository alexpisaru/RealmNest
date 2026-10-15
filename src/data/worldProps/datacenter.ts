// Datacenter (128×64 pack): metadata of this world's own props (prefix new types, see docs/PACK_GUIDE.md).
// The art is in src/render/hd4/packs/datacenter. w/d footprint in tiles, h = art height (base units) for picking.
import type { PropMeta } from '../props';

export const DATACENTER_META: Record<string, PropMeta> = {
  // inside the data hall
  dc_ups: { w: 2, d: 1, h: 26 },
  dc_tapelib: { w: 1, d: 1, h: 26 },
  dc_boxes: { w: 1, d: 1, h: 14 },
  dc_cylinders: { w: 1, d: 1, h: 22 },
  dc_ladder: { w: 1, d: 1, h: 24 },
  dc_whiteboard: { w: 1, d: 1, h: 24 },
  dc_floorhole: { w: 1, d: 1, h: 10 },
  dc_cone: { w: 1, d: 1, h: 8, solid: false },
  dc_lift: { w: 1, d: 1, h: 20 },
  dc_spools: { w: 1, d: 1, h: 10 },
  // the data hall and its plant
  dc_hall: { w: 24, d: 10, h: 110 },
  dc_genset: { w: 2, d: 1, h: 46 },
  dc_fueltank: { w: 3, d: 1, h: 26 },
  dc_container: { w: 5, d: 2, h: 30 },
  // the substation and the grid
  dc_transformer: { w: 2, d: 2, h: 40 },
  dc_gantry: { w: 4, d: 1, h: 64 },
  dc_hut: { w: 2, d: 2, h: 34 },
  dc_line: { w: 10, d: 1, h: 130 },
  dc_ridge: { w: 8, d: 12, h: 330 },
  // fences, gate, street furniture
  dc_fence: { w: 4, d: 1, h: 24 },
  dc_gatehouse: { w: 2, d: 2, h: 36 },
  dc_barrier: { w: 3, d: 1, h: 14 },
  dc_lamp: { w: 1, d: 1, h: 64 },
  dc_bollard: { w: 1, d: 1, h: 10 },
  dc_sign: { w: 1, d: 1, h: 30 },
  dc_gritbin: { w: 1, d: 1, h: 12 },
  dc_hydrant: { w: 1, d: 1, h: 12 },
  dc_bikeshed: { w: 3, d: 1, h: 28 },
  dc_parkbench: { w: 2, d: 1, h: 12 },
  dc_flag: { w: 1, d: 1, h: 80 },
  // vehicles
  dc_car: { w: 3, d: 2, h: 20 },
  dc_plough: { w: 5, d: 2, h: 36 },
  dc_ploughM: { w: 4, d: 1, h: 34 },
  dc_snowmobile: { w: 2, d: 1, h: 14 },
  dc_kicksled: { w: 1, d: 1, h: 14 },
  // nature
  dc_spruce: { w: 1, d: 1, h: 190 },
  dc_pine: { w: 1, d: 1, h: 200 },
  dc_birch: { w: 1, d: 1, h: 130 },
  dc_shrub: { w: 1, d: 1, h: 16 },
  dc_mound: { w: 1, d: 1, h: 10 },
  dc_rock: { w: 1, d: 1, h: 26 },
  dc_crag: { w: 3, d: 3, h: 60 },
  dc_snowbank: { w: 4, d: 1, h: 8 },
  dc_reeds: { w: 1, d: 1, h: 14, solid: false },
  dc_snowfence: { w: 6, d: 1, h: 20 },
  // the shore
  dc_cabin: { w: 3, d: 2, h: 56 },
  dc_jetty: { w: 5, d: 1, h: 22 },
  dc_boat: { w: 2, d: 1, h: 10 },
  dc_woodpile: { w: 1, d: 1, h: 16 },
  dc_icehut: { w: 1, d: 1, h: 16 },
  dc_snowman: { w: 1, d: 1, h: 18 },
  // flat details baked into the ground: tracks, footprints, markings, covers
  dc_decal: { w: 1, d: 1, h: 2, solid: false, flat: true },
};

// Space (128×64 pack): metadata of this world's own props (the art is in
// src/render/hd4/packs/space). w/d footprint in tiles, h = art height (base px)
// for picking and the sprite's bounds.
import type { PropMeta } from '../props';

export const SPACE_META: Record<string, PropMeta> = {
  // the station's structures
  spc_edge: { w: 4, d: 1, h: 10 },
  spc_module: { w: 4, d: 4, h: 50 },
  spc_adapter: { w: 1, d: 4, h: 36 },
  spc_truss: { w: 4, d: 1, h: 6 },
  spc_solar: { w: 10, d: 4, h: 4 },
  spc_radiator: { w: 5, d: 2, h: 40 },
  spc_dish: { w: 2, d: 2, h: 56 },
  spc_tower: { w: 1, d: 1, h: 84 },
  spc_arm: { w: 3, d: 3, h: 56 },
  spc_shuttle: { w: 9, d: 4, h: 44 },
  spc_tunnel: { w: 2, d: 4, h: 26 },
  spc_thruster: { w: 2, d: 2, h: 20 },
  spc_mount: { w: 1, d: 1, h: 22 },
  // clutter on the deck
  spc_cargo: { w: 2, d: 2, h: 16 },
  spc_rack: { w: 1, d: 1, h: 26 },
  spc_cabinet: { w: 1, d: 1, h: 30 },
  spc_tank: { w: 2, d: 1, h: 16 },
  spc_box: { w: 1, d: 1, h: 10 },
  spc_beacon: { w: 1, d: 1, h: 24 },
  spc_mast: { w: 1, d: 1, h: 50 },
  spc_rail: { w: 3, d: 1, h: 4 },
  spc_pipes: { w: 4, d: 1, h: 4 },
  spc_vent: { w: 1, d: 1, h: 10 },
  spc_capsule: { w: 4, d: 4, h: 30 },
  spc_worksite: { w: 2, d: 1, h: 16 },
  spc_telescope: { w: 2, d: 2, h: 30 },
  spc_dome: { w: 3, d: 3, h: 30 },
  spc_cupola: { w: 2, d: 2, h: 22 },
  spc_cmg: { w: 2, d: 1, h: 14 },
  spc_decal: { w: 1, d: 1, h: 2, solid: false, flat: true },
  // lit structures after the reference picture, and the truss trolley (a vehicle)
  spc_hangar: { w: 4, d: 2, h: 30 },
  spc_habdome: { w: 3, d: 3, h: 46 },
  spc_lifesup: { w: 3, d: 2, h: 30 },
  spc_antenna: { w: 1, d: 1, h: 52 },
  spc_pod: { w: 2, d: 1, h: 36, solid: false },
};

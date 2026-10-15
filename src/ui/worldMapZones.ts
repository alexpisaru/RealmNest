// The Home map (public/home/world-map.webp, the owner's illustration) and
// where each RealmNest world is drawn on it. Coordinates are fractions of the
// image: the centre of the world's district and its size.

import type { TagBox } from './homeData';

export const WORLD_MAP_IMAGE = 'home/world-map.webp';
/** the illustration's own size (4:3) */
export const WORLD_MAP_W = 1448;
export const WORLD_MAP_H = 1086;

export const MAP_ZONES: Record<string, Omit<TagBox, 'id'>> = {
  // the station in orbit, top right
  space: { u: 0.86, v: 0.13, w: 0.2, h: 0.17 },
  // the observatory domes and the lodge on the north-western mountain
  research: { u: 0.26, v: 0.17, w: 0.2, h: 0.17 },
  // the server complex in the snow
  datacenter: { u: 0.48, v: 0.15, w: 0.22, h: 0.14 },
  // the green labs with solar roofs, north-east
  chemlab: { u: 0.76, v: 0.3, w: 0.24, h: 0.19 },
  // the town centre with the clock tower
  office: { u: 0.49, v: 0.42, w: 0.24, h: 0.2 },
  // the fields and the red barn, west
  farm: { u: 0.19, v: 0.48, w: 0.26, h: 0.2 },
  // the brick factory by the canal
  factory: { u: 0.81, v: 0.54, w: 0.3, h: 0.15 },
  // the hangars and the airfield, south-west
  robotics: { u: 0.27, v: 0.67, w: 0.27, h: 0.15 },
  // the colourful beach village
  studio: { u: 0.47, v: 0.75, w: 0.22, h: 0.14 },
  // the container port with its cranes
  port: { u: 0.79, v: 0.76, w: 0.3, h: 0.18 },
};

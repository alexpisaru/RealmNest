// The world packs by world id (see ./types). The Farm's art lives in ../index (HD4_ART).
// Each world's pack is a folder of its own; packs never import each other.
import { OFFICE } from './office';
import { FACTORY } from './factory';
import { SPACE } from './space';
import { CHEMLAB } from './chemlab';
import { STUDIO } from './studio';
import { ROBOTICS } from './robotics';
import { DATACENTER } from './datacenter';
import { RESEARCH } from './research';
import { PORT } from './port';
import type { WorldPack } from './types';

export const PACKS: Record<string, WorldPack> = {
  office: OFFICE,
  factory: FACTORY,
  space: SPACE,
  chemlab: CHEMLAB,
  studio: STUDIO,
  robotics: ROBOTICS,
  datacenter: DATACENTER,
  research: RESEARCH,
  port: PORT,
};

// Each 128×64 world registers its own props here (one file per world, never shared).
import type { PropMeta } from '../props';
import { OFFICE_META } from './office';
import { FACTORY_META } from './factory';
import { SPACE_META } from './space';
import { CHEMLAB_META } from './chemlab';
import { STUDIO_META } from './studio';
import { ROBOTICS_META } from './robotics';
import { DATACENTER_META } from './datacenter';
import { RESEARCH_META } from './research';
import { PORT_META } from './port';

export const WORLD_PROP_META: Record<string, PropMeta> = {
  ...OFFICE_META,
  ...FACTORY_META,
  ...SPACE_META,
  ...CHEMLAB_META,
  ...STUDIO_META,
  ...ROBOTICS_META,
  ...DATACENTER_META,
  ...RESEARCH_META,
  ...PORT_META,
};

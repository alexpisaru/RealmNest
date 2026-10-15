import type { WorldDef } from '../../domain/world';
import { chemlab } from './chemlab';
import { datacenter } from './datacenter';
import { factory } from './factory';
import { farm } from './farm';
import { office } from './office';
import { port } from './port';
import { research } from './research';
import { robotics } from './robotics';
import { space } from './space';
import { studio } from './studio';

/** All worlds, in menu order. Adding a world = add a file + list it here. */
export const WORLDS: WorldDef[] = [office, factory, farm, space, chemlab, studio, robotics, datacenter, research, port];

export const WORLD_BY_ID: Record<string, WorldDef> = Object.fromEntries(WORLDS.map((w) => [w.id, w]));

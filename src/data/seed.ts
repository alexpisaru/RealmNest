import type { Character } from '../domain/character';
import { PRESET_BY_ID } from './presets';
import { WORLD_BY_ID } from './worlds';

/**
 * The demo team, created only when the user asks for it (Settings › Data › Load the demo team).
 * A new profile starts with no agents (0.11.1). Everything here is ordinary, editable data.
 */
const DEMO: [presetId: string, name: string, role: string, worldId: string, outfit?: string][] = [
  ['founder', 'Alex', 'Founder & CEO', 'farm', 'farm.casual'],
  ['braids', 'Maya', 'Research lead', 'farm', 'farm.gardener'],
  ['afro', 'Zoe', 'Grower', 'farm', 'farm.classic'],
  ['curly', 'Theo', 'Data analyst', 'farm', 'farm.field'],
  ['spiky', 'Kenji', 'Engineer', 'office'],
  ['bun', 'Lena', 'Product designer', 'office', 'office.creative'],
  ['ponytail', 'Priya', 'ML engineer', 'office', 'office.operations'],
  ['long', 'Hana', 'Writer', 'office', 'office.smart_casual'],
  ['bigbeard', 'Bruno', 'Line supervisor', 'factory', 'factory.supervisor'],
  ['bearded', 'Omar', 'Operator', 'factory'],
  ['undercut', 'Sam', 'Machinist', 'factory', 'factory.mechanic'],
  ['silver', 'Grace', 'Senior chemist', 'chemlab', 'chemlab.senior'],
];

export function demoCrew(now = Date.now()): Character[] {
  return DEMO.map(([presetId, name, role, worldId, outfit], i) => {
    const preset = PRESET_BY_ID[presetId];
    return {
      id: `demo-${presetId}`,
      name,
      role,
      visualPresetId: presetId,
      profile: { ...preset.profile },
      signature: preset.signature,
      worldId,
      outfitId: outfit ?? WORLD_BY_ID[worldId].defaultOutfitId,
      metadata: { createdAt: now + i, updatedAt: now + i, founder: !!preset.founderPreset },
    };
  });
}

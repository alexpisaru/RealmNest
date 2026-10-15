import type { OutfitDef, OutfitLayers, OutfitVariant } from '../domain/outfit';

// ─────────────────────────────────────────────────────────────
// Outfit collections: one per world (7–8 each) + a small universal set.
// All are layer recipes for the sprite composer, wearable by any body.
// `signature` = the wearer's signature colour.
// ─────────────────────────────────────────────────────────────

const C = {
  denim: '#36456b',
  navy: '#2d3554',
  khaki: '#a58f6c',
  charcoal: '#3a3d4a',
  white: '#f4f1ea',
  black: '#24212e',
  brown: '#6b4632',
  boot: '#3a2b22',
  sneaker: '#f1efe9',
  slate: '#56677f',
  hivisO: '#f07a2f',
  hivisY: '#e6d43a',
  stripe: '#f6f1d8',
  gold: '#c9a24a',
};

const o = (
  worldCategory: string,
  id: string,
  name: string,
  layers: OutfitLayers,
  extra: { description?: string; variants?: OutfitVariant[] } = {},
): OutfitDef => ({ id: `${worldCategory}.${id}`, worldCategory, name, layers, ...extra });

const colourVariants = (...cols: [string, string][]): OutfitVariant[] =>
  cols.map(([id, top]) => ({ id, name: id[0].toUpperCase() + id.slice(1), layers: { top } }));

export const OUTFITS: OutfitDef[] = [
  // ── Universal ──
  o('universal', 'tee', 'Basic tee', { top: 'signature', pants: C.denim, shoes: C.sneaker, shortSleeves: true }),
  o('universal', 'hoodie', 'Cozy hoodie', { top: 'signature', neck: 'hood', pants: C.black, shoes: C.sneaker }),
  o('universal', 'founder', 'Founder', {
    top: '#fffaf0', neck: 'henley', coat: '#68683d', rolledSleeves: true, buttons: C.gold, pockets: true,
    belt: '#6b3a22', buckle: C.gold, strap: '#7a3a1e', pants: '#59454c', cargo: true,
    shoes: '#9a4a28', boots: '#9a4a28', laces: '#f8dcb0',
  }, { description: 'Open olive jacket with rolled sleeves, cream henley, crossbody strap, cargo trousers and lace-up boots.' }),

  // ── Office ──
  o('office', 'tech_casual', 'Tech casual', { top: 'signature', pants: C.denim, shoes: C.sneaker, badge: '#ffffff' }),
  o('office', 'smart_casual', 'Smart casual', { top: 'signature', neck: 'collar', neckColor: C.white, pants: C.khaki, shoes: C.brown },
    { variants: colourVariants(['sage', '#8fb08a'], ['oat', '#d9c8a8'], ['navy', C.navy]) }),
  o('office', 'formal', 'Formal', { top: C.white, coat: C.navy, neck: 'tie', neckColor: 'signature', pants: C.navy, shoes: C.black }),
  o('office', 'startup_hoodie', 'Startup hoodie', { top: 'signature', neck: 'hood', pants: C.black, shoes: C.sneaker }),
  o('office', 'business', 'Business', { top: '#dfe6ef', coat: C.charcoal, neck: 'tie', neckColor: '#7a2e3a', pants: C.charcoal, shoes: C.black }),
  o('office', 'creative', 'Creative office', { top: 'signature', neck: 'turtle', pants: C.black, shoes: C.brown, headgear: 'beret', headgearColor: C.black }),
  o('office', 'operations', 'Operations', { top: 'signature', neck: 'collar', neckColor: 'signature', pants: C.khaki, shoes: C.boot, headgear: 'headset', headgearColor: C.black, badge: C.white }),
  o('office', 'executive', 'Executive', { top: C.white, coat: '#1e2233', neck: 'tie', neckColor: C.gold, pants: '#1e2233', shoes: C.black, badge: C.gold }),
  o('office', 'skirt_suit', 'Skirt suit', { top: C.white, coat: 'signature', neck: 'collar', neckColor: C.white, pants: C.navy, skirt: 'signature', shoes: C.black }),

  // ── Factory ──
  o('factory', 'operator', 'Operator', { top: '#3e4f73', vest: { color: C.hivisO, stripe: C.stripe }, pants: '#2f3a56', shoes: C.boot, headgear: 'hardhat', headgearColor: '#f3c843', gloves: '#8c8f99' }),
  o('factory', 'mechanic', 'Mechanic', { top: '#d9d2c3', overalls: '#4a6fa5', pants: '#4a6fa5', shoes: C.boot, gloves: '#3a3d4a', boots: C.boot }),
  o('factory', 'engineer', 'Engineer', { top: C.white, neck: 'collar', neckColor: C.white, pants: C.navy, shoes: C.boot, headgear: 'hardhat', headgearColor: '#f4f1ea', badge: 'signature' }),
  o('factory', 'maintenance', 'Maintenance', { top: 'signature', overalls: '#6b7280', pants: '#6b7280', shoes: C.boot, headgear: 'cap', headgearColor: 'signature', belt: '#8a5a32' }),
  o('factory', 'supervisor', 'Supervisor', { top: C.white, neck: 'tie', neckColor: 'signature', pants: C.charcoal, shoes: C.black, headgear: 'hardhat', headgearColor: '#5b8def', badge: C.gold }),
  o('factory', 'industrial', 'Industrial worker', { top: C.charcoal, apron: '#7a5236', pants: '#2f3a56', shoes: C.boot, headgear: 'goggles', headgearColor: '#9fe3e0', gloves: '#c99b56' }),
  o('factory', 'safety', 'Safety officer', { top: '#2f3a56', vest: { color: '#c6e04a', stripe: C.white }, pants: '#2f3a56', shoes: C.boot, headgear: 'hardhat', headgearColor: C.hivisO, boots: C.boot }),
  o('factory', 'technician', 'Technician', { top: C.slate, neck: 'collar', neckColor: '#46566d', pants: C.slate, shoes: C.boot, belt: '#8a5a32', badge: '#f3c843', gloves: '#8c8f99' }),

  // ── Farm ──
  o('farm', 'classic', 'Farmer classic', { top: 'signature', overalls: '#4a6fa5', pants: '#4a6fa5', shoes: C.brown, headgear: 'strawhat', headgearColor: '#e8c574' }),
  o('farm', 'gardener', 'Gardener', { top: '#7bb35a', apron: '#a6714a', pants: C.khaki, shoes: C.brown, gloves: '#e8c574', headgear: 'bandana', headgearColor: 'signature' }),
  o('farm', 'ranch', 'Ranch worker', { top: 'signature', vest: { color: '#8a5a3c', stripe: '#8a5a3c' }, pants: C.denim, shoes: C.brown, boots: '#5b3a24', headgear: 'strawhat', headgearColor: '#a6714a' }),
  o('farm', 'greenhouse', 'Greenhouse', { top: C.white, apron: '#4f9a55', pants: C.khaki, shoes: C.sneaker, gloves: '#7fb6f0' }),
  o('farm', 'casual', 'Casual farm', { top: 'signature', pants: C.denim, shoes: C.brown, headgear: 'cap', headgearColor: '#4f9a55' }),
  o('farm', 'utility', 'Utility', { top: '#6b7a4a', pants: '#5a5246', shoes: C.boot, belt: '#8a5a32', gloves: '#c99b56', boots: C.boot }),
  o('farm', 'rain', 'Rain gear', { top: '#f3c843', coat: '#f3c843', longCoat: true, pants: '#2f6b4a', shoes: '#2f6b4a', boots: '#2f6b4a', headgear: 'raincap', headgearColor: '#f3c843' }),
  o('farm', 'field', 'Field worker', { top: '#c0533f', suspenders: C.brown, pants: C.khaki, shoes: C.brown, headgear: 'strawhat', headgearColor: '#e8c574' }),

  // ── Space station ──
  o('space', 'commander', 'Commander', { top: C.navy, stripe: C.gold, pants: C.navy, shoes: '#8a93a8', patch: 'signature', badge: C.gold }),
  o('space', 'engineer', 'Station engineer', { top: '#9aa4b8', overalls: C.hivisO, pants: C.hivisO, shoes: '#5a6378', gloves: '#d7dce6', patch: 'signature' }),
  o('space', 'scientist', 'Scientist', { top: '#2f6b8a', coat: '#eef1f6', pants: '#5c6577', shoes: '#e4e7ec', badge: '#5ee0e6' }),
  o('space', 'pilot', 'Pilot', { top: '#3f5a8a', neck: 'ring', neckColor: '#9aa4b8', pants: '#3f5a8a', shoes: '#2b2730', patch: 'signature', headgear: 'visor', headgearColor: 'signature' }),
  o('space', 'maintenance', 'Maintenance crew', { top: C.slate, belt: '#5a6378', pants: C.slate, shoes: '#2b2730', gloves: '#d7dce6', headgear: 'headset', headgearColor: '#2a2633' }),
  o('space', 'medical', 'Medical crew', { top: '#5ec3b3', neck: 'vneck', pants: '#4fae9f', shoes: '#f1f3f5', badge: '#ffffff', patch: '#e2553b' }),
  o('space', 'eva', 'EVA indoor suit', { top: '#eef1f6', neck: 'ring', neckColor: '#9aa4b8', pants: '#e1e5ee', shoes: '#8a93a8', belt: '#5a6378', gloves: '#d7dce6', patch: 'signature', boots: '#8a93a8' }),
  o('space', 'operations', 'Operations', { top: 'signature', neck: 'collar', neckColor: 'signature', pants: '#3a3f5a', shoes: '#2b2730', headgear: 'headset', headgearColor: '#2a2633' }),

  // ── Chemical lab ──
  o('chemlab', 'researcher', 'Researcher', { top: 'signature', coat: '#f3f6f8', longCoat: true, neck: 'vneck', pants: '#5c6577', shoes: '#e4e7ec', headgear: 'goggles', headgearColor: '#9fe3e0', badge: '#2fb5c8' }),
  o('chemlab', 'chemist', 'Chemist', { top: '#3a3d4a', coat: '#f3f6f8', longCoat: true, pants: '#5c6577', shoes: C.black, gloves: '#7fb6f0', headgear: 'goggles', headgearColor: '#f3c843' }),
  o('chemlab', 'technician', 'Lab technician', { top: '#5b8def', coat: '#f3f6f8', pants: C.navy, shoes: C.sneaker, gloves: '#7fb6f0' }),
  o('chemlab', 'cleanroom', 'Cleanroom', { top: '#e8f2f8', pants: '#e8f2f8', shoes: '#ffffff', boots: '#ffffff', headgear: 'hairnet', headgearColor: '#bfe3f2', gloves: '#7fb6f0' }),
  o('chemlab', 'analysis', 'Analysis', { top: '#2f3a4a', neck: 'turtle', coat: '#f3f6f8', longCoat: true, pants: C.black, shoes: C.black, badge: 'signature' }),
  o('chemlab', 'safety', 'Safety', { top: '#2f3a4a', coat: '#f3c843', longCoat: true, pants: '#2f3a4a', shoes: C.boot, gloves: '#2a2a2a', headgear: 'goggles', headgearColor: '#9fe3e0', boots: C.boot }),
  o('chemlab', 'senior', 'Senior scientist', { top: C.white, neck: 'tie', neckColor: 'signature', coat: '#f3f6f8', longCoat: true, pants: C.charcoal, shoes: C.brown, badge: C.gold }),
  o('chemlab', 'assistant', 'Assistant', { top: 'signature', apron: '#f3f6f8', pants: C.denim, shoes: C.sneaker, gloves: '#7fb6f0' }),

  // ── Creative studio ──
  o('studio', 'artist', 'Artist', { top: C.white, apron: '#5b8def', pants: C.black, shoes: C.sneaker, headgear: 'beret', headgearColor: 'signature' }),
  o('studio', 'editor', 'Editor', { top: C.charcoal, neck: 'hood', pants: C.black, shoes: C.sneaker, headgear: 'headset', headgearColor: C.black }),
  o('studio', 'photographer', 'Photographer', { top: 'signature', vest: { color: '#6b7a4a', stripe: '#6b7a4a' }, pants: C.khaki, shoes: C.brown, headgear: 'cap', headgearColor: C.black }),
  o('studio', 'designer', 'Designer', { top: C.black, neck: 'turtle', pants: C.black, shoes: C.white }),
  o('studio', 'streamer', 'Streamer', { top: 'signature', neck: 'hood', pants: '#2f2c3a', shoes: C.sneaker, headgear: 'headset', headgearColor: 'signature' }),
  o('studio', 'director', 'Director', { top: C.white, coat: '#8a5a3c', neck: 'scarf', neckColor: 'signature', pants: C.black, shoes: C.brown }),
  o('studio', 'illustrator', 'Illustrator', { top: C.white, stripe: 'signature', pants: C.denim, shoes: '#e2553b', skirt: C.denim }),

  // ── Robotics workshop ──
  o('robotics', 'builder', 'Builder', { top: '#d9d2c3', overalls: '#3f6fb5', pants: '#3f6fb5', shoes: C.boot, gloves: '#3a3d4a', headgear: 'goggles', headgearColor: '#f3c843' }),
  o('robotics', 'electronics', 'Electronics', { top: C.charcoal, apron: '#2f3346', pants: C.black, shoes: C.sneaker, badge: '#f3c843', headgear: 'goggles', headgearColor: '#9fe3e0' }),
  o('robotics', 'tester', 'Field tester', { top: 'signature', vest: { color: C.hivisY, stripe: C.white }, pants: C.slate, shoes: C.boot, headgear: 'cap', headgearColor: C.charcoal }),
  o('robotics', 'mechanic', 'Mechanic', { top: C.slate, belt: '#8a5a32', pants: C.slate, shoes: C.boot, gloves: '#8c8f99', patch: 'signature' }),
  o('robotics', 'programmer', 'Programmer', { top: 'signature', neck: 'hood', pants: C.denim, shoes: C.sneaker }),
  o('robotics', 'lead', 'Lead engineer', { top: C.white, neck: 'collar', neckColor: C.white, coat: '#3a4a5c', pants: C.charcoal, shoes: C.black, badge: 'signature' }),
  o('robotics', 'welder', 'Welder', { top: '#7a5236', apron: '#5a3a24', pants: '#3a3d4a', shoes: C.boot, gloves: '#c99b56', headgear: 'bandana', headgearColor: 'signature' }),

  // ── Data center ──
  o('datacenter', 'sysadmin', 'Sysadmin', { top: 'signature', neck: 'hood', pants: C.black, shoes: C.sneaker, badge: '#59e08a' }),
  o('datacenter', 'network', 'Network engineer', { top: C.slate, neck: 'collar', neckColor: '#46566d', pants: C.slate, shoes: C.boot, belt: '#8a5a32', badge: '#f3c843' }),
  o('datacenter', 'noc', 'NOC operator', { top: 'signature', neck: 'collar', neckColor: 'signature', pants: C.charcoal, shoes: C.black, headgear: 'headset', headgearColor: C.black }),
  o('datacenter', 'hardware', 'Hardware tech', { top: C.charcoal, vest: { color: '#3f6fb5', stripe: '#59e08a' }, pants: C.charcoal, shoes: C.boot, gloves: '#8c8f99', headgear: 'cap', headgearColor: '#3f6fb5' }),
  o('datacenter', 'security', 'Security', { top: '#1e2233', pants: '#1e2233', shoes: C.black, badge: C.gold, headgear: 'cap', headgearColor: '#1e2233', belt: C.black }),
  o('datacenter', 'field', 'Field crew', { top: '#d9d2c3', overalls: C.slate, pants: C.slate, shoes: C.boot, patch: 'signature' }),
  o('datacenter', 'shift_lead', 'Shift lead', { top: '#dfe6ef', neck: 'tie', neckColor: 'signature', pants: C.navy, shoes: C.black, badge: '#59e08a' }),

  // ── Research hub ──
  o('research', 'researcher', 'Researcher', { top: C.white, coat: 'signature', pants: C.khaki, shoes: C.brown, badge: '#ffffff' }),
  o('research', 'archivist', 'Archivist', { top: '#7a5236', neck: 'scarf', neckColor: 'signature', pants: C.charcoal, shoes: C.brown }),
  o('research', 'analyst', 'Analyst', { top: C.white, neck: 'collar', neckColor: C.white, vest: { color: C.charcoal, stripe: C.charcoal }, pants: C.charcoal, shoes: C.black }),
  o('research', 'botanist', 'Botanist', { top: '#7bb35a', apron: '#a6714a', pants: C.khaki, shoes: C.boot, gloves: '#e8c574', headgear: 'strawhat', headgearColor: '#e8c574' }),
  o('research', 'field', 'Field scientist', { top: 'signature', vest: { color: C.khaki, stripe: C.khaki }, pants: '#5a5246', shoes: C.boot, headgear: 'cap', headgearColor: C.khaki }),
  o('research', 'lecturer', 'Lecturer', { top: C.white, coat: '#5a4a3a', neck: 'tie', neckColor: 'signature', pants: C.charcoal, shoes: C.brown }),
  o('research', 'assistant', 'Lab assistant', { top: 'signature', coat: '#f3f6f8', longCoat: true, pants: C.denim, shoes: C.sneaker, badge: '#2fb5c8' }),

  // ── Logistics port ──
  o('port', 'dockworker', 'Dockworker', { top: C.charcoal, vest: { color: C.hivisO, stripe: C.stripe }, pants: '#5a5246', shoes: C.boot, headgear: 'hardhat', headgearColor: '#f3c843', gloves: '#c99b56' }),
  o('port', 'crane', 'Crane operator', { top: '#d9d2c3', overalls: C.hivisO, pants: C.hivisO, shoes: C.boot, headgear: 'hardhat', headgearColor: C.white }),
  o('port', 'dispatcher', 'Dispatcher', { top: 'signature', neck: 'collar', neckColor: 'signature', pants: C.khaki, shoes: C.boot, headgear: 'headset', headgearColor: C.black, badge: C.white }),
  o('port', 'harbor_master', 'Harbor master', { top: C.white, coat: '#1e2a44', longCoat: true, pants: '#1e2a44', shoes: C.black, headgear: 'cap', headgearColor: '#1e2a44', badge: C.gold }),
  o('port', 'customs', 'Customs', { top: '#dfe6ef', neck: 'tie', neckColor: C.navy, pants: C.navy, shoes: C.black, headgear: 'cap', headgearColor: C.navy, badge: C.gold }),
  o('port', 'forklift', 'Forklift driver', { top: 'signature', vest: { color: C.hivisY, stripe: C.white }, pants: C.denim, shoes: C.boot, headgear: 'cap', headgearColor: 'signature', gloves: '#c99b56' }),
  o('port', 'sailor', 'Sailor', { top: C.white, stripe: '#2d5aa0', pants: C.navy, shoes: C.brown, headgear: 'beanie', headgearColor: '#2d5aa0' }),
  o('port', 'rain', 'Rain gear', { top: '#f3c843', coat: '#f3c843', longCoat: true, pants: C.navy, shoes: C.boot, boots: C.boot, headgear: 'raincap', headgearColor: '#f3c843' }),
];

export const OUTFIT_BY_ID: Record<string, OutfitDef> = Object.fromEntries(OUTFITS.map((x) => [x.id, x]));

/** Outfits usable in a world: its own collection + the universal basics. */
export function outfitsForWorld(category: string): OutfitDef[] {
  return OUTFITS.filter((x) => x.worldCategory === category || x.worldCategory === 'universal');
}

export function isOutfitCompatible(outfitId: string, category: string, body?: string): boolean {
  const def = OUTFIT_BY_ID[outfitId];
  if (!def) return false;
  if (def.worldCategory !== category && def.worldCategory !== 'universal') return false;
  if (body && def.compatibleCharacterTypes && !def.compatibleCharacterTypes.includes(body as never)) return false;
  return true;
}

/** Resolve the final layers (base + optional variant). */
export function outfitLayers(outfitId: string, variant?: string): OutfitLayers {
  const def = OUTFIT_BY_ID[outfitId] ?? OUTFITS[0];
  const v = variant ? def.variants?.find((x) => x.id === variant) : undefined;
  return v ? { ...def.layers, ...v.layers } : def.layers;
}

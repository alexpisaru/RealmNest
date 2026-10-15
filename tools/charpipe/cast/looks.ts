// Cast factory: the app's characters as cast assets. A VisualProfile (body, skin, hair, face,
// accessory) plus an outfit (src/data/outfits.ts layers) becomes the list of assets to composite,
// each with its colours per material. Pure data: the editor and the app use it at runtime.
import { SKIN_TONES } from '../../../src/data/presets';
import { outfitLayers } from '../../../src/data/outfits';
import type { VisualProfile } from '../../../src/domain/character';
import type { OutfitLayers } from '../../../src/domain/outfit';
import type { Build, Height, Kind } from './body';
import { SLOTS, type Material, type Slot } from './catalog';

export interface LookAsset {
  asset: string;
  slot: Slot;
  /** the colour of each material the asset uses (base tone; ramps come from palette.rampOf) */
  colors: Partial<Record<Material, string>>;
}
export interface CastLook {
  shape: { kind: Kind; build: Build; height: Height };
  assets: LookAsset[];
}

const GLASSES: Record<string, string> = { round: '#a87a36', square: '#5a4a5e' };
/** a headgear's own colours when the outfit gives none: [main, second] */
const HEADGEAR: Record<string, [string, string]> = {
  hardhat: ['#f3c843', '#d9d9d9'],
  strawhat: ['#e2c27a', '#8a4b2c'],
  cap: ['#2d3554', '#f4f1ea'],
  hairnet: ['#e8eef2', '#c9d4dc'],
  headset: ['#24212e', '#8a8f9e'],
  beanie: ['#3a3d4a', '#f4f1ea'],
  goggles: ['#3a3d4a', '#7fd0e8'],
  bandana: ['#c0533f', '#f4f1ea'],
  beret: ['#24212e', '#24212e'],
  visor: ['#f4f1ea', '#2d3554'],
  raincap: ['#e6d43a', '#b39a1e'],
};
const METAL = '#b9bdc8';

/** a slot's place in the composite (for sorting) */
const slotIndex = (s: Slot) => SLOTS.indexOf(s);

export function castLook(p: VisualProfile, signature: string, layers: OutfitLayers): CastLook {
  const sig = (c: string | undefined, fallback = signature) => (!c ? fallback : c === 'signature' ? signature : c);
  const out: LookAsset[] = [];
  const add = (asset: string, slot: Slot, colors: LookAsset['colors']) => out.push({ asset, slot, colors });
  const skin = SKIN_TONES[p.skin];

  // the body: skin, eyes, and the brows in the hair's colour
  add('body', 'body', { skin: skin.base, eyes: p.eyeColor, hair: p.hairColor });
  // hair and face
  add(`hair:${p.hair}`, 'hair', { hair: p.hairColor, accent: sig(p.hairAccent) });
  if (p.facialHair) add(`face:${p.facialHair}`, 'face', { hair: p.hairColor });
  if (p.freckles) add('face:freckles', 'face', { skin: skin.base });
  if (p.earring) add('face:earring', 'face', { accent: p.earring });
  if (p.glasses) add(`glasses:${p.glasses}`, 'glasses', { main: GLASSES[p.glasses] });

  // the outfit, layer by layer
  const L = layers;
  const coat = L.coat ? sig(L.coat) : undefined;
  const top = sig(L.top);
  add(L.rolledSleeves ? 'top:rolled' : L.shortSleeves && !coat ? 'top:short' : 'top:long', 'top', { main: top });
  add(L.cargo ? 'pants:cargo' : 'pants:straight', 'pants', { main: sig(L.pants) });
  if (L.boots) add('boots', 'boots', { main: sig(L.boots), accent: sig(L.laces, sig(L.boots)) });
  else add('shoes:shoe', 'shoes', { main: sig(L.shoes) });
  if (L.skirt) add('skirt', 'skirt', { main: sig(L.skirt) });
  if (L.stripe) add('stripe', 'stripe', { main: sig(L.stripe) });
  if (L.overalls) add('overalls', 'overalls', { main: sig(L.overalls), metal: METAL });
  if (L.suspenders) add('suspenders', 'suspenders', { main: sig(L.suspenders) });
  if (L.strap) add('strap', 'strap', { main: sig(L.strap), metal: sig(L.buckle, METAL) });
  if (L.belt) add('belt', 'belt', { main: sig(L.belt), metal: sig(L.buckle, METAL) });
  if (L.vest) add('vest', 'vest', { main: sig(L.vest.color), accent: sig(L.vest.stripe) });
  if (L.apron) add('apron', 'apron', { main: sig(L.apron) });
  if (coat) add(L.longCoat ? 'coat:long' : 'coat:short', 'coat', { main: coat, accent: sig(L.buttons, coat) });
  if (L.neck) add(`neck:${L.neck}`, 'neck', { main: sig(L.neckColor, L.neck === 'hood' ? top : signature) });
  if (L.badge) add('badge', 'badge', { main: sig(L.badge) });
  if (L.patch) add('patch', 'patch', { main: sig(L.patch) });
  if (L.gloves) add('gloves', 'gloves', { main: sig(L.gloves) });
  if (L.headgear) {
    const [m, s] = HEADGEAR[L.headgear];
    // a cap's bill is the cap's own colour
    const main = sig(L.headgearColor, m);
    add(`headgear:${L.headgear}`, 'headgear', { main, second: L.headgear === 'cap' ? main : s });
  }
  // the profile accessory (headphones give way to an outfit's headset; a scarf is a neck piece)
  if (p.accessory === 'headphones' && L.headgear !== 'headset') add('accessory:headphones', 'accessory', { main: signature, metal: METAL });
  if (p.accessory === 'flower') add('accessory:flower', 'accessory', { accent: '#ef7aa8', main: '#f3c843' });
  if (p.accessory === 'scarf' && L.neck !== 'scarf') add('neck:scarf', 'neck', { main: signature });

  return {
    shape: { kind: p.body, build: p.build, height: p.height },
    assets: out.sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot)),
  };
}

/** a character's look in an outfit of the app (id and optional colour variant) */
export const castLookFor = (p: VisualProfile, signature: string, outfitId: string, variant?: string) => castLook(p, signature, outfitLayers(outfitId, variant));

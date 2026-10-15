// Dev-only asset catalogue for the 128×64 Farm library (not imported by the app).
//   const C = await import('/src/dev/catalog.ts'); await C.sheet('trees.png', C.FAMILIES.trees)
// Renders each asset alone at native scale on a grass swatch, with a label.
import { PROP_META } from '../data/props';
import { WORLD_BY_ID } from '../data/worlds';
import { SoftCtx, bufferToCanvas } from '../render/hd/soft';
import { HD4_ART } from '../render/hd4';
import { Painter, PropPainter } from '../render/iso';

export interface Entry {
  type: string;
  variant?: string;
  w?: number;
  d?: number;
  rot?: 0 | 1;
  seed?: number;
  label?: string;
  color?: string;
}

async function post(name: string, c: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res));
  await fetch('http://localhost:5199/' + name, { method: 'POST', body: blob });
}

const K = 4;

/** Render one asset into its own canvas; returns the canvas and the ground anchor. */
export function renderAsset(e: Entry, cw = 440, ch = 440) {
  const meta = PROP_META[e.type];
  const w = e.w ?? meta?.w ?? 1;
  const d = e.d ?? meta?.d ?? 1;
  const soft = new SoftCtx(cw, ch);
  // ground swatch: the footprint diamond plus a little margin, flat warm grass
  const ox = Math.round(cw / 2 - ((w - d) * 16 * K) / 2);
  const oy = Math.round(ch - 40 - (w + d) * 8 * K);
  const P = new Painter(soft.asContext(), ox, oy, K);
  const art = HD4_ART[e.type];
  if (art) {
    const pp = new PropPainter(P, 0, 0, w, d, e.rot ?? 0);
    art.draw(pp, { w, d, variant: e.variant, color: e.color, th: WORLD_BY_ID.farm.theme, t: 0.8, seed: e.seed ?? 3 });
  }
  return { cv: bufferToCanvas(soft.data, cw, ch), ox, oy, w, d };
}

/** A catalogue sheet: cells in a grid on a grass background, labelled; `scale` magnifies (integer, nearest). */
export async function sheet(name: string, entries: Entry[], cols = 6, cw = 440, ch = 440, scale = 1) {
  const rows = Math.ceil(entries.length / cols);
  const CW = cw * scale;
  const CH = ch * scale;
  const out = document.createElement('canvas');
  out.width = cols * CW;
  out.height = rows * (CH + 26);
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.fillStyle = '#5c8a3e';
  o.fillRect(0, 0, out.width, out.height);
  entries.forEach((e, i) => {
    const cx = (i % cols) * CW;
    const cy = Math.floor(i / cols) * (CH + 26);
    // footprint diamond (lighter grass) so the scale reads
    const { cv, ox, oy, w, d } = renderAsset(e, cw, ch);
    const pt = (x: number, y: number) => [cx + (ox + (x - y) * 16 * K) * scale, cy + (oy + (x + y) * 8 * K) * scale] as const;
    o.fillStyle = '#6b9a46';
    o.beginPath();
    const a = pt(0, 0);
    const b = pt(w, 0);
    const c2 = pt(w, d);
    const d2 = pt(0, d);
    o.moveTo(a[0], a[1]);
    o.lineTo(b[0], b[1]);
    o.lineTo(c2[0], c2[1]);
    o.lineTo(d2[0], d2[1]);
    o.closePath();
    o.fill();
    o.drawImage(cv, cx, cy, CW, CH);
    o.fillStyle = 'rgba(20,16,26,0.75)';
    o.fillRect(cx, cy + CH, CW, 26);
    o.fillStyle = '#f3e9dc';
    o.font = '600 15px Inter, system-ui, sans-serif';
    o.fillText(e.label ?? `${e.type}${e.variant ? ' · ' + e.variant : ''}`, cx + 10, cy + CH + 18);
  });
  await post(name, out);
  return [out.width, out.height];
}

const v = (type: string, variants: string[], extra: Partial<Entry> = {}) => variants.map((variant) => ({ type, variant, ...extra }));

export const FAMILIES: Record<string, Entry[]> = {
  trees: [
    ...v('tree', ['oak', 'birch', 'pine', 'willow', 'poplar', 'cherry', 'sapling']),
    ...v('fruitTree', ['apple', 'pear', 'plum', 'orange']),
    { type: 'tree', variant: 'oak', seed: 9, label: 'oak · seed 9' },
  ],
  bushes: [...v('bush', ['round', 'hydrangea', 'berry', 'boxwood', 'lavender', 'rose', 'fern']), { type: 'bush', variant: 'hydrangea', seed: 4, label: 'hydrangea · pink' }],
  flowers: [
    ...v('flowers', ['daisy', 'tulip', 'poppy', 'marigold', 'hollyhock', 'foxglove', 'forgetmenot', 'cosmos', 'lavenderSmall', 'wild']),
    ...v('tallGrass', ['tuft', 'seedheads', 'sedge', 'clump']),
    { type: 'sunflowers' },
    { type: 'hedgeRow', w: 3, variant: 'pink', label: 'hedge · pink' },
  ],
  fences: [
    ...v('fenceRow', ['rail', 'picket', 'wattle', 'broken'], { w: 2 }),
    { type: 'fenceRow', variant: 'rail', w: 2, rot: 1, label: 'fenceRow · rail · rot 1' },
    { type: 'gate', w: 1, label: 'gate' },
    ...v('stoneWall', ['dry', 'cut', 'mossy', 'ruin', 'brick'], { w: 2 }),
  ],
  decals: [
    ...v('decal', ['edge.tufts', 'edge.stones', 'edge.crumbs', 'edge.flowers', 'edge.moss', 'edge.puddle']),
    ...v('decal', ['trans.patchy', 'trans.worn', 'trans.mud', 'trans.dry', 'trans.clover', 'trans.gravel']),
    ...v('decal', ['clutter.leaves', 'clutter.twigs', 'clutter.pebbles', 'clutter.mushrooms', 'clutter.flowers', 'clutter.weeds', 'steps']),
    { type: 'lilies' },
  ],
  props: [
    ...['crate', 'bucket', 'wateringCan', 'sack', 'barrel', 'tools', 'basket', 'signpost', 'lanternPost', 'pots', 'wheelbarrow', 'milkCan', 'firewood', 'hay', 'haystack', 'ladder'].map((type) => ({ type })),
    { type: 'bench', w: 2 },
    { type: 'trough', w: 2 },
  ],
  decor: [
    { type: 'laundry', w: 2 },
    ...['seedBags', 'potStack', 'birdhouse', 'scarecrow', 'broom', 'tarpPile', 'rainBarrel', 'picnicBlanket', 'chopBlock', 'mailbox'].map((type) => ({ type })),
    { type: 'appleCart', w: 2 },
    { type: 'crate', seed: 4, label: 'crate · empty' },
    { type: 'basket', seed: 3, label: 'basket · apples' },
  ],
  buildings: [
    { type: 'farmhouse', w: 8, d: 5 },
    { type: 'barn', w: 4, d: 3 },
    { type: 'greenhouse2', w: 4, d: 3 },
    { type: 'shed', w: 2, d: 2 },
    { type: 'coop', w: 2, d: 2 },
    { type: 'well' },
    { type: 'pergola', w: 4, d: 3 },
    { type: 'trellis' },
    { type: 'beehive' },
    { type: 'compost' },
    { type: 'raisedBed', w: 2, variant: 'pink' },
    { type: 'raisedBed', w: 2, variant: 'lettuce' },
    { type: 'armchair', color: '#d9a066' },
    { type: 'cafeTable' },
    { type: 'picnic', w: 2 },
  ],
  water: [
    ...v('rock', ['boulder', 'flat', 'mossy', 'cluster']),
    ...v('reeds', ['cattail', 'reedgrass', 'iris', 'rush']),
    { type: 'dock', w: 2 },
    { type: 'rowboat', w: 2 },
    { type: 'lilies' },
    { type: 'birdbath' },
    { type: 'gnome' },
    { type: 'bicycle' },
  ],
  crops: [...['carrot', 'cabbage', 'tomato', 'pumpkin', 'lettuce', 'corn', 'beans', 'herbs', 'wheat', 'wheatGreen'].map((variant) => ({ type: 'crops', variant, w: 2, d: 1 }))],
};

/** Magnified view (integer, nearest) of a few assets, for pixel-level review. */
export async function zoom(name: string, entries: Entry[], scale = 2, cols = 3, cw = 440, ch = 440) {
  const rows = Math.ceil(entries.length / cols);
  const out = document.createElement('canvas');
  out.width = cols * cw * scale;
  out.height = rows * ch * scale;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.fillStyle = '#5c8a3e';
  o.fillRect(0, 0, out.width, out.height);
  entries.forEach((e, i) => {
    const { cv } = renderAsset(e, cw, ch);
    o.drawImage(cv, (i % cols) * cw * scale, Math.floor(i / cols) * ch * scale, cw * scale, ch * scale);
  });
  await post(name, out);
  return [out.width, out.height];
}

/** Animal sheet: every kind × variant × frame, magnified. */
export async function animals(name: string, scale = 4) {
  const A = await import('../render/hd4/animals');
  const rows: [string, number, number][] = [
    ['chicken', 2, 3],
    ['rooster', 1, 2],
    ['duck', 2, 2],
    ['cat', 2, 4],
    ['dog', 1, 3],
    ['sheep', 2, 3],
    ['cow', 1, 3],
    ['frog', 1, 2],
    ['butterfly', 3, 2],
    ['bird', 2, 2],
  ];
  const cells: { cv: HTMLCanvasElement }[][] = [];
  for (const [kind, vars, frames] of rows)
    for (let v = 0; v < vars; v++) {
      const row: { cv: HTMLCanvasElement }[] = [];
      for (let f = 0; f < frames; f++) row.push(A.animalSprite(kind, v, f, true, false));
      row.push(A.animalSprite(kind, v, 0, false, false));
      cells.push(row);
    }
  const cw = 96;
  const ch = 80;
  const out = document.createElement('canvas');
  out.width = 6 * cw * scale;
  out.height = cells.length * ch * scale;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.fillStyle = '#6b9a46';
  o.fillRect(0, 0, out.width, out.height);
  cells.forEach((row, j) => row.forEach((s, i) => o.drawImage(s.cv, i * cw * scale + 4 * scale, j * ch * scale + 4 * scale, s.cv.width * scale, s.cv.height * scale)));
  await post(name, out);
  return [out.width, out.height];
}

/** 64×96 crew sheet: presets × poses (with the 32×48 level of detail at the end). */
export async function people(name: string, idxs: number[], scale = 3) {
  const P = await import('../render/hd4/people');
  const { PRESETS } = await import('../data/presets');
  const { OUTFITS } = await import('../data/outfits');
  const outfits = OUTFITS.filter((o) => o.worldCategory === 'farm').map((o) => o.id);
  const poses: [string, string, number][] = [['se', 'stand', 0], ['sw', 'stand', 0], ['ne', 'stand', 0], ['se', 'walk', 1], ['se', 'work', 0], ['se', 'talk', 1]];
  const cw = 68;
  const ch = 98;
  const out = document.createElement('canvas');
  out.width = (poses.length + 1) * cw * scale;
  out.height = idxs.length * ch * scale;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.fillStyle = '#6b9a46';
  o.fillRect(0, 0, out.width, out.height);
  idxs.forEach((i, r) => {
    const pr = PRESETS[i];
    const look = { profile: pr.profile, outfitId: outfits[i % outfits.length], signature: pr.signature, name: pr.label } as never;
    poses.forEach(([d, m, f], col) => o.drawImage(P.getPerson(look, { dir: d as never, mode: m as never, frame: f }), col * cw * scale, r * ch * scale, 64 * scale, 96 * scale));
    o.drawImage(P.getPerson(look, { dir: 'se', mode: 'stand', frame: 0 }, true), poses.length * cw * scale + 16 * scale, r * ch * scale + 48 * scale, 32 * scale, 48 * scale);
  });
  await post(name, out);
  return [out.width, out.height];
}

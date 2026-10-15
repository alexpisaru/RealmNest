// Dev only: draw props into a PNG sheet with the engine's own CPU raster, no browser.
//
//   npx vite-node tools/sheet.ts <module> <export> <out.png> <spec> [<spec> …]
//
//   <module>  a path from the repo root, e.g. src/render/hd4/packs/office/city_plaza.ts
//   <export>  the Record<string, PropArt> it exports, e.g. CITY_PLAZA
//   <spec>    type[:variant][:w=2][:d=1][:rot=1][:h=60][:seed=3][:color=#rrggbb]
//             h = height in z units (1 z = 4 px at 128×64) to leave room for; default 60
//
// Props are drawn at 128×64 (k = 4) on a grey plaza-like ground with their tile
// footprint outlined, left to right, wrapping at about 2400 px. The order is
// printed. Animations are not drawn (they need a real canvas).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { outlineBuffer, SoftCtx } from '../src/render/hd/soft';
import { Painter, PropPainter } from '../src/render/iso';
import type { WorldTheme } from '../src/domain/world';
import type { PropArt } from '../src/render/props';

const [modPath, exportName, out, ...specs] = process.argv.slice(2).filter((a) => a !== '--');
if (!modPath || !exportName || !out || !specs.length) {
  console.log('usage: npx vite-node tools/sheet.ts <module> <export> <out.png> <type[:variant][:w=2][:d=1][:rot=1][:h=60]> …');
  process.exit(1);
}
const mod = await import(pathToFileURL(resolve(modPath)).href);
const arts = mod[exportName] as Record<string, PropArt>;
if (!arts) throw new Error(`no export ${exportName} in ${modPath}`);
// the Office's theme colours (inlined so the tool doesn't load the worlds, which may be mid-edit)
const theme = { floorA: '#c99a6b', floorB: '#bd8e60', floorDetail: '#a87a50', wall: '#efe3cf', wallTrim: '#8a6a4f', slab: '#6b4a34', accent: '#3fb68b', accent2: '#e2553b', ui: '#f2b98a', sky: ['#2a2140', '#c9785a'] } as unknown as WorldTheme;
const K = 4;
const PAD = 24;

interface Cell {
  w: number;
  h: number;
  data: Uint32Array;
  label: string;
}
const cells: Cell[] = [];
for (const spec of specs) {
  const [type, ...rest] = spec.split(':');
  const o: Record<string, string> = {};
  let variant: string | undefined;
  for (const r of rest) {
    const m = r.match(/^(\w+)=(.*)$/);
    if (m) o[m[1]] = m[2];
    else variant = r;
  }
  const art = arts[type];
  if (!art) {
    console.log(`  ✗ ${spec}: no art "${type}"`);
    continue;
  }
  const w = +(o.w ?? 1);
  const d = +(o.d ?? 1);
  const rot = (+(o.rot ?? 0) ? 1 : 0) as 0 | 1;
  const hz = +(o.h ?? 60);
  const fw = rot ? d : w;
  const fd = rot ? w : d;
  const cw = Math.ceil((fw + fd) * 16 * K + PAD * 2 + hz * 0.6 * K);
  const ch = Math.ceil((fw + fd) * 8 * K + hz * K + PAD * 2);
  const ox = fd * 16 * K + PAD + hz * 0.3 * K;
  const oy = hz * K + PAD;
  const soft = new SoftCtx(cw, ch);
  const c = soft.asContext();
  // ground: a grey paving tone, the footprint outlined
  c.fillStyle = '#8f949b';
  c.fillRect(0, 0, cw, ch);
  const painter = new Painter(c, ox, oy, K);
  const corners = [painter.P(0, 0), painter.P(fw, 0), painter.P(fw, fd), painter.P(0, fd)];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = corners[i];
    const [x1, y1] = corners[(i + 1) % 4];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    c.fillStyle = '#6c7178';
    for (let s = 0; s <= n; s += 1) c.fillRect(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n), 1, 1);
  }
  // the prop on its own layer, outlined if the art asks for it, then over the ground
  const layer = new SoftCtx(cw, ch);
  const lp = new Painter(layer.asContext(), ox, oy, K);
  try {
    art.draw(new PropPainter(lp, 0, 0, w, d, rot), { w, d, variant, color: o.color, th: theme, t: 0, seed: +(o.seed ?? 1) });
  } catch (e) {
    console.log(`  ✗ ${spec}: ${(e as Error).message}`);
    continue;
  }
  if (art.outline) outlineBuffer(layer.data, cw, ch);
  for (let i = 0; i < layer.data.length; i++) {
    const v = layer.data[i];
    const a = v >>> 24;
    if (!a) continue;
    if (a === 255) {
      soft.data[i] = v;
      continue;
    }
    const bg = soft.data[i];
    const mixc = (sh: number) => Math.round((((v >>> sh) & 255) * a + ((bg >>> sh) & 255) * (255 - a)) / 255);
    soft.data[i] = (0xff000000 | (mixc(16) << 16) | (mixc(8) << 8) | mixc(0)) >>> 0;
  }
  cells.push({ w: cw, h: ch, data: soft.data, label: spec });
}

// lay the cells out in rows
const MAXW = 2400;
let x = 0;
let y = 0;
let rowH = 0;
let W = 0;
const placed: [Cell, number, number][] = [];
for (const cell of cells) {
  if (x > 0 && x + cell.w > MAXW) {
    x = 0;
    y += rowH + 8;
    rowH = 0;
  }
  placed.push([cell, x, y]);
  x += cell.w + 8;
  W = Math.max(W, x);
  rowH = Math.max(rowH, cell.h);
}
const H = y + rowH;
const sheet = new Uint32Array(W * H).fill(0xff2a2420);
for (const [cell, cx, cy] of placed) for (let j = 0; j < cell.h; j++) sheet.set(cell.data.subarray(j * cell.w, (j + 1) * cell.w), (cy + j) * W + cx);
placed.forEach(([cell, cx, cy], i) => console.log(`  ${i + 1}. ${cell.label}  @${cx},${cy} ${cell.w}×${cell.h}`));

// PNG (RGBA, no filtering)
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array) => {
  const out2 = new Uint8Array(12 + data.length);
  const dv = new DataView(out2.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out2[4 + i] = type.charCodeAt(i);
  out2.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out2.subarray(4, 8 + data.length)));
  return out2;
};
const raw = new Uint8Array((W * 4 + 1) * H);
const bytes = new Uint8Array(sheet.buffer);
for (let j = 0; j < H; j++) raw.set(bytes.subarray(j * W * 4, (j + 1) * W * 4), j * (W * 4 + 1) + 1);
const ihdr = new Uint8Array(13);
const dv = new DataView(ihdr.buffer);
dv.setUint32(0, W);
dv.setUint32(4, H);
ihdr.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
writeFileSync(out, png);
console.log(`wrote ${out} (${W}×${H})`);

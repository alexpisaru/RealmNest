// Dev only: render a whole world's static scene to a PNG with the engine's CPU raster, no browser.
//
//   npx vite-node tools/scene.ts <world> <out.png> [scale] [x0 y0 x1 y1]
//
//   scale     0.25..1 (default 0.5): box-downsampled, like the app zoomed out
//   x0 … y1   an optional crop in frame px (full scale); omit for the whole frame
//
// It builds the world exactly as the app does (ground, props, walls, colour grade)
// and composites the sprites in the engine's depth order. Animations, animals,
// people, vehicles and night are not drawn. Prints the build time and frame size.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { WORLD_BY_ID } from '../src/data/worlds';
import { WorldRenderer } from '../src/render/worldRenderer';

const args = process.argv.slice(2).filter((a) => a !== '--');
const [id, out] = args;
const scale = +(args[2] ?? 0.5);
const w = WORLD_BY_ID[id];
if (!w || !out) {
  console.log('usage: npx vite-node tools/scene.ts <world> <out.png> [scale] [x0 y0 x1 y1]');
  process.exit(1);
}
type Img = { data?: Uint32Array; w: number; h: number };
type It = { sprite?: Img; sprX?: number; bx0: number; by0: number; bx1: number; by1: number };
const t0 = performance.now();
const r = new WorldRenderer(w) as unknown as { fw: number; fh: number; bg: Img; items: It[] };
const t1 = performance.now();
const { fw, fh } = r;
const buf = new Uint32Array(r.bg.data!);
const over = (dst: number, v: number) => {
  const a = v >>> 24;
  if (!a) return;
  if (a === 255) {
    buf[dst] = v;
    return;
  }
  const b = buf[dst];
  const m = (sh: number) => Math.round((((v >>> sh) & 255) * a + ((b >>> sh) & 255) * (255 - a)) / 255);
  buf[dst] = (0xff000000 | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0;
};
for (const it of r.items) {
  const s = it.sprite;
  if (!s?.data) continue;
  // slices of long props can start at fractional pixels: round like the renderer's drawImage does
  const sx0 = Math.round(it.sprX ?? 0);
  const sw = it.sprX !== undefined ? Math.round(it.bx1 - it.bx0) : s.w;
  const bx0 = Math.round(it.bx0);
  const by0 = Math.round(it.by0);
  for (let y = 0; y < s.h; y++) {
    const fy = by0 + y;
    if (fy < 0 || fy >= fh) continue;
    for (let x = 0; x < sw && sx0 + x < s.w; x++) {
      const fx = bx0 + x;
      if (fx < 0 || fx >= fw) continue;
      over(fy * fw + fx, s.data[y * s.w + sx0 + x]);
    }
  }
}
const [cx0, cy0, cx1, cy1] = args.length >= 7 ? args.slice(3, 7).map(Number) : [0, 0, fw, fh];
const W = Math.max(1, Math.round((cx1 - cx0) * scale));
const H = Math.max(1, Math.round((cy1 - cy0) * scale));
const outBuf = new Uint32Array(W * H);
const step = 1 / scale;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    // box filter over the source pixels this output pixel covers
    let r2 = 0;
    let g2 = 0;
    let b2 = 0;
    let n = 0;
    const sy0 = Math.floor(cy0 + y * step);
    const sx0 = Math.floor(cx0 + x * step);
    for (let j = 0; j < Math.max(1, Math.floor(step)); j++)
      for (let i = 0; i < Math.max(1, Math.floor(step)); i++) {
        const sx = sx0 + i;
        const sy = sy0 + j;
        if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) continue;
        const v = buf[sy * fw + sx];
        r2 += v & 255;
        g2 += (v >>> 8) & 255;
        b2 += (v >>> 16) & 255;
        n++;
      }
    outBuf[y * W + x] = n ? (0xff000000 | (Math.round(b2 / n) << 16) | (Math.round(g2 / n) << 8) | Math.round(r2 / n)) >>> 0 : 0xff201a18;
  }
// PNG (RGBA)
const crcT = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (t: string, d: Uint8Array) => {
  const o = new Uint8Array(12 + d.length);
  const dv = new DataView(o.buffer);
  dv.setUint32(0, d.length);
  for (let i = 0; i < 4; i++) o[4 + i] = t.charCodeAt(i);
  o.set(d, 8);
  dv.setUint32(8 + d.length, crc(o.subarray(4, 8 + d.length)));
  return o;
};
const raw = new Uint8Array((W * 4 + 1) * H);
const bytes = new Uint8Array(outBuf.buffer);
for (let j = 0; j < H; j++) raw.set(bytes.subarray(j * W * 4, (j + 1) * W * 4), j * (W * 4 + 1) + 1);
const ih = new Uint8Array(13);
const dv = new DataView(ih.buffer);
dv.setUint32(0, W);
dv.setUint32(4, H);
ih.set([8, 6, 0, 0, 0], 8);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]));
console.log(`${id}: built in ${Math.round(t1 - t0)} ms, frame ${fw}×${fh}, wrote ${out} (${W}×${H})`);

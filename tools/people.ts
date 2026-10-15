// Dev only: the hand-drawn characters in every direction and pose, to a PNG, no browser.
//
//   npx vite-node tools/people.ts <out.png> [scale]
//
// Rows: the six directions standing, then the walk cycle, work, talk and blink
// in each drawn direction. The last column of each row is the 40×64 level of detail.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { composeTemplate, halveTemplate } from '../src/render/hd4/peopleTemplate';
import type { Pose, PoseMode, SpriteDir } from '../src/render/sprites';

const args = process.argv.slice(2).filter((a) => a !== '--');
const out = args[0];
const S = +(args[1] ?? 4);
if (!out) {
  console.log('usage: npx vite-node tools/people.ts <out.png> [scale]');
  process.exit(1);
}
const rows: Pose[][] = [
  (['s', 'se', 'sw', 'ne', 'nw', 'n'] as SpriteDir[]).map((dir) => ({ dir, mode: 'stand', frame: 0 })),
  ...(['s', 'se', 'ne', 'n'] as SpriteDir[]).map((dir) => [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((frame) => ({ dir, mode: 'walk' as PoseMode, frame })),
    ...[0, 1].map((frame) => ({ dir, mode: 'work' as PoseMode, frame })),
    ...[0, 1].map((frame) => ({ dir, mode: 'talk' as PoseMode, frame })),
    { dir, mode: 'stand' as PoseMode, frame: 0, blink: true },
  ]),
];
const CW = 84;
const CH = 130;
const cols = Math.max(...rows.map((r) => r.length)) + 1;
const W = cols * CW * S;
const H = rows.length * CH * S;
const buf = new Uint32Array(W * H).fill(0xff466e5a);
const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
};
const blit = (g: (string | null)[], gw: number, gh: number, ox: number, oy: number) => {
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const c = g[y * gw + x];
      if (!c) continue;
      const v = hex(c);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) buf[(oy + y * S + j) * W + ox + x * S + i] = v;
    }
};
rows.forEach((r, ri) => {
  r.forEach((pose, ci) => blit(composeTemplate(pose), 80, 128, ci * CW * S, ri * CH * S));
  blit(halveTemplate(composeTemplate(r[0])), 40, 64, r.length * CW * S + 20 * S, ri * CH * S + 64 * S);
});
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
const bytes = new Uint8Array(buf.buffer);
for (let j = 0; j < H; j++) raw.set(bytes.subarray(j * W * 4, (j + 1) * W * 4), j * (W * 4 + 1) + 1);
const ih = new Uint8Array(13);
const dv = new DataView(ih.buffer);
dv.setUint32(0, W);
dv.setUint32(4, H);
ih.set([8, 6, 0, 0, 0], 8);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]));
console.log(`wrote ${out} (${W}×${H})`);

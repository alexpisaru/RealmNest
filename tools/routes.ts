// Dev only: check a world's passers-by routes and vehicle lines against its props and frame.
//   npx vite-node tools/routes.ts <world>
// Reports route points that cross a solid prop (passers-by stray up to 0.25 tile
// to either side) and how much of each route and line lies inside the frame.
import { PROP_META } from '../src/data/props';
import { WORLD_BY_ID } from '../src/data/worlds';
import { sceneMarginPx, tileScale, type PropPlacement } from '../src/domain/world';
import { footprint } from '../src/engine/nav';
import { WorldRenderer } from '../src/render/worldRenderer';

const id = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'office';
const w = WORLD_BY_ID[id];
if (!w) throw new Error('no world ' + id);
const k = tileScale(w);
const ext = sceneMarginPx(k);
const pb = (WorldRenderer as unknown as { playableBox: (w: unknown) => { x0: number; y0: number; x1: number; y1: number } }).playableBox(w);
const even = (n: number) => Math.ceil(n / 2) * 2;
const fw = even(Math.round(pb.x1 - pb.x0 + ext * 2));
const fh = even(Math.round(pb.y1 - pb.y0 + ext * 2));
const ox = even(Math.round(ext - pb.x0));
const oy = even(Math.round(ext - pb.y0));
const P = (x: number, y: number, z = 0) => [(x - y) * 16 * k + ox, ((x + y) * 8 - z) * k + oy];
const inFrame = (x: number, y: number) => {
  const [sx, sy] = P(x, y);
  return sx >= 0 && sx < fw && sy >= 0 && sy < fh;
};
console.log(`${id}: frame ${fw}×${fh}, origin ${ox},${oy}`);

const solids: { p: PropPlacement; x0: number; y0: number; x1: number; y1: number }[] = [];
for (const p of [...w.props, ...w.scene.props]) {
  const m = PROP_META[p.type];
  if (!m || m.flat || m.solid === false) continue;
  const t = footprint(p);
  solids.push({ p, x0: p.x, y0: p.y, x1: Math.max(...t.map((q) => q.x)) + 1, y1: Math.max(...t.map((q) => q.y)) + 1 });
}
const hits = (x: number, y: number, m: number) => solids.filter((s) => x > s.x0 - m && x < s.x1 + m && y > s.y0 - m && y < s.y1 + m);

(w.scene.walkers ?? []).forEach((r, i) => {
  const pts = r.loop ? [...r.path, r.path[0]] : r.path;
  const bad = new Map<string, string>();
  let n = 0;
  let vis = 0;
  for (let j = 0; j + 1 < pts.length; j++) {
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[j + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let d = 0; d <= len; d += 0.2) {
      const x = x0 + ((x1 - x0) * d) / len;
      const y = y0 + ((y1 - y0) * d) / len;
      n++;
      if (inFrame(x, y)) vis++;
      for (const off of [-0.25, 0, 0.25]) for (const s of hits(x + nx * off, y + ny * off, 0.1)) bad.set(s.p.id, `${s.p.type} at ${s.p.x},${s.p.y} (near ${x.toFixed(1)},${y.toFixed(1)})`);
    }
  }
  console.log(`route ${i + 1} (${r.count} walkers): ${Math.round((100 * vis) / n)}% in frame${bad.size ? '; crosses:' : ', clear'}`);
  for (const v of bad.values()) console.log('    ' + v);
});
(w.scene.vehicles ?? []).forEach((v) => {
  const ax = v.axis === 'x';
  const at = (s: number) => [v.x + (ax ? s : 0), v.y + (ax ? 0 : s)];
  const [sx, sy] = at(0);
  const [ex, ey] = at(v.length - v.w);
  const startVis = [0, v.w].some((d) => inFrame(...(at(d) as [number, number])) || inFrame(sx + (ax ? d : 0) + 0.5, sy + 0.5));
  const endVis = [0, v.w].some((d) => inFrame(ex + (ax ? d : 0), ey + (ax ? 0 : d)));
  const bad = new Map<string, string>();
  for (let s = 0; s <= v.length; s += 0.25) {
    const [x, y] = at(s);
    for (const h of hits(x + (ax ? 0 : 0.5), y + (ax ? 0.5 : 0), -0.05)) if (h.p.type !== 'monorotaia' && h.p.type !== v.type) bad.set(h.p.id, `${h.p.type} at ${h.p.x},${h.p.y}`);
  }
  console.log(`vehicle ${v.type}: waits ${startVis || endVis ? 'IN VIEW at ' + (startVis ? 'start ' : '') + (endVis ? 'end' : '') : 'off-frame at both ends'}${bad.size ? '; line crosses:' : ', line clear'}`);
  for (const b of bad.values()) console.log('    ' + b);
});

// Character pipeline: drawing in PhotoCraft the way a pixel artist would, through its MCP server.
//
// Every pixel is placed by PhotoCraft's own tools:
//   fills      select.lasso / select.rect with antiAlias:false, then edit.fill
//   shading    the same, with edit.fill preserveTransparency (Lock Transparency): paint only on the part
//   lines/dots paint.pencil, size 1 (a hard 1-px pencil)
//   outline    the part's silhouette (select.loadSelection transparency, union of its layers), copied
//              four times and moved ±1 px with layer.translate, merged and sent below the part;
//              then erased across joints (select.rect + edit.clear). select.modify.expand is not used:
//              it grows the selection round and anti-aliased (19 soft pixels on a test shape).
// Commands are queued and sent with command_batch, one round trip per drawing step.
import type { Mask } from './hd/mask';
import { McpClient } from './mcp';

export type P = [number, number];
type Step = { id: string; params?: Record<string, unknown> };

export class Painter {
  private q: Step[] = [];
  /** layer name → id, in creation order (back to front) */
  readonly layers = new Map<string, number>();
  constructor(readonly mcp: McpClient) {}

  private push(id: string, params: Record<string, unknown> = {}) {
    this.q.push({ id, params });
  }

  async flush() {
    if (!this.q.length) return [];
    const steps = this.q;
    this.q = [];
    const r = await this.mcp.tool('command_batch', { steps });
    const res = JSON.parse(r.text) as { completed: number; failed: number; results: { ok: boolean; error?: string; result?: unknown }[] };
    if (res.failed) {
      const i = res.results.findIndex((x) => !x.ok);
      throw new Error(`step ${i} ${steps[i]?.id} failed: ${res.results[i]?.error}`);
    }
    return res.results.map((x) => x.result);
  }

  async run<T = unknown>(id: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.flush();
    const r = await this.mcp.tool('command_run', { id, params });
    return (r.text ? JSON.parse(r.text) : null) as T;
  }

  /** A new layer on top of the active one, made active. Names are `part/material`. */
  async layer(name: string): Promise<number> {
    const { layer } = await this.run<{ layer: number }>('layer.new.layer', { name });
    this.layers.set(name, layer);
    return layer;
  }

  async use(name: string) {
    await this.run('layer.select', { layer: this.id(name) });
  }

  id(name: string) {
    const v = this.layers.get(name);
    if (v === undefined) throw new Error(`no layer ${name}`);
    return v;
  }

  /** a filled polygon, hard edges (the lasso closes it) */
  poly(pts: P[], color: string, lock = false) {
    this.push('select.lasso', { points: pts, antiAlias: false });
    this.push('edit.fill', { contents: 'color', color, preserveTransparency: lock });
    this.push('select.deselect');
  }

  rect(x: number, y: number, w: number, h: number, color: string, lock = false) {
    this.push('select.rect', { x, y, width: w, height: h, antiAlias: false });
    this.push('edit.fill', { contents: 'color', color, preserveTransparency: lock });
    this.push('select.deselect');
  }

  /**
   * A mask, exactly: its boundary rings as hard lasso selections (outer rings added, holes
   * subtracted, largest first so islands inside holes come back), then one fill.
   */
  mask(m: Mask, color: string, lock = false) {
    const rings = m.rings();
    if (!rings.length) return;
    const area = (r: P[]) => r.reduce((a, p, i) => a + (p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1]), 0) / 2;
    const sorted = rings.map((r) => ({ r, a: area(r) })).sort((x, y) => Math.abs(y.a) - Math.abs(x.a));
    const outerSign = Math.sign(sorted[0].a);
    sorted.forEach(({ r, a }, i) => this.push('select.lasso', { points: r, antiAlias: false, mode: i === 0 ? 'replace' : Math.sign(a) === outerSign ? 'add' : 'subtract' }));
    this.push('edit.fill', { contents: 'color', color, preserveTransparency: lock });
    this.push('select.deselect');
  }

  /** shading: paint only where the layer already has pixels */
  shade(pts: P[], color: string) {
    this.poly(pts, color, true);
  }

  shadeRect(x: number, y: number, w: number, h: number, color: string) {
    this.rect(x, y, w, h, color, true);
  }

  /** a 1-px pencil line through the points */
  line(pts: P[], color: string) {
    this.push('paint.pencil', { points: pts, size: 1, color });
  }

  /** single pixels */
  dots(pts: P[], color: string) {
    for (const p of pts) this.push('paint.pencil', { points: [p], size: 1, color });
  }

  /** erase a mask's pixels on the active layer */
  eraseMask(m: Mask) {
    const rings = m.rings();
    if (!rings.length) return;
    const area = (r: P[]) => r.reduce((a, p, i) => a + (p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1]), 0) / 2;
    const sorted = rings.map((r) => ({ r, a: area(r) })).sort((x, y) => Math.abs(y.a) - Math.abs(x.a));
    const outerSign = Math.sign(sorted[0].a);
    sorted.forEach(({ r, a }, i) => this.push('select.lasso', { points: r, antiAlias: false, mode: i === 0 ? 'replace' : Math.sign(a) === outerSign ? 'add' : 'subtract' }));
    this.push('edit.clear');
    this.push('select.deselect');
  }

  /** erase a rectangle on the active layer */
  erase(x: number, y: number, w: number, h: number) {
    this.push('select.rect', { x, y, width: w, height: h, antiAlias: false });
    this.push('edit.clear');
    this.push('select.deselect');
  }

  /**
   * Outline a part: a 1-px, 4-neighbour outline around the union of its layers, on its own layer
   * (`<part>/outline`) below the part, with `seams` (joint bands) erased.
   */
  async outline(part: string, color: string, seams: [number, number, number, number][] = []) {
    const own = [...this.layers.entries()].filter(([n]) => n.startsWith(`${part}/`) && !/\/outline\d*$/.test(n));
    if (!own.length) throw new Error(`outline: no layers for ${part}`);
    own.forEach(([, id], i) => this.push('select.loadSelection', { channel: 'transparency', layer: id, operation: i ? 'add' : 'new' }));
    await this.flush();
    const sil = await this.layer(`${part}/outline`);
    this.push('edit.fill', { contents: 'color', color });
    this.push('select.deselect');
    await this.flush();
    const copies: number[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const { layer } = await this.run<{ layer: number }>('layer.duplicate', { layer: sil });
      await this.run('layer.translate', { layer, dx, dy });
      copies.push(layer);
    }
    // each copy landed right above the silhouette: merge the nearest first
    for (const c of copies.reverse()) await this.run('layer.mergeDown', { layer: c });
    // below the part's lowest layer in the document's actual stack (top to bottom)
    const stack = await this.stack();
    const ownIds = new Set(own.map(([, id]) => id));
    const lowest = [...stack].reverse().find((l) => ownIds.has(l))!;
    await this.run('layer.moveTo', { layer: sil, target: lowest, position: 'below' });
    await this.run('layer.select', { layer: sil });
    for (const [x, y, w, h] of seams) this.erase(x, y, w, h);
    await this.flush();
    return sil;
  }

  /**
   * A multi-ring outline (the HD style: two near-black rings and a brown halo): each ring is the
   * previous silhouette grown by 1 px and sent below it; all rings are erased across the joints.
   */
  async outlineRings(part: string, colors: string[], seams: ([number, number, number, number] | Mask)[] = []) {
    const rects = seams.filter((x): x is [number, number, number, number] => Array.isArray(x));
    const masks = seams.filter((x): x is Mask => !Array.isArray(x));
    const first = await this.outline(part, colors[0], rects);
    if (masks.length) {
      await this.run('layer.select', { layer: first });
      for (const m of masks) this.eraseMask(m);
      await this.flush();
    }
    let cur = first;
    for (const [i, color] of colors.slice(1).entries()) {
      const { layer } = await this.run<{ layer: number }>('layer.duplicate', { layer: cur });
      await this.run('layer.select', { layer });
      this.push('edit.fill', { contents: 'color', color, preserveTransparency: true });
      await this.flush();
      const copies: number[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = await this.run<{ layer: number }>('layer.duplicate', { layer });
        await this.run('layer.translate', { layer: c.layer, dx, dy });
        copies.push(c.layer);
      }
      for (const c of copies.reverse()) await this.run('layer.mergeDown', { layer: c });
      await this.run('layer.moveTo', { layer, target: cur, position: 'below' });
      await this.run('layer.select', { layer });
      for (const [x, y, w, h] of rects) this.erase(x, y, w, h);
      for (const m of masks) this.eraseMask(m);
      await this.flush();
      this.layers.set(`${part}/outline${i + 2}`, layer);
      cur = layer;
    }
    return first;
  }

  /** layer ids, top to bottom */
  async stack(): Promise<number[]> {
    await this.flush();
    const doc = JSON.parse((await this.mcp.tool('doc_inspect')).text) as { layers: { id: number }[] };
    return doc.layers.map((l) => l.id);
  }

  async remove(name: string) {
    await this.run('layer.delete', { layer: this.id(name) });
    this.layers.delete(name);
  }

  /**
   * Redraws a layer in place: the new pixels go on a fresh layer right above the old one,
   * then the old one is deleted, so the stacking order is kept.
   */
  async replace(name: string, draw: () => void) {
    const old = this.id(name);
    await this.run('layer.select', { layer: old });
    this.layers.delete(name);
    await this.layer(name);
    draw();
    await this.flush();
    await this.run('layer.delete', { layer: old });
  }

  /** shows only the layers whose names start with one of the prefixes */
  async showOnly(prefixes: string[] | null) {
    for (const [name, id] of this.layers) this.push('layer.setProps', { layer: id, visible: !prefixes || prefixes.some((p) => name.startsWith(p)) });
    await this.flush();
  }
}

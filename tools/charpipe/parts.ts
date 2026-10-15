// Character pipeline prototype, step 1: cut a rest-pose sprite into the rig's parts.
//
// One full rest-pose sprite per outfit is the only drawing an artist makes. The cut
// (rects per part), the overlaps and the hidden-pixel fills live in character.json and
// are the same for every outfit of that character, so a new outfit is a new sprite (or,
// here, a recolour of the shipped one) and nothing else.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, blit, clone, hex, opaque, px, readPng, scale2x, setPx, writePng, type Img } from './img';
import { artJoints, charDir, specEntries, type CharacterSpec, type Rect, type Rig } from './spec';

const inRect = (x: number, y: number, [x0, y0, x1, y1]: Rect) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

export function recolour(src: Img, map: Record<string, string> | undefined): Img {
  if (!map) return src;
  const m = new Map(Object.entries(map).map(([a, b]) => [hex(a), hex(b)]));
  const out = clone(src);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = px(src, x, y);
      const to = c && m.get(opaque(c));
      if (to) setPx(out, x, y, to);
    }
  return out;
}

/** The parts of one rest-pose sprite, each a full-frame transparent image. */
export function cutParts(rig: Rig, ch: CharacterSpec, sprite: Img): Map<string, Img> {
  const parts = new Map(artJoints(rig).map((j) => [j, blank(sprite.w, sprite.h)]));
  const cut = ch.cut!;
  const owner = (x: number, y: number) => cut.order.find((p) => cut.rects[p].some((r) => inRect(x, y, r))) ?? cut.rest;
  for (let y = 0; y < sprite.h; y++)
    for (let x = 0; x < sprite.w; x++) {
      const c = px(sprite, x, y);
      if (c) setPx(parts.get(owner(x, y))!, x, y, c);
    }
  for (const [part, rects] of specEntries(ch.overlap ?? {}))
    for (const r of rects)
      for (let y = r[1]; y <= r[3]; y++)
        for (let x = r[0]; x <= r[2]; x++) {
          const c = px(sprite, x, y);
          const p = parts.get(part)!;
          if (c && !px(p, x, y)) setPx(p, x, y, c);
        }
  for (const [part, fills] of specEntries(ch.fill ?? {})) {
    const p = parts.get(part)!;
    for (const { rect: [x0, y0, x1, y1], from, outline } of fills)
      for (let y = y0; y <= y1; y++) {
        // the part's first pixel just inside the filled span: its colour carries across
        const step = from === 'right' ? 1 : -1;
        let x = from === 'right' ? x1 + 1 : x0 - 1;
        while (x >= 0 && x < p.w && !px(p, x, y)) x += step;
        // skip the part's own outline to reach its fill colour
        const inner = px(p, x + step, y) || px(p, x, y);
        if (!inner) continue;
        let any = false;
        // only under something: where the source is empty there is nothing hidden to draw
        for (let fx = x0; fx <= x1; fx++)
          if (!px(p, fx, y) && px(sprite, fx, y)) {
            setPx(p, fx, y, inner);
            any = true;
          }
        if (any && outline && px(sprite, from === 'right' ? x0 : x1, y)) setPx(p, from === 'right' ? x0 : x1, y, hex(outline));
      }
  }
  return parts;
}

export function enlarge8(im: Img): Img {
  return scale2x(scale2x(scale2x(im)));
}

export interface PreparedVariant {
  variant: string;
  /** part id → png path, at 1× and at 8× (Scale2x three times) */
  parts1: Record<string, string>;
  /** layered characters: the parts that differ from the default outfit's (what an outfit swap replaces) */
  changed?: string[];
  parts8: Record<string, string>;
  accessories1: Record<string, string>;
  accessories8: Record<string, string>;
}

/** Writes parts/<variant>/<part>.png into the character's build folder, plus their 8× copies. */
export function prepare(rig: Rig, ch: CharacterSpec, buildDir: string): PreparedVariant[] {
  const dir = charDir(ch.id);
  const source = ch.layers ? null : readPng(join(dir, ch.source.file));
  const out: PreparedVariant[] = [];
  const acc1: Record<string, string> = {};
  const acc8: Record<string, string> = {};
  for (const [id, a] of Object.entries(ch.accessories)) {
    const f = join(dir, a.file);
    if (!existsSync(f)) throw new Error(`accessory ${id}: ${f} is missing`);
    const src = readPng(f);
    const im = blank(src.w, src.h);
    blit(im, src, a.offset?.[0] ?? 0, a.offset?.[1] ?? 0);
    acc1[id] = join(buildDir, 'parts', 'accessories', `${id}.png`);
    acc8[id] = join(buildDir, 'parts8', 'accessories', `${id}.png`);
    writePng(acc1[id], im);
    writePng(acc8[id], enlarge8(im));
  }
  const first = Object.keys(ch.variants)[0];
  for (const [variant, v] of Object.entries(ch.variants)) {
    let sprite: Img;
    let parts: Map<string, Img>;
    let changed: string[] | undefined;
    if (ch.layers) {
      // layered: the parts come drawn (parts/<variant>/<layer>.png); the sprite is their stack
      parts = new Map(ch.layers.map((l) => [l.id, readPng(join(dir, 'parts', variant, `${l.id}.png`))]));
      sprite = blank(rig.frame.w, rig.frame.h);
      for (const im of parts.values()) blit(sprite, im, 0, 0);
      if (variant !== first)
        changed = ch.layers.map((l) => l.id).filter((id) => !readFileSync(join(dir, 'parts', variant, `${id}.png`)).equals(readFileSync(join(dir, 'parts', first, `${id}.png`))));
    } else {
      sprite = recolour(source!, v.recolor);
      parts = cutParts(rig, ch, sprite);
    }
    const p1: Record<string, string> = {};
    const p8: Record<string, string> = {};
    for (const [id, im] of parts) {
      p1[id] = join(buildDir, 'parts', variant, `${id}.png`);
      p8[id] = join(buildDir, 'parts8', variant, `${id}.png`);
      writePng(p1[id], im);
      writePng(p8[id], enlarge8(im));
    }
    writePng(join(buildDir, 'parts', variant, '_sprite.png'), sprite);
    out.push({ variant, parts1: p1, parts8: p8, changed, accessories1: acc1, accessories8: acc8 });
  }
  return out;
}

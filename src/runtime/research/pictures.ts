// Report pictures: the preview pictures (og:image) of the pages a run read, the way a reader
// expects them — a cover from the source the report leans on most, and in a section the picture of
// the source that section cites most. RealmNest fetches them through the Web layer (raster only,
// size-capped), re-encodes them (no metadata, nothing active), keeps them in its file store and
// shows them from there: opening a report never contacts the sites again.

import type { ResearchRun } from '../../domain/research';
import type { FileStore } from '../files/store';
import { citedLabels } from '../knowledge/grounding';
import type { WebService } from '../web/service';

export interface Picture {
  /** "hero" or "s<section index>" */
  slot: string;
  ref: string;
  sourceId: string;
  w?: number;
  h?: number;
}

export interface PictureLayout {
  hero?: Picture;
  /** one place per report section (undefined: no picture there) */
  sections: (Picture | undefined)[];
  /** kept pictures not shown: what "another picture" picks from */
  spare: { ref: string; sourceId: string }[];
  /** pictures the user hid (and places emptied) */
  hidden: number;
}

/** where each picture goes; the user's choices (`run.pictures`) win over the defaults */
export function pictureLayout(run: ResearchRun): PictureLayout {
  const r = run.report;
  const out: PictureLayout = { sections: [], spare: [], hidden: 0 };
  if (!r) return out;
  // how often each source is cited: in the whole report, and in each section
  const total = new Map<string, number>();
  const count = (texts: string[], into: Map<string, number>) => {
    for (const t of texts) for (const l of citedLabels(t)) into.set(l, (into.get(l) ?? 0) + 1);
  };
  count([r.summary, ...r.keyFindings, ...r.sections.flatMap((s) => s.paragraphs), ...r.timeline.map((e) => e.event), ...(r.verdict ? [r.verdict.text] : [])], total);
  const perSection = r.sections.map((s) => {
    const m = new Map<string, number>();
    count(s.paragraphs, m);
    return m;
  });
  // one candidate per picture (the same picture on two pages: the more cited page)
  const byRef = new Map<string, { ref: string; sourceId: string; w?: number; h?: number }>();
  const hidden = new Set(run.picturesHidden ?? []);
  for (const s of run.sources) {
    const ref = s.image?.ref;
    if (!ref || hidden.has(s.id)) continue;
    const prev = byRef.get(ref);
    if (!prev || (total.get(s.id) ?? 0) > (total.get(prev.sourceId) ?? 0)) byRef.set(ref, { ref, sourceId: s.id, ...(s.image!.w && { w: s.image!.w }), ...(s.image!.h && { h: s.image!.h }) });
  }
  const candidates = [...byRef.values()].sort((a, b) => (total.get(b.sourceId) ?? 0) - (total.get(a.sourceId) ?? 0));
  const used = new Set<string>();
  const choice = run.pictures ?? {};
  const place = (slot: string, pick: (typeof candidates)[number] | undefined): Picture | undefined => {
    if (!pick) return undefined;
    used.add(pick.ref);
    return { slot, ...pick };
  };
  /** the user's choice for a place: undefined (none made), null (emptied) or a picture */
  const chosen = (slot: string) => {
    if (!(slot in choice)) return undefined;
    const id = choice[slot];
    if (id === null) return null;
    const c = candidates.find((x) => x.sourceId === id) ?? (run.sources.find((s) => s.id === id)?.image?.ref ? { ref: run.sources.find((s) => s.id === id)!.image!.ref!, sourceId: id } : undefined);
    return c && !used.has(c.ref) ? c : undefined;
  };
  const hero = chosen('hero');
  if (hero === null) out.hidden++;
  else out.hero = place('hero', hero ?? candidates.find((c) => (total.get(c.sourceId) ?? 0) > 0 && !used.has(c.ref)));
  let previous = false;
  r.sections.forEach((_, i) => {
    const slot = `s${i}`;
    const c = chosen(slot);
    if (c === null) {
      out.hidden++;
      out.sections.push(undefined);
      previous = false;
      return;
    }
    if (c) {
      out.sections.push(place(slot, c));
      previous = true;
      return;
    }
    // by default: the section's most cited source that has a picture, never two sections in a row
    const cites = perSection[i];
    const best = previous
      ? undefined
      : candidates
          .filter((x) => !used.has(x.ref) && (cites.get(x.sourceId) ?? 0) > 0)
          .sort((a, b) => (cites.get(b.sourceId) ?? 0) - (cites.get(a.sourceId) ?? 0) || (total.get(b.sourceId) ?? 0) - (total.get(a.sourceId) ?? 0))[0];
    out.sections.push(place(slot, best));
    previous = !!best;
  });
  out.hidden = Math.max(out.hidden, hidden.size);
  out.spare = candidates.filter((c) => !used.has(c.ref)).map(({ ref, sourceId }) => ({ ref, sourceId }));
  return out;
}

/** every picture the layout shows */
export function shownPictures(l: PictureLayout): Picture[] {
  return [l.hero, ...l.sections].filter((p): p is Picture => !!p);
}

/** keeps a preview picture: fetched by the Web layer, decoded, refused when it is an icon, a logo
 *  or a strip (a preview is landscape and large), shrunk to 1200 px and re-encoded as WebP */
export function pictureKeeper(web: WebService, files: FileStore) {
  return async (url: string, runId: string) => {
    const { mime, bytes } = await web.fetchImage(url, runId);
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    try {
      const { width: w, height: h } = bmp;
      if (w < 360 || h < 180 || w / h < 1.1 || w / h > 3.2) return undefined;
      const scale = Math.min(1, 1200 / w);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = new OffscreenCanvas(cw, ch);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, cw, ch);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
      const stored = await files.put(new Uint8Array(await blob.arrayBuffer()));
      return { ref: stored.storageRef, w: cw, h: ch };
    } finally {
      bmp.close();
    }
  };
}

/** the shown pictures as data: addresses (the HTML export carries them inside the page) */
export async function pictureData(run: ResearchRun, files: FileStore): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const p of shownPictures(pictureLayout(run))) {
    if (out.has(p.ref)) continue;
    try {
      const b = await files.get(p.ref);
      let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      out.set(p.ref, `data:image/webp;base64,${btoa(bin)}`);
    } catch {
      /* a missing file: no picture */
    }
  }
  return out;
}

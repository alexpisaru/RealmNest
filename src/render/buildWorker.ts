// A build worker: builds a world's scene (ground, props, walls — all CPU raster)
// off the main thread and sends the pixels back as transferable buffers.
import { WORLD_BY_ID } from '../data/worlds';
import { WorldRenderer } from './worldRenderer';

self.onmessage = (e: MessageEvent<{ id: string }>) => {
  const w = WORLD_BY_ID[e.data.id];
  try {
    const { payload, transfer } = new WorldRenderer(w).exportPayload();
    (self as unknown as Worker).postMessage({ id: w.id, payload }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: w.id, error: String((err as Error)?.stack ?? err) });
  }
};

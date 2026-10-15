// The agents as a picture for Telegram (docs/TELEGRAM.md): each one's pixel-art bust, name and
// role on a card, a few cards a row, sent with the buttons to pick one (buttons cannot hold images).

import type { Look } from '../../render/sprites';
import { getSprite, SPRITE_W } from '../../render/sprites';
import { castBox, castReady, getCastFrame } from '../../render/cast/castPeople';

export interface SheetAgent {
  name: string;
  role?: string;
  look: Look;
}

const CELL_W = 168;
const CELL_H = 196;
const GAP = 12;
const PAD = 18;
const ART_H = 120;
const BUST_H = 21;

/** a bust at 1:1 (the Cast art when it is loaded, else the classic sprite) */
function bust(look: Look): HTMLCanvasElement | null {
  if (castReady()) {
    const box = castBox(look, true);
    const fr = box ? getCastFrame(look, 'idle', 0, false) : null;
    if (box && fr) {
      const cv = document.createElement('canvas');
      cv.width = box.w;
      cv.height = box.h;
      cv.getContext('2d')!.drawImage(fr, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      return cv;
    }
  }
  const s = getSprite(look, { dir: 's', mode: 'stand', frame: 0, blink: false });
  const cv = document.createElement('canvas');
  cv.width = SPRITE_W;
  cv.height = BUST_H;
  cv.getContext('2d')!.drawImage(s, 0, 0, SPRITE_W, BUST_H, 0, 0, SPRITE_W, BUST_H);
  return cv;
}

function fit(c: CanvasRenderingContext2D, text: string, max: number) {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** the PNG bytes of the sheet, or undefined when there is nothing to draw */
export async function agentSheet(agents: SheetAgent[]): Promise<Uint8Array | undefined> {
  const list = agents.slice(0, 24);
  if (!list.length) return undefined;
  const cols = Math.min(4, list.length);
  const rows = Math.ceil(list.length / cols);
  const cv = document.createElement('canvas');
  cv.width = PAD * 2 + cols * CELL_W + (cols - 1) * GAP;
  cv.height = PAD * 2 + rows * CELL_H + (rows - 1) * GAP;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#161814';
  c.fillRect(0, 0, cv.width, cv.height);
  list.forEach((a, i) => {
    const x = PAD + (i % cols) * (CELL_W + GAP);
    const y = PAD + Math.floor(i / cols) * (CELL_H + GAP);
    // the card
    c.fillStyle = '#22261f';
    c.beginPath();
    c.roundRect(x, y, CELL_W, CELL_H, 14);
    c.fill();
    c.fillStyle = '#2c3128';
    c.beginPath();
    c.roundRect(x + 10, y + 10, CELL_W - 20, ART_H + 6, 10);
    c.fill();
    // the bust, scaled up with crisp pixels
    const b = bust(a.look);
    if (b) {
      const k = Math.min((ART_H - 4) / b.height, (CELL_W - 28) / b.width);
      const w = Math.round(b.width * k);
      const h = Math.round(b.height * k);
      c.imageSmoothingEnabled = false;
      c.drawImage(b, x + (CELL_W - w) / 2, y + 13 + (ART_H - h), w, h);
    }
    // name and role
    c.textAlign = 'center';
    c.fillStyle = '#ece9df';
    c.font = '600 17px "Segoe UI", system-ui, sans-serif';
    c.fillText(fit(c, a.name, CELL_W - 16), x + CELL_W / 2, y + ART_H + 42);
    if (a.role) {
      c.fillStyle = '#a3a898';
      c.font = '13px "Segoe UI", system-ui, sans-serif';
      c.fillText(fit(c, a.role, CELL_W - 16), x + CELL_W / 2, y + ART_H + 62);
    }
  });
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
}

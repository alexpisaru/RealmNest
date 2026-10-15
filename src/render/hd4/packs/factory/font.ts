// Factory pack — a 3×5 pixel font for stencils, signs and painted lettering.
// Text is drawn in screen space and sheared along an iso face (2:1 slope), so
// "FIRE POINT" on a wall or "ALBION WORKS" across a gable sits on its plane.
import type { C } from '../../kit4';
import type { Plane } from '../../plane4';

const G: Record<string, string> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '-': '000000111000000',
  '.': '000000000000010',
  '!': '010010010000010',
  '/': '001001010100100',
  '+': '000010111010000',
  ' ': '000000000000000',
};

/** Width of a string in font pixels (3 per glyph + 1 spacing). */
export const textWidth = (s: string) => Math.max(0, s.length * 4 - 1);

/**
 * Draw text with its top-left at screen (x, y): `s` screen px per font pixel,
 * `slope` the vertical shift per horizontal px (0.5 on +y faces, −0.5 on +x faces).
 */
export function text(c: C, x: number, y: number, str: string, col: string, s = 1, slope = 0) {
  c.fillStyle = col;
  let cx = 0;
  for (const ch of str.toUpperCase()) {
    const g = G[ch] ?? G[' '];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++) {
        if (g[j * 3 + i] !== '1') continue;
        const px0 = (cx + i) * s;
        c.fillRect(Math.round(x + px0), Math.round(y + j * s + px0 * slope), s, s);
      }
    cx += 4;
  }
}

/**
 * Text on a vertical plane, centred on (u, z) (z = the text's vertical centre).
 * `s` px per font pixel. Reads left to right on screen whatever the face.
 */
export function planeText(c: C, pl: Plane, u: number, z: number, str: string, col: string, s = 1) {
  const [x0, y0] = pl.F(u, z);
  const [x1, y1] = pl.F(u + 0.25, z);
  const slope = (y1 - y0) / (x1 - x0 || 1);
  const w = textWidth(str) * s;
  const h = 5 * s;
  const sx = x0 - w / 2;
  const sy = y0 - h / 2 - (w / 2) * slope;
  text(c, sx, sy, str, col, s, slope);
}

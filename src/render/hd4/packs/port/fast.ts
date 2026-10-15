// Logistics Port — fast noise for the ground shaders (17 Mpx per bake): a
// precomputed lattice with smooth interpolation, a few times cheaper than
// the generic value noise. Values 0 … 1; the lattice repeats every 256.
import { h2 } from '../../../materials';

const N = 256;
const M = N - 1;
const LAT = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) LAT[j * N + i] = h2(i, j, 7771);

/** Smooth value noise; `s` picks an independent field (offsets the lattice). */
export function fn(x: number, y: number, s = 0): number {
  x += s * 37.13;
  y += s * 91.71;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const i0 = xi & M;
  const j0 = (yi & M) * N;
  const i1 = (i0 + 1) & M;
  const j1 = ((yi + 1) & M) * N;
  const a = LAT[j0 + i0];
  const b = LAT[j0 + i1];
  const c = LAT[j1 + i0];
  const d = LAT[j1 + i1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Cheap integer hash 0 … 1 (same quality as h2, inlined maths). */
export function hh(a: number, b: number, s = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Research Hub — the observatory on the summit (1 z ≈ 10 cm; a tile ≈ 16 z).
//   res_dome     variants: 'open' (the old granite drum, its slit open and the
//                telescope looking out, a catwalk round it), 'shut' (a white
//                rendered drum, the shutter closed), 'small' (an aluminium dome
//                on a concrete hut)
//   res_dish     a radio telescope: a white paraboloid on an alt-azimuth mount
//   res_weather  the weather station: lattice mast, anemometer, Stevenson screen
//   res_solar    a rack of solar panels
//   res_hut      a timber instrument hut with a stone base
// Domes and dishes are shaded per pixel from their real surface normals.
import { darken } from '../../../color';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, curve, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { cutStone4, glass4 } from '../../materials4';
import { front, front3, poly3, pq, pt, side, side3 } from '../../plane4';
import { grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { cylinder, lightOf, logs, piode, plot, rubble, sphere, toneOf } from './kit';
import { CONCRETE, DOME, GNEISS, IRONK, LARCHF, MORTAR, PIODE, RED, STEEL, TIMBER } from './palette';

const GRANITE: Ramp = ['#4a4a4e', '#5e5e62', '#747476', '#8a8a8a', '#a09e9a', '#b6b2ac', '#cac6be'];
const RENDER: Ramp = ['#7e7c78', '#9a9792', '#b4b0aa', '#cac6be', '#dcd8d0', '#ece8e0', '#f8f6f0'];
const ALU: Ramp = ['#5a6068', '#767c86', '#949aa4', '#b2b8c0', '#ced2d8', '#e6e8ec', '#f8f9fa'];

/** Screen offset of a 3D vector (tiles, tiles, tile-heights) at scale k. */
const proj = (k: number, dx: number, dy: number, dz: number): [number, number] => [(dx - dy) * 16 * k, (dx + dy) * 8 * k - dz * 16 * k];

// ── the domes ───────────────────────────────────────────────
function domeArt(p: PropPainter, k: PropCtx) {
  const v = k.variant ?? 'open';
  const W = k.w;
  const K = p.k;
  const cxT = W / 2;
  const small = v === 'small';
  const open = v === 'open';
  const R = small ? 0.95 : W / 2 - 0.45;
  const Hd = small ? 0 : open ? 24 : 20;
  const baseZ = small ? 13 : 0;
  footShadow(p, 0.2, 0.2, W - 0.2, W - 0.2, Hd + 30, 0.3);
  const [cx, cy] = anchor(p, cxT, cxT, 0);
  // a ring of gravel and a worn path at the foot
  if (small) {
    // a square concrete hut under the small dome, a steel door, a vent
    const c = paint(CONCRETE);
    lbox(p, cxT - 1.05, cxT - 1.05, 2.1, 2.1, 0, baseZ, { front: c, side: c, top: paint(CONCRETE), edge: CONCRETE[0] });
    const F = front(p, cxT + 1.05);
    const S = side(p, cxT + 1.05);
    pq(p, F, cxT - 0.3, cxT + 0.3, 0, 9.6, '#3a4248');
    pq(p, F, cxT - 0.26, cxT + 0.26, 0, 9.2, '#5a6870');
    pq(p, F, cxT - 0.26, cxT + 0.26, 4.4, 4.7, '#3a4248');
    pq(p, S, cxT - 0.4, cxT + 0.4, 6, 9, '#3a4248');
    for (let i = 0; i < 5; i++) pq(p, S, cxT - 0.36, cxT + 0.36, 6.3 + i * 0.55, 6.5 + i * 0.55, '#7a8288');
    pq(p, F, cxT - 0.9, cxT + 0.9, baseZ - 0.6, baseZ, CONCRETE[1]);
  }
  // the drum
  const zTop = baseZ + Hd;
  if (!small) {
    const stone = open;
    cylinder(p.c, K, cx, cy, R, 0, Hd, (nx, ny, ang, z, x, y) => {
      const l = lightOf(nx, ny, 0);
      // a door on the lit side, toward the viewer
      if (ang > 0.52 && ang < 0.78 && z < 9.4) {
        if (z > 9 || ang < 0.54 || ang > 0.76) return '#2a2c30';
        const t = toneOf(['#24382e', '#2e4a3c', '#3a5c4a', '#4a6e5a', '#5e8270'], l, x, y, 0.3, 0.7);
        if (Math.abs(z - 4.8) < 0.25) return '#1e2a24';
        return ['#24382e', '#2e4a3c', '#3a5c4a', '#4a6e5a', '#5e8270'][t];
      }
      // a small barred window higher up
      if (ang > 1.1 && ang < 1.24 && z > 12 && z < 17) return Math.abs(ang - 1.17) < 0.012 ? '#3a3a40' : '#1e2630';
      if (stone) {
        // cut granite courses, slightly rough
        const row = Math.floor(z / 3);
        const off = row & 1 ? 0.09 : 0;
        const col = Math.floor((ang + off) / 0.18);
        const fz = z - row * 3;
        const fa = (ang + off) - col * 0.18;
        if (fz < 0.4 || fa < 0.012) return GRANITE[1];
        let t = toneOf(GRANITE, l, x, y, 0.28, 0.72) + (hash(col, row, 7) < 0.3 ? -1 : 0);
        if (fz > 2.5) t += 1;
        if (hash(x, y, 8) < 0.06) t -= 1;
        if (z < 6 && hash(x >> 1, y, 9) < (6 - z) * 0.05) t -= 1;
        return GRANITE[Math.max(0, Math.min(6, t))];
      }
      // white render with a grey plinth and rust streaks under the rail
      if (z < 2.4) return CONCRETE[Math.max(0, Math.min(5, toneOf(CONCRETE, l, x, y, 0.3, 0.7) - 1))];
      let t = toneOf(RENDER, l, x, y, 0.3, 0.72);
      if (z > Hd - 6 && hash(Math.floor(ang * 40), 1, 3) < 0.15 && hash(x, y, 4) < 0.6) t -= 1;
      if (hash(x, y, 5) < 0.03) t -= 1;
      return RENDER[Math.max(0, t)];
    });
    // the cornice ring the dome turns on
    cylinder(p.c, K, cx, cy, R + 0.06, Hd - 1.2, Hd, (nx, ny, _a, z, x, y) => {
      const l = lightOf(nx, ny, 0);
      return z > Hd - 0.35 ? '#e8e6e0' : (stone ? GRANITE : RENDER)[Math.min(6, toneOf(stone ? GRANITE : RENDER, l, x, y, 0.35, 0.7) + 1)];
    });
  }
  // the catwalk round the big dome: a grating deck ring, then the railing's back half
  const railR = R + 0.26;
  const RH = 9;
  const ringPt = (ang: number, rr: number, z: number): [number, number] => {
    const [ox, oy] = proj(K, Math.cos(ang) * rr, Math.sin(ang) * rr, 0);
    return [cx + ox, cy + oy - z * K];
  };
  const rail = (frontHalf: boolean) => {
    if (!open) return;
    const n = 72;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const am2 = (a0 + a1) / 2;
      const fr = Math.cos(am2) + Math.sin(am2) > -0.15;
      if (fr !== frontHalf) continue;
      const lit = Math.sin(am2) > Math.cos(am2) - 0.2;
      const t0 = ringPt(a0, railR, zTop + RH);
      const t1 = ringPt(a1, railR, zTop + RH);
      const m0 = ringPt(a0, railR, zTop + RH / 2);
      const m1 = ringPt(a1, railR, zTop + RH / 2);
      ln(p.c, t0[0], t0[1], t1[0], t1[1], fr ? (lit ? IRONK[5] : IRONK[3]) : IRONK[2], 2);
      ln(p.c, m0[0], m0[1], m1[0], m1[1], fr ? IRONK[3] : IRONK[1]);
      if (i % 4 === 0) {
        const b0 = ringPt(a0, railR, zTop);
        ln(p.c, b0[0], b0[1], t0[0], t0[1], fr ? IRONK[4] : IRONK[2]);
      }
    }
  };
  if (open) {
    const n = 72;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const q = [ringPt(a0, R - 0.02, zTop), ringPt(a1, R - 0.02, zTop), ringPt(a1, railR, zTop), ringPt(a0, railR, zTop)];
      fillPoly(p.c, q, i % 2 ? '#4a4e56' : '#5a5e66');
      const e0 = ringPt(a0, railR, zTop);
      const e1 = ringPt(a1, railR, zTop);
      ln(p.c, e0[0], e0[1] + 1, e1[0], e1[1] + 1, '#2e3036', 2);
    }
  }
  rail(false);
  // the dome: white panels, seams, rivets, a slit
  const domeR = small ? R : R + 0.04;
  const slitAz = small ? 1.05 : open ? 1.05 : 0.95;
  const slitW = small ? 0.12 : open ? 0.23 : 0.17;
  const ramp: Ramp = small ? ALU : DOME;
  const dcy = cy - zTop * K;
  // telescope geometry (open dome): pivot, direction, length
  const tubeEl = 1.0;
  const td: [number, number, number] = [Math.cos(tubeEl) * Math.cos(slitAz), Math.cos(tubeEl) * Math.sin(slitAz), Math.sin(tubeEl)];
  const pz = 0.3;
  const back = -domeR * 0.42;
  const tl = domeR * 0.9;
  const pv = proj(K, td[0] * back, td[1] * back, pz + td[2] * back);
  const te = proj(K, td[0] * tl, td[1] * tl, pz + td[2] * tl);
  const P0x = cx + pv[0];
  const P0y = dcy + pv[1];
  const P1x = cx + te[0];
  const P1y = dcy + te[1];
  const tubeR = domeR * 0.2 * 16 * K;
  sphere(p.c, K, cx, dcy, domeR, (nx, ny, nz, x, y) => {
    const az = Math.atan2(ny, nx);
    const lat = Math.asin(Math.max(-1, Math.min(1, nz)));
    let d = az - slitAz;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const cl = Math.max(0.2, Math.cos(lat));
    const inSlit = Math.abs(d) * cl < slitW && lat > 0.02;
    const l = lightOf(nx, ny, nz);
    if (inSlit) {
      if (open) {
        // the interior, dark; the telescope's white tube inside
        const ex = P1x - P0x;
        const ey = P1y - P0y;
        const t = Math.max(0, Math.min(1, ((x - P0x) * ex + (y - P0y) * ey) / (ex * ex + ey * ey)));
        const dist = Math.hypot(x - (P0x + ex * t), y - (P0y + ey * t));
        const rad = t > 0.8 ? tubeR * 1.12 : tubeR;
        if (dist < rad) {
          // a white tube shaded as a cylinder, a dark dew shield, the black opening at its end
          const s = ((x - P0x) * ey - (y - P0y) * ex) / Math.hypot(ex, ey) / rad;
          if (t > 0.992) return dist < rad * 0.72 ? '#0a0c12' : '#3a3e46';
          if (t > 0.86) return s < -0.3 ? '#5a5e68' : s < 0.4 ? '#44484f' : '#2e3238';
          if (Math.abs(t - 0.5) < 0.012 || Math.abs(t - 0.2) < 0.012) return '#8a909c';
          return s < -0.45 ? '#ffffff' : s < -0.05 ? '#eef0f4' : s < 0.45 ? '#c4c8d0' : '#8a909c';
        }
        // the shutter's edges catch the light
        if (Math.abs(Math.abs(d) * cl - slitW) < 0.02) return d < 0 ? '#9aa2ae' : '#e8ecf0';
        // the inside of the far wall: dark, with the dome's ribs faintly lit
        if (((lat * 7) % 1) < 0.06) return '#2a3244';
        return lat > 1.1 ? '#141a28' : '#1a2132';
      }
      // closed: the shutter, a raised band with ribs and two rails
      if (Math.abs(Math.abs(d) * cl - slitW) < 0.025) return ramp[Math.max(0, toneOf(ramp, l, x, y) - 2)];
      let t = toneOf(ramp, l, x, y, 0.26, 0.8) - 1;
      if (((lat * 28) % 1) < 0.12) t -= 1;
      return ramp[Math.max(0, t)];
    }
    let t = toneOf(ramp, l, x, y, 0.24, 0.8, 0.6);
    // meridian seams every 15°, two latitude rings, rivets along them
    const mer = (((az / (Math.PI / 12)) % 1) + 1) % 1;
    if (mer < 0.035 * (1 / cl) && lat < 1.4) t -= 1;
    if (Math.abs(lat - 0.55) < 0.012 || Math.abs(lat - 1.05) < 0.014) t -= 1;
    if (Math.abs(lat - 0.55) < 0.03 && mer > 0.4 && mer < 0.47) t += 1;
    // grime toward the base, streaks under the seams
    if (lat < 0.14) t -= 1;
    if (lat < 0.5 && mer < 0.1 && hash(Math.floor(az * 40), Math.floor(lat * 30), 6) < 0.4) t -= 1;
    if (hash(x, y, 7) < 0.02) t -= 1;
    return ramp[Math.max(0, Math.min(ramp.length - 1, t))];
  }, { upper: true });
  // the base ring of the dome (its skirt) and the front of the catwalk railing
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const dx = Math.cos(a) * (domeR + 0.01);
    const dy = Math.sin(a) * (domeR + 0.01);
    if (dx + dy < -0.3) continue;
    const [ox, oy] = proj(K, dx, dy, 0);
    px(p.c, cx + ox, dcy + oy, ramp[1], 2, 2);
  }
  rail(true);
  // a lightning rod at the zenith, an access ladder up the drum
  const zen = proj(K, 0, 0, domeR);
  px(p.c, cx + zen[0], dcy + zen[1] - 10, IRONK[3], 1, 10);
  px(p.c, cx + zen[0] - 1, dcy + zen[1] - 11, IRONK[4], 3, 2);
  if (!small) {
    const la = 2.1;
    const lx = Math.cos(la) * (R + 0.02);
    const ly = Math.sin(la) * (R + 0.02);
    const [ox, oy] = proj(K, lx, ly, 0);
    layer(p.c, (l) => {
      for (const s of [-3, 3]) ln(l, cx + ox + s, cy + oy, cx + ox + s, cy + oy - (Hd + 4) * K, IRONK[3]);
      for (let z = 2; z < Hd + 3; z += 2.2) ln(l, cx + ox - 3, cy + oy - z * K, cx + ox + 3, cy + oy - z * K, IRONK[2]);
    }, { outline: false });
  }
  // steps up to the door
  if (!small) {
    const da = 0.65;
    const dx = Math.cos(Math.PI / 2 - 0.0) * 0;
    void dx;
    const ang = Math.PI / 4 + (da - Math.PI / 4);
    void ang;
    const [sx, sy] = proj(K, 0.25, R + 0.2, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 2; i++) {
        fillPoly(l, [[cx + sx - 16 + i * 2, cy + sy - i * 4], [cx + sx + 2 + i * 2, cy + sy - 9 - i * 4], [cx + sx + 18, cy + sy - 1 - i * 4], [cx + sx + 0, cy + sy + 8 - i * 4]], GRANITE[4 - i]);
        fillPoly(l, [[cx + sx - 16 + i * 2, cy + sy - i * 4], [cx + sx + 0, cy + sy + 8 - i * 4], [cx + sx + 0, cy + sy + 12 - i * 4], [cx + sx - 16 + i * 2, cy + sy + 4 - i * 4]], GRANITE[2]);
      }
    });
  }
}
const res_dome: PropArt = { draw: domeArt };

// ── the radio telescope ─────────────────────────────────────
const res_dish: PropArt = {
  draw(p, k) {
    const W = k.w;
    const K = p.k;
    const c0 = W / 2;
    footShadow(p, 0.4, 0.4, W - 0.4, W - 0.4, 60, 0.32);
    const [cx, cy] = anchor(p, c0, c0, 0);
    // the concrete base and the rail it turns on
    cylinder(p.c, K, cx, cy, 1.05, 0, 3.4, (nx, ny, _a, z, x, y) => {
      const l = lightOf(nx, ny, 0);
      if (z > 3) return '#a8a49c';
      return CONCRETE[toneOf(CONCRETE, l, x, y, 0.3, 0.7)];
    });
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const [ox, oy] = proj(K, Math.cos(a) * 0.98, Math.sin(a) * 0.98, 3.4 / 16);
      px(p.c, cx + ox, cy + oy, '#5a5e66', 2, 1);
    }
    // the turret: a white steel cabin with a door and a little window
    const tw = 0.62;
    const wt = paint(DOME);
    lbox(p, c0 - tw, c0 - tw * 0.8, tw * 2, tw * 1.6, 3.4, 9, { front: wt, side: wt, top: paint(DOME), edge: DOME[0] });
    const TF = front(p, c0 + tw * 0.8);
    pq(p, TF, c0 - 0.2, c0 + 0.1, 3.4, 10.6, '#4a5260');
    pq(p, TF, c0 - 0.17, c0 + 0.07, 3.6, 10.3, '#6a7484');
    const TS = side(p, c0 + tw);
    pq(p, TS, c0 - 0.3, c0 + 0.1, 8, 10.6, '#2a3440');
    // the dish's orientation: looking up toward the upper left
    const el = 0.62;
    const az = 1.72;
    const n: [number, number, number] = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    // e1 horizontal ⟂ n, e2 = n × e1
    const hz = Math.hypot(n[0], n[1]);
    const e1: [number, number, number] = [-n[1] / hz, n[0] / hz, 0];
    const e2: [number, number, number] = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    const Rd = W * 0.36;
    const f = Rd * 0.62;
    const hubZ = 2.2; // elevation axis height in tile-heights (~35 z)
    const C: [number, number, number] = [-n[0] * 0.25, -n[1] * 0.25, hubZ - n[2] * 0.25];
    // the yoke: two A-frame arms either side of the dish, on the turret
    const arm = (sgn: number) => {
      const bx = sgn * 0.66 * e1[0];
      const by = sgn * 0.66 * e1[1];
      const top = proj(K, bx, by, hubZ);
      layer(p.c, (l) => {
        for (const off of [-0.32, 0.32]) {
          const foot = proj(K, bx + off * n[0] * 0.6, by + off * n[1] * 0.6, 12.4 / 16);
          ln(l, cx + foot[0], cy + foot[1], cx + top[0], cy + top[1], STEEL[sgn > 0 ? 3 : 5], 4);
        }
        ell(l, cx + top[0], cy + top[1], 6, 6, STEEL[2]);
        ell(l, cx + top[0] - 1, cy + top[1] - 1, 3, 3, STEEL[5]);
      });
    };
    // both arms stand behind the reflector (it faces us): only their legs show under its rim
    arm(1);
    arm(-1);
    // the dish: every pixel's view ray (along (1, 1, 1) in tile space) meets the paraboloid
    // s = |q|² / 4f in the dish frame; the front-most hit inside the rim is shaded
    const A16 = 16 * K;
    const B8 = 8 * K;
    const de1 = e1[0] + e1[1] + e1[2];
    const de2 = e2[0] + e2[1] + e2[2];
    const dn = n[0] + n[1] + n[2];
    const span = Rd * 1.45 * A16;
    const [hcx, hcy] = proj(K, C[0], C[1], C[2]);
    for (let yy = Math.floor(cy + hcy - span); yy <= cy + hcy + span; yy++)
      for (let xx = Math.floor(cx + hcx - span); xx <= cx + hcx + span; xx++) {
        const X = xx + 0.5 - cx;
        const Y = yy + 0.5 - cy;
        const x0 = (X / A16 + Y / B8) / 2;
        const y0 = (Y / B8 - X / A16) / 2;
        const w0 = x0 - C[0];
        const w1 = y0 - C[1];
        const w2 = 0 - C[2];
        const we1 = w0 * e1[0] + w1 * e1[1] + w2 * e1[2];
        const we2 = w0 * e2[0] + w1 * e2[1] + w2 * e2[2];
        const wn = w0 * n[0] + w1 * n[1] + w2 * n[2];
        const Aq = de1 * de1 + de2 * de2;
        const Bq = 2 * (we1 * de1 + we2 * de2) - 4 * f * dn;
        const Cq = we1 * we1 + we2 * we2 - 4 * f * wn;
        const disc = Bq * Bq - 4 * Aq * Cq;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        let hit = -1e9;
        let q1 = 0;
        let q2 = 0;
        for (const t of [(-Bq + sq) / (2 * Aq), (-Bq - sq) / (2 * Aq)]) {
          const a1 = we1 + t * de1;
          const a2 = we2 + t * de2;
          if (a1 * a1 + a2 * a2 <= Rd * Rd && t > hit) {
            hit = t;
            q1 = a1;
            q2 = a2;
          }
        }
        if (hit === -1e9) continue;
        const rho = Math.hypot(q1, q2);
        let nnx = -(q1 / (2 * f)) * e1[0] - (q2 / (2 * f)) * e2[0] + n[0];
        let nny = -(q1 / (2 * f)) * e1[1] - (q2 / (2 * f)) * e2[1] + n[1];
        let nnz = -(q1 / (2 * f)) * e1[2] - (q2 / (2 * f)) * e2[2] + n[2];
        const nl = Math.hypot(nnx, nny, nnz);
        nnx /= nl;
        nny /= nl;
        nnz /= nl;
        const facing = nnx + nny + nnz > 0;
        const th = Math.atan2(q2, q1);
        let col: string;
        if (rho > Rd * 0.965) col = facing ? '#f2f4f6' : '#6a7280';
        else if (!facing) {
          // the back of the reflector: its truss of ribs and rings
          const rib = Math.abs(((th / (Math.PI / 8)) % 1 + 1) % 1 - 0.5) < 0.06 || Math.abs(((rho / Rd) * 5) % 1 - 0.5) < 0.05;
          col = rib ? STEEL[5] : STEEL[2 + ((xx + yy) & 1)];
        } else {
          const l = lightOf(nnx, nny, nnz);
          let t = toneOf(DOME, l * 0.8 + 0.2, xx, yy, 0.3, 0.7, 0.5);
          // panel joints: four rings and radial seams every 15°, a darker hub
          const ring = Math.abs(((rho / Rd) * 4.5) % 1) < 0.03;
          const seam = Math.abs(((th / (Math.PI / 12)) % 1 + 1) % 1 - 0.5) > 0.47 && rho > Rd * 0.2;
          if (ring || seam) t -= 1;
          if (rho < Rd * 0.1) t -= 2;
          col = DOME[Math.max(0, Math.min(6, t))];
        }
        plot(p.c, xx, yy, col);
      }
    // the feed legs from the rim to the focus, the receiver cabin at the focus
    const F = proj(K, C[0] + n[0] * f * 1.02, C[1] + n[1] * f * 1.02, C[2] + n[2] * f * 1.02);
    layer(p.c, (l) => {
      for (const th of [0.4, 2.0, 3.6, 5.2]) {
        const rr = Rd * 0.96;
        const s = (rr * rr) / (4 * f);
        const R0 = proj(K, C[0] + rr * (Math.cos(th) * e1[0] + Math.sin(th) * e2[0]) + s * n[0], C[1] + rr * (Math.cos(th) * e1[1] + Math.sin(th) * e2[1]) + s * n[1], C[2] + rr * (Math.cos(th) * e1[2] + Math.sin(th) * e2[2]) + s * n[2]);
        ln(l, cx + R0[0], cy + R0[1], cx + F[0], cy + F[1], STEEL[4], 2);
      }
      ell(l, cx + F[0], cy + F[1], 7, 6, STEEL[3]);
      ell(l, cx + F[0] - 1, cy + F[1] - 1, 5, 4, '#e8ecf0');
      ell(l, cx + F[0] + 1, cy + F[1] + 2, 3, 2, '#3a3e46');
    });
    // a red aircraft warning light on the receiver, cables, a ladder on the turret
    px(p.c, cx + F[0] - 1, cy + F[1] - 9, RED[4], 3, 3);
    const lad = front(p, c0 + tw * 0.8 + 0.01);
    for (const a of [c0 + 0.28, c0 + 0.42]) {
      const [x0, y0] = lad.F(a, 3.4);
      const [x1, y1] = lad.F(a, 12.4);
      ln(p.c, x0, y0, x1, y1, STEEL[2]);
    }
    for (let z = 4; z < 12.4; z += 1.4) {
      const [x0, y0] = lad.F(c0 + 0.28, z);
      const [x1, y1] = lad.F(c0 + 0.42, z);
      ln(p.c, x0, y0, x1, y1, STEEL[3]);
    }
  },
};

// ── the weather station ─────────────────────────────────────
const res_weather: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 30, 0.22);
    const wood = grain(LARCHF);
    // the fence round the enclosure: back posts and wires first
    const post = (a: number, b: number) => lbox(p, a - 0.03, b - 0.03, 0.06, 0.06, 0, 8, mono(wood, LARCHF[0]));
    const wire = (a0: number, b0: number, a1: number, b1: number) => {
      for (const z of [3, 5.6, 7.8]) {
        const [x0, y0] = p.P(a0, b0, z);
        const [x1, y1] = p.P(a1, b1, z);
        ln(p.c, x0, y0, x1, y1, '#8a8e94');
      }
    };
    const m = 0.12;
    wire(m, m, W - m, m);
    wire(m, m, m, D - m);
    for (let i = 0; i <= 4; i++) post(m + ((W - 2 * m) * i) / 4, m);
    for (let i = 1; i <= 4; i++) post(m, m + ((D - 2 * m) * i) / 4);
    // the lattice mast at the back corner with its sensors
    const [mx, my] = anchor(p, 0.55, 0.55, 0);
    const H = 168;
    layer(p.c, (l) => {
      for (const dx of [-5, 5]) ln(l, mx + dx, my, mx + dx * 0.4, my - H, STEEL[dx < 0 ? 4 : 2], 2);
      ln(l, mx, my + 2, mx, my - H, STEEL[3], 1);
      for (let z = 0; z < H; z += 10) {
        const w0 = 5 * (1 - (z / H) * 0.6);
        const w1 = 5 * (1 - ((z + 10) / H) * 0.6);
        ln(l, mx - w0, my - z, mx + w1, my - z - 10, STEEL[3]);
        ln(l, mx + w0, my - z, mx - w1, my - z - 10, STEEL[2]);
      }
      // guy wires
      ln(l, mx, my - H * 0.7, mx - 34, my + 8, '#9aa0a8');
      ln(l, mx, my - H * 0.7, mx + 30, my + 14, '#9aa0a8');
      // the anemometer: three cups on arms, and a vane
      const ty = my - H - 6;
      px(l, mx - 1, ty, STEEL[4], 2, 8);
      for (const [dx, dy] of [[-9, 2], [8, 3], [1, -3]] as const) {
        ln(l, mx, ty, mx + dx, ty + dy, STEEL[4]);
        ell(l, mx + dx, ty + dy, 2.5, 2, '#e8ecf0');
        px(l, mx + dx, ty + dy, '#5a6068');
      }
      ln(l, mx, ty + 10, mx + 14, ty + 8, STEEL[3]);
      fillPoly(l, [[mx + 10, ty + 4], [mx + 16, ty + 6], [mx + 16, ty + 11], [mx + 10, ty + 10]], '#d8dce2');
      ln(l, mx - 4, ty + 9, mx - 10, ty + 10, STEEL[3], 2);
      // a radiation shield (stacked white plates) and a logger box
      for (let i = 0; i < 5; i++) ell(l, mx + 12, my - H * 0.55 + i * 3, 6, 2, i % 2 ? '#e8ecf0' : '#c8ccd2');
      ln(l, mx, my - H * 0.55 + 6, mx + 8, my - H * 0.55 + 6, STEEL[3]);
      px(l, mx - 9, my - 52, '#c8ccd2', 8, 11);
      px(l, mx - 9, my - 52, '#e8ecf0', 2, 11);
      // a small solar panel tilted up to the sun
      fillPoly(l, [[mx - 22, my - 82], [mx - 4, my - 92], [mx - 2, my - 80], [mx - 20, my - 70]], '#1e2a4a');
      for (let i = 1; i < 4; i++) ln(l, mx - 22 + i * 5, my - 82 - i * 2.5, mx - 20 + i * 5, my - 70 - i * 2.5, '#5a6a9a');
      ln(l, mx - 22, my - 82, mx - 4, my - 92, '#8a9ab8');
      // a lightning rod
      ln(l, mx, my - H - 6, mx, my - H - 26, STEEL[5]);
    });
    // the Stevenson screen: a white louvred box on legs, double roof
    const sw = paint(['#8a8a88', '#a8a8a4', '#c8c8c2', '#e0e0da', '#f0f0ea', '#fafaf6']);
    const sa = W * 0.6;
    const sb = D * 0.62;
    for (const [a, b] of [[sa - 0.24, sb - 0.2], [sa + 0.2, sb - 0.2], [sa - 0.24, sb + 0.16], [sa + 0.2, sb + 0.16]] as const) lbox(p, a, b, 0.05, 0.05, 0, 10, mono(wood, LARCHF[0]));
    lbox(p, sa - 0.3, sb - 0.24, 0.6, 0.46, 10, 6, { front: sw, side: sw, top: sw, edge: '#7a7a76' });
    const SF = front(p, sb + 0.22);
    const SS = side(p, sa + 0.3);
    for (let i = 0; i < 9; i++) {
      pq(p, SF, sa - 0.27, sa + 0.27, 10.4 + i * 0.6, 10.6 + i * 0.6, '#a8a8a2');
      pq(p, SS, sb - 0.21, sb + 0.19, 10.4 + i * 0.6, 10.6 + i * 0.6, '#8a8a86');
    }
    lbox(p, sa - 0.36, sb - 0.3, 0.72, 0.58, 16, 0.6, { front: sw, side: sw, top: sw, edge: '#7a7a76' });
    lbox(p, sa - 0.32, sb - 0.26, 0.64, 0.5, 16.8, 0.6, { front: sw, side: sw, top: sw, edge: '#7a7a76' });
    // a copper rain gauge on its post, a sunshine recorder (a glass ball)
    const [gx, gy] = anchor(p, W * 0.3, D * 0.82, 0);
    layer(p.c, (l) => {
      px(l, gx - 1, gy - 12, LARCHF[3], 3, 12);
      px(l, gx - 5, gy - 22, '#b8723a', 10, 10);
      px(l, gx - 5, gy - 22, '#d8925a', 2, 10);
      ell(l, gx, gy - 22, 5, 2, '#8a4a22');
      const [bx, by] = anchor(p, W * 0.8, D * 0.3, 0);
      px(l, bx - 2, by - 10, '#7a7a7a', 4, 10);
      fillPoly(l, [[bx - 6, by - 10], [bx + 6, by - 10], [bx + 4, by - 13], [bx - 4, by - 13]], '#5a5a5a');
      ell(l, bx, by - 18, 5, 5, '#c8e4ec');
      ell(l, bx - 2, by - 20, 2, 2, '#ffffff');
      curve(l, bx - 6, by - 13, bx - 8, by - 20, bx - 3, by - 24, '#8a6a3a', 1);
    });
    // the front fence last
    wire(W - m, m, W - m, D - m);
    wire(m, D - m, W - m, D - m);
    for (let i = 0; i <= 4; i++) post(W - m, m + ((D - 2 * m) * i) / 4);
    for (let i = 0; i < 4; i++) post(m + ((W - 2 * m) * i) / 4, D - m);
    void k;
  },
};

// ── a rack of solar panels ──────────────────────────────────
const res_solar: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.95, 10, 0.24);
    // a galvanised frame and two rows of panels tilted toward the sun (the upper left)
    for (let a = 0.15; a < W - 0.1; a += Math.max(0.5, (W - 0.3) / 3)) {
      lbox(p, a, 0.25, 0.05, 0.05, 0, 9, mono(paint(STEEL), STEEL[0]));
      lbox(p, a, 0.75, 0.05, 0.05, 0, 4, mono(paint(STEEL), STEEL[0]));
    }
    const cells = (u: number, v: number, x: number, y: number) => {
      if (u % 15 < 1.2 || v % 15 < 1.2) return '#8a96b0';
      const d = (u * 0.7 + v) % 50;
      if (d > 8 && d < 13) return '#4a62a0';
      return hash(x, y, 3) < 0.04 ? '#2a3a6a' : '#1e2c56';
    };
    poly3(p, [[0.05, 0.9, 4.6], [W - 0.05, 0.9, 4.6], [W - 0.05, 0.15, 9.8], [0.05, 0.15, 9.8]], cells, 2, [[0.05, 0.9, 4.6], [W - 0.05, 0.9, 4.6], [0.05, 0.15, 9.8]]);
    const [x0, y0] = p.P(0.05, 0.9, 4.6);
    const [x1, y1] = p.P(W - 0.05, 0.9, 4.6);
    ln(p.c, x0, y0 + 1, x1, y1 + 1, STEEL[1], 2);
    const [x2, y2] = p.P(W - 0.05, 0.15, 9.8);
    ln(p.c, x1, y1, x2, y2, STEEL[2], 2);
    void k;
  },
};

// ── a timber instrument hut on a stone base ─────────────────
const res_hut: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.05, 30, 0.28);
    const stone = rubble(GNEISS, MORTAR, 12);
    lbox(p, 0.15, 0.2, W - 0.3, D - 0.4, 0, 5, { front: stone, side: stone, top: stone, edge: GNEISS[0] });
    const lg = logs(TIMBER, 8);
    lbox(p, 0.2, 0.25, W - 0.4, D - 0.5, 5, 17, { front: lg, side: lg, top: lg, edge: TIMBER[0] });
    const F = front3(p, D - 0.25);
    const S = side3(p, W - 0.2);
    // a door, a window with shutters
    pq(p, F, W * 0.3, W * 0.3 + 0.55, 5, 19, TIMBER[1]);
    pt(p, F, W * 0.3 + 0.03, W * 0.3 + 0.52, 5, 18.6, grain(LARCHF, 'v'), F.light);
    const [hx, hy] = F.F(W * 0.3 + 0.44, 11.5);
    px(p.c, hx - 1, hy - 1, IRONK[4], 3, 2);
    pq(p, S, D * 0.35, D * 0.65, 8.5, 14, '#2a2420');
    pt(p, S, D * 0.37, D * 0.63, 8.8, 13.7, glass4(['#24444c', '#2f5a63', '#3f7680', '#5a949a', '#82b6b6', '#b6dcd6', '#e4f6f0']), S.light);
    // the roof: two slopes of stone slabs with a ridge along the depth, sitting on the log walls
    const a0 = 0.2;
    const a1 = W - 0.2;
    const b0 = 0.25;
    const b1 = D - 0.25;
    const am = (a0 + a1) / 2;
    const oh = 0.22;
    const ze = 22;
    const sl = 12; // z per tile across the roof
    const zr = ze + (am - a0) * sl;
    const zo = ze - oh * sl;
    const slabs = piode(PIODE, 10);
    // the gable over the front wall first (the roof's overhang comes over it)
    poly3(p, [[a0, b1, ze], [a1, b1, ze], [am, b1, zr]], logs(TIMBER, 8), F.light, [[a0, b1, ze], [a1, b1, ze], [a0, b1, zr]]);
    poly3(p, [[a0 - oh, b0 - oh, zo], [a0 - oh, b1 + oh, zo], [am, b1 + oh, zr], [am, b0 - oh, zr]], slabs, 1, [[a0 - oh, b1 + oh, zo], [a0 - oh, b0 - oh, zo], [am, b1 + oh, zr]]);
    poly3(p, [[am, b0 - oh, zr], [am, b1 + oh, zr], [a1 + oh, b1 + oh, zo], [a1 + oh, b0 - oh, zo]], slabs, 0, [[a1 + oh, b1 + oh, zo], [a1 + oh, b0 - oh, zo], [am, b1 + oh, zr]]);
    const [r0x, r0y] = p.P(am, b0 - oh, zr);
    const [r1x, r1y] = p.P(am, b1 + oh, zr);
    ln(p.c, r0x, r0y - 1, r1x, r1y - 1, PIODE[5], 2);
    const [e0x, e0y] = p.P(a0 - oh, b1 + oh, zo);
    const [e1x, e1y] = p.P(a1 + oh, b1 + oh, zo);
    ln(p.c, e0x, e0y, r1x, r1y, TIMBER[4], 3);
    ln(p.c, r1x, r1y, e1x, e1y, TIMBER[3], 3);
    ln(p.c, e0x, e0y + 3, r1x, r1y + 3, TIMBER[1], 1);
    ln(p.c, r1x, r1y + 3, e1x, e1y + 3, TIMBER[1], 1);
    const [f0x, f0y] = p.P(a1 + oh, b0 - oh, zo);
    ln(p.c, f0x, f0y + 1, e1x, e1y + 1, TIMBER[2], 2);
    // a stovepipe with a cap
    const [sx, sy] = p.P(am + (a1 - am) * 0.4, D * 0.4, zr - (a1 - am) * 0.4 * sl);
    px(p.c, sx - 2, sy - 16, IRONK[3], 4, 16);
    px(p.c, sx - 4, sy - 18, IRONK[4], 8, 3);
    void k;
  },
};

// ── a telescope on a concrete pier (one of them under its canvas cover) ──
const res_pier: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    const K = p.k;
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 16, 0.26);
    lbox(p, 0.24, 0.24, 0.52, 0.52, 0, 0.8, mono(paint(CONCRETE), CONCRETE[0]));
    cylinder(p.c, K, x, y - 0.8 * K, 0.17, 0, 10.4, (nx, ny, _a, z, xx, yy) => {
      if (z > 10) return '#c8c4bc';
      return RENDER[Math.max(0, toneOf(RENDER, lightOf(nx, ny, 0), xx, yy, 0.3, 0.7) - (z < 1.5 ? 1 : 0))];
    });
    const top = y - 11.2 * K;
    const covered = k.seed % 3 === 2;
    layer(p.c, (l) => {
      if (covered) {
        // a canvas bag over the whole instrument, tied at the pier
        fillPoly(l, [[x - 9, top], [x + 9, top], [x + 12, top - 14], [x + 4, top - 30], [x - 6, top - 26], [x - 12, top - 12]], '#4a5a3a');
        fillPoly(l, [[x - 9, top], [x - 2, top], [x - 4, top - 24], [x - 6, top - 26], [x - 12, top - 12]], '#5e6e48');
        px(l, x - 9, top - 3, '#c8b890', 18, 1);
        return;
      }
      // the equatorial mount: a wedge, the head, the counterweight shaft and its weight
      fillPoly(l, [[x - 6, top], [x + 6, top], [x + 4, top - 8], [x - 3, top - 10]], STEEL[2]);
      fillPoly(l, [[x - 6, top], [x - 1, top], [x - 2, top - 9], [x - 3, top - 10]], STEEL[4]);
      ln(l, x, top - 9, x + 9, top - 2, STEEL[3], 2);
      ell(l, x + 10, top - 2, 3, 3, STEEL[1]);
      ell(l, x + 9, top - 3, 1.5, 1.5, STEEL[4]);
      // the tube, white, aimed high toward the upper left; a dark dew cap, the eyepiece and finder
      ln(l, x + 8, top - 6, x - 16, top - 30, '#c8ccd4', 6);
      ln(l, x + 8, top - 8, x - 16, top - 32, '#f4f6f8', 2);
      ln(l, x - 12, top - 26, x - 18, top - 32, '#2e3238', 7);
      ell(l, x - 19, top - 33, 3, 3, '#0a0c12');
      px(l, x + 7, top - 5, '#2a2a30', 3, 4);
      ln(l, x - 2, top - 22, x - 8, top - 28, STEEL[2], 2);
    });
    // a little metal box with a red light for the cables
    const [bx, by] = anchor(p, 0.72, 0.78, 0.8);
    px(p.c, bx - 3, by - 6, STEEL[3], 6, 6);
    px(p.c, bx - 3, by - 6, STEEL[5], 6, 1);
    px(p.c, bx + 1, by - 4, '#e84a3a', 1, 1);
  },
};

export const RESEARCH_OBSERVATORY: Record<string, PropArt> = { res_dome, res_dish, res_weather, res_solar, res_hut, res_pier };
export { proj, GRANITE, RENDER, cutStone4, darken, at, rng };

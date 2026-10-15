// Logistics Port — the container terminal (1 tile ≈ 2 m, 1 z ≈ 10 cm).
//   prt_stack     a block of containers in bays (20 ft = 3 tiles) and rows,
//                 tiers of 1–4, colours, codes, rust; only showing faces drawn
//   prt_stsleg    a pair of gantry legs on their rail with bogies (rail side)
//   prt_sts       the gantry's upper works: portal beams, machinery house,
//                 A-frame, the boom out over the berth, trolley, cab, spreader
//                 (its footprint runs out over the water so it draws after the ship)
//   prt_ship      a container feeder at the berth: hull, deck boxes, bridge,
//                 funnel, lifeboat, mooring lines to the quay
//   prt_straddle  a straddle carrier lifting a box · prt_truck  a tractor and
//                 trailer with a box · prt_wagon  a container flat wagon
import { darken } from '../../../color';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, bayer, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { lbox, mono } from '../util';
import { deckFill, plate, planks, rope, shadowBand, stencil, wheelOn } from './kit';
import { QD } from './layout';
import { BOX_COLOURS, GALV, IRON, P, ROPE, STEEL } from './palette';
import { drawBox, glass } from './quay';

const BOXH = 25.9;
const pickColour = (h: number) => P[BOX_COLOURS[Math.floor(h * BOX_COLOURS.length) % BOX_COLOURS.length]];

// ── container stacks ─────────────────────────────────────────
const stack: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Rn = rng(k.seed * 19 + 7);
    const L = k.variant === '40' ? 6 : 3;
    const gap = 0.1;
    const nb = Math.max(1, Math.floor((W + gap) / (L + gap)));
    const rowD = 1.22;
    const nr = Math.max(1, Math.floor((D + 0.04) / (rowD + 0.04)));
    const maxT = k.variant === 'low' ? 2 : 4;
    const hgt: number[][] = [];
    for (let i = 0; i < nb; i++) {
      hgt.push([]);
      for (let j = 0; j < nr; j++) hgt[i].push(1 + Math.floor(Rn() * maxT * 0.999) + (Rn() < 0.3 ? 0 : 0));
    }
    shadowBand(p, 0, 0, W, D, 0.8, 0.3);
    for (let j = 0; j < nr; j++) {
      for (let i = 0; i < nb; i++) {
        const a0 = i * (L + gap);
        const b0 = j * (rowD + 0.04);
        const h = hgt[i][j];
        for (let t = 0; t < h; t++) {
          const frontOpen = j === nr - 1 || hgt[i][j + 1] <= t;
          const sideOpen = i === nb - 1 || hgt[i + 1][j] <= t;
          const top = t === h - 1;
          if (!frontOpen && !sideOpen && !top) continue;
          const sd = hash(i * 31 + j * 7 + t, k.seed, 5);
          const r = pickColour(sd);
          drawBox(p, a0, b0, L, rowD, t * BOXH, BOXH, r, {
            seed: Math.floor(sd * 9999),
            rust: 0.3 + sd * 0.7,
            doors: sd < 0.5 ? 'closed' : 'blank',
            logo: sd > 0.45 && L > 3,
            code: frontOpen,
            faces: { front: frontOpen, side: sideOpen, top },
            cheap: true,
          });
        }
        // a dark slit between bays where the neighbour is as high
        if (i < nb - 1) {
          const hm = Math.min(h, hgt[i + 1][j]);
          if (hm > 0) pq(p, front(p, b0 + rowD), a0 + L, a0 + L + gap, 0, hm * BOXH, '#16141a');
        }
      }
    }
    // lashing bars left on a roof, a gull or two on the tops
    const gi = Math.floor(Rn() * nb);
    const gj = nr - 1;
    const [gx, gy] = p.P(gi * (L + gap) + L * 0.5, gj * (rowD + 0.04) + 0.6, hgt[gi][gj] * BOXH);
    if (Rn() < 0.7) {
      px(p.c, gx - 3, gy - 9, '#eef0ee', 7, 4);
      px(p.c, gx - 4, gy - 10, '#9aa2ac', 6, 2);
      px(p.c, gx + 2, gy - 12, '#ffffff', 3, 3);
      px(p.c, gx + 5, gy - 11, '#f2c43a', 2, 1);
    }
  },
};

// ── the ship-to-shore gantry crane ───────────────────────────
// The legs stand on two rails along the quay (land y = 5.3, sea y = 12.3).
// Each leg frame (the plane x = const) is its own long, thin prop, cut into
// columns by the renderer, so carriers between the legs sort correctly; the
// upper works (cross beams, boom, A-frame, house, trolley, spreader) are one
// prop whose footprint runs out over the water so it draws after the ship.
const SB: Ramp = ['#0a2a64', '#0d3a80', '#1251a0', '#1a5cb0', '#2468c0', '#3478d0', '#4a8ade'];
const SBm = plate(SB);
const STS_LAND = 5.3;
const STS_SEA = 12.3;
const PORTAL_Z = 172;

/** A girder between two 3D points: a shaded thick line with a lit edge and a dark edge. */
function girder(p: PropPainter, A: [number, number, number], B: [number, number, number], w: number) {
  const a = p.P(...A);
  const b = p.P(...B);
  ln(p.c, a[0], a[1], b[0], b[1], SB[3], w);
  ln(p.c, a[0] - Math.floor(w / 2), a[1], b[0] - Math.floor(w / 2), b[1], SB[5], 1);
  ln(p.c, a[0] + Math.ceil(w / 2) - 1, a[1] + 1, b[0] + Math.ceil(w / 2) - 1, b[1] + 1, SB[1], 1);
}

/** One leg frame: land and sea legs on bogies, a sill girder, a diagonal, the portal girder on top. */
const stsframe: PropArt = {
  draw(p, k) {
    const a = 0.37;
    const bl = STS_LAND - p.y;
    const bs = STS_SEA - p.y;
    shadowBand(p, a - 0.3, bl - 0.6, a + 0.3, bs + 0.6, 0.5, 0.24);
    const yel = plate(P.yellow);
    for (const b of [bl, bs]) {
      // the bogie on the rail: a yellow frame, four wheels, black-and-yellow buffers at the ends
      lbox(p, a - 0.2, b - 0.55, 0.4, 1.1, 0.2, 3, { front: yel, side: yel, top: yel, edge: P.yellow[0] });
      const S = side(p, a + 0.2);
      for (const wb of [b - 0.4, b - 0.14, b + 0.14, b + 0.4]) {
        const [wx, wy] = S.F(wb, 1.1);
        ell(p.c, wx, wy, 4, 4, '#1e1e24');
        ell(p.c, wx, wy - 1, 1.5, 1.5, '#7a7a82');
      }
      const F = front(p, b + 0.55);
      for (let i = 0; i < 3; i++) pq(p, F, a - 0.2 + i * 0.14, a - 0.13 + i * 0.14, 0.4, 3, '#1e1e24');
      // the leg: a box column with a ladder and a hazard band at its foot
      lbox(p, a - 0.14, b - 0.14, 0.28, 0.28, 3.2, PORTAL_Z - 3.2, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
      const L = front(p, b + 0.14);
      for (let i = 0; i < 4; i++) pq(p, L, a - 0.14, a + 0.14, 3.6 + i * 2.4, 4.8 + i * 2.4, i % 2 ? '#1e1e24' : '#e8b42a');
      const LS = side(p, a + 0.14);
      for (let z = 14; z < PORTAL_Z - 6; z += 2.6) pq(p, LS, b - 0.1, b + 0.1, z, z + 0.45, SB[2]);
    }
    // the sill girder joining the legs, the diagonal brace, the portal girder on top
    lbox(p, a - 0.09, bl + 0.14, 0.18, bs - bl - 0.28, 58, 4, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
    girder(p, [a, bl + 0.14, 62], [a, bs - 0.14, PORTAL_Z - 8], 5);
    girder(p, [a, bs - 0.14, 62], [a, (bl + bs) / 2, 110], 3);
    lbox(p, a - 0.16, bl - 0.25, 0.32, bs - bl + 0.5, PORTAL_Z, 6, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
    void k;
  },
};

/**
 * The upper works (local a along the quay; b from the footprint's row, the rails at
 * negative b). variant 'up': parked, the boom raised almost upright over the legs.
 */
const sts: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const up = k.variant === 'up';
    const bl = STS_LAND - p.y;
    const bs = STS_SEA - p.y;
    const a0 = 0.37;
    const a1 = W - 0.63;
    const Z = PORTAL_Z;
    const ba = (a0 + a1) / 2;
    // cross beams at the top of the legs, land and sea side
    for (const b of [bl, bs]) lbox(p, a0, b - 0.12, a1 - a0, 0.24, Z + 0.5, 5, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
    const zb = Z + 6;
    const bBack = bl - 3.4;
    const bTip = bs + 9;
    const deckTop = plate(['#20507a', '#2c6696', '#3a7eae', '#4a8cba', '#5a9cc8', '#74b2d8']);
    // the boom's back span over the land (always level): one box girder with the trolley rail slot
    const backEnd = up ? bs + 0.3 : bTip;
    lbox(p, ba - 0.58, bBack, 1.16, backEnd - bBack, zb, 3.6, { front: SBm, side: SBm, top: deckTop, edge: SB[0] });
    const slot0 = p.P(ba, bBack + 0.2, zb + 3.6);
    const slot1 = p.P(ba, backEnd - 0.2, zb + 3.6);
    ln(c, slot0[0], slot0[1], slot1[0], slot1[1], SB[1], 2);
    for (let b = bBack + 0.6; b < backEnd - 0.2; b += 1.3) {
      const L = p.P(ba - 0.58, b, zb + 3.6);
      const R = p.P(ba + 0.58, b, zb + 3.6);
      ln(c, L[0], L[1], R[0], R[1], SB[2]);
    }
    const r0 = p.P(ba + 0.66, bBack, zb + 8);
    const r1 = p.P(ba + 0.66, backEnd, zb + 8);
    ln(c, r0[0], r0[1], r1[0], r1[1], '#e8b42a');
    // the A-frame: struts up from the portal corners to the apex
    const apexB = bl + 1.4;
    const ZA = Z + 108;
    for (const da of [-0.5, 0.5]) {
      girder(p, [ba + da, bl, Z + 6], [ba + da * 0.6, apexB, ZA], 7);
      girder(p, [ba + da, bs, Z + 6], [ba + da * 0.6, apexB, ZA], 7);
    }
    lbox(p, ba - 0.42, apexB - 0.12, 0.84, 0.24, ZA - 2, 4, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
    const Ap = p.P(ba, apexB, ZA + 2);
    // the machinery house on the back of the boom
    const white = plate(P.white);
    lbox(p, ba - 0.6, bBack + 0.25, 1.2, 2.2, zb + 3.6, 13, { front: white, side: white, top: plate(P.grey), edge: P.white[0] });
    const MH = front(p, bBack + 2.45);
    for (let i = 0; i < 4; i++) pq(p, MH, ba - 0.5 + i * 0.27, ba - 0.38 + i * 0.27, zb + 7, zb + 11.4, '#7a7e84');
    pq(p, MH, ba - 0.6, ba + 0.6, zb + 13.2, zb + 15.4, '#2c5aa0');
    stencil(p, MH, ba - 0.38, zb + 15, k.seed % 2 ? 'STS 2' : 'STS 1', '#f4f0e6');
    if (up) {
      // the outreach raised: two chords leaning back over the legs, braced, held by the luffing ropes
      const tipB = bs - 3.1;
      const tipZ = zb + 169;
      for (const da of [-0.5, 0.5]) {
        // each chord a box girder: its sea-facing (lit) face and its +x (shaded) face
        const a = ba + da;
        poly3(p, [[a - 0.09, bs + 0.19, zb + 2], [a + 0.09, bs + 0.19, zb + 2], [a + 0.09, tipB + 0.09, tipZ], [a - 0.09, tipB + 0.09, tipZ]], SBm, 1);
        poly3(p, [[a + 0.09, bs + 0.19, zb + 2], [a + 0.09, bs + 0.01, zb + 2], [a + 0.09, tipB - 0.09, tipZ], [a + 0.09, tipB + 0.09, tipZ]], SBm, 0);
      }
      for (let i = 1; i < 10; i++) {
        const t0 = (i - 1) / 10;
        const t1 = i / 10;
        const A = p.P(ba - 0.5, bs + 0.1 + (tipB - bs - 0.1) * t0, zb + 2 + (tipZ - zb - 2) * t0);
        const B = p.P(ba + 0.5, bs + 0.1 + (tipB - bs - 0.1) * t1, zb + 2 + (tipZ - zb - 2) * t1);
        const A2 = p.P(ba + 0.5, bs + 0.1 + (tipB - bs - 0.1) * t0, zb + 2 + (tipZ - zb - 2) * t0);
        const B2 = p.P(ba - 0.5, bs + 0.1 + (tipB - bs - 0.1) * t1, zb + 2 + (tipZ - zb - 2) * t1);
        ln(c, A[0], A[1], B[0], B[1], SB[2], 2);
        ln(c, A2[0], A2[1], B2[0], B2[1], SB[1], 1);
      }
      // the boom head: a box across the tip with its light
      lbox(p, ba - 0.62, tipB - 0.2, 1.24, 0.4, tipZ - 2, 5, { front: SBm, side: SBm, top: SBm, edge: SB[0] });
      const T = p.P(ba, tipB, tipZ);
      ln(c, Ap[0], Ap[1], T[0], T[1], '#2a3a4a');
      const Tl = p.P(ba - 0.5, tipB, tipZ);
      const Tr = p.P(ba + 0.5, tipB, tipZ);
      ln(c, Tl[0], Tl[1], Tr[0], Tr[1], SB[3], 4);
      px(c, T[0] - 2, T[1] - 5, '#d8402a', 4, 4);
      // the trolley parked over the land
      lbox(p, ba - 0.6, bl + 0.6, 1.2, 0.9, zb + 3.6, 2.6, mono(plate(P.yellow), P.yellow[0]));
    } else {
      // the stays from the apex out along the boom
      for (const [b, da] of [[bs + 3, -0.45], [bs + 3, 0.45], [bs + 6.4, -0.45], [bs + 6.4, 0.45], [bTip - 0.2, 0], [bBack + 0.3, 0]] as const) {
        const T = p.P(ba + da, b, zb + 3.6);
        ln(c, Ap[0], Ap[1], T[0], T[1], '#2a3a4a');
      }
      // the trolley out over the ship, the cab under it, the spreader on its ropes over the deck boxes
      const tb = bs + 5.2;
      lbox(p, ba - 0.62, tb - 0.45, 1.24, 0.9, zb + 3.6, 2.8, mono(plate(P.yellow), P.yellow[0]));
      lbox(p, ba + 0.14, tb + 0.15, 0.46, 0.5, zb - 10, 9, { front: white, side: white, top: white, edge: P.white[0] });
      pt(p, front(p, tb + 0.65), ba + 0.18, ba + 0.56, zb - 7.6, zb - 3.2, glass, 1);
      const zs = 142;
      for (const da of [-0.4, 0.4]) {
        const A = p.P(ba + da, tb, zb);
        const B = p.P(ba + da, tb, zs + 3);
        ln(c, A[0], A[1], B[0], B[1], '#26262c');
      }
      const sd = hash(k.seed, 11, 3);
      drawBox(p, ba - 1.5, tb - 0.6, 3, 1.2, zs - BOXH, BOXH, pickColour(sd), { seed: Math.floor(sd * 9999), rust: 0.4, doors: 'closed', cheap: true });
      lbox(p, ba - 1.45, tb - 0.55, 2.9, 1.1, zs, 2.6, mono(plate(P.yellow), P.yellow[0]));
      const SPF = front(p, tb + 0.55);
      for (let i = 0; i < 6; i++) pq(p, SPF, ba - 1.45 + i * 0.5, ba - 1.25 + i * 0.5, zs, zs + 2.6, '#1e1e24');
    }
    px(c, Ap[0] - 2, Ap[1] - 6, '#d8402a', 4, 4);
  },
  anim(p, k) {
    const bl = STS_LAND - p.y;
    const bs = STS_SEA - p.y;
    const ba = (0.37 + k.w - 0.63) / 2;
    const apex = p.P(ba, bl + 1.4, PORTAL_Z + 110);
    const tip = k.variant === 'up' ? p.P(ba, bs - 3.1, PORTAL_Z + 6 + 172) : p.P(ba, bs + 9, PORTAL_Z + 9.6);
    if (Math.sin(k.t * 2.6 + k.seed) > 0.1) px(p.c, apex[0] - 2, apex[1] - 6, '#ff6a4a', 4, 4);
    if (Math.sin(k.t * 2.6 + k.seed + 1.5) > 0.1) px(p.c, tip[0] - 2, tip[1] - 5, '#ff6a4a', 4, 4);
  },
};

// ── the feeder ship at the berth ─────────────────────────────
const HULLS: Ramp = ['#0a1838', '#0e2048', '#13295c', '#153572', '#1e4486', '#2a5498', '#3e68ac'];
/** Half-beam (fraction of the full half-beam) from stern (0) to bow (1). */
const shipBeam = (t: number) => (t < 0.05 ? 0.86 + t * 2.8 : t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) : 1);

const ship: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const ZW = -QD;
    const ZD = ZW + 36; // main deck
    const bm = 2.5;
    const hb = 1.95;
    const a0 = 0.3;
    const a1 = W - 0.2;
    const N = 48;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([a0 + (a1 - a0) * t, shipBeam(t) * hb]);
    }
    // the water at the hull: dark band and a foam line
    layer(c, (l) => {
      for (let i = 0; i < N; i++) {
        const A = p.P(pts[i][0], bm + pts[i][1] + 0.08, ZW);
        const B = p.P(pts[i + 1][0], bm + pts[i + 1][1] + 0.08, ZW);
        ln(l, A[0], A[1] + 2, B[0], B[1] + 2, '#0a2a44', 4);
        if (i % 2 === 0) ln(l, A[0], A[1], B[0], B[1], '#b8dcec');
      }
    }, { outline: false });
    // the hull's starboard side: facets lit by their normal, red boot-top, white sheer line
    for (let i = 0; i < N; i++) {
      const [aA, hA] = pts[i];
      const [aB, hB] = pts[i + 1];
      const nx = -(hB - hA);
      const ny = aB - aA;
      const lit = (-0.5 * nx + ny) / Math.hypot(nx, ny);
      const base = 2.4 + lit * 2;
      poly3(
        p,
        [[aA, bm + hA, ZD], [aB, bm + hB, ZD], [aB, bm + hB * 0.96, ZW], [aA, bm + hA * 0.96, ZW]],
        (_u: number, v: number, x: number, y: number) => {
          let i2 = base;
          if (v > 141) i2 += 1;
          if (hash(x >> 2, y, 41) < 0.04) i2 -= 0.8;
          // weld seams of the plating and a scuffed band where the fenders rub
          if (v % 36 < 1) i2 -= 0.6;
          if (v > 40 && v < 60 && hash(x >> 1, y >> 2, 42) < 0.2) i2 += 0.5;
          return at(HULLS, i2);
        },
        1,
        [[aA, bm + hA * 0.96, ZW], [aB, bm + hB * 0.96, ZW], [aA, bm + hA, ZD]],
      );
      const w0 = p.P(aA, bm + hA * 0.96, ZW);
      const w1 = p.P(aB, bm + hB * 0.96, ZW);
      fillPoly(c, [[w0[0], w0[1] - 7], [w1[0], w1[1] - 7], w1, w0], at(P.red, 2.4 + lit * 1.4));
      const s0 = p.P(aA, bm + hA, ZD);
      const s1 = p.P(aB, bm + hB, ZD);
      fillPoly(c, [s0, s1, [s1[0], s1[1] + 3], [s0[0], s0[1] + 3]], at(P.white, 3 + lit));
    }
    // the transom at the stern is hidden (it faces −x); the bow's name and draft marks
    const bowA = a0 + (a1 - a0) * 0.82;
    const NF = front(p, bm + hb);
    stencil(p, NF, bowA - 1.2, ZD - 5, 'REALMNEST', '#f2f0ea', 2);
    stencil(p, NF, a0 + 1.0, ZD - 5, 'REALMNEST', '#f2f0ea', 2);
    stencil(p, NF, a0 + 1.4, ZD - 10, 'HAMBURG', '#e2ded4');
    for (let i = 0; i < 4; i++) stencil(p, NF, bowA + 0.4, ZW + 6 + i * 6, String(2 + i * 2), '#f2f0ea');
    // the bulbous bow's anchor and its hawse
    const [hx, hy] = NF.F(a1 - 1.6, ZD - 8);
    ell(c, hx, hy, 4, 3, '#0a1018');
    ln(c, hx, hy + 2, hx - 2, hy + 14, '#4a4e54', 2);
    px(c, hx - 6, hy + 13, '#3a3e44', 9, 4);
    // the deck: walkways along the side, the forecastle, hatch coamings under the boxes
    deckFill(p, pts, bm, ZD, ['#4a3226', '#5e4030', '#724e3a', '#866046', '#9a7254', '#ac8462'], 0.97);
    // the bulwark rail along the starboard side
    for (let i = 0; i < N; i++) {
      const A = p.P(pts[i][0], bm + pts[i][1], ZD + 3);
      const B = p.P(pts[i + 1][0], bm + pts[i + 1][1], ZD + 3);
      ln(c, A[0], A[1], B[0], B[1], '#e8e4da');
      if (i % 2 === 0) {
        const D2 = p.P(pts[i][0], bm + pts[i][1], ZD);
        ln(c, A[0], A[1], D2[0], D2[1], '#c8c4ba');
      }
    }
    // the deck cargo: three bays of 20 ft boxes, three rows, two or three tiers
    const bay0 = a0 + 4.6;
    const Rn = rng(k.seed * 11 + 3);
    const rows = 3;
    const rowD = 1.2;
    const bb0 = bm - (rows * rowD + (rows - 1) * 0.04) / 2;
    const fa = a1 - 2.3;
    const nbays = Math.floor((fa - 0.3 - bay0) / 3.1);
    const tiers: number[][] = [];
    for (let i = 0; i < nbays; i++) {
      tiers.push([]);
      for (let j = 0; j < rows; j++) tiers[i].push(2 + (Rn() < 0.5 ? 1 : 0));
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < nbays; i++) {
        const ba0 = bay0 + i * 3.1;
        const bb = bb0 + j * (rowD + 0.04);
        for (let t = 0; t < tiers[i][j]; t++) {
          const frontOpen = j === rows - 1 || tiers[i][j + 1] <= t;
          const sideOpen = i === nbays - 1 || tiers[i + 1][j] <= t;
          const top = t === tiers[i][j] - 1;
          if (!frontOpen && !sideOpen && !top) continue;
          const sd = hash(i * 13 + j * 5 + t, k.seed, 9);
          drawBox(p, ba0, bb, 3, rowD, ZD + 1.6 + t * BOXH, BOXH, pickColour(sd), { seed: Math.floor(sd * 9999), rust: 0.4, doors: 'blank', code: frontOpen, faces: { front: frontOpen, side: sideOpen, top }, cheap: true });
        }
      }
    // lashing bridges between the bays
    for (let i = 0; i <= nbays; i++) {
      const a = bay0 - 0.06 + i * 3.1;
      for (const t of [0, 0.5, 1]) {
        const b = bb0 + t * rows * 1.24;
        const A = p.P(a, b, ZD);
        const B = p.P(a, b, ZD + 26);
        ln(c, A[0], A[1], B[0], B[1], '#c8941c', 2);
      }
      for (const z of [ZD + 13, ZD + 26]) {
        const A = p.P(a, bb0, z);
        const B = p.P(a, bb0 + rows * 1.24, z);
        ln(c, A[0], A[1], B[0], B[1], '#e8b42a', 2);
      }
    }
    // hatch covers between the last bay and the forecastle
    const hc0 = bay0 + nbays * 3.1;
    lbox(p, hc0, bb0, fa - hc0 - 0.15, rows * 1.24, ZD, 2.2, { front: plate(P.green), side: plate(P.green), top: (light) => (u: number, v: number) => at(P.green, (light === 2 ? 4 : 3) - (u % 22 < 1.2 ? 1.4 : 0) - (v % 16 < 1 ? 0.6 : 0)), edge: P.green[0] });
    // the forecastle: a raised deck following the bow's lines, a windlass, the foremast
    const i0 = pts.findIndex(([a]) => a >= fa);
    const fpts = pts.slice(i0);
    for (let i = 0; i < fpts.length - 1; i++) {
      const [aA, hA] = fpts[i];
      const [aB, hB] = fpts[i + 1];
      fillPoly(c, [p.P(aA, bm + hA * 0.97, ZD), p.P(aB, bm + hB * 0.97, ZD), p.P(aB, bm + hB * 0.97, ZD + 7), p.P(aA, bm + hA * 0.97, ZD + 7)], i % 2 ? P.white[4] : P.white[5]);
    }
    fillPoly(c, [p.P(fa, bm + fpts[0][1] * 0.97, ZD), p.P(fa, bm - fpts[0][1] * 0.97, ZD), p.P(fa, bm - fpts[0][1] * 0.97, ZD + 7), p.P(fa, bm + fpts[0][1] * 0.97, ZD + 7)], P.white[3]);
    deckFill(p, fpts, bm, ZD + 7, ['#3a4048', '#4a525a', '#5c646c', '#707880', '#868e94', '#9ea4a8'], 0.95);
    const [wx, wy] = p.P(fa + 1.0, bm, ZD + 7);
    px(c, wx - 8, wy - 7, '#3a3e44', 16, 7);
    ell(c, wx - 4, wy - 4, 4, 4, '#1e2024');
    ell(c, wx + 4, wy - 4, 4, 4, '#1e2024');
    const [fx, fy] = p.P(fa + 0.6, bm, ZD + 7);
    px(c, fx - 1, fy - 62, '#e8e4da', 2, 62);
    px(c, fx - 6, fy - 46, '#e8e4da', 12, 2);
    px(c, fx - 2, fy - 66, '#f4f0e6', 4, 4);
    // rust weeping from the scuppers down the hull, the load line mark amidships
    const NFl = front(p, bm + hb);
    for (let a = a0 + 1.2; a < fa; a += 1.35) {
      const [rx, ry] = NFl.F(a, ZD - 2);
      for (let j = 0; j < 30 + hash(Math.floor(a * 10), 3, 7) * 40; j++) if (bayer(rx, ry + j) > j / 70) px(c, rx, ry + j, j < 10 ? '#7a3a1e' : '#5a3020', 2, 1);
    }
    const [lx2, ly2] = NFl.F((a0 + fa) / 2, ZW + 14);
    ell(c, lx2, ly2, 6, 6, '#e8e4da');
    ell(c, lx2, ly2, 4.5, 4.5, at(HULLS, 3));
    ln(c, lx2 - 9, ly2, lx2 + 9, ly2, '#e8e4da');
    // the superstructure aft: decks of white with windows, the bridge with wings, radar mast, funnel
    const sa0 = a0 + 0.6;
    const sa1 = a0 + 4.0;
    const sw = 1.5;
    const decks = 4;
    const DH = 9;
    for (let d = 0; d < decks; d++) {
      const z = ZD + d * DH;
      const ins = d === decks - 1 ? 0.2 : 0.3;
      lbox(p, sa0 + ins * 0.5, bm - sw, sa1 - sa0 - ins, sw * 2, z, DH, { front: plate(P.white), side: plate(P.white), top: plate(P.white), edge: P.white[0] });
      const SF = front(p, bm + sw);
      const SS = side(p, sa1 - ins * 0.5);
      const nwin = 7;
      for (let i = 0; i < nwin; i++) {
        const u = sa0 + 0.35 + (i * (sa1 - sa0 - 0.7)) / (nwin - 1);
        pq(p, SF, u - 0.12, u + 0.12, z + 3.4, z + 6.8, d === decks - 1 ? '#1a2a36' : '#24343e');
        pq(p, SF, u - 0.12, u - 0.06, z + 5.6, z + 6.8, '#6a8a96');
      }
      for (let i = 0; i < 5; i++) {
        const u = bm - sw + 0.4 + i * ((sw * 2 - 0.8) / 4);
        pq(p, SS, u - 0.1, u + 0.1, z + 3.4, z + 6.8, '#1e2c34');
      }
    }
    // the bridge wings and the wheelhouse windows all round
    const zb = ZD + decks * DH;
    lbox(p, sa0 + 0.2, bm - sw - 0.5, sa1 - sa0 - 0.4, sw * 2 + 1.0, zb, 1.2, mono(plate(P.white), P.white[0]));
    const BF = front(p, bm + sw + 0.5);
    for (let a = sa0 + 0.25; a < sa1 - 0.25; a += 0.12) {
      const [x0, y0] = BF.F(a, zb + 1.2);
      px(c, x0, y0 - 8, '#d8d4ca', 1, 8);
    }
    const [w0x, w0y] = BF.F(sa0 + 0.2, zb + 4.6);
    const [w1x, w1y] = BF.F(sa1 - 0.2, zb + 4.6);
    ln(c, w0x, w0y, w1x, w1y, '#d8d4ca');
    // radar mast, radars, horn and the flag
    const [rx, ry] = p.P((sa0 + sa1) / 2, bm, zb + 1.2);
    layer(c, (l) => {
      px(l, rx - 2, ry - 70, '#e8e4da', 3, 70);
      px(l, rx - 16, ry - 50, '#e8e4da', 32, 3);
      ln(l, rx - 14, ry - 56, rx + 2, ry - 52, '#2a2a30', 2);
      ln(l, rx + 2, ry - 64, rx + 16, ry - 60, '#2a2a30', 2);
      px(l, rx - 3, ry - 74, '#f4f0e6', 5, 4);
      px(l, rx + 12, ry - 48, '#3ac85a', 2, 2);
      px(l, rx - 14, ry - 48, '#d8402a', 2, 2);
    }, { rect: [rx - 20, ry - 78, rx + 20, ry + 2] });
    // the funnel in the company's colours
    const fa0 = sa0 + 0.6;
    lbox(p, fa0, bm - 0.6, 1.1, 1.2, zb + 1.2, 18, { front: plate(P.navy), side: plate(P.navy), top: plate(IRON), edge: P.navy[0] });
    const FF = front(p, bm + 0.6);
    pq(p, FF, fa0, fa0 + 1.1, zb + 9, zb + 13, '#f4f0e6');
    pq(p, FF, fa0 + 0.35, fa0 + 0.75, zb + 9.5, zb + 12.5, '#c8382a');
    pq(p, side(p, fa0 + 1.1), bm - 0.6, bm + 0.6, zb + 9, zb + 13, '#d8d4ca');
    // the free-fall lifeboat on its ramp at the stern, two liferaft canisters
    const [lx, ly] = p.P(a0 + 0.4, bm + 0.5, ZD + 12);
    layer(c, (l) => {
      fillPoly(l, [[lx - 14, ly + 6], [lx + 16, ly - 9], [lx + 18, ly - 3], [lx - 12, ly + 12]], '#e8622a');
      fillPoly(l, [[lx - 10, ly], [lx + 12, ly - 11], [lx + 14, ly - 8], [lx - 8, ly + 3]], '#f48a4a');
      px(l, lx - 2, ly - 4, '#2a2a30', 6, 2);
    }, { rect: [lx - 16, ly - 14, lx + 20, ly + 14] });
    for (const db of [-0.9, 0.9]) {
      const [cx, cy] = p.P(sa1 - 0.3, bm + db, zb + 1.2);
      ell(c, cx, cy - 3, 5, 3, '#e8e4da');
      ell(c, cx - 1, cy - 4, 3, 1.5, '#ffffff');
    }
    // mooring lines from the bow and stern fairleads down to bollards on the quay (y = 12.7)
    const qb = 12.7 - p.y;
    for (const [la, qa] of [[a0 + 0.6, a0 - 1.2], [a0 + 2.6, a0 + 4.2], [a1 - 2.2, a1 - 3.8], [a1 - 1.0, a1 + 0.8]] as const) {
      const [x0, y0] = p.P(la, bm - hb * 0.95, ZD + 2);
      const [x1, y1] = p.P(qa, qb, 5);
      rope(c, x0, y0, x1, y1, 8, ROPE[2], ROPE[4]);
      ell(c, x1, y1 + 1, 7, 2.5, ROPE[1]);
      ell(c, x1, y1, 6, 2, ROPE[3]);
    }
    // the gangway down to the quay amidships of the superstructure
    const g0 = p.P(sa1 + 0.3, bm - hb, ZD + 2);
    const g1 = p.P(sa1 + 1.6, qb - 0.2, 0.5);
    ln(c, g0[0], g0[1], g1[0], g1[1], '#c8ccd0', 3);
    ln(c, g0[0], g0[1] - 7, g1[0], g1[1] - 7, '#e8e4da');
  },
};

// ── the straddle carrier ─────────────────────────────────────
// ── the container wagon on the siding ────────────────────────
const wagon: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    shadowBand(p, 0.05, 0.3, W - 0.05, 1.7, 0.35, 0.28);
    // bogies with wheels, the frame with its buffers, then the boxes
    for (const a of [1.0, W - 1.6]) {
      lbox(p, a, 0.5, 0.9, 1.0, 1.6, 2.4, mono(plate(IRON), IRON[0]));
      for (const da of [0.2, 0.7]) wheelOn(p, front(p, 1.52), a + da, 3.2, 0.16, ['#3a3430', '#4e4640', '#6a6058', '#8a8078', '#a49a90', '#c4bab0']);
    }
    lbox(p, 0.2, 0.42, W - 0.4, 1.16, 4, 2.2, { front: plate(['#2a2a26', '#3a3832', '#4a463e', '#5a564c', '#6c665a', '#7e786a']), side: plate(['#2a2a26', '#3a3832', '#4a463e', '#5a564c', '#6c665a', '#7e786a']), top: planks(['#3a3028', '#4a3e34', '#5a4c40', '#6c5c4e', '#7e6e5e', '#90806e'], 5), edge: '#1e1e1a' });
    const F = front(p, 1.58);
    for (let a = 0.4; a < W - 0.4; a += 0.5) pq(p, F, a, a + 0.06, 4, 6.2, '#1e1e1a');
    for (const b of [0.62, 1.38]) {
      const [x, y] = p.P(W - 0.1, b, 5);
      ell(c, x + 2, y, 3, 3, '#2a2a2e');
      ell(c, x + 2, y, 2, 2, '#9a9ea4');
    }
    const n = W >= 9 ? 2 : 1;
    const L = (W - 0.7 - (n - 1) * 0.15) / n;
    for (let i = 0; i < n; i++) {
      if (k.color === 'empty' && i === 1) continue;
      const sd = hash(k.seed * 3 + i, 4, 9);
      drawBox(p, 0.35 + i * (L + 0.15), 0.4, L, 1.2, 6.2, BOXH, pickColour(sd), { seed: Math.floor(sd * 9999), rust: 0.5, doors: i === n - 1 ? 'closed' : 'blank', logo: L > 4 });
    }
    stencil(p, F, 0.4, 5.6, `SGNS ${400 + (k.seed % 90)}`, '#e8e4da');
  },
};

// ── the container train (a vehicle on the siding: w × 1, drawn along a) ──
// A diesel loco at each end, cab outward, so it looks the same whichever way
// it runs; container flats in between with 40 ft and 2 × 20 ft boxes in the
// reference's colours (blue, grey, red, white). Kept within its 1-tile depth.
const LOCO: Ramp = ['#4a0c10', '#6e1016', '#94181c', '#b42222', '#cc2e2a', '#e04a40', '#f06a58'];
function loco(p: PropPainter, a0: number, a1: number, cabEnd: 0 | 1) {
  const c = p.c;
  const body = plate(LOCO);
  const roof = plate(['#3a3e46', '#4a4e56', '#5a5e66', '#6c7078', '#7e828a', '#92969c']);
  // bogies, wheels, the frame with its buffers
  for (const a of [a0 + 0.35, a1 - 1.25]) {
    lbox(p, a, 0.18, 0.9, 0.64, 1.4, 2.6, mono(plate(IRON), IRON[0]));
    for (const da of [0.2, 0.7]) wheelOn(p, front(p, 0.84), a + da, 3.2, 0.16, ['#3a3430', '#4e4640', '#6a6058', '#8a8078', '#a49a90', '#c4bab0']);
  }
  lbox(p, a0, 0.1, a1 - a0, 0.8, 4, 2, mono(plate(STEEL), STEEL[0]));
  // the hood: red, a white band, louvres, the cab with its windscreen at the outer end
  lbox(p, a0 + 0.05, 0.14, a1 - a0 - 0.1, 0.72, 6, 20, { front: body, side: body, top: roof, edge: LOCO[0] });
  const F = front(p, 0.86);
  pq(p, F, a0 + 0.05, a1 - 0.05, 12.2, 13.8, '#f4f0e6');
  pq(p, F, a0 + 0.05, a1 - 0.05, 6, 6.8, '#2a2a30');
  for (let a = a0 + 0.9; a < a1 - 0.9; a += 0.22) pq(p, F, a, a + 0.1, 16, 23, darken(LOCO[3], 0.25));
  const cabA = cabEnd ? a1 - 0.75 : a0 + 0.15;
  pt(p, F, cabA, cabA + 0.5, 18.4, 24, glass, 1);
  if (cabEnd) {
    const S = side(p, a1 - 0.05);
    pt(p, S, 0.2, 0.8, 18.4, 24.2, glass, 0);
    pq(p, S, 0.18, 0.82, 12.2, 13.8, '#d8d4ca');
    pq(p, S, 0.44, 0.56, 14.6, 16.4, '#f2c43a');
    // headlights and buffers on the nose
    for (const b of [0.26, 0.74]) {
      const [x, y] = side(p, a1 - 0.05).F(b, 9);
      px(c, x - 2, y - 2, '#fff4c0', 4, 3);
      const [bx, by] = p.P(a1 + 0.05, b, 4.8);
      ell(c, bx + 1, by, 3, 3, '#2a2a2e');
    }
  }
  // roof gear: a radiator grille and horns
  lbox(p, (a0 + a1) / 2 - 0.4, 0.3, 0.8, 0.4, 26, 1.2, mono(plate(GALV), GALV[0]));
}

const train: PropArt = {
  draw(p, k) {
    const W = k.w;
    shadowBand(p, 0.05, 0.05, W - 0.05, 0.95, 0.35, 0.3);
    const LL = 3;
    loco(p, 0, LL, 0);
    // flats between the locos
    const nW = Math.max(1, Math.round((W - 2 * LL) / 8));
    const wl = (W - 2 * LL) / nW;
    const cols: Ramp[] = [P.blue, P.grey, P.red, P.white, P.sky, P.green];
    for (let i = 0; i < nW; i++) {
      const a = LL + i * wl;
      for (const ba of [a + 0.9, a + wl - 1.6]) {
        lbox(p, ba, 0.18, 0.8, 0.64, 1.4, 2.4, mono(plate(IRON), IRON[0]));
        for (const da of [0.18, 0.62]) wheelOn(p, front(p, 0.84), ba + da, 3.2, 0.16, ['#3a3430', '#4e4640', '#6a6058', '#8a8078', '#a49a90', '#c4bab0']);
      }
      lbox(p, a + 0.15, 0.08, wl - 0.3, 0.84, 4, 2.2, { front: plate(['#2a2a26', '#3a3832', '#4a463e', '#5a564c', '#6c665a', '#7e786a']), side: plate(['#2a2a26', '#3a3832', '#4a463e', '#5a564c', '#6c665a', '#7e786a']), top: planks(['#3a3028', '#4a3e34', '#5a4c40', '#6c5c4e', '#7e6e5e', '#90806e'], 5), edge: '#1e1e1a' });
      const sd = hash(k.seed * 3 + i, 4, 9);
      if (i % 2 === 0) drawBox(p, a + 0.3, 0.04, wl - 0.6, 0.92, 6.2, BOXH, cols[(i + k.seed) % cols.length], { seed: Math.floor(sd * 9999), rust: 0.35, doors: 'blank', logo: true });
      else {
        const L = (wl - 0.75) / 2;
        for (let j = 0; j < 2; j++) drawBox(p, a + 0.3 + j * (L + 0.15), 0.04, L, 0.92, 6.2, BOXH, cols[(i + j * 3 + k.seed) % cols.length], { seed: Math.floor(sd * 9999) + j, rust: 0.35, doors: 'blank' });
      }
    }
    loco(p, W - LL, W, 1);
  },
};

// ── night lights ────────────────────────────────────────────
ship.lights = (k) => [
  { a: k.w * 0.12, b: k.d / 2, z: 60, r: 2.4, color: '#ffd9a0', kind: 'window' },
  { a: k.w * 0.5, b: k.d / 2, z: 40, r: 3, color: '#f2f6ff', kind: 'lamp' },
];

export const PORT_TERMINAL: Record<string, PropArt> = {
  prt_stack: stack,
  prt_stsframe: stsframe,
  prt_sts: sts,
  prt_ship: ship,
  prt_wagon: wagon,
  prt_train: train,
};

export { GALV };

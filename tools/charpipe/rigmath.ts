// Character pipeline prototype: forward kinematics of the cut-out rig, for groundLock.
// Same convention as EffectCraft / After Effects: y down, positive rotation is clockwise on screen,
// a joint turns about its pivot and its children ride along.
import { specEntries, type AnimationSpec, type CharacterSpec, type Pt, type Rig } from './spec';

type M = [number, number, number, number, number, number]; // a b c d e f: x' = a x + c y + e, y' = b x + d y + f
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
const apply = (m: M, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function local(pivot: Pt, deg: number, dx: number, dy: number, step: [number, number, number, number] | null): M {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // translate(pivot + offset) · step · rotate · translate(-pivot); step is row-major [m0 m1; m2 m3]
  const [px, py] = pivot;
  const [m0, m1, m2, m3] = step ?? [1, 0, 0, 1];
  const L = [m0 * c + m1 * s, m2 * c + m3 * s, -m0 * s + m1 * c, -m2 * s + m3 * c];
  return [L[0], L[1], L[2], L[3], px + dx - (L[0] * px + L[2] * py), py + dy - (L[1] * px + L[3] * py)];
}

export function worldMatrices(rig: Rig, ch: CharacterSpec, anim: AnimationSpec, f: number, extra: Record<string, { dy: number }> = {}): Map<string, M> {
  const out = new Map<string, M>();
  for (const j of rig.joints) {
    const t = anim.tracks[j.id];
    const m = local(ch.pivots[j.id], t?.rot?.[f] ?? 0, t?.dx?.[f] ?? 0, (t?.dy?.[f] ?? 0) + (extra[j.id]?.dy ?? 0), stepOf(rig, ch, anim, j.id, f));
    out.set(j.id, j.parent ? mul(out.get(j.parent)!, m) : m);
  }
  return out;
}

/**
 * The pelvis offsets (whole px, one per frame) that put the lowest sole point back on its rest
 * row: the planted foot stays on the ground while the legs turn. Added to the pelvis dy track.
 */
export function groundLock(rig: Rig, ch: CharacterSpec, anim: AnimationSpec): number[] {
  const dys: number[] = [];
  for (let f = 0; f < anim.frames; f++) {
    const ms = worldMatrices(rig, ch, anim, f);
    let lift = -Infinity; // how far below its rest row the lowest point went (+ = into the ground)
    for (const [part, pts] of specEntries(ch.soles)) for (const p of pts) lift = Math.max(lift, apply(ms.get(part)!, p)[1] - p[1]);
    dys.push(Math.round(-lift));
  }
  return dys;
}

/**
 * A limb stepping along the ground instead of turning in the screen plane (what the shipped
 * Alex rig does): its far end moves `step` px along the ground diagonal. Linear part about the
 * pivot, [a, b, c, d] with x' = a x + b y, y' = c x + d y.
 */
export function stepMatrix(step: number, reach: number, slope: number): [number, number, number, number] {
  const s = step / reach;
  return [1, s, 0, 1 + s * slope];
}

/**
 * EffectCraft layers can only rotate and scale, but a parent rotated and scaled non-uniformly
 * makes its child skew. Any 2×2 matrix is R(r1) · diag(sx, sy) · R(r2) (a 2×2 SVD), so a null
 * (rotation r1, scale sx, sy) parenting the limb (rotation r2) reproduces it exactly.
 * Degrees clockwise on screen, scale in %.
 */
export function decompose([a, b, c, d]: [number, number, number, number]): { r1: number; sx: number; sy: number; r2: number } {
  const E = (a + d) / 2;
  const F = (a - d) / 2;
  const G = (c + b) / 2;
  const H = (c - b) / 2;
  const Q = Math.hypot(E, H);
  const R = Math.hypot(F, G);
  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(H, E);
  const deg = 180 / Math.PI;
  const out = { r1: ((a2 + a1) / 2) * deg, sx: (Q + R) * 100, sy: (Q - R) * 100, r2: ((a2 - a1) / 2) * deg };
  // check: R(r1) S R(r2) must give back the matrix
  const rot = (t: number): [number, number, number, number] => [Math.cos(t / deg), -Math.sin(t / deg), Math.sin(t / deg), Math.cos(t / deg)];
  const m2 = (p: number[], q: number[]) => [p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3], p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3]];
  const back = m2(m2(rot(out.r1), [out.sx / 100, 0, 0, out.sy / 100]), rot(out.r2));
  if (back.some((v, i) => Math.abs(v - [a, b, c, d][i]) > 1e-9)) throw new Error(`decompose: ${[a, b, c, d]} → ${back}`);
  return out;
}

/** The step matrix of a joint at frame f, or null when the animation does not step it. */
export function stepOf(rig: Rig, ch: CharacterSpec, anim: AnimationSpec, joint: string, f: number) {
  const st = anim.tracks[joint]?.step;
  if (!st) return null;
  const reach = ch.reach[joint];
  if (!reach) throw new Error(`${anim.id}: ${joint} steps but the character has no reach for it`);
  return stepMatrix(st[f] ?? 0, reach, rig.groundSlope[ch.view] ?? 0);
}

// A jointed body, free of React so it can be tested. Limbs are solved with
// two-bone inverse kinematics: give a hand a target and the shoulder and elbow
// angles follow from the law of cosines. A target past full stretch has no
// solution, so the hand stops at full reach: the body can only touch what it
// can reach. Units: a standing figure is 60 tall, feet at y 0, up is negative.

export interface Pt {
  x: number;
  y: number;
}

export const BONES = { thigh: 13, shin: 13, upperArm: 11.5, foreArm: 11.5, spine: 22, neck: 9, shoulders: 11, hips: 5.5 };
export const ARM = BONES.upperArm + BONES.foreArm;
export const LEG = BONES.thigh + BONES.shin;

export interface Limb {
  mid: Pt;
  end: Pt;
  // False when the target was out of reach and the limb stopped at full stretch.
  reached: boolean;
}

// outward: -1 bends the joint toward low x, 1 toward high x. Elbows and knees
// only ever bend away from the body, never through it.
export function twoBone(root: Pt, target: Pt, l1: number, l2: number, outward: -1 | 1): Limb {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const full = l1 + l2;
  const gap = Math.hypot(dx, dy);
  const reached = gap <= full;
  const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(full - 0.01, gap));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const mids = [base + a, base - a].map((t) => ({ x: root.x + Math.cos(t) * l1, y: root.y + Math.sin(t) * l1 }));
  const mid = (mids[0].x - mids[1].x) * outward >= 0 ? mids[0] : mids[1];
  const ux = gap > 0.001 ? dx / gap : 0;
  const uy = gap > 0.001 ? dy / gap : 1;
  const end = reached ? { x: target.x, y: target.y } : { x: root.x + ux * d, y: root.y + uy * d };
  return { mid, end, reached };
}

export interface PoseInput {
  // The pelvis.
  hip: Pt;
  // Spine angle from upright in radians; positive leans toward high x.
  lean?: number;
  handL: Pt;
  handR: Pt;
  footL: Pt;
  footR: Pt;
}

export interface Skeleton {
  hip: Pt;
  hipL: Pt;
  hipR: Pt;
  neck: Pt;
  head: Pt;
  shoulderL: Pt;
  shoulderR: Pt;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
}

export function solve(p: PoseInput): Skeleton {
  const lean = p.lean ?? 0;
  const up = { x: Math.sin(lean), y: -Math.cos(lean) };
  const side = { x: Math.cos(lean), y: Math.sin(lean) };
  const along = (from: Pt, dir: Pt, n: number) => ({ x: from.x + dir.x * n, y: from.y + dir.y * n });
  const neck = along(p.hip, up, BONES.spine);
  const head = along(neck, up, BONES.neck);
  const shoulderL = along(neck, side, -BONES.shoulders);
  const shoulderR = along(neck, side, BONES.shoulders);
  const hipL = along(p.hip, side, -BONES.hips);
  const hipR = along(p.hip, side, BONES.hips);
  return {
    hip: p.hip,
    hipL,
    hipR,
    neck,
    head,
    shoulderL,
    shoulderR,
    armL: twoBone(shoulderL, p.handL, BONES.upperArm, BONES.foreArm, -1),
    armR: twoBone(shoulderR, p.handR, BONES.upperArm, BONES.foreArm, 1),
    legL: twoBone(hipL, p.footL, BONES.thigh, BONES.shin, -1),
    legR: twoBone(hipR, p.footR, BONES.thigh, BONES.shin, 1),
  };
}

import { ARM, Pt, PoseInput } from './skeleton';

// Ready-made poses. Each is only a set of targets: the skeleton works out the
// joints, so a pose can never stretch a limb past its length.

export const stand = (): PoseInput => ({ hip: { x: 0, y: -26 }, handL: { x: -15, y: -27 }, handR: { x: 15, y: -27 }, footL: { x: -6, y: 0 }, footR: { x: 6, y: 0 } });

// A keeper's set position: knees bent, weight forward, hands ready.
export const ready = (): PoseInput => ({ hip: { x: 0, y: -21 }, handL: { x: -20, y: -37 }, handR: { x: 20, y: -37 }, footL: { x: -10, y: 0 }, footR: { x: 10, y: 0 } });

// A running stride. phase in radians.
export function run(phase: number): PoseInput {
  const s = Math.sin(phase);
  return {
    hip: { x: 0, y: -25 + Math.abs(s) * -1.5 },
    lean: 0.08,
    handL: { x: -14 + s * 4, y: -33 + s * 6 },
    handR: { x: 14 + s * 4, y: -33 - s * 6 },
    footL: { x: -4 + s * 9, y: -Math.max(0, s) * 8 },
    footR: { x: 4 - s * 9, y: -Math.max(0, -s) * 8 },
  };
}

// Making himself big: arms out to span units either side.
export function spread(span: number): PoseInput {
  const reach = Math.max(14, Math.min(span, 11 + ARM - 1));
  const y = -44 + Math.max(0, reach - 16) * 0.35;
  return { ...stand(), handL: { x: -reach, y }, handR: { x: reach, y } };
}

// Feet wide apart, as in the nutmeg game.
export function straddle(span: number): PoseInput {
  const hip = -Math.max(19, 26 - span * 0.22);
  return { hip: { x: 0, y: hip }, handL: { x: -16, y: hip - 2 }, handR: { x: 16, y: hip - 2 }, footL: { x: -span, y: 0 }, footR: { x: span, y: 0 } };
}

// A jump: k 0 on the grass to 1 at the top, arms up.
export function jump(k: number): PoseInput {
  const hip = -26 - k * 11;
  return { hip: { x: 0, y: hip }, handL: { x: -13 - k * 2, y: hip - 12 - k * 22 }, handR: { x: 13 + k * 2, y: hip - 12 - k * 22 }, footL: { x: -5, y: -k * 8 }, footR: { x: 5, y: -k * 8 } };
}

// Striking a ball, seen from behind. foot: which leg swings. k: -1 at the top of
// the backswing, 0 at the ball, 1 at the end of the follow-through.
export function kick(foot: 'L' | 'R', k: number): PoseInput {
  const s = foot === 'R' ? 1 : -1;
  const lift = Math.max(0, Math.abs(k)) * 15;
  const swing = { x: s * (5 + (k > 0 ? -k * 11 : -k * 6)), y: -lift };
  const plant = { x: -s * 7, y: 0 };
  return {
    hip: { x: -s * 2, y: -25 + Math.abs(k) * 1.5 },
    lean: -s * 0.1 * k,
    // The arm opposite the kicking leg comes across for balance.
    handL: { x: -18 - (s < 0 ? 6 * k : 0), y: -36 + (s > 0 ? -7 * Math.abs(k) : 0) },
    handR: { x: 18 + (s > 0 ? 6 * k : 0), y: -36 + (s < 0 ? -7 * Math.abs(k) : 0) },
    footL: s > 0 ? plant : swing,
    footR: s > 0 ? swing : plant,
  };
}

// A slide tackle along the ground toward dir.
export function slide(dir: -1 | 1): PoseInput {
  return { hip: { x: -dir * 4, y: -9 }, lean: -dir * 1.1, handL: { x: -dir * 24, y: -16 }, handR: { x: -dir * 12, y: -3 }, footL: { x: dir * 20, y: -3 }, footR: { x: dir * 12, y: 0 } };
}

// A keeper's dive. side -1 or 1; amount 0 set to 1 full stretch. reach, in
// figure units from his feet, is where the hands go, if the ball sets it.
export function dive(side: number, amount: number, reach?: Pt): PoseInput {
  const k = Math.max(0, Math.min(1, amount));
  const s = side || 1;
  const lean = s * k * 1.32;
  const hip = { x: s * k * 24, y: -21 - Math.sin(k * Math.PI * 0.8) * 13 - k * 4 };
  // Past the head along the spine, if the ball gives no target.
  const headX = hip.x + Math.sin(lean) * 48;
  const headY = hip.y - Math.cos(lean) * 48;
  const handL = reach ? { x: reach.x - 3, y: reach.y } : { x: headX - 4, y: headY - 3 };
  const handR = reach ? { x: reach.x + 3, y: reach.y } : { x: headX + 4, y: headY + 3 };
  const set = ready();
  const mix = (a: Pt, b: Pt) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  return {
    hip,
    lean,
    handL: reach ? handL : mix(set.handL, handL),
    handR: reach ? handR : mix(set.handR, handR),
    // The legs trail behind him, one a little ahead of the other.
    footL: mix(set.footL, { x: hip.x - Math.sin(lean) * 24 - 3, y: hip.y + Math.cos(lean) * 24 + 2 }),
    footR: mix(set.footR, { x: hip.x - Math.sin(lean) * 25 + 4, y: hip.y + Math.cos(lean) * 25 }),
  };
}

// A goal celebration at time t in seconds. lift raises him; turn spins him.
export function celebrate(style: string, t: number): { pose: PoseInput; lift: number; turn: number } {
  const beat = Math.abs(Math.sin(t * 5));
  switch (style) {
    case 'knee-slide':
      return { pose: { hip: { x: 0, y: -13 }, lean: -0.32, handL: { x: -26, y: -46 }, handR: { x: 22, y: -52 }, footL: { x: -14, y: 0 }, footR: { x: 12, y: -1 } }, lift: 0, turn: 0 };
    case 'backflip': {
      const k = (t % 1.3) / 1.3;
      const air = k < 0.6;
      return { pose: jump(air ? 0.8 : 0), lift: air ? Math.sin((k / 0.6) * Math.PI) * 30 : 0, turn: air ? -(k / 0.6) * 360 : 0 };
    }
    case 'shush':
      return { pose: { ...stand(), handR: { x: 1, y: -55 }, handL: { x: -16, y: -28 } }, lift: 0, turn: 0 };
    case 'heart':
      return { pose: { ...stand(), handL: { x: -3, y: -46 - beat * 3 }, handR: { x: 3, y: -46 - beat * 3 } }, lift: 0, turn: 0 };
    case 'robot': {
      const up = Math.floor(t * 3) % 2 === 0;
      return { pose: { ...stand(), handL: up ? { x: -21, y: -56 } : { x: -21, y: -33 }, handR: up ? { x: 21, y: -33 } : { x: 21, y: -56 } }, lift: 0, turn: 0 };
    }
    case 'calm':
      return { pose: { ...stand(), handL: { x: 7, y: -39 }, handR: { x: -7, y: -41 } }, lift: 0, turn: 0 };
    default:
      return { pose: jump(0.6 + beat * 0.4), lift: beat * 12, turn: 0 };
  }
}

// The referee's signals.
export const point = (side: -1 | 1): PoseInput => ({ ...stand(), lean: side * 0.05, handL: side < 0 ? { x: -30, y: -49 } : { x: -14, y: -27 }, handR: side > 0 ? { x: 30, y: -49 } : { x: 14, y: -27 } });
export const armUp = (side: -1 | 1): PoseInput => ({ ...stand(), handL: side < 0 ? { x: -8, y: -71 } : { x: -14, y: -27 }, handR: side > 0 ? { x: 8, y: -71 } : { x: 14, y: -27 } });
export const playOn = (): PoseInput => ({ ...stand(), handL: { x: -24, y: -44 }, handR: { x: 24, y: -44 } });

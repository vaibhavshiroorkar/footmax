// A shot, played out against a keeper with a real body. Nothing here is a
// dice roll on the result: the keeper reacts late, moves at his speed, and
// either the ball meets his reach or it does not. No touch, no save.
// Distances are metres across the goal from its centre, heights in metres.
// Timings come from research: the ball takes 0.4 to 0.6 s from the penalty
// spot, and a keeper about 0.6 s to reach a side, a second for a top corner.

export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
const POST = 0.12;
// How far his centre is off the ground as he moves.
const BODY_Z = 1;

export type Touch = 'body' | 'hand' | 'fingers';
export type ShotEnd = 'net' | 'inOffHand' | 'inOffPost' | 'held' | 'parry' | 'tipRound' | 'tipOver' | 'post' | 'bar' | 'wide' | 'over';

export interface ShotInput {
  // Across the goal from the shooter's view: 0 his left post, 1 his right.
  aim: number;
  // Height at the line, as a share of the bar. Over 1 clears it.
  height: number;
  // Seconds from boot to goal line.
  flight: number;
  keeper: {
    // Where he stands, in the same units as aim.
    at: number;
    skill: number;
    // 0 on his line to 1 right off it: he has less far to go.
    rush?: number;
    // Sold by a fake: he starts later and reaches less.
    fooled?: boolean;
    // A penalty: he goes here on the kick, whatever the ball does.
    guess?: number;
  };
  // How much harder the ball's movement makes it to read: 1 for a straight
  // ball, more for a curler that moves late.
  curl?: number;
  rand: () => number;
}

export interface ShotRun {
  outcome: 'goal' | 'save' | 'miss';
  end: ShotEnd;
  // Where and when the ball met him, if it did. t is a share of the flight.
  touch?: { t: number; limb: Touch };
  // Where he ended up, in the same units as aim, and when he set off.
  keeperTo: number;
  launch: number;
}

const toMetres = (share: number) => (share - 0.5) * GOAL_W;
const toShare = (m: number) => m / GOAL_W + 0.5;

export interface KeeperBody {
  reaction: number;
  speed: number;
  reach: number;
  stretch: number;
}

// What a keeper of this skill can do. Better keepers set off sooner, move
// faster and reach further.
export function keeperBody(skill: number): KeeperBody {
  return { reaction: 0.3 - skill * 0.0012, speed: 2.8 + skill * 0.012, reach: 0.72 + skill * 0.002, stretch: 2.1 + skill * 0.006 };
}

// How far from where he stands he can touch a ball that takes this long.
export function coverage(skill: number, flight: number, rush = 0): number {
  const k = keeperBody(skill);
  return (Math.min(k.stretch, k.speed * Math.max(0, flight - k.reaction)) + k.reach) * (1 + rush * 0.35);
}

// The goal width he covers, as a share, for the bar under him in the shot game.
export const coverageShare = (skill: number, flight: number, rush = 0) => coverage(skill, flight, rush) / GOAL_W;

function normal(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

export function flyShot(s: ShotInput): ShotRun {
  const x = toMetres(s.aim);
  const z = s.height * GOAL_H;
  const k = keeperBody(s.keeper.skill);
  const from = toMetres(s.keeper.at);
  const launch = s.keeper.guess !== undefined ? 0 : k.reaction / Math.max(0.01, s.flight);

  // Off the frame first: the woodwork decides before the keeper does.
  const offPost = Math.abs(Math.abs(x) - GOAL_W / 2) < POST && z < GOAL_H;
  const offBar = Math.abs(z - GOAL_H) < POST && Math.abs(x) < GOAL_W / 2;
  if (Math.abs(x) >= GOAL_W / 2 + POST) return { outcome: 'miss', end: 'wide', keeperTo: toShare(from + Math.sign(x - from) * Math.min(1, Math.abs(x - from))), launch };
  if (z >= GOAL_H + POST) return { outcome: 'miss', end: 'over', keeperTo: toShare(from + (x - from) * 0.3), launch };

  // How far he has to go, and how far he can.
  const rush = s.keeper.rush ?? 0;
  const guess = s.keeper.guess === undefined ? undefined : toMetres(s.keeper.guess);
  // He misreads a little; a curler and a fake make it worse.
  const misread = Math.abs(normal(s.rand)) * (0.32 - s.keeper.skill * 0.0022) * (s.curl ?? 1) * (s.keeper.fooled ? 1.8 : 1);
  const gap = Math.hypot(x - (guess ?? from), (z - BODY_Z) * 1.15);
  const need = guess === undefined ? gap + misread : gap;
  const moving = guess === undefined ? Math.min(k.stretch, k.speed * Math.max(0, s.flight - k.reaction * (s.keeper.fooled ? 1.5 : 1))) : 0.35;
  const can = (moving + k.reach * (s.keeper.fooled ? 0.82 : 1)) * (1 + rush * 0.35);
  const margin = can - need;

  if (margin < 0) {
    // Beyond him. He is left short, at full stretch.
    const to = toShare((guess ?? from) + Math.sign(x - (guess ?? from)) * Math.min(Math.abs(x - (guess ?? from)), guess === undefined ? moving : 0.35));
    if (offPost) return s.rand() < 0.5 ? { outcome: 'goal', end: 'inOffPost', keeperTo: to, launch } : { outcome: 'miss', end: 'post', keeperTo: to, launch };
    if (offBar) return { outcome: 'miss', end: 'bar', keeperTo: to, launch };
    return { outcome: 'goal', end: 'net', keeperTo: to, launch };
  }

  // He gets to it. How well depends on how much he had to spare.
  const limb: Touch = margin > 0.75 ? 'body' : margin > 0.25 ? 'hand' : 'fingers';
  const touch = { t: 0.86 + Math.min(0.1, rush * 0.1), limb };
  const keeperTo = s.aim;
  const fast = s.flight < 0.62;
  const nearPost = Math.abs(x) > GOAL_W / 2 - 1.1;
  const high = z > GOAL_H - 0.55;
  if (limb === 'fingers') {
    // A fingertip does not always stop a hard shot.
    if (s.rand() < (fast ? 0.32 : 0.14)) return { outcome: 'goal', end: 'inOffHand', touch, keeperTo, launch };
    if (high) return { outcome: 'save', end: 'tipOver', touch, keeperTo, launch };
    return { outcome: 'save', end: nearPost ? 'tipRound' : 'parry', touch, keeperTo, launch };
  }
  if (limb === 'hand') {
    if (high && s.rand() < 0.6) return { outcome: 'save', end: 'tipOver', touch, keeperTo, launch };
    if (nearPost && s.rand() < 0.6) return { outcome: 'save', end: 'tipRound', touch, keeperTo, launch };
    return { outcome: 'save', end: fast || s.rand() < 0.45 ? 'parry' : 'held', touch, keeperTo, launch };
  }
  return { outcome: 'save', end: fast && s.rand() < 0.4 ? 'parry' : 'held', touch, keeperTo, launch };
}

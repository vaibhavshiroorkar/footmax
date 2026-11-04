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
// How far a beaten keeper's body stays from the ball, so it never passes through.
const CLEAR = 1.05;

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
    // The shooter's edge, from 0: a clinical finisher, a clear run. It takes
    // this share off what the keeper can reach.
    edge?: number;
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

// How hard it is hit decides how fast it goes and how true. power 0 to 1.
export const ballSpeed = (power: number) => 13 + power * 21;
export const powerStray = (power: number) => -0.012 + power * power * 0.085;

// Weighing a pass: hold longer for a longer ball. held 0 to 1 is how full the bar
// was, ideal where it should be. Returns how much of the pass's value survives.
export function passWeight(held: number, ideal: number): number {
  return Math.max(0.35, 1 - Math.abs(held - ideal) * 1.4);
}

export interface KeeperBody {
  reaction: number;
  speed: number;
  reach: number;
  stretch: number;
}

// What a keeper of this skill can do. Better keepers set off sooner, move
// faster and reach further.
export function keeperBody(skill: number): KeeperBody {
  return { reaction: 0.28 - skill * 0.0012, speed: 3.2 + skill * 0.012, reach: 0.82 + skill * 0.002, stretch: 2.3 + skill * 0.006 };
}

// How far from where he stands he can touch a ball that takes this long.
export function coverage(skill: number, flight: number, rush = 0): number {
  const k = keeperBody(skill);
  return (Math.min(k.stretch, k.speed * Math.max(0, flight - k.reaction)) + k.reach) * (1 + rush * 0.35);
}

// The goal width he covers, as a share, for the bar under him in the shot game.
export const coverageShare = (skill: number, flight: number, rush = 0) => coverage(skill, flight, rush) / GOAL_W;

// Going up for a header. timing: how far off the jump was, as a share of the
// ball's swing. window: how much leeway height and strength give. marker: how
// strong the man going up with him is, 0 to 1.
export function judgeHeader(h: { timing: number; window: number; rightLane: boolean; air: number; marker: number; rand: () => number }): { contact: boolean; quality: number; text: string } {
  if (h.timing > h.window * 2) return { contact: false, quality: 0, text: 'Mistimed. It goes over your head.' };
  const timing = Math.max(0, 1 - h.timing / (h.window * 2));
  // In the wrong place he can only stretch for it.
  const quality = timing * (h.rightLane ? 1 : 0.4);
  // The marker goes up too: the better jump wins it.
  const strength = Math.max(0, Math.min(1, h.air / 99));
  const won = quality + strength * 0.5 + h.rand() * 0.25 > h.marker + 0.25;
  if (!won) return { contact: false, quality: 0, text: h.rightLane ? 'The marker gets there first.' : 'Wrong run. The marker has it.' };
  return { contact: true, quality, text: quality > 0.7 ? 'Bullet header!' : 'Good contact.' };
}

// How likely a shot is to score from d metres, for an average shooter: it falls
// exponentially, fitted to published figures of about 0.10 at 16.5 m and 0.03
// at 27 m. That gives about 0.0016 from halfway, which is our own extension.
export function distanceChance(metres: number): number {
  return 0.1 * Math.exp(-0.115 * (metres - 16.5));
}

export type LongKind = 'lob' | 'driven';

export interface LongRun {
  outcome: 'goal' | 'save' | 'miss';
  end: 'net' | 'held' | 'wide' | 'over';
}

// Half the width of the power window, as a share of the bar. It narrows
// exponentially with distance; a good shooter gets more of it.
export function longWindow(metres: number, shooting: number): number {
  return Math.max(0.012, 0.11 * Math.exp(-0.035 * (metres - 30)) * (0.55 + (shooting / 99) * 0.75));
}

// A shot from a long way out. error: how far off the window centre, where 1 is
// its edge. A keeper off his line is the real chance, for a lob most of all.
export function longShot(s: { metres: number; shooting: number; keeperOut: number; kind: LongKind; error: number; rand: () => number }): LongRun {
  if (s.error > 1) return s.rand() < 0.55 ? { outcome: 'miss', end: 'over' } : { outcome: 'miss', end: 'wide' };
  const clean = 1 - s.error * 0.7;
  const exposed = s.kind === 'lob' ? 1 + (s.keeperOut / 3.2) ** 2 : 1 + s.keeperOut / 12;
  const p = Math.min(0.8, distanceChance(s.metres) * (0.5 + (s.shooting / 99) * 1.1) * 9 * clean * clean * exposed);
  if (s.rand() < p) return { outcome: 'goal', end: 'net' };
  // On target, but it is a long way: he has time.
  return s.rand() < 0.6 ? { outcome: 'save', end: 'held' } : { outcome: 'miss', end: s.kind === 'lob' ? 'over' : 'wide' };
}

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
  // The very corners are the hardest of all to get to.
  const corner = Math.abs(x) > GOAL_W / 2 - 0.65 && (z > GOAL_H - 0.7 || z < 0.45) ? 1.12 : 1;
  const gap = Math.hypot(x - (guess ?? from), (z - BODY_Z) * 1.15) * corner;
  const need = guess === undefined ? gap + misread : gap;
  const moving = guess === undefined ? Math.min(k.stretch, k.speed * Math.max(0, s.flight - k.reaction * (s.keeper.fooled ? 1.5 : 1))) : 0.35;
  const can = (moving + k.reach * (s.keeper.fooled ? 0.82 : 1)) * (1 + rush * 0.35) * (1 - (s.keeper.edge ?? 0));
  const margin = can - need;

  if (margin < 0) {
    // Beyond him. He is left short at full stretch, and never where the ball
    // goes: what beat him was his read, so his body is somewhere else.
    const base = guess ?? from;
    const side = Math.sign(x - base) || 1;
    const went = Math.min(Math.abs(x - base), guess === undefined ? moving : 0.35);
    const to = toShare(Math.abs(base + side * went - x) < CLEAR ? x - side * CLEAR : base + side * went);
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

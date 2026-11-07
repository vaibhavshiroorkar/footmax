import { Fixture, Player, Position, Style, World, Formation, Club } from './types';
import { Rng, clamp } from './rng';
import { matchRating, shortName } from './player';
import { bench, startingXI, teamById } from './lineup';
import { SKILL_MOVES, finishBonus, hasMove, skillLevel } from './skills';
import { formShift } from './mood';
import { ROLES, isRole, FORMATION_LEAN } from './roles';
import { celebrationText } from './creation';
import { line, LineKind } from './commentary';
import { ShotEnd, distanceChance } from './contact';
import { firstLegOf } from './europe';
import { EXTRA_PASS_VISION } from './perks';
import { CARD_PER_MINUTE, FLAG_CALL, FLARE_ODDS, FLARE_UP, FOUL_CALL, HEAT_PER_CARD, Laws, MIN_PLAYERS, PENALTY_PER_CHANCE, PENALTY_RED, STRAIGHT_RED, banFor, lawsFor } from './laws';
import { Pattern, ShotFacts, goalLine, missLine, saveLine } from './shotText';
import { PlayOutcome, PlayStart, PlayStep, Positions, addFinish, assignNumbers, assignSlots, buildPlay, nextStart, playSeed, toPitch } from './play';

export type SideKey = 'home' | 'away';
// 'choice' asks the user what to do (shoot, pass or dribble) before the
// matching mini-game; 'header' meets a cross.
// 'intercept', 'block' and 'clear' are the defending moments: read a pass,
// throw yourself in front of a shot, head a cross away.
export type MomentKind = 'shot' | 'dribble' | 'pass' | 'penalty' | 'freekick' | 'save' | 'tackle' | 'header' | 'choice' | 'intercept' | 'block' | 'clear' | 'fight';

// Where the career player plays in a match. It decides which moments come
// to him: shots and men to beat up front, passes, long shots and
// interceptions in the middle, tackles, blocks and headers at the back.
export type Zone = 'defend' | 'middle' | 'attack';

// Career player's calls from the pitch. Each lasts a spell of the match and
// then needs a rest before the next.
export type ShoutKind = 'call' | 'run' | 'track';
export const SHOUT_MINUTES = 8;
// While calling for it, the pass scenes play as if he passed this much better.
export const CALL_PASSING = 12;
// No rest between calls: the user can switch call whenever he likes.

export type PassKind = 'safe' | 'square' | 'through' | 'cross';
// How a through ball or cross played in its scene went: into his path, an
// offside flag, or cut out by a defender.
export type PassOutcome = 'ok' | 'offside' | 'cut';

export interface PassOption {
  playerId: string;
  // 0..1: how likely the pass is to arrive.
  openness: number;
  // What kind of ball it is, and how dangerous it is if it arrives: the
  // extra chance of scoring from the shot that follows. A safe ball has
  // little threat but comes straight back to you for a one-two.
  kind?: PassKind;
  threat?: number;
}

// Up to four options with a real trade-off: the safest ball is never the
// most dangerous one. shooter, when given, is always among them.
export function passOptions(rng: Rng, world: World, s: MatchState, side: SideKey, actorId: string, shooterId?: string): PassOption[] {
  const mates = players(world, s[side].onPitch).filter((p) => p.id !== actorId && p.position !== 'GK');
  if (!mates.length) return [];
  const forwards = mates.filter((p) => p.position === 'FWD');
  const tall = [...mates].sort((a, b) => (b.heightCm ?? 180) + b.attrs.physical / 3 - ((a.heightCm ?? 180) + a.attrs.physical / 3))[0];
  const pick = (pool: Player[], not: string[]) => {
    const left = pool.filter((p) => !not.includes(p.id));
    return left.length ? rng.pick(left) : undefined;
  };
  const used: string[] = [];
  const out: PassOption[] = [];
  // Calling for it means he is showing and his mates are moving: every lane
  // is a little more open and a little more dangerous.
  const calling = actorId === s.focus.playerId && shoutActive(s, 'call');
  const add = (p: Player | undefined, kind: PassKind, openness: number, threat: number) => {
    if (!p) return;
    used.push(p.id);
    out.push({ playerId: p.id, kind, openness: calling ? Math.min(0.98, openness + 0.12) : openness, threat: calling ? threat + 0.04 : threat });
  };
  const runner = shooterId ? world.players[shooterId] : undefined;
  add(runner && runner.position !== 'GK' ? runner : pick(forwards.length ? forwards : mates, used), 'through', rng.range(0.3, 0.6), rng.range(0.24, 0.32));
  add(pick(mates.filter((p) => p.position !== 'DEF'), used), 'square', rng.range(0.5, 0.78), rng.range(0.12, 0.2));
  add(pick(mates.filter((p) => p.position !== 'FWD'), used), 'safe', rng.range(0.82, 0.96), rng.range(0.02, 0.06));
  if (tall && !used.includes(tall.id) && rng.chance(0.6)) add(tall, 'cross', rng.range(0.4, 0.65), rng.range(0.15, 0.24));
  // Great vision sees one more.
  if ((world.players[actorId]?.attrs.vision ?? 0) >= EXTRA_PASS_VISION) add(pick(mates, used), 'square', rng.range(0.5, 0.72), rng.range(0.1, 0.18));
  return rng.shuffle(out);
}

export interface KeyMoment {
  kind: MomentKind;
  // How the chance was built on the pitch, for the feed line.
  pattern?: Pattern;
  side: SideKey;
  minute: number;
  actorId: string;
  assistId?: string;
  keeperId: string;
  options?: PassOption[];
  // Extra chance of scoring when this moment follows a good dribble or pass.
  bonus: number;
  // Defensive moments: the opponent who has the ball.
  attackerId?: string;
  // The shot is on the user's weaker foot.
  weakFoot?: boolean;
  // A 'choice' moment: what the user can do from here.
  choices?: MomentKind[];
  // One-twos played so far in this move.
  chain?: number;
  // Men the user has beaten on this run (dribbles in a row).
  beaten?: number;
  // Where a shot or header comes from, for how the moment looks.
  view?: 'box' | 'outside' | 'oneonone' | 'cross' | 'corner' | 'long';
  // A shot: how far out he is, in metres.
  metres?: number;
  // A corner: the user takes it, or picks where to be for it.
  corner?: boolean;
  // A flare-up: the man whose foul started it.
  fouler?: string;
  // Shots the user takes from far out: 0 is the edge of the box, 1 is long range.
  range?: number;
  // A defending moment in open play with no chance behind it: losing it
  // costs nothing more than the ball.
  quiet?: boolean;
  // An interception: who the pass is meant for, and shoots if it arrives.
  targetId?: string;
  // A pass from deep: arriving keeps the move going but only sometimes
  // makes a chance.
  deep?: boolean;
  // His kick in a penalty shoot-out, which adds to no score but that one.
  shootout?: boolean;
  // A free kick the user takes: shoot it, or cross it into the box.
  setPiece?: boolean;
}

export type EventType =
  | 'kickoff'
  | 'half'
  | 'full'
  | 'goal'
  | 'save'
  | 'miss'
  | 'card'
  | 'red'
  | 'injury'
  | 'sub'
  | 'info';

export interface MatchEvent {
  minute: number;
  side: SideKey | null;
  type: EventType;
  text: string;
  playerId?: string;
  // True when the user played this moment.
  played?: boolean;
  // Shots: what the shot did, which the pitch plays (see ShotFacts).
  shot?: ShotFacts;
}

export interface MatchSide {
  clubId: string;
  // The shape for this match. A change at half time stays in the match.
  formation: Formation;
  // An outfield player in goal, after the keeper was sent off with no sub left.
  standIn?: string;
  onPitch: string[];
  bench: string[];
  usedIds: string[];
  subsUsed: number;
  style: Style;
  goals: number;
  shots: number;
  onTarget: number;
  possession: number;
}

export interface MatchFocus {
  // Career mode: the user's player. Moments only happen around them.
  playerId?: string;
  // Manager mode: the user's club. Moments happen on its big chances.
  clubId?: string;
  // Career mode: how the user's player celebrates a goal.
  celebration?: string;
  // Career mode: the shirt number the user picked.
  number?: number;
}

export interface MatchState {
  fixtureId: string;
  minute: number;
  endMinute: number;
  // 3 is extra time.
  half: 1 | 2 | 3;
  finished: boolean;
  extraTime?: boolean;
  // The penalties so far: round counts completed pairs of kicks.
  shootout?: { h: number; a: number; round: number; homeTaken: boolean };
  // Shots the user has taken since his last completed pass. See spamCost.
  spam?: number;
  // Manager mode stops at half time so the user can change things.
  pausedAtHalf: boolean;
  home: MatchSide;
  away: MatchSide;
  events: MatchEvent[];
  ratings: Record<string, number>;
  goals: Record<string, number>;
  assists: Record<string, number>;
  scorers: { playerId: string; clubId: string; minute: number }[];
  injuries: Record<string, number>;
  // Minute each player left the pitch, and minute each sub came on.
  minutes: Record<string, number>;
  cameOn: Record<string, number>;
  pending: KeyMoment | null;
  // The laws of this season (see laws.ts).
  laws: Laws;
  // Bookings so far, and everyone sent off with their ban in games.
  yellows: Record<string, number>;
  sentOff: Record<string, number>;
  // How hot the match is, from 0. Bookings raise it and it cools with time.
  heat: number;
  // Knockout games go to penalties when level.
  knockout: boolean;
  // The second leg of a tie: the first leg, for the aggregate.
  firstLeg?: Fixture;
  penaltyWinner?: string;
  // All key moments this match, played or skipped. Capped by MAX_MOMENTS.
  moments: number;
  focus: MatchFocus;
  // Ball position for the live pitch: x across (0..1), y from the home
  // goal (0) to the away goal (1).
  ball: { x: number; y: number };
  // Career player's defensive work, for objectives.
  userTackles: number;
  userSaves: number;
  rngState: number;
  // Live pitch only (matches the user watches): shirt numbers, and the
  // move played this minute. AI-only matches skip both.
  visual?: boolean;
  numbers?: Record<string, number>;
  play?: PlayStep[];
  // What the pitch shows of that move (see pace.ts): folded and trimmed.
  // Only counts while of is still the current move.
  shown?: { of: PlayStep[]; steps: PlayStep[] };
  // Where the pitch has everyone. Only the visuals read it, never a result.
  bodies?: Positions;
  // Side that kicks off next, after a goal or at half time.
  kickoff?: SideKey;
  // The pass the last pass moment played: who it was for and whether it
  // arrived. The pitch draws exactly that pass: a cross as a cross, and an
  // offside flag when the pass scene called it.
  lastPass?: { to: string; ok: boolean; kind?: PassKind; offside?: boolean; cutBy?: string };
  // The coach took the user's player off for playing badly.
  hooked?: boolean;
  // How the user's flare-up ended, for the pitch.
  fightShown?: NonNullable<PlayStep['fight']>;
  // A ball left alive near goal: this side is first to it next minute.
  rebound?: SideKey;
  // The Last-ditch technique was used this match (it saves one mistake).
  lastDitchUsed?: boolean;
  // The career player's current call, and when the next one is allowed.
  shout?: { kind: ShoutKind; until: number };
  // Career: the zone the user picked. Unset means the default for his role.
  zone?: Zone;
  // Whether the user won the last defending moment, for the pitch.
  lastWon?: boolean;
}

const MAX_MOMENTS = 12;
const RESTART_KEPT = 0.9;
const BASE_CHANCE = 0.197;
const SUB_MINUTES = [60, 70, 80];

const STYLE_MOD: Record<Style, { mid: number; chance: number; concede: number; finish: number }> = {
  balanced: { mid: 1, chance: 1, concede: 1, finish: 0 },
  possession: { mid: 1.05, chance: 0.95, concede: 0.9, finish: 0 },
  counter: { mid: 0.94, chance: 0.95, concede: 0.97, finish: 0.04 },
  press: { mid: 1.03, chance: 1.1, concede: 1.08, finish: 0 },
};

export function createMatch(world: World, fixture: Fixture, focus: MatchFocus, seed: number): MatchState {
  const makeSide = (clubId: string): MatchSide => {
    const club = teamById(world, clubId);
    const xi = startingXI(world, club);
    const subs = bench(world, club, xi);
    // The user's player always makes the bench when fit, so he can come on.
    const f = focus.playerId ? world.players[focus.playerId] : undefined;
    if (f && f.clubId === clubId && !f.injuryWeeks && !xi.includes(f.id) && !subs.includes(f.id)) {
      subs[Math.max(0, subs.length - 1)] = f.id;
    }
    return {
      clubId,
      formation: club.formation,
      onPitch: xi,
      bench: subs,
      usedIds: [...xi],
      subsUsed: 0,
      style: club.style,
      goals: 0,
      shots: 0,
      onTarget: 0,
      possession: 0,
    };
  };
  const state: MatchState = {
    fixtureId: fixture.id,
    minute: 0,
    endMinute: 90,
    half: 1,
    finished: false,
    pausedAtHalf: false,
    home: makeSide(fixture.homeId),
    away: makeSide(fixture.awayId),
    events: [],
    ratings: {},
    goals: {},
    assists: {},
    scorers: [],
    injuries: {},
    minutes: {},
    cameOn: {},
    pending: null,
    laws: lawsFor(world.season, teamById(world, fixture.homeId).nationId),
    yellows: {},
    sentOff: {},
    heat: 0,
    knockout: !!fixture.stage && fixture.stage !== 'Group' && !fixture.noShootout,
    firstLeg: fixture.secondLeg ? firstLegOf(world, fixture) : undefined,
    moments: 0,
    focus,
    rngState: seed >>> 0,
    ball: { x: 0.5, y: 0.5 },
    userTackles: 0,
    userSaves: 0,
  };
  const rng = new Rng(state.rngState);
  state.endMinute = 90 + rng.int(1, 4);
  if (focus.playerId || focus.clubId) {
    state.visual = true;
    const fixed = focus.playerId && focus.number ? { [focus.playerId]: focus.number } : {};
    const numberSide = (side: MatchSide) => assignNumbers(world, [...side.onPitch, ...side.bench], !teamById(world, side.clubId).national, fixed);
    state.numbers = { ...numberSide(state.home), ...numberSide(state.away) };
    state.kickoff = 'home';
  }
  for (const id of [...state.home.onPitch, ...state.away.onPitch]) state.ratings[id] = 6;
  push(state, 0, null, 'kickoff', `Kick off: ${teamById(world, fixture.homeId).name} vs ${teamById(world, fixture.awayId).name}.`);
  state.rngState = rng.state;
  return state;
}

function push(s: MatchState, minute: number, side: SideKey | null, type: EventType, text: string, playerId?: string, played?: boolean) {
  s.events.push({ minute, side, type, text, playerId, played });
}

function other(side: SideKey): SideKey {
  return side === 'home' ? 'away' : 'home';
}

function players(world: World, ids: string[]): Player[] {
  return ids.map((id) => world.players[id]);
}

const LINE_WEIGHTS: Record<'attack' | 'mid' | 'defense', Record<Position, number>> = {
  attack: { FWD: 3, MID: 2, DEF: 0.5, GK: 0 },
  mid: { FWD: 1, MID: 3, DEF: 1, GK: 0 },
  defense: { FWD: 0.2, MID: 1, DEF: 3, GK: 2 },
};

export function sideStrength(world: World, side: MatchSide) {
  const ps = players(world, side.onPitch);
  const calc = (kind: keyof typeof LINE_WEIGHTS) => {
    let sum = 0;
    let w = 0;
    // A cubed mean, so one great player lifts a side more than his share:
    // a 95 among 75s is felt.
    for (const p of ps) {
      const weight = LINE_WEIGHTS[kind][p.position];
      sum += weight * matchRating(p) ** 3;
      w += weight;
    }
    // Fewer than 11 players (red card or injury with no subs left) hurts.
    return (w ? Math.cbrt(sum / w) : 30) * (0.6 + 0.4 * (ps.length / 11));
  };
  return { attack: calc('attack'), mid: calc('mid'), defense: calc('defense') };
}

function keeperOf(world: World, side: MatchSide): Player {
  if (side.standIn && side.onPitch.includes(side.standIn)) return world.players[side.standIn];
  const ps = players(world, side.onPitch);
  return ps.find((p) => p.position === 'GK') ?? ps.sort((a, b) => b.attrs.goalkeeping - a.attrs.goalkeeping)[0];
}

const SHOOT_WEIGHT: Record<Position, number> = { FWD: 5, MID: 2.2, DEF: 0.6, GK: 0.01 };
const ASSIST_WEIGHT: Record<Position, number> = { FWD: 2, MID: 4, DEF: 1.2, GK: 0.1 };

const ATTACK_ROLES = ['ST', 'CF', 'LW', 'RW', 'CAM'];
const MIDDLE_ROLES = ['CM', 'CDM', 'LM', 'RM'];

export function defaultZone(p: Player): Zone {
  const r = p.role ?? '';
  if (ATTACK_ROLES.includes(r) || (!r && p.position === 'FWD')) return 'attack';
  if (MIDDLE_ROLES.includes(r) || (!r && p.position === 'MID')) return 'middle';
  return 'defend';
}

export function zoneOf(world: World, s: MatchState): Zone {
  const id = s.focus.playerId;
  if (!id || !world.players[id]) return 'middle';
  return s.zone ?? defaultZone(world.players[id]);
}

export function setZone(s: MatchState, zone: Zone): void {
  s.zone = zone;
}

// How often the user ends up shooting or making the pass, by zone.
const ZONE_SHOOT: Record<Zone, number> = { attack: 1.6, middle: 0.85, defend: 0.4 };
const ZONE_ASSIST: Record<Zone, number> = { attack: 1.1, middle: 1.7, defend: 0.8 };

function shoutActive(s: MatchState, kind: ShoutKind): boolean {
  return s.shout?.kind === kind && s.minute <= s.shout.until;
}

function pickShooter(rng: Rng, world: World, s: MatchState, side: MatchSide): Player {
  const ps = players(world, side.onPitch);
  // Making a run or calling for it puts the user's player on the end of more chances.
  // The user's player is on the end of a few more chances anyway, so key
  // moments come along steadily.
  const zone = zoneOf(world, s);
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : ZONE_SHOOT[zone] * (shoutActive(s, 'run') ? 3.4 : 1));
  // Great shooters take far more of the chances.
  return rng.weighted(ps, ps.map((p) => SHOOT_WEIGHT[p.position] * (p.attrs.shooting / 50) ** 3.5 * boost(p)));
}

function pickAssister(rng: Rng, world: World, s: MatchState, side: MatchSide, shooter: Player): Player | undefined {
  if (!rng.chance(0.7)) return undefined;
  const ps = players(world, side.onPitch).filter((p) => p.id !== shooter.id);
  if (!ps.length) return undefined;
  const zone = zoneOf(world, s);
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : ZONE_ASSIST[zone] * (shoutActive(s, 'call') ? 4.5 : 1));
  return rng.weighted(ps, ps.map((p) => ASSIST_WEIGHT[p.position] * (p.attrs.passing / 50) ** 2 * boost(p)));
}

function bump(s: MatchState, id: string | undefined, delta: number) {
  if (!id || s.ratings[id] === undefined) return;
  s.ratings[id] += delta;
}

function names(world: World, s: MatchState, sideKey: SideKey) {
  const side = s[sideKey];
  return { club: teamById(world, side.clubId).name };
}

// --- Shot resolution -------------------------------------------------------

// VAR looks at some goals before they count; a few are ruled out.
const VAR_REVIEW = 0.08;
const VAR_OVERTURN = 0.4;
const VAR_REASONS = ['Offside in the build-up', 'A foul in the build-up', 'Handball'];

function recordGoal(world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, kind: LineKind, played: boolean, facts?: ShotFacts) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
  if (s.visual && facts && kind !== 'penaltyGoal') {
    const vr = new Rng(s.rngState);
    // The officials can take it away on the spot, in any season.
    const roll = vr.next();
    const call = roll < FLAG_CALL ? 'flag' : roll < FLAG_CALL + FOUL_CALL ? 'foul' : undefined;
    // VAR only exists in its own era.
    const review = !call && s.laws.var && vr.chance(VAR_REVIEW);
    const out = review && vr.chance(VAR_OVERTURN);
    const reason = vr.pick(VAR_REASONS);
    s.rngState = vr.state;
    if (call) {
      side.onTarget++;
      bump(s, shooter.id, -0.1);
      const why = call === 'flag' ? 'Offside' : 'A foul by the attacker';
      push(s, s.minute, sideKey, 'miss', call === 'flag' ? `The flag is up. ${shortName(shooter)}'s goal is ruled out for offside.` : `The referee had blown for a foul. ${shortName(shooter)}'s goal does not count.`, shooter.id, played);
      s.events[s.events.length - 1].shot = { ...facts, var: 'overturned', varReason: why, call };
      return;
    }
    if (out) {
      // In the net, but it does not count. The pitch shows the check and
      // the decision; the event is a miss with the reason.
      side.onTarget++;
      bump(s, shooter.id, -0.1);
      push(s, s.minute, sideKey, 'miss', `VAR rules out ${shortName(shooter)}'s goal. ${reason}.`, shooter.id, played);
      s.events[s.events.length - 1].shot = { ...facts, var: 'overturned', varReason: reason };
      return;
    }
    if (review) facts = { ...facts, var: 'stands' };
  }
  side.goals++;
  side.onTarget++;
  s.goals[shooter.id] = (s.goals[shooter.id] ?? 0) + 1;
  bump(s, shooter.id, 1.0);
  if (assister) {
    s.assists[assister.id] = (s.assists[assister.id] ?? 0) + 1;
    bump(s, assister.id, 0.75);
  }
  bump(s, keeper.id, -0.3);
  for (const p of players(world, s[other(sideKey)].onPitch)) if (p.position === 'DEF') bump(s, p.id, -0.15);
  s.scorers.push({ playerId: shooter.id, clubId: side.clubId, minute: s.minute });
  s.ball = { x: 0.5, y: sideKey === 'home' ? 0.99 : 0.01 };
  s.kickoff = other(sideKey);
  const rng = new Rng(s.rngState);
  const vars = { p: shortName(shooter), a: assister ? shortName(assister) : '', k: shortName(keeper), ...names(world, s, sideKey) };
  const text = facts ? goalLine(rng, facts, { ...vars, a: assister ? vars.a : undefined }) : line(rng, assister && kind === 'goal' ? 'goalAssist' : kind, vars);
  s.rngState = rng.state;
  push(s, s.minute, sideKey, 'goal', facts?.var === 'stands' ? `${text} VAR checks it: the goal stands.` : text, shooter.id, played);
  s.events[s.events.length - 1].shot = facts;
  if (shooter.id === s.focus.playerId && s.focus.celebration) {
    push(s, s.minute, sideKey, 'info', `${shortName(shooter)} ${celebrationText(s.focus.celebration)}`, shooter.id);
  }
}

// Decides what a shot the user did not play does: where it goes, how it is
// struck, and for a save or a miss whether it ends in a corner. The feed
// line and the pitch both come from this.
function decideShot(rng: Rng, result: 'goal' | 'save' | 'miss', how: { header?: boolean; pattern?: Pattern; penalty?: boolean; freekick?: boolean } = {}): ShotFacts {
  const shape = how.header || how.penalty ? 'driven' : rng.weighted(['driven', 'curl', 'low'] as const, [5, 3, 3]);
  const f: ShotFacts = { aim: 0.5, shape, header: how.header, pattern: how.pattern, penalty: how.penalty, freekick: how.freekick };
  if (result === 'goal') f.aim = rng.chance(0.5) ? rng.range(0.06, 0.3) : rng.range(0.7, 0.94);
  else if (result === 'save') {
    f.aim = rng.range(0.28, 0.72);
    f.tipped = rng.chance(0.33);
    f.parried = !f.tipped && !how.penalty && rng.chance(0.4);
  } else if (!how.penalty && !how.header && rng.chance(0.22)) {
    f.blocker = how.freekick ? 'wall' : 'lane';
    f.aim = rng.range(0.2, 0.8);
    f.blockOut = blockOut(rng);
  } else if (!how.penalty && rng.chance(0.09)) {
    f.frame = rng.chance(0.7) ? 'post' : 'bar';
    f.aim = f.frame === 'bar' ? rng.range(0.2, 0.8) : rng.chance(0.5) ? 0.01 : 0.99;
  } else if (shape !== 'low' && rng.chance(0.4)) {
    f.over = true;
    f.aim = rng.range(0.25, 0.75);
  } else {
    f.aim = rng.chance(0.5) ? rng.range(-0.18, -0.04) : rng.range(1.04, 1.18);
    f.deflected = !how.penalty && rng.chance(0.18);
  }
  return f;
}

// A blocked shot goes behind most often, but can go out or stay in play.
function blockOut(rng: Rng): 'throw' | 'loose' | undefined {
  const r = rng.next();
  return r < 0.6 ? undefined : r < 0.75 ? 'throw' : 'loose';
}

// What the user's mini-game showed, as shot facts.
function factsFrom(rng: Rng, result: 'goal' | 'save' | 'miss', p: Played, how: { header?: boolean; penalty?: boolean; freekick?: boolean }): ShotFacts {
  if (p.aim === undefined) return decideShot(rng, result, how);
  const inside = p.aim >= 0.02 && p.aim <= 0.98;
  const frame = p.end === 'post' || p.end === 'bar' ? p.end : undefined;
  return {
    aim: p.aim,
    shape: p.shape ?? 'driven',
    header: how.header,
    penalty: how.penalty,
    freekick: how.freekick,
    blocker: result === 'miss' ? (p.wall ? 'wall' : p.blocker) : undefined,
    blockOut: result === 'miss' && (p.wall || p.blocker) ? blockOut(rng) : undefined,
    over: result === 'miss' && !p.blocker && !p.wall && !frame && (p.over ?? inside),
    tipped: result === 'save' && (p.end ? p.end === 'tipRound' || p.end === 'tipOver' : rng.chance(0.33)),
    parried: result === 'save' && p.end === 'parry',
    frame,
  };
}

function autoShot(rng: Rng, world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, bonus: number, how: { header?: boolean; pattern?: Pattern } = {}) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
  side.shots++;
  const finishing = (shooter.attrs.shooting + shooter.attrs.composure) / 2;
  const onTargetP = clamp(0.18 + 0.4 * (shooter.attrs.shooting / 99) + bonus, 0.1, 0.9);
  const vars = { p: shortName(shooter), k: shortName(keeper), a: assister && how.pattern !== 'solo' && how.pattern !== 'longshot' ? shortName(assister) : undefined };
  if (!rng.chance(onTargetP)) {
    bump(s, shooter.id, -0.05);
    const f = decideShot(rng, 'miss', how);
    push(s, s.minute, sideKey, 'miss', missLine(rng, f, vars), shooter.id);
    s.events[s.events.length - 1].shot = f;
    if (f.frame || f.blockOut === 'loose') s.rebound = sideKey;
    return;
  }
  const skills = 0.03 * skillLevel(shooter, 'finisher') + 0.01 * skillLevel(shooter, 'finesse');
  const goalP = clamp(0.27 + (0.55 * (finishing - keeper.attrs.goalkeeping)) / 99 + bonus + skills + STYLE_MOD[side.style].finish, 0.05, 0.85);
  if (rng.chance(goalP)) {
    const f = decideShot(rng, 'goal', how);
    s.rngState = rng.state;
    recordGoal(world, s, sideKey, shooter, assister, 'goal', false, f);
    rng.state = s.rngState;
  } else {
    side.onTarget++;
    bump(s, keeper.id, 0.2);
    if (keeper.id === s.focus.playerId) s.userSaves++;
    const f = decideShot(rng, 'save', how);
    push(s, s.minute, sideKey, 'save', saveLine(rng, f, vars), shooter.id);
    s.events[s.events.length - 1].shot = f;
    if (f.parried) s.rebound = sideKey;
  }
}

// --- Key moments -----------------------------------------------------------

function wantsMoment(rng: Rng, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined): boolean {
  if (s.moments >= MAX_MOMENTS) return false;
  const f = s.focus;
  if (f.playerId) return shooter.id === f.playerId || assister?.id === f.playerId;
  if (f.clubId) return s[sideKey].clubId === f.clubId && rng.chance(0.3);
  return false;
}

function buildMoment(rng: Rng, world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined): KeyMoment {
  const keeperId = keeperOf(world, s[other(sideKey)]).id;
  const focusId = s.focus.playerId;
  // A run gets him in behind: a better chance, from closer in.
  const running = shooter.id === focusId && shoutActive(s, 'run');
  const base = { side: sideKey, minute: s.minute, keeperId, bonus: running ? 0.08 : 0 };
  const actsAsPasser = assister && (focusId ? assister.id === focusId : rng.chance(0.25));
  if (actsAsPasser && assister) {
    return { ...base, kind: 'pass', actorId: assister.id, options: passOptions(rng, world, s, sideKey, assister.id, shooter.id) };
  }
  const role = shooter.role && isRole(shooter.role) ? ROLES[shooter.role] : undefined;
  const dribbleShare = role?.dribbleShare ?? 0.31;
  // Tall players and centre-backs at set pieces meet more crosses.
  const headerShare = 0.13 + ((shooter.heightCm ?? 180) >= 186 ? 0.12 : 0) + (shooter.position === 'DEF' ? 0.15 : 0);
  const roll = rng.next();
  let kind: MomentKind = roll < 0.06 ? 'penalty' : roll < 0.14 ? 'freekick' : roll < 0.14 + headerShare ? 'header' : rng.chance(dribbleShare) ? 'dribble' : 'shot';
  // Open play often hands the user the decision first.
  const mates = players(world, s[sideKey].onPitch).filter((p) => p.id !== shooter.id && p.position !== 'GK');
  let choices: MomentKind[] | undefined;
  if (shooter.id === focusId && (kind === 'shot' || kind === 'dribble') && rng.chance(0.75)) {
    choices = mates.length ? ['shot', 'dribble', 'pass'] : ['shot', 'dribble'];
    kind = 'choice';
  }
  let setPiece = false;
  if (shooter.id === focusId && kind === 'freekick' && mates.length) {
    // Shoot it, or swing it into the box.
    choices = ['freekick', 'pass'];
    kind = 'choice';
    setPiece = true;
  }
  const weakFoot = shooter.id === focusId && (kind === 'shot' || kind === 'freekick' || kind === 'choice') && rng.chance(0.35);
  const roll2 = rng.chance(0.3);
  const view = kind === 'header' ? (rng.chance(0.4) ? 'corner' : 'cross') : running ? (roll2 ? 'oneonone' : 'box') : roll2 ? 'outside' : 'box';
  return { ...base, kind, actorId: shooter.id, assistId: kind === 'shot' || kind === 'header' || (kind === 'choice' && !setPiece) ? assister?.id : undefined, weakFoot, choices, view, setPiece: setPiece || undefined };
}

// Career keepers and defenders: an opponent chance can become a save or a
// tackle for the user's player.
function defensiveMoment(rng: Rng, world: World, s: MatchState, attKey: SideKey, shooter: Player, assister: Player | undefined): KeyMoment | null {
  const focusId = s.focus.playerId;
  if (!focusId || s.moments >= MAX_MOMENTS) return null;
  const defKey = other(attKey);
  if (!s[defKey].onPitch.includes(focusId)) return null;
  const me = world.players[focusId];
  const role = me.role && isRole(me.role) ? ROLES[me.role] : undefined;
  // Tracking back brings even forwards into the defending; so does
  // playing deep. Pushing up leaves it to the others.
  const tracking = shoutActive(s, 'track');
  const zone = me.position === 'GK' ? 'defend' : zoneOf(world, s);
  let p = tracking ? Math.max(role?.defends ?? 0, 0.3) + 0.25 : role?.defends ?? 0;
  if (me.position !== 'GK') {
    if (zone === 'defend') p = Math.max(p * 1.4, 0.32);
    else if (zone === 'middle') p = Math.max(p, 0.12);
    else p *= 0.35;
  }
  if (!p || !rng.chance(Math.min(0.85, p))) return null;
  const base = { side: defKey, minute: s.minute, keeperId: keeperOf(world, s[defKey]).id, bonus: 0, actorId: focusId, attackerId: shooter.id, assistId: assister?.id };
  if (me.position === 'GK') return { ...base, kind: 'save' };
  // Which duel it is: an interception needs a pass to read, a clearance
  // needs a cross.
  const kinds: MomentKind[] = ['tackle'];
  const weights = [3];
  if (zone !== 'attack') {
    kinds.push('block');
    weights.push(zone === 'defend' ? 3 : 1);
  }
  if (assister && zone === 'middle') {
    kinds.push('intercept');
    weights.push(3);
  }
  if (assister && zone === 'defend') {
    kinds.push('clear');
    weights.push(3);
  }
  const kind = rng.weighted(kinds, weights);
  if (kind === 'intercept' && assister) return { ...base, kind, attackerId: assister.id, targetId: shooter.id, assistId: undefined };
  return { ...base, kind };
}

// Quiet minutes: where the user plays decides what comes to him. In the
// middle he gets passes from deep, long shots and passes to read; at the
// back, tackles and crosses to head away; up front, a man to beat.
function zoneMoment(rng: Rng, world: World, s: MatchState, attKey: SideKey, start: PlayStart): boolean {
  const id = s.focus.playerId;
  if (!id || s.moments >= MAX_MOMENTS) return false;
  // Never while the teams line up for a kick-off or in the opening minutes.
  if (start.restart === 'kickoff' || s.minute <= 2) return false;
  const mySide: SideKey | null = s.home.onPitch.includes(id) ? 'home' : s.away.onPitch.includes(id) ? 'away' : null;
  const me = world.players[id];
  if (!mySide || !me || me.position === 'GK') return false;
  const zone = zoneOf(world, s);
  const mine = attKey === mySide;
  // Tracking back: a real chance to win it, as a tackle he plays.
  const tracking = !mine && shoutActive(s, 'track');
  const p = tracking ? 0.3 : mine ? { attack: 0.02, middle: 0.05, defend: 0.014 }[zone] : { attack: 0.008, middle: 0.035, defend: 0.03 }[zone];
  if (!rng.chance(p)) return false;
  const oppKey = other(mySide);
  let m: KeyMoment;
  let depth: number | undefined;
  if (mine) {
    const base = { side: mySide, minute: s.minute, keeperId: keeperOf(world, s[oppKey]).id, actorId: id, bonus: 0 };
    if (zone === 'attack') {
      m = { ...base, kind: 'dribble' };
      depth = 0.72;
    } else if (zone === 'middle' && rng.chance(0.35)) {
      m = { ...base, kind: 'shot', view: 'outside' };
      depth = rng.range(0.6, 0.68);
    } else {
      m = { ...base, kind: 'pass', deep: true, options: passOptions(rng, world, s, mySide, id) };
    }
  } else {
    const opp = players(world, s[oppKey].onPitch).filter((x) => x.position !== 'GK');
    if (!opp.length) return false;
    const carrier = rng.weighted(opp, opp.map((x) => (x.position === 'MID' ? 3 : x.position === 'FWD' ? 2 : 1)));
    const kind: MomentKind = tracking ? 'tackle' : zone === 'middle' ? (rng.chance(0.6) ? 'intercept' : 'tackle') : zone === 'defend' ? (rng.chance(0.5) ? 'clear' : 'tackle') : 'tackle';
    m = { side: mySide, minute: s.minute, keeperId: keeperOf(world, s[mySide]).id, actorId: id, bonus: 0, attackerId: carrier.id, kind, quiet: true };
  }
  leadIn(world, s, attKey, start, m, depth);
  if (m.kind === 'shot') {
    const d = mySide === 'home' ? s.ball.y : 1 - s.ball.y;
    m.range = clamp((0.82 - d) / 0.4, 0.3, 1);
  }
  s.pending = m;
  s.moments++;
  return true;
}

// The move that leads to a quiet-minute moment: the side on the ball plays
// it about, then it reaches whoever the moment is about.
function leadIn(world: World, s: MatchState, attKey: SideKey, start: PlayStart, m: KeyMoment, depth?: number) {
  const slotSpot = (id: string, d?: number) => {
    const slot = assignSlots(world, matchTeam(world, s[attKey]), s[attKey].onPitch)[id] ?? { depth: 0.5, lat: 0.5 };
    return toPitch(attKey, { depth: d ?? clamp(slot.depth + 0.1, 0.25, 0.75), lat: clamp(slot.lat, 0.1, 0.9) });
  };
  const holder = m.attackerId ?? m.actorId;
  if (!s.visual) {
    s.ball = slotSpot(holder, depth);
    return;
  }
  const steps = buildPlay(world, playSeed(s.rngState, s.minute, s.events.length), playSide(world, s, attKey), playSide(world, s, other(attKey)), start, { result: null });
  // Keep the move up to the point the side on the ball would lose it.
  const first = steps.findIndex((st) => st.side === attKey);
  let end = first;
  while (end >= 0 && end + 1 < steps.length && steps[end + 1].side === attKey && (steps[end + 1].act === 'pass' || steps[end + 1].act === 'run')) end++;
  const kept: PlayStep[] = end >= 0 ? steps.slice(0, end + 1) : [{ x: start.x, y: start.y, carrier: null, side: attKey, act: 'start' }];
  const last = kept[kept.length - 1];
  if (m.attackerId && last.carrier && s[attKey].onPitch.includes(last.carrier) && world.players[last.carrier]?.position !== 'GK') {
    // An opponent has the ball: the duel is with him.
    m.attackerId = last.carrier;
  } else if (last.carrier !== holder) {
    kept.push({ ...slotSpot(holder, depth), carrier: holder, side: attKey, act: 'pass' });
  } else if (depth !== undefined) {
    kept.push({ ...slotSpot(holder, depth), carrier: holder, side: attKey, act: 'run' });
  }
  const at = kept[kept.length - 1];
  kept.push({ x: at.x, y: at.y, carrier: at.carrier, side: attKey, act: 'moment' });
  s.play = kept;
  s.ball = { x: clamp(at.x, 0, 1), y: clamp(at.y, 0, 1) };
}

// The user picks what to do with a 'choice' moment.
export function chooseMoment(world: World, s: MatchState, kind: MomentKind): void {
  const m = s.pending;
  if (!m || m.kind !== 'choice') return;
  const rng = new Rng(s.rngState);
  if (kind === 'pass') {
    // From a free kick every ball is a cross into the box.
    const options = passOptions(rng, world, s, m.side, m.actorId).map((o) => (m.setPiece ? { ...o, kind: 'cross' as PassKind, threat: (o.threat ?? 0.12) + 0.05 } : o));
    s.pending = { ...m, kind: 'pass', options, assistId: undefined, choices: undefined };
  } else {
    // At a corner he waits on the edge of the box for it to drop to him.
    const edge = m.corner && kind === 'shot' ? { view: 'outside' as const, range: 0.12 } : {};
    s.pending = { ...m, kind, choices: undefined, assistId: kind === 'shot' || m.corner ? m.assistId : undefined, ...edge };
  }
  s.rngState = rng.state;
}

// A corner for the user's side. If he takes them he swings it in; if not he
// picks where to be: attack it, or wait on the edge of the box.
function cornerMoment(rng: Rng, world: World, s: MatchState, start: PlayStart): boolean {
  const id = s.focus.playerId;
  if (!id || start.restart !== 'corner' || !start.restartSide || s.moments >= MAX_MOMENTS) return false;
  const side = start.restartSide;
  const me = world.players[id];
  if (!s[side].onPitch.includes(id) || me.position === 'GK' || !rng.chance(0.65)) return false;
  const mates = players(world, s[side].onPitch).filter((p) => p.position !== 'GK');
  const taker = [...mates].sort((a, b) => b.attrs.passing - a.attrs.passing)[0];
  if (!taker) return false;
  const base = { side, minute: s.minute, keeperId: keeperOf(world, s[other(side)]).id, actorId: id, bonus: 0.03, setPiece: true, corner: true };
  s.pending =
    taker.id === id
      ? { ...base, kind: 'pass', options: passOptions(rng, world, s, side, id).map((o) => ({ ...o, kind: 'cross' as PassKind, threat: (o.threat ?? 0.12) + 0.05 })) }
      : { ...base, kind: 'choice', choices: ['header', 'shot'], view: 'corner', assistId: taker.id };
  s.moments++;
  if (s.visual) {
    const at = { x: start.x, y: start.y };
    s.play = [
      { ...at, carrier: taker.id, side, act: 'start', restart: 'corner' },
      { ...at, carrier: taker.id, side, act: 'moment' },
    ];
    s.ball = { ...at };
  }
  return true;
}

// The user's player has the ball on the live pitch and acts on his own:
// shoot from wherever he is, pick a pass, or take his man on. ball is where
// the pitch shows the ball, so the moment starts from there.
export function takeAction(world: World, s: MatchState, kind: 'shot' | 'pass' | 'dribble', ball: { x: number; y: number }): boolean {
  const id = s.focus.playerId;
  if (!id || s.pending || s.finished || s.pausedAtHalf) return false;
  const side: SideKey | null = s.home.onPitch.includes(id) ? 'home' : s.away.onPitch.includes(id) ? 'away' : null;
  if (!side) return false;
  const rng = new Rng(s.rngState);
  s.ball = { x: clamp(ball.x, 0, 1), y: clamp(ball.y, 0, 1) };
  const depth = side === 'home' ? s.ball.y : 1 - s.ball.y;
  const base = { side, minute: s.minute, keeperId: keeperOf(world, s[other(side)]).id, actorId: id, bonus: 0 };
  if (kind === 'pass') s.pending = { ...base, kind: 'pass', options: passOptions(rng, world, s, side, id) };
  else if (kind === 'dribble') s.pending = { ...base, kind: 'dribble' };
  else s.pending = { ...base, kind: 'shot', ...shotPlace(s, side) };
  s.rngState = rng.state;
  return true;
}

// From here on a shot opens the long range scene.
export const LONG_RANGE = 35;

// Where a shot is from, read off the ball. oneOnOne keeps a clear run on goal.
function shotPlace(s: MatchState, side: SideKey, oneOnOne = false): Pick<KeyMoment, 'view' | 'metres' | 'range'> {
  const depth = side === 'home' ? s.ball.y : 1 - s.ball.y;
  const metres = (1 - depth) * 105;
  const far = depth <= 0.82;
  return { metres, range: far ? clamp((0.82 - depth) / 0.4, 0, 1) : 0, view: metres >= LONG_RANGE ? 'long' : far ? 'outside' : oneOnOne ? 'oneonone' : 'box' };
}

// A moment opens where the ball really is on the pitch. A shot's view and
// range come from there, not from a roll, so the game matches what you see.
export function placeMoment(s: MatchState, ball: { x: number; y: number }): void {
  s.ball = { x: clamp(ball.x, 0, 1), y: clamp(ball.y, 0, 1) };
  const m = s.pending;
  if (!m || m.setPiece || (m.kind !== 'shot' && m.kind !== 'choice' && m.kind !== 'dribble')) return;
  Object.assign(m, shotPlace(s, m.side, m.view === 'oneonone'));
}

// The user sees men in the way and passes instead: the shot becomes a pass
// moment from the same spot.
export function passInstead(world: World, s: MatchState): void {
  const m = s.pending;
  if (!m || m.kind !== 'shot') return;
  const rng = new Rng(s.rngState);
  s.pending = { ...m, kind: 'pass', options: passOptions(rng, world, s, m.side, m.actorId), view: undefined, range: undefined, assistId: undefined };
  s.rngState = rng.state;
}

// The user turns down every pass and shoots: from the box if he is in it,
// from distance if not.
export function shootInstead(s: MatchState): void {
  const m = s.pending;
  if (!m || m.kind !== 'pass') return;
  s.pending = { ...m, kind: 'shot', options: undefined, assistId: undefined, ...shotPlace(s, m.side) };
}

// What the sim would do with a choice: the option that suits the player.
// Shot after shot with no pass and the defence reads it: they sit on the shooter
// and the keeper is set. A completed pass moves them and clears it.
export function spamCost(s: MatchState): number {
  return Math.min(0.15, 0.05 * (s.spam ?? 0));
}

// True when a pass is the better idea than a shot here, so the choice can say so.
export function passIsBetter(s: MatchState, m: KeyMoment): boolean {
  return !!m.choices?.includes('pass') && m.view !== 'oneonone' && (m.view === 'outside' || !!m.weakFoot || (s.spam ?? 0) > 0);
}

function autoChoice(world: World, m: KeyMoment): MomentKind {
  const p = world.players[m.actorId];
  const opts = m.choices ?? ['shot'];
  const score = (k: MomentKind) => (k === 'shot' ? p.attrs.shooting - (m.view === 'outside' ? 10 : 0) : k === 'dribble' ? p.attrs.dribbling : (p.attrs.passing + p.attrs.vision) / 2 + 6);
  return [...opts].sort((a, b) => score(b) - score(a))[0];
}

// A call from the pitch. False while the last one is still resting.
export function shout(world: World, s: MatchState, kind: ShoutKind): boolean {
  const id = s.focus.playerId;
  if (!id || s.finished) return false;
  const side: SideKey = s.home.onPitch.includes(id) ? 'home' : s.away.onPitch.includes(id) ? 'away' : 'home';
  if (!s[side].onPitch.includes(id)) return false;
  s.shout = { kind, until: s.minute + SHOUT_MINUTES };
  const name = shortName(world.players[id]);
  const text = kind === 'call' ? `${name} is calling for the ball.` : kind === 'run' ? `${name} starts making runs in behind.` : `${name} drops back to help the defence.`;
  push(s, s.minute, side, 'info', text, id, true);
  return true;
}

// Quality the sim uses when the user skips a moment: based on the actor's skill.
export function autoQuality(rng: Rng, world: World, m: KeyMoment): number {
  const p = world.players[m.actorId];
  const skill =
    m.kind === 'pass'
      ? (p.attrs.passing + p.attrs.vision) / 2
      : m.kind === 'dribble'
        ? p.attrs.dribbling
        : m.kind === 'save'
          ? p.attrs.goalkeeping
          : m.kind === 'tackle' || m.kind === 'block'
            ? p.attrs.defending
            : m.kind === 'intercept'
              ? (p.attrs.defending + p.attrs.vision) / 2
              : m.kind === 'clear'
                ? (p.attrs.defending + p.attrs.physical) / 2
            : m.kind === 'header'
              ? (p.attrs.physical + p.attrs.shooting) / 2
              : (p.attrs.shooting + p.attrs.composure) / 2;
  return clamp(rng.normal(skill / 140, 0.15), 0, 1);
}

// How a shot left the boot. Driven is the default; a curler bends in from
// outside the post (round a defender, away from the keeper), a low shot
// skims the grass (hard to get down to, easier to block, never over).
export type ShotShape = 'driven' | 'curl' | 'low';

// What the user's mini-game actually did, so the match counts and the
// pitch shows exactly that.
// forced: what a shot did (goal, save or miss). aim: where it went across
// the goal (see PlayStep.aim). blocker: the defender a missed shot hit.
// passed: what a pass scene showed. shape: how the shot was struck.
export interface Played {
  // A flare-up: walk away or square up.
  fight?: 'walk' | 'square';
  forced?: 'goal' | 'save' | 'miss';
  // How the shot ended, from the contact model (see contact.ts).
  end?: ShotEnd;
  aim?: number;
  blocker?: string;
  passed?: PassOutcome;
  shape?: ShotShape;
  // The shot game showed it going over the bar, or into the wall.
  over?: boolean;
  wall?: boolean;
}

// moveId: the skill move the user picked for a dribble moment.
export function resolveMoment(world: World, s: MatchState, quality: number | null, chosenPlayerId?: string, moveId?: string, played: Played = {}): void {
  let m = s.pending;
  if (!m) return;
  if (m.shootout) {
    s.pending = null;
    userKick(world, s, m, played);
    return;
  }
  if (m.kind === 'choice') {
    chooseMoment(world, s, autoChoice(world, m));
    m = s.pending!;
  }
  s.pending = null;
  const from = s.events.length;
  resolveMomentInner(world, s, m, quality, chosenPlayerId, moveId, played);
  visualizeMoment(world, s, m, from);
}

function resolveMomentInner(world: World, s: MatchState, m: KeyMoment, quality: number | null, chosenPlayerId?: string, moveId?: string, user: Played = {}): void {
  const { forced, passed } = user;
  const rng = new Rng(s.rngState);
  const played = quality !== null;
  const actor = world.players[m.actorId];
  const clutch = s.minute >= 75 ? 0.05 * skillLevel(actor, 'clutch') : 0;
  const footFactor = m.weakFoot ? 0.75 + 0.05 * (actor.weakFoot ?? 2) : 1;
  const q = clamp(((quality ?? autoQuality(rng, world, m)) + clutch) * footFactor, 0, 1);
  const lvl = (id: string) => skillLevel(actor, id);
  const keeper = world.players[m.keeperId];
  const side = s[m.side];
  const skill = (v: number) => 0.55 + (0.45 * (v + formShift(actor))) / 99;
  const keeperPenalty = ((keeper.attrs.goalkeeping - 50) / 99) * 0.12;

  const finish = (pGoal: number, kind: LineKind, missKind: LineKind, assistId?: string) => {
    side.shots++;
    // From way out the curve decides alone, down to its own tiny odds.
    const long = m.view === 'long';
    if (!long) pGoal += finishBonus(actor, m.kind);
    const scored = forced ? forced === 'goal' : rng.chance(clamp(pGoal, long ? 0.001 : 0.02, 0.92));
    const how = { header: m.kind === 'header', penalty: m.kind === 'penalty', freekick: m.kind === 'freekick' };
    if (scored) {
      const f = { ...factsFrom(rng, 'goal', user, how), pattern: m.pattern };
      s.rngState = rng.state;
      recordGoal(world, s, m.side, actor, assistId ? world.players[assistId] : undefined, kind, played, f);
      return;
    }
    const onTarget = forced ? forced === 'save' : q > 0.35;
    if (onTarget) {
      side.onTarget++;
      bump(s, keeper.id, 0.25);
    }
    bump(s, actor.id, -0.15);
    const f = factsFrom(rng, onTarget ? 'save' : 'miss', user, how);
    const vars = { p: shortName(actor), k: shortName(keeper), d: f.blocker && world.players[f.blocker] ? shortName(world.players[f.blocker]) : undefined };
    push(s, s.minute, m.side, onTarget ? 'save' : 'miss', onTarget ? saveLine(rng, f, vars) : missLine(rng, f, vars), actor.id, played);
    s.events[s.events.length - 1].shot = f;
    if (f.parried || f.frame || f.blockOut === 'loose') s.rebound = m.side;
    s.rngState = rng.state;
  };

  // A badly timed defensive moment is a mistake, and the other side make
  // him pay: the man he lost gets a far better chance, and his rating takes
  // a bigger hit, more so if it goes in. A plain lost duel in midfield can
  // still end in a shot.
  const blunder = played && q < 0.22;
  const punish = (attSide: SideKey, shooter: Player, assister: Player | undefined, bonus: number, text: string) => {
    // Last-ditch: the first mistake of the match, he gets back in time.
    if (lvl('lastditch') && !s.lastDitchUsed) {
      s.lastDitchUsed = true;
      push(s, s.minute, m.side, 'info', `${shortName(actor)} is beaten, but gets back in time to smother it.`, actor.id, played);
      return;
    }
    bump(s, actor.id, -0.15);
    push(s, s.minute, attSide, 'info', text, shooter.id, played);
    const goals = s[attSide].goals;
    const how = m.kind === 'clear' ? { pattern: 'cross' as Pattern, header: true } : m.kind === 'intercept' && assister ? { pattern: 'through' as Pattern } : { pattern: 'solo' as Pattern };
    autoShot(rng, world, s, attSide, shooter, assister, bonus, how);
    if (s[attSide].goals > goals) bump(s, actor.id, -0.25);
  };

  switch (m.kind) {
    case 'fight': {
      // Walking away nearly always ends it. Squaring up needs a cool head.
      const rival = world.players[m.attackerId!];
      const walk = (user.fight ?? (q > 0.4 ? 'walk' : 'square')) === 'walk';
      const calm = actor.attrs.composure / 99;
      const fight = walk ? (lvl('coolhead') ? 'calm' : rng.weighted(['calm', 'booked'] as const, [0.85, 0.15])) : rng.weighted(['calm', 'booked', 'one', 'both'] as const, [0.15 + calm * 0.3, 0.45, 0.25 - calm * 0.15, 0.15 - calm * 0.08]);
      if (walk) bump(s, actor.id, 0.1);
      // 'one' is the user: he threw the punch.
      settleFight(rng, world, s, m.side, actor, other(m.side), rival, fight, m.fouler);
      s.fightShown = fight;
      s.rngState = rng.state;
      break;
    }
    case 'save': {
      const attSide = other(m.side);
      const shooter = world.players[m.attackerId!];
      const finishing = (shooter.attrs.shooting + shooter.attrs.composure) / 2;
      s[attSide].shots++;
      const saved = rng.chance(clamp(0.3 + 0.55 * q * skill(actor.attrs.goalkeeping) + 0.04 * lvl('shotstopper') - (finishing - 60) / 400, 0.08, 0.92));
      if (saved) {
        s.userSaves++;
        s[attSide].onTarget++;
        bump(s, actor.id, 0.35);
        const f = decideShot(rng, 'save', { pattern: 'solo' });
        push(s, s.minute, attSide, 'save', saveLine(rng, f, { p: shortName(shooter), k: shortName(actor) }), actor.id, played);
        s.events[s.events.length - 1].shot = f;
        s.rngState = rng.state;
      } else {
        // recordGoal counts the shot on target and hits the keeper's rating.
        const f = decideShot(rng, 'goal', { pattern: 'solo' });
        s.rngState = rng.state;
        recordGoal(world, s, attSide, shooter, undefined, 'goal', false, f);
      }
      break;
    }
    case 'tackle': {
      const attSide = other(m.side);
      const attacker = world.players[m.attackerId!];
      const won = rng.chance(clamp(0.25 + 0.6 * q * skill(actor.attrs.defending) + 0.03 * lvl('wall') - (attacker.attrs.dribbling - 60) / 400, 0.08, 0.9));
      s.lastWon = won;
      if (won) {
        s.userTackles++;
        bump(s, actor.id, 0.3);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} reads it and wins the ball off ${shortName(attacker)}!`, actor.id, played);
      } else {
        bump(s, actor.id, m.quiet ? -0.08 : -0.15);
        const assister = m.assistId ? world.players[m.assistId] : undefined;
        if (blunder) punish(attSide, attacker, assister, m.quiet ? 0.12 : 0.22, `${shortName(actor)} dives in and misses. ${shortName(attacker)} is clean through!`);
        else {
          push(s, s.minute, attSide, 'info', `${shortName(attacker)} gets past ${shortName(actor)}...`, attacker.id, played);
          if (!m.quiet) autoShot(rng, world, s, attSide, attacker, assister, 0.05, { pattern: 'solo' });
          else if (rng.chance(0.3)) autoShot(rng, world, s, attSide, attacker, undefined, 0, { pattern: 'solo' });
        }
      }
      s.rngState = rng.state;
      break;
    }
    case 'intercept': {
      const attSide = other(m.side);
      const passer = world.players[m.attackerId!];
      const won = rng.chance(clamp(0.25 + 0.6 * q * skill((actor.attrs.defending + actor.attrs.vision) / 2) + 0.03 * lvl('wall') - (passer.attrs.passing - 60) / 400, 0.08, 0.9));
      s.lastWon = won;
      if (won) {
        s.userTackles++;
        bump(s, actor.id, 0.3);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} reads it and steps in front of the pass!`, actor.id, played);
        // Win it in midfield and the counter is on: the user picks the pass.
        s.pending = { side: m.side, minute: s.minute, keeperId: keeperOf(world, s[attSide]).id, actorId: actor.id, bonus: 0, kind: 'pass', deep: true, options: passOptions(rng, world, s, m.side, actor.id) };
      } else {
        bump(s, actor.id, -0.08);
        const target = m.targetId ? world.players[m.targetId] : undefined;
        if (blunder) punish(attSide, target ?? passer, target ? passer : undefined, m.quiet ? 0.1 : 0.18, `${shortName(actor)} goes for it and gets nothing. ${shortName(target ?? passer)} is in behind!`);
        else {
          push(s, s.minute, attSide, 'info', `${shortName(passer)} threads it past ${shortName(actor)}.`, passer.id, played);
          if (target && !m.quiet) autoShot(rng, world, s, attSide, target, passer, 0.04, { pattern: 'through' });
          else if (m.quiet && rng.chance(0.25)) autoShot(rng, world, s, attSide, passer, undefined, 0, { pattern: 'solo' });
        }
      }
      s.rngState = rng.state;
      break;
    }
    case 'block': {
      const attSide = other(m.side);
      const shooter = world.players[m.attackerId!];
      const won = rng.chance(clamp(0.22 + 0.62 * q * skill((actor.attrs.defending + actor.attrs.physical) / 2) + 0.04 * lvl('wall') - (shooter.attrs.shooting - 60) / 400, 0.08, 0.9));
      s.lastWon = won;
      if (won) {
        s.userTackles++;
        s[attSide].shots++;
        bump(s, actor.id, 0.3);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} throws himself in front of ${shortName(shooter)}'s shot. Blocked!`, actor.id, played);
      } else {
        bump(s, actor.id, -0.1);
        const assister = m.assistId ? world.players[m.assistId] : undefined;
        if (blunder) punish(attSide, shooter, assister, 0.12, `${shortName(actor)} turns his back. ${shortName(shooter)} has a clear sight of goal.`);
        else autoShot(rng, world, s, attSide, shooter, assister, 0, { pattern: 'solo' });
      }
      s.rngState = rng.state;
      break;
    }
    case 'clear': {
      const attSide = other(m.side);
      const attacker = world.players[m.attackerId!];
      // Height wins headers, for him and for the man he is marking.
      const air = (actor.attrs.physical + actor.attrs.defending) / 2 + ((actor.heightCm ?? 180) - 180) / 2;
      const won = rng.chance(clamp(0.3 + 0.55 * q * skill(air) - ((attacker.heightCm ?? 180) - 180) / 250, 0.08, 0.92));
      s.lastWon = won;
      if (won) {
        s.userTackles++;
        bump(s, actor.id, 0.25);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} rises highest and heads it clear!`, actor.id, played);
      } else {
        bump(s, actor.id, -0.1);
        const assister = m.assistId ? world.players[m.assistId] : undefined;
        if (blunder) punish(attSide, attacker, assister, m.quiet ? 0.1 : 0.18, `${shortName(actor)} misjudges it. ${shortName(attacker)} is free in the box!`);
        else {
          push(s, s.minute, attSide, 'info', `${shortName(attacker)} gets above ${shortName(actor)}...`, attacker.id, played);
          if (!m.quiet) autoShot(rng, world, s, attSide, attacker, assister, 0.03, { pattern: 'cross', header: true });
        }
      }
      s.rngState = rng.state;
      break;
    }
    // Tuned so a skipped moment converts about as often as an AI shot from
    // a player of the same quality; playing the mini-game well beats that.
    case 'shot':
      // From way out the curve decides, however the moment was played.
      if (m.view === 'long') {
        finish(distanceChance(m.metres ?? 45) * (0.5 + (1.1 * actor.attrs.shooting) / 99), 'goal', 'miss', m.assistId);
        break;
      }
      // From distance it takes a real shooter.
      if (actor.id === s.focus.playerId) s.spam = (s.spam ?? 0) + 1;
      finish(0.02 + 0.3 * q * skill(actor.attrs.shooting) - keeperPenalty + m.bonus - (actor.id === s.focus.playerId ? spamCost(s) - 0.05 : 0) + 0.025 * lvl('finisher') + (m.view === 'box' || m.view === 'oneonone' ? 0.03 * lvl('poacher') : 0) - (m.view === 'outside' ? (0.06 + 0.14 * (m.range ?? 0)) * (1 - actor.attrs.shooting / 99) : 0), 'goal', q > 0.35 ? 'save' : 'miss', m.assistId);
      break;
    case 'header': {
      // Height and strength win the ball in the air.
      const air = ((actor.attrs.physical + actor.attrs.shooting) / 2 + ((actor.heightCm ?? 180) - 180) / 2) as number;
      finish(0.03 + 0.3 * q * skill(air) - keeperPenalty + m.bonus + 0.02 * lvl('finisher'), 'headerGoal', q > 0.35 ? 'save' : 'headerMiss', m.assistId);
      break;
    }
    case 'penalty':
      finish(0.4 + 0.42 * q * skill(actor.attrs.composure) - keeperPenalty / 2 + 0.04 * lvl('setpiece'), 'penaltyGoal', 'penaltyMiss');
      break;
    case 'freekick':
      finish(0.02 + 0.22 * q * skill(actor.attrs.shooting) - keeperPenalty / 2 + 0.03 * lvl('setpiece'), 'freekickGoal', 'freekickMiss');
      break;
    case 'dribble': {
      // A learned skill move adds to the chance: more for the harder ones.
      const move = moveId && hasMove(actor, moveId) ? SKILL_MOVES.find((x) => x.id === moveId) : undefined;
      const flair = move ? 0.02 + 0.02 * move.stars : 0.006 * (actor.moves?.length ?? 0);
      // The next man is harder to beat than the first.
      const beaten = m.beaten ?? 0;
      const ok = rng.chance(clamp(0.2 + 0.7 * q * skill(actor.attrs.dribbling) + 0.04 * (lvl('speedster') + lvl('dribbler')) + flair - 0.12 * beaten, 0.05, 0.94));
      if (ok) {
        const now = beaten + 1;
        bump(s, actor.id, (0.2 + (move ? 0.05 * move.stars : 0)) * (now > 1 ? 1.5 : 1));
        const how = move ? `with a ${move.label.toLowerCase()}` : 'and skips away';
        push(s, s.minute, m.side, 'info', now > 1 ? `${shortName(actor)} beats a second man ${how}! The box opens up.` : `${shortName(actor)} beats his man ${how}!`, actor.id, played);
        // Past him: the user picks what comes next. After two men he is
        // clean through, and the chance is bigger for it.
        s.pending = { ...m, kind: 'choice', choices: now >= 2 ? ['shot', 'pass'] : ['shot', 'pass', 'dribble'], beaten: now, bonus: m.bonus + (now >= 2 ? 0.12 : 0.06), ...shotPlace(s, m.side, true), options: undefined };
        s.rngState = rng.state;
      } else {
        bump(s, actor.id, -0.1);
        push(s, s.minute, m.side, 'info', line(rng, 'dribbleFail', { p: shortName(actor) }), actor.id, played);
        s.rngState = rng.state;
      }
      break;
    }
    case 'pass': {
      const options = m.options ?? [];
      let target: PassOption | undefined = options.find((o) => o.playerId === chosenPlayerId);
      if (!target) {
        // Skipped: good passers weigh risk against reward; others guess.
        const value = (o: PassOption) => o.openness * (0.08 + (o.threat ?? 0.12));
        const sorted = [...options].sort((a, b) => value(b) - value(a));
        target = rng.chance(actor.attrs.vision / 110) ? sorted[0] : rng.pick(options);
      }
      // A played pass: q already carries how open the man was and how fast
      // the user picked him, so it is not discounted again. A safe ball
      // nearly always arrives; a through ball about two times in three.
      const ok =
        target &&
        (passed
          ? passed === 'ok'
          : played
          ? rng.chance(clamp(0.35 + 0.6 * q + 0.15 * ((actor.attrs.passing - 50) / 50) + 0.04 * lvl('playmaker'), 0.1, 0.96))
          : rng.chance(clamp(0.25 + 0.65 * q * (target.openness ?? 0.5) * skill(actor.attrs.passing) + 0.04 * lvl('playmaker'), 0.05, 0.95)));
      const focused = actor.id === s.focus.playerId;
      if (ok && focused) s.spam = 0;
      if (target) s.lastPass = { to: target.playerId, ok: !!ok, kind: target.kind, offside: passed === 'offside' || undefined };
      if (ok && target && target.kind === 'safe' && focused && !m.deep && (m.chain ?? 0) < 2) {
        // A one-two: the ball comes back and the user goes again, a little
        // further forward.
        bump(s, actor.id, 0.1);
        const mate = world.players[target.playerId];
        push(s, s.minute, m.side, 'info', `${shortName(actor)} plays a one-two with ${shortName(mate)}.`, actor.id, played);
        s.pending = { ...m, kind: 'choice', choices: ['shot', 'dribble', 'pass'], options: undefined, assistId: mate.id, bonus: m.bonus + 0.09, chain: (m.chain ?? 0) + 1 };
      } else if (ok && target) {
        // A ball played well in its scene is a big chance: up to 1.4 times
        // the danger. A poor one, still arriving, is worth less.
        const threat = (target.threat ?? 0.12) * (passed ? 0.6 + 0.8 * q : 1);
        bump(s, actor.id, passed && q > 0.7 ? 0.25 : 0.15);
        const receiver = world.players[target.playerId];
        if (m.deep && !rng.chance(0.3 + 1.5 * (target.threat ?? 0.12))) {
          // From deep, a good ball keeps the move going; a chance is not
          // guaranteed.
          push(s, s.minute, m.side, 'info', `${shortName(actor)} finds ${shortName(receiver)} and the move goes on.`, actor.id, played);
        } else {
          const pattern: Pattern = m.setPiece || target.kind === 'cross' ? 'cross' : target.kind === 'through' ? 'through' : target.kind === 'square' ? 'cutback' : 'build';
          autoShot(rng, world, s, m.side, receiver, actor, passed ? threat : target.threat ?? 0.12 + 0.15 * target.openness, { pattern, header: pattern === 'cross' });
          const last = s.events[s.events.length - 1];
          if (last) last.played = played;
        }
      } else {
        bump(s, actor.id, -0.1);
        if (passed === 'offside' && target) push(s, s.minute, m.side, 'info', `Flag up. ${shortName(world.players[target.playerId])} is offside.`, actor.id, played);
        else {
          // The man who cuts it out is the one the pitch shows winning it.
          const outfield = s[other(m.side)].onPitch.filter((id) => world.players[id]?.position !== 'GK');
          const cutBy = outfield.length ? rng.pick(outfield) : undefined;
          if (cutBy && s.lastPass) s.lastPass.cutBy = cutBy;
          const d = cutBy ? shortName(world.players[cutBy]) : 'A defender';
          const p = shortName(actor);
          const text = target?.kind === 'through' ? `${d} reads ${p}'s through ball and cuts it out.` : target?.kind === 'cross' || m.setPiece ? `${d} heads ${p}'s cross away.` : `${d} steps in and intercepts ${p}'s pass.`;
          push(s, s.minute, m.side, 'info', text, actor.id, played);
        }
      }
      s.rngState = rng.state;
      break;
    }
  }
}

// --- Substitutions ---------------------------------------------------------

export function makeSub(world: World, s: MatchState, sideKey: SideKey, outId: string, inId: string): boolean {
  const side = s[sideKey];
  if (side.subsUsed >= s.laws.maxSubs || !side.onPitch.includes(outId) || !side.bench.includes(inId)) return false;
  side.onPitch = side.onPitch.map((id) => (id === outId ? inId : id));
  side.bench = side.bench.filter((id) => id !== inId);
  side.usedIds.push(inId);
  side.subsUsed++;
  s.minutes[outId] = s.minute;
  s.cameOn[inId] = s.minute;
  s.ratings[inId] = 6;
  const rng = new Rng(s.rngState);
  push(s, s.minute, sideKey, 'sub', line(rng, 'sub', { p: shortName(world.players[inId]), o: shortName(world.players[outId]), ...names(world, s, sideKey) }));
  s.rngState = rng.state;
  return true;
}

// The coach has seen enough. Below this rating the user's player can come off,
// more likely the worse he has been, and more likely still on a booking.
export const POOR_RATING = 5.8;

function hookUser(rng: Rng, world: World, s: MatchState, sideKey: SideKey): boolean {
  const side = s[sideKey];
  const id = s.focus.playerId;
  if (!id || !side.onPitch.includes(id) || world.players[id].position === 'GK') return false;
  const rating = (s.ratings[id] ?? 6) + (skillLevel(world.players[id], 'trusted') ? 0.4 : 0);
  if (rating >= POOR_RATING || s.goals[id] || s.assists[id]) return false;
  const p = Math.min(0.85, (POOR_RATING - rating) * 1.1 + (s.yellows[id] ? 0.2 : 0) + 0.15);
  if (!rng.chance(p)) return false;
  const me = world.players[id];
  const incoming = players(world, side.bench).filter((b) => b.position !== 'GK').sort((a, b) => (b.position === me.position ? 1 : 0) - (a.position === me.position ? 1 : 0) || matchRating(b) - matchRating(a))[0];
  if (!incoming) return false;
  s.rngState = rng.state;
  const done = makeSub(world, s, sideKey, id, incoming.id);
  rng.state = s.rngState;
  if (done) {
    s.hooked = true;
    push(s, s.minute, sideKey, 'info', `The coach has seen enough. ${shortName(me)} is taken off.`, id, true);
  }
  return done;
}

function aiSubs(rng: Rng, world: World, s: MatchState, sideKey: SideKey) {
  const side = s[sideKey];
  if (s.focus.clubId === side.clubId) return;
  if (!SUB_MINUTES.includes(s.minute) || !side.bench.length) return;
  if (hookUser(rng, world, s, sideKey)) return;
  const onPitch = players(world, side.onPitch).filter((p) => p.position !== 'GK');
  const focusId = s.focus.playerId;
  // The user's player on the bench gets a fair shot at coming on.
  // Youngsters on the bench get minutes more often, so careers start moving.
  const young = focusId ? world.players[focusId].age <= 19 : false;
  const benchFocus = focusId && side.bench.includes(focusId) && s.minute === 60 && rng.chance(young ? 0.75 : 0.55);
  const incoming = benchFocus
    ? world.players[focusId!]
    : players(world, side.bench)
        .filter((p) => p.position !== 'GK')
        .sort((a, b) => matchRating(b) - matchRating(a))[0];
  if (!incoming) return;
  const samePos = onPitch.filter((p) => p.position === incoming.position && p.id !== focusId);
  const pool = samePos.length ? samePos : onPitch.filter((p) => p.id !== focusId);
  const out = pool.sort((a, b) => (s.ratings[a.id] ?? 6) - (s.ratings[b.id] ?? 6))[0];
  if (out) {
    s.rngState = rng.state;
    makeSub(world, s, sideKey, out.id, incoming.id);
    rng.state = s.rngState;
  }
}

// A manager changes the shape: at half time or at any stoppage.
export function setFormation(world: World, s: MatchState, sideKey: SideKey, f: Formation): void {
  if (s[sideKey].formation === f) return;
  s[sideKey].formation = f;
  push(s, s.minute, sideKey, 'info', `${teamById(world, s[sideKey].clubId).name} change to ${f}.`);
}

// At half time a coach looks at the score. Behind, he goes for it. Well ahead,
// or a man down, he shuts up shop. Otherwise he usually leaves it alone. The
// user's own side in manager mode is the user's call.
function coachReacts(rng: Rng, world: World, s: MatchState, sideKey: SideKey) {
  const side = s[sideKey];
  if (s.focus.clubId === side.clubId) return;
  const lead = side.goals - s[other(sideKey)].goals;
  const short = side.onPitch.length < 11;
  const want = short || lead >= 2 ? -1 : lead < 0 ? 1 : 0;
  if (!want || !rng.chance(short ? 0.8 : 0.45)) return;
  const now = FORMATION_LEAN[side.formation];
  const options = (Object.keys(FORMATION_LEAN) as Formation[]).filter((f) => (want > 0 ? FORMATION_LEAN[f] > now : FORMATION_LEAN[f] < now));
  if (!options.length) return;
  setFormation(world, s, sideKey, options.sort((a, b) => Math.abs(FORMATION_LEAN[a] - now) - Math.abs(FORMATION_LEAN[b] - now))[0]);
}

// --- Live pitch ------------------------------------------------------------

// The team as it lines up in this match, in today's shape.
export function matchTeam(world: World, side: MatchSide): Club {
  return { ...teamById(world, side.clubId), formation: side.formation };
}

function playSide(world: World, s: MatchState, key: SideKey) {
  const side = s[key];
  return { key, team: matchTeam(world, side), ids: side.onPitch, keeperId: side.onPitch.length ? keeperOf(world, side).id : undefined };
}

// Where this minute's move starts: the centre spot after a goal or the
// break, the spot of a set piece, or wherever the last move ended.
function moveStart(s: MatchState): PlayStart {
  if (s.kickoff) {
    const side = s.kickoff;
    s.kickoff = undefined;
    s.play = undefined;
    return { x: 0.5, y: 0.5, restart: 'kickoff', restartSide: side };
  }
  return nextStart(s.play, s.ball);
}

function shotResult(s: MatchState, from: number): 'goal' | 'save' | 'miss' | null {
  for (let i = s.events.length - 1; i >= from; i--) {
    const t = s.events[i].type;
    if (t === 'goal' || t === 'save' || t === 'miss') return t;
  }
  return null;
}

// How a quiet minute brings the ball to the user's player, from his calls
// and his zone: a pass to feet, a ball in behind for a run, or winning it
// back when he tracks back.
type Involve = { kind: 'receive' | 'through' | 'win'; id: string };

const INVOLVE_OWN: Record<Zone, number> = { attack: 0.14, middle: 0.22, defend: 0.12 };
const INVOLVE_WIN: Record<Zone, number> = { attack: 0.02, middle: 0.06, defend: 0.1 };

function involve(rng: Rng, world: World, s: MatchState, attKey: SideKey): Involve | null {
  const id = s.focus.playerId;
  if (!id || !world.players[id] || world.players[id].position === 'GK') return null;
  const mySide: SideKey | null = s.home.onPitch.includes(id) ? 'home' : s.away.onPitch.includes(id) ? 'away' : null;
  if (!mySide) return null;
  const zone = zoneOf(world, s);
  if (attKey === mySide) {
    const run = shoutActive(s, 'run');
    // Calling for it: a team-mate gives it to him. Running: a ball in behind.
    const p = Math.min(0.8, INVOLVE_OWN[zone] + (shoutActive(s, 'call') ? 0.6 : 0) + (run ? 0.45 : 0));
    if (!rng.chance(p)) return null;
    return { kind: run ? 'through' : 'receive', id };
  }
  const p = INVOLVE_WIN[zone];
  if (!rng.chance(p)) return null;
  // Winning it back counts, watched or not.
  s.userTackles++;
  bump(s, id, 0.05);
  const me = world.players[id];
  push(s, s.minute, mySide, 'info', `${shortName(me)} closes down and wins it back.`, id, true);
  return { kind: 'win', id };
}

function visualize(world: World, s: MatchState, attKey: SideKey, from: PlayStart, outcome: PlayOutcome, inv?: Involve | null) {
  if (!s.visual) return;
  let steps = buildPlay(world, playSeed(s.rngState, s.minute, s.events.length), playSide(world, s, attKey), playSide(world, s, other(attKey)), from, outcome, s.bodies);
  if (inv) steps = withUser(world, s, attKey, steps, inv);
  s.play = steps;
  const end = steps[steps.length - 1];
  if (end) s.ball = { x: Math.min(1, Math.max(0, end.x)), y: Math.min(1, Math.max(0, end.y)) };
}

// Cuts a quiet move where the side on the ball still has it, then brings
// the user in: the ball played to him, or him winning it.
function withUser(world: World, s: MatchState, attKey: SideKey, steps: PlayStep[], inv: Involve): PlayStep[] {
  const first = steps.findIndex((st) => st.side === attKey);
  let end = first;
  while (end >= 0 && end + 1 < steps.length && steps[end + 1].side === attKey && (steps[end + 1].act === 'pass' || steps[end + 1].act === 'run')) end++;
  if (end < 0) return steps;
  const kept = steps.slice(0, end + 1);
  const last = kept[kept.length - 1];
  if (inv.kind === 'win') {
    const mySide = other(attKey);
    kept.push({ x: last.x, y: last.y, carrier: inv.id, side: mySide, act: 'tackle', other: last.carrier ?? undefined });
    return kept;
  }
  if (last.carrier === inv.id) return kept;
  const zone = zoneOf(world, s);
  const slot = assignSlots(world, matchTeam(world, s[attKey]), s[attKey].onPitch)[inv.id] ?? { depth: 0.5, lat: 0.5 };
  const lastDepth = attKey === 'home' ? last.y : 1 - last.y;
  const at =
    inv.kind === 'through'
      ? // In behind: beyond the ball, toward the middle.
        // Into the box, where a run should end.
        { depth: clamp(Math.max(0.84, lastDepth + 0.2), 0.84, 0.9), lat: clamp(0.5 + (slot.lat - 0.5) * 0.4, 0.35, 0.65) }
      : { depth: clamp(slot.depth + (zone === 'attack' ? 0.12 : zone === 'defend' ? -0.06 : 0.04), 0.2, 0.8), lat: clamp(slot.lat, 0.08, 0.92) };
  kept.push({ ...toPitch(attKey, at), carrier: inv.id, side: attKey, act: 'pass' });
  return kept;
}

// After a key moment: how it played out on the pitch.
// The man nearest this spot on the pitch, or any of them when it is not shown.
function closest(rng: Rng, s: MatchState, ids: string[], at: { x: number; y: number }): string | null {
  if (!ids.length) return null;
  const pos = s.bodies;
  if (!pos) return rng.pick(ids);
  const gap = (id: string) => (pos[id] ? Math.hypot(pos[id].x - at.x, pos[id].y - at.y) : 9);
  return [...ids].sort((a, b) => gap(a) - gap(b))[0];
}

function visualizeMoment(world: World, s: MatchState, m: KeyMoment, from: number) {
  if (!s.visual) return;
  const rng = new Rng(playSeed(s.rngState, s.minute, s.events.length + 1));
  const start = { ...s.ball };
  const attKey: SideKey = m.attackerId ? other(m.side) : m.side;
  const defKey = other(attKey);
  const holder = m.attackerId ?? m.actorId;
  const steps: PlayStep[] = [{ ...start, carrier: holder, side: attKey, act: 'start' }];
  const result = shotResult(s, from);
  const lastShot = [...s.events.slice(from)].reverse().find((e) => e.type === 'goal' || e.type === 'save' || e.type === 'miss');
  const forward = attKey === 'home' ? 1 : -1;
  const defenders = s[defKey].onPitch.filter((id) => world.players[id]?.position !== 'GK');
  // Where the receiver of the user's pass stands: his slot, pushed up with
  // the attack.
  const pass = m.kind === 'pass' && s.lastPass && s[attKey].onPitch.includes(s.lastPass.to) ? s.lastPass : undefined;
  s.lastPass = undefined;
  const mateSpot = (id: string) => {
    const slot = assignSlots(world, matchTeam(world, s[attKey]), s[attKey].onPitch)[id] ?? { depth: 0.6, lat: 0.5 };
    return toPitch(attKey, { depth: Math.min(0.9, slot.depth + 0.22), lat: slot.lat });
  };
  if (m.kind === 'fight') {
    // The foul that started it still stands: a free kick to the other man's side.
    const end = { ...start, carrier: m.actorId, other: m.attackerId, side: m.fouler === m.actorId ? other(m.side) : m.side, act: 'brawl' as const, fight: s.fightShown ?? ('calm' as const), restart: 'freekick' as const };
    s.fightShown = undefined;
    s.play = [end];
    return;
  }
  const duel = m.kind === 'tackle' || m.kind === 'intercept' || m.kind === 'block' || m.kind === 'clear';
  const won = s.lastWon;
  s.lastWon = undefined;
  if (duel && won) {
    // The user wins it: where depends on the duel.
    const x = clamp(start.x + rng.range(-0.03, 0.03), 0.04, 0.96);
    if (m.kind === 'intercept') {
      const at = { x, y: start.y + forward * 0.08 };
      steps.push({ ...at, carrier: m.actorId, side: defKey, act: 'win', other: holder });
      if (s.pending) steps.push({ ...at, carrier: m.actorId, side: defKey, act: 'moment' });
    } else if (m.kind === 'block') {
      steps.push({ x, y: start.y + forward * 0.04, carrier: m.actorId, side: defKey, act: 'tackle', other: holder });
    } else if (m.kind === 'clear') {
      // The cross drops on him and he heads it away up the pitch.
      const box = { x: 0.5 + rng.range(-0.12, 0.12), y: (attKey === 'home' ? 1 : 0) - forward * rng.range(0.08, 0.12) };
      steps.push({ ...box, carrier: m.actorId, side: defKey, act: 'cross', header: true });
      const mates = s[defKey].onPitch.filter((id) => id !== m.actorId && world.players[id]?.position === 'MID');
      steps.push({ x: rng.range(0.25, 0.75), y: box.y - forward * 0.3, carrier: mates.length ? rng.pick(mates) : m.actorId, side: defKey, act: 'pass' });
    } else {
      steps.push({ x, y: start.y - forward * 0.03, carrier: m.actorId, side: defKey, act: 'tackle', other: holder });
    }
  } else if (duel && !result) {
    // Beaten, with nothing more to it: he carries on past.
    steps.push({ x: clamp(start.x + rng.range(-0.06, 0.06), 0.04, 0.96), y: start.y + forward * 0.07, carrier: holder, side: attKey, act: 'run' });
  } else if (pass) {
    // The ball goes to the team-mate the user picked, whatever happens next.
    const at = mateSpot(pass.to);
    if (pass.offside) {
      steps.push({ x: at.x, y: at.y, carrier: null, side: defKey, act: 'offside', other: pass.to, restart: 'freekick' });
    } else if (!pass.ok) {
      // Cut out on its way to him, by the man the feed names.
      const winner = pass.cutBy ?? closest(rng, s, defenders, start);
      steps.push({ x: (start.x + at.x) / 2, y: (start.y + at.y) / 2, carrier: winner, side: defKey, act: 'win', other: holder });
    } else if (s.pending) {
      // A one-two: out to him and back, a little further up.
      steps.push({ ...at, carrier: pass.to, side: attKey, act: 'pass' });
      const back = { x: start.x + rng.range(-0.05, 0.05), y: start.y + forward * 0.08 };
      steps.push({ ...back, carrier: m.actorId, side: attKey, act: 'pass' });
      steps.push({ ...back, carrier: m.actorId, side: attKey, act: 'moment' });
    } else {
      // A cross lands in the box for a header; a through ball runs him in
      // behind, into the box.
      const cross = !!m.setPiece || pass.kind === 'cross';
      const box = cross ? toPitch(attKey, { depth: 0.9, lat: clamp(0.5 + rng.range(-0.12, 0.12), 0.3, 0.7) }) : pass.kind === 'through' ? toPitch(attKey, { depth: 0.86, lat: clamp(0.5 + rng.range(-0.15, 0.15), 0.25, 0.75) }) : at;
      steps.push({ ...box, carrier: pass.to, side: attKey, act: cross ? 'cross' : 'pass', header: cross || undefined });
      if (result && lastShot?.playerId) addFinish(steps, rng, attKey, lastShot.playerId, result, playSide(world, s, defKey).keeperId, cross, lastShot.shot);
    }
  } else if (s.pending) {
    // A beaten man: the run goes on and the user gets the shot.
    steps.push({ x: start.x + rng.range(-0.06, 0.06), y: start.y + forward * 0.06, carrier: m.actorId, side: attKey, act: 'run' });
    const last = steps[steps.length - 1];
    steps.push({ x: last.x, y: last.y, carrier: m.actorId, side: attKey, act: 'moment' });
  } else if (result && lastShot?.playerId) {
    const shooter = lastShot.playerId === m.actorId && m.kind === 'save' ? holder : lastShot.playerId;
    if (shooter !== holder && s[attKey].onPitch.includes(shooter)) {
      const crossIn = lastShot?.shot ? !!lastShot.shot.header : m.kind !== 'pass' && m.kind !== 'intercept';
      steps.push({ x: 0.5 + rng.range(-0.14, 0.14), y: (attKey === 'home' ? 1 : 0) - forward * rng.range(0.1, 0.15), carrier: shooter, side: attKey, act: crossIn ? 'cross' : 'pass', header: crossIn || undefined });
    }
    addFinish(steps, rng, attKey, shooter, result, playSide(world, s, defKey).keeperId, m.kind === 'header' || m.kind === 'clear', lastShot?.shot);
  } else {
    // The move broke down: a defender steps in.
    const winner = closest(rng, s, defenders, start);
    steps.push({ x: start.x + rng.range(-0.05, 0.05), y: start.y - forward * 0.04, carrier: winner, side: defKey, act: m.kind === 'dribble' ? 'tackle' : 'win', other: holder });
  }
  s.play = steps;
  const last = steps[steps.length - 1];
  s.ball = { x: Math.min(1, Math.max(0, last.x)), y: Math.min(1, Math.max(0, last.y)) };
}

// --- Main loop -------------------------------------------------------------

export function stepMinute(world: World, s: MatchState): void {
  if (s.pending || s.finished || s.pausedAtHalf) return;
  const rng = new Rng(s.rngState);
  s.minute++;

  if (s.minute === 46 && s.half === 1) {
    s.half = 2;
    s.kickoff = 'away';
    s.play = undefined;
    s.rebound = undefined;
    push(s, 45, null, 'half', `Half time: ${s.home.goals}-${s.away.goals}.`);
    coachReacts(rng, world, s, 'home');
    coachReacts(rng, world, s, 'away');
    if (s.focus.clubId) s.pausedAtHalf = true;
    s.rngState = rng.state;
    return;
  }
  if (s.minute > s.endMinute) {
    if (!s.extraTime && stillLevel(world, s)) startExtraTime(rng, world, s);
    else finishMatch(world, s, rng);
    return;
  }
  const short = tooFew(s);
  if (short) {
    const win = other(short);
    s[win].goals = Math.max(s[win].goals, s[short].goals + 3);
    push(s, s.minute, null, 'info', `The referee abandons the match: ${teamById(world, s[short].clubId).name} are down to too few players.`);
    finishMatch(world, s, rng);
    return;
  }

  aiSubs(rng, world, s, 'home');
  aiSubs(rng, world, s, 'away');

  const hs = sideStrength(world, s.home);
  const as = sideStrength(world, s.away);
  const hm = hs.mid * STYLE_MOD[s.home.style].mid;
  const am = as.mid * STYLE_MOD[s.away.style].mid;
  const pHome = clamp(hm ** 3 / (hm ** 3 + am ** 3) + 0.03, 0.15, 0.85);
  const start = moveStart(s);
  // A loose ball near goal: the side that shot is usually first to it.
  const rebound = s.rebound;
  s.rebound = undefined;
  const firstThere = !!rebound && !start.restart && rng.chance(0.7);
  // Whoever restarts has the ball: an offside is the defenders' free kick, and
  // they keep it. Only now and then do they lose it straight away.
  const restarts = start.restartSide && rng.chance(RESTART_KEPT) ? start.restartSide : null;
  const attKey: SideKey = restarts ?? (firstThere ? rebound! : rng.chance(pHome) ? 'home' : 'away');
  const defKey = other(attKey);
  s[attKey].possession++;
  if (cornerMoment(rng, world, s, start)) {
    s.rngState = rng.state;
    return;
  }
  const before = s.events.length;
  // Move the ball into the attacking half of whoever has it. The live pitch
  // replaces this with the real move (see visualize).
  const forward = (v: number) => (attKey === 'home' ? v : 1 - v);
  s.ball = { x: rng.range(0.15, 0.85), y: forward(rng.range(0.5, 0.75)) };
  let outcome: PlayOutcome = { result: null };
  let inv: Involve | null = null;

  const att = attKey === 'home' ? hs : as;
  const def = attKey === 'home' ? as : hs;
  const walls = Math.min(6, players(world, s[defKey].onPitch).reduce((n, p) => n + skillLevel(p, 'wall'), 0));
  // A run or a call adds a little threat; tracking back takes a little away
  // from the other side.
  const focusSide = s.focus.playerId ? (s.home.onPitch.includes(s.focus.playerId) ? 'home' : s.away.onPitch.includes(s.focus.playerId) ? 'away' : null) : null;
  const shoutMod = !focusSide ? 1 : attKey === focusSide ? (shoutActive(s, 'call') ? 1.12 : shoutActive(s, 'run') ? 1.08 : 1) : shoutActive(s, 'track') ? 0.93 : 1;
  const chanceP =
    (1 - 0.02 * walls) *
    shoutMod *
    (firstThere ? 1.8 : 1) *
    (1 + 0.035 * FORMATION_LEAN[s[attKey].formation] + 0.025 * FORMATION_LEAN[s[defKey].formation]) *
    BASE_CHANCE * (att.attack / def.defense) ** 1.6 * STYLE_MOD[s[attKey].style].chance * STYLE_MOD[s[defKey].style].concede;

  const chance = rng.chance(chanceP);
  if (chance && rng.chance(PENALTY_PER_CHANCE) && s[defKey].onPitch.length) {
    // Brought down in the box: a penalty, whoever it is for.
    const taker = penaltyTaker(world, s[attKey]);
    const fouler = concedePenalty(rng, world, s, defKey);
    if (taker.id === s.focus.playerId && s.moments < MAX_MOMENTS) {
      s.pending = { side: attKey, minute: s.minute, keeperId: keeperOf(world, s[defKey]).id, bonus: 0, kind: 'penalty', actorId: taker.id };
      s.moments++;
      s.rngState = rng.state;
      visualize(world, s, attKey, start, { result: 'moment', shooterId: taker.id });
      setPieceLead(world, s, attKey, s.pending, fouler.id);
      return;
    }
    autoPenalty(rng, world, s, attKey, taker, fouler.id);
    s.rngState = rng.state;
    return;
  } else if (chance) {
    s.ball = { x: rng.range(0.3, 0.7), y: forward(rng.range(0.84, 0.92)) };
    const shooter = pickShooter(rng, world, s, s[attKey]);
    const assister = pickAssister(rng, world, s, s[attKey], shooter);
    // The build-up, decided here so the feed line and the pitch agree.
    const fromCorner = start.restart === 'corner' && start.restartSide === attKey;
    const pattern: Pattern = fromCorner ? 'corner' : rng.weighted<Pattern>(assister ? ['through', 'cross', 'cutback', 'build'] : ['solo', 'longshot', 'build'], assister ? [3, 2, 2, 2] : [3, 2, 2]);
    const header = (pattern === 'cross' || pattern === 'corner') && rng.chance(0.65);
    const defensive = defensiveMoment(rng, world, s, attKey, shooter, assister);
    if (defensive) {
      s.pending = defensive;
      s.moments++;
      s.rngState = rng.state;
      visualize(world, s, attKey, start, { result: 'moment', shooterId: shooter.id, assistId: assister?.id });
      return;
    }
    if (wantsMoment(rng, s, attKey, shooter, assister)) {
      s.pending = buildMoment(rng, world, s, attKey, shooter, assister);
      s.moments++;
      s.rngState = rng.state;
      const passer = s.pending.kind === 'pass';
      const momentPattern: Pattern | undefined = passer ? undefined : s.pending.kind === 'header' ? (pattern === 'corner' ? 'corner' : 'cross') : pattern === 'cross' || pattern === 'corner' ? 'build' : pattern;
      s.pending.pattern = momentPattern;
      visualize(world, s, attKey, start, { result: 'moment', shooterId: s.pending.actorId, assistId: passer ? undefined : assister?.id, cross: s.pending.kind === 'header', pattern: momentPattern });
      if (s.pending.kind === 'penalty' || s.pending.kind === 'freekick' || s.pending.setPiece) setPieceLead(world, s, attKey, s.pending);
      return;
    }
    autoShot(rng, world, s, attKey, shooter, assister, 0, { pattern, header });
    const shot = [...s.events.slice(before)].reverse().find((e) => e.shot);
    outcome = { result: shotResult(s, before), shooterId: shooter.id, assistId: assister?.id, pattern, facts: shot?.shot };
  } else if (zoneMoment(rng, world, s, attKey, start)) {
    s.rngState = rng.state;
    return;
  } else {
    inv = start.restart === 'kickoff' || s.minute <= 2 ? null : involve(rng, world, s, attKey);
    if (!inv && rng.chance(0.03)) push(s, s.minute, attKey, 'info', line(rng, 'quiet', names(world, s, attKey)));
  }

  // Cards and injuries. The pitch shows each one (see withIncident).
  let incident: Incident | null = null;
  let flare: { a: string; b: string; fight: NonNullable<PlayStep['fight']>; side: SideKey } | 'user' | null = null;
  // A bookable foul is committed by the side without the ball.
  if (rng.chance(CARD_PER_MINUTE) && s[defKey].onPitch.length) {
    const pool = players(world, s[defKey].onPitch);
    // A booked player backs off.
    const p = rng.weighted(pool, pool.map((x) => FOUL_WEIGHT[x.position] * (s.yellows[x.id] ? 0.1 : 1)));
    incident = caution(rng, world, s, defKey, p, rng.chance(STRAIGHT_RED));
    s.heat += HEAT_PER_CARD;
    if (rng.chance(s.heat * FLARE_UP)) flare = flareUp(rng, world, s, defKey, p);
  }
  s.heat *= 0.985;
  const sideKey: SideKey = rng.chance(0.5) ? 'home' : 'away';
  const hurt = rng.chance(0.002) ? world.players[rng.pick(s[sideKey].onPitch)] : undefined;
  // Tired legs go first.
  if (hurt && rng.chance(hurt.fitness < 60 ? 1 : 0.6)) {
    const side = s[sideKey];
    const p = hurt;
    incident = { kind: 'injury', id: p.id, side: sideKey };
    s.injuries[p.id] = rng.int(1, 6);
    push(s, s.minute, sideKey, 'injury', line(rng, 'injury', { p: shortName(p) }), p.id);
    const sub = players(world, side.bench).find((b) => b.position === p.position) ?? players(world, side.bench)[0];
    s.rngState = rng.state;
    if (!(sub && makeSub(world, s, sideKey, p.id, sub.id))) {
      side.onPitch = side.onPitch.filter((id) => id !== p.id);
      s.minutes[p.id] = s.minute;
    }
    rng.state = s.rngState;
  }
  s.rngState = rng.state;
  visualize(world, s, attKey, start, outcome, inv);
  if (incident && s.visual && s.play) s.play = withIncident(world, s, s.play, incident);
  if (flare && s.visual && s.play) {
    const end = s.play[s.play.length - 1];
    const at = { x: clamp(end?.x ?? 0.5, 0.05, 0.95), y: clamp(end?.y ?? 0.5, 0.05, 0.95) };
    if (flare === 'user') s.play.push({ ...at, carrier: s.focus.playerId ?? null, side: end?.side ?? attKey, act: 'moment' });
    else s.play.push({ ...at, carrier: flare.a, other: flare.b, side: flare.side, act: 'brawl', fight: flare.fight });
  }
}

type Incident = { kind: 'card'; id: string; side: SideKey; red: boolean } | { kind: 'injury'; id: string; side: SideKey };

// The man fouled turns on the man who did it. If the user is in it, it is
// his call; otherwise it plays out by the numbers.
function flareUp(rng: Rng, world: World, s: MatchState, foulSide: SideKey, fouler: Player): { a: string; b: string; fight: NonNullable<PlayStep['fight']>; side: SideKey } | 'user' | null {
  const otherSide = other(foulSide);
  const pool = players(world, s[otherSide].onPitch).filter((p) => p.position !== 'GK');
  if (!pool.length || !s[foulSide].onPitch.includes(fouler.id)) return null;
  const me = s.focus.playerId;
  const victim = me && pool.some((p) => p.id === me) && rng.chance(0.3) ? world.players[me] : rng.pick(pool);
  if (me && (victim.id === me || fouler.id === me) && s.moments < MAX_MOMENTS) {
    const rival = victim.id === me ? fouler : victim;
    const mySide = victim.id === me ? otherSide : foulSide;
    s.pending = { side: mySide, minute: s.minute, keeperId: keeperOf(world, s[other(mySide)]).id, actorId: me, bonus: 0, kind: 'fight', attackerId: rival.id, fouler: fouler.id };
    s.moments++;
    return 'user';
  }
  // Cool heads calm it; hot ones do not.
  const calm = (fouler.attrs.composure + victim.attrs.composure) / 198;
  const odds = [FLARE_ODDS[0] * (0.6 + calm * 0.8), FLARE_ODDS[1], FLARE_ODDS[2], FLARE_ODDS[3]];
  const fight = rng.weighted(['calm', 'booked', 'one', 'both'] as const, odds);
  settleFight(rng, world, s, foulSide, fouler, otherSide, victim, fight, fouler.id);
  return { a: fouler.id, b: victim.id, fight, side: foulSide };
}

// The referee's verdict. 'one' sends off a, who started it.
// booked: the man just cautioned for the foul that started it, who is not
// cautioned a second time for the same incident.
function settleFight(rng: Rng, world: World, s: MatchState, aSide: SideKey, a: Player, bSide: SideKey, b: Player, fight: NonNullable<PlayStep['fight']>, booked?: string) {
  const names = `${shortName(a)} and ${shortName(b)}`;
  if (fight === 'calm') push(s, s.minute, null, 'info', `${names} square up, but team-mates pull them apart.`);
  else if (fight === 'booked') {
    push(s, s.minute, null, 'info', `${names} go head to head. The referee books them both.`);
    if (a.id !== booked) caution(rng, world, s, aSide, a, false);
    if (b.id !== booked) caution(rng, world, s, bSide, b, false);
  } else {
    push(s, s.minute, null, 'info', fight === 'both' ? `${names} come to blows. Both are sent off!` : `${shortName(a)} lashes out at ${shortName(b)}. Violent conduct.`);
    if (s[aSide].onPitch.includes(a.id)) sendOff(rng, world, s, aSide, a, true);
    if (fight === 'both' && s[bSide].onPitch.includes(b.id)) sendOff(rng, world, s, bSide, b, true);
  }
}

// Who gives away fouls: defenders and midfielders far more than keepers.
const FOUL_WEIGHT: Record<Position, number> = { GK: 0.1, DEF: 3, MID: 3, FWD: 1.2 };

// Books a player, or sends him off for a straight red or a second yellow.
function caution(rng: Rng, world: World, s: MatchState, sideKey: SideKey, p: Player, straight: boolean): Incident {
  const yellows = (s.yellows[p.id] ?? 0) + (straight ? 0 : 1);
  s.yellows[p.id] = yellows;
  if (straight || yellows >= 2) {
    sendOff(rng, world, s, sideKey, p, straight, !straight);
    return { kind: 'card', id: p.id, side: sideKey, red: true };
  }
  bump(s, p.id, -0.2);
  push(s, s.minute, sideKey, 'card', line(rng, 'yellow', { p: shortName(p) }), p.id);
  return { kind: 'card', id: p.id, side: sideKey, red: false };
}

// Off he goes. A side needs a keeper: a sub if one can come on, otherwise the
// best outfield player goes in goal.
export function sendOff(rng: Rng, world: World, s: MatchState, sideKey: SideKey, p: Player, straight: boolean, second = false): void {
  const side = s[sideKey];
  const keeper = keeperOf(world, side).id === p.id;
  side.onPitch = side.onPitch.filter((id) => id !== p.id);
  s.minutes[p.id] = s.minute;
  s.sentOff[p.id] = banFor(straight);
  bump(s, p.id, -1.5);
  push(s, s.minute, sideKey, 'red', second ? `Second yellow! ${shortName(p)} is sent off.` : line(rng, 'red', { p: shortName(p) }), p.id);
  if (!keeper || !side.onPitch.length) return;
  side.standIn = undefined;
  const cover = players(world, side.bench).find((x) => x.position === 'GK');
  const outfield = players(world, side.onPitch).sort((a, b) => (s.ratings[a.id] ?? 6) - (s.ratings[b.id] ?? 6));
  s.rngState = rng.state;
  if (cover && outfield.length && makeSub(world, s, sideKey, outfield[0].id, cover.id)) {
    rng.state = s.rngState;
    return;
  }
  rng.state = s.rngState;
  side.standIn = players(world, side.onPitch).sort((a, b) => b.attrs.goalkeeping - a.attrs.goalkeeping)[0]?.id;
}

// A side below seven cannot go on: the match stops, and the side still on
// the pitch gets at least a 3-0 win.
function tooFew(s: MatchState): SideKey | null {
  return s.home.onPitch.length < MIN_PLAYERS ? 'home' : s.away.onPitch.length < MIN_PLAYERS ? 'away' : null;
}

// The best taker on the side, on shooting and nerve.
function penaltyTaker(world: World, side: MatchSide): Player {
  const ps = players(world, side.onPitch).filter((p) => p.position !== 'GK');
  return [...(ps.length ? ps : players(world, side.onPitch))].sort((a, b) => b.attrs.shooting + b.attrs.composure - (a.attrs.shooting + a.attrs.composure))[0];
}

// A foul in the box. Trying for the ball is a yellow, anything else a red.
function concedePenalty(rng: Rng, world: World, s: MatchState, defKey: SideKey): Player {
  const pool = players(world, s[defKey].onPitch);
  const fouler = rng.weighted(pool, pool.map((x) => (x.position === 'DEF' ? 4 : x.position === 'GK' ? 1 : x.position === 'MID' ? 2 : 0.3)));
  caution(rng, world, s, defKey, fouler, rng.chance(PENALTY_RED));
  return fouler;
}

// A penalty the user is not taking. It plays out on the pitch like any other.
function autoPenalty(rng: Rng, world: World, s: MatchState, attKey: SideKey, taker: Player, foulerId: string) {
  const side = s[attKey];
  const keeper = keeperOf(world, s[other(attKey)]);
  side.shots++;
  const skill = (taker.attrs.shooting + taker.attrs.composure) / 2 - keeper.attrs.goalkeeping;
  const scored = rng.chance(clamp(0.77 + skill / 500, 0.62, 0.9));
  const saved = !scored && rng.chance(0.68);
  const result = scored ? 'goal' : saved ? 'save' : 'miss';
  const f = decideShot(rng, result, { penalty: true });
  const vars = { p: shortName(taker), k: shortName(keeper) };
  if (scored) {
    s.rngState = rng.state;
    recordGoal(world, s, attKey, taker, undefined, 'penaltyGoal', false, f);
    rng.state = s.rngState;
  } else {
    if (saved) {
      side.onTarget++;
      bump(s, keeper.id, 0.4);
    }
    bump(s, taker.id, -0.2);
    push(s, s.minute, attKey, saved ? 'save' : 'miss', saved ? saveLine(rng, f, vars) : missLine(rng, f, vars), taker.id);
    s.events[s.events.length - 1].shot = f;
  }
  if (!s.visual) return;
  const v = new Rng(playSeed(s.rngState, s.minute, s.events.length + 5));
  const spot = toPitch(attKey, { depth: 0.895, lat: 0.5 });
  const foulAt = toPitch(attKey, { depth: v.range(0.9, 0.95), lat: v.range(0.35, 0.65) });
  const steps: PlayStep[] = [
    { ...foulAt, carrier: taker.id, side: attKey, act: 'run' },
    { ...foulAt, carrier: foulerId, side: attKey, act: 'foul', other: taker.id, restart: 'penalty' },
    { ...spot, carrier: taker.id, side: attKey, act: 'start', restart: 'penalty' },
  ];
  addFinish(steps, v, attKey, taker.id, result, keeper.id, false, f);
  s.play = steps;
  s.ball = { x: clamp(spot.x, 0, 1), y: clamp(spot.y, 0, 1) };
}

// Shows a card or an injury in the minute's move. A card follows a foul by
// that player (a free kick to the other side) unless the move ended with a
// shot, when it comes after it. An injury: he goes down where play stopped.
function withIncident(world: World, s: MatchState, steps: PlayStep[], inc: Incident): PlayStep[] {
  const last = steps[steps.length - 1];
  if (!last || last.act === 'goal') return steps;
  if (inc.kind === 'injury') {
    steps.push({ x: last.x, y: last.y, carrier: inc.id, side: last.side, act: 'injury' });
    return steps;
  }
  const card = inc.red ? 'red' : 'yellow';
  if (last.act === 'save' || last.act === 'miss') {
    steps.push({ x: last.x, y: last.y, carrier: inc.id, side: last.side, act: 'card', card });
    return steps;
  }
  const kept = last.act === 'foul' || last.act === 'out' || last.act === 'offside' ? steps.slice(0, -1) : steps;
  const end = kept[kept.length - 1] ?? last;
  const victimSide = other(inc.side);
  const rng = new Rng(playSeed(s.rngState, s.minute, s.events.length + 7));
  const victims = s[victimSide].onPitch.filter((id) => world.players[id]?.position !== 'GK');
  const victim = end.side === victimSide && end.carrier && s[victimSide].onPitch.includes(end.carrier) ? end.carrier : victims.length ? rng.pick(victims) : undefined;
  const at = { x: clamp(end.x, 0.04, 0.96), y: clamp(end.y, 0.04, 0.96) };
  kept.push({ ...at, carrier: inc.id, side: victimSide, act: 'foul', other: victim, restart: 'freekick' });
  kept.push({ ...at, carrier: inc.id, side: victimSide, act: 'card', card });
  return kept;
}

// A penalty or a free kick for the user: brought down first, then the ball
// placed for him (on the spot, or 25 to 30 metres out).
function setPieceLead(world: World, s: MatchState, attKey: SideKey, m: KeyMoment, foulerId?: string) {
  const steps = s.play;
  if (!s.visual || !steps?.length) return;
  const at = steps[steps.length - 1].act === 'moment' ? steps.length - 1 : steps.length;
  const rng = new Rng(playSeed(s.rngState, s.minute, s.events.length + 3));
  const spot = m.kind === 'penalty' ? toPitch(attKey, { depth: 0.895, lat: 0.5 }) : toPitch(attKey, { depth: rng.range(0.7, 0.76), lat: rng.range(0.3, 0.7) });
  const foulAt = m.kind === 'penalty' ? toPitch(attKey, { depth: rng.range(0.9, 0.95), lat: rng.range(0.35, 0.65) }) : spot;
  const defs = s[other(attKey)].onPitch.filter((id) => world.players[id]?.position !== 'GK');
  const fouler = foulerId ?? closest(rng, s, defs, foulAt);
  const lead: PlayStep[] = [
    { ...foulAt, carrier: m.actorId, side: attKey, act: 'run' },
    { ...foulAt, carrier: fouler, side: attKey, act: 'foul', other: m.actorId, restart: m.kind === 'penalty' ? 'penalty' : 'freekick' },
    { ...spot, carrier: m.actorId, side: attKey, act: 'start', restart: m.kind === 'penalty' ? 'penalty' : 'freekick' },
    { ...spot, carrier: m.actorId, side: attKey, act: 'moment' },
  ];
  s.play = [...steps.slice(0, at), ...lead];
  s.ball = { x: clamp(spot.x, 0, 1), y: clamp(spot.y, 0, 1) };
}

function finishMatch(world: World, s: MatchState, rng: Rng) {
  s.minute = s.endMinute;
  s.finished = true;
  const diff = s.home.goals - s.away.goals;
  for (const [key, side] of [['home', s.home], ['away', s.away]] as const) {
    const won = key === 'home' ? diff > 0 : diff < 0;
    const lost = key === 'home' ? diff < 0 : diff > 0;
    const conceded = key === 'home' ? s.away.goals : s.home.goals;
    for (const id of side.usedIds) {
      const p = world.players[id];
      let r = (s.ratings[id] ?? 6) + (won ? 0.4 : lost ? -0.3 : 0) + 0.1 * skillLevel(p, 'leader') + rng.normal(0, 0.35);
      if (conceded === 0 && (p.position === 'GK' || p.position === 'DEF')) r += 0.5;
      s.ratings[id] = Math.round(clamp(r, 3, 10) * 10) / 10;
      if (s.minutes[id] === undefined) s.minutes[id] = s.endMinute;
    }
  }
  push(s, s.endMinute, null, 'full', `${s.extraTime ? 'After extra time' : 'Full time'}: ${teamById(world, s.home.clubId).name} ${s.home.goals}-${s.away.goals} ${teamById(world, s.away.clubId).name}.`);
  if (stillLevel(world, s)) {
    s.finished = false;
    s.shootout = { h: 0, a: 0, round: 0, homeTaken: false };
    runShootout(world, s, rng);
  }
  s.rngState = rng.state;
}

// A knockout tie with nothing between the sides. A second leg is level on
// aggregate, not on the night. Away goals settle it until 2020/21.
function stillLevel(world: World, s: MatchState): boolean {
  const leg = s.firstLeg;
  const homeTotal = s.home.goals + (leg?.awayGoals ?? 0);
  const awayTotal = s.away.goals + (leg?.homeGoals ?? 0);
  const awayGoalsDecide = !!leg && world.season <= 2020 && s.away.goals !== leg.awayGoals;
  return s.knockout && homeTotal === awayTotal && !awayGoalsDecide;
}

// Thirty more minutes, with one more substitute each.
function startExtraTime(rng: Rng, world: World, s: MatchState) {
  push(s, s.endMinute, null, 'half', `Full time: ${s.home.goals}-${s.away.goals}. Extra time.`);
  s.extraTime = true;
  s.half = 3;
  s.minute = 90;
  s.endMinute = 120 + rng.int(0, 2);
  s.laws = { ...s.laws, maxSubs: s.laws.maxSubs + 1 };
  s.kickoff = 'home';
  s.play = undefined;
  s.rebound = undefined;
  coachReacts(rng, world, s, 'home');
  coachReacts(rng, world, s, 'away');
  if (s.focus.clubId) s.pausedAtHalf = true;
  s.rngState = rng.state;
}

// The order of a side's kicks: its best finishers. The user's player always
// takes one of the first five, third, so a shoot-out rarely ends before him.
function shootoutOrder(world: World, s: MatchState, side: MatchSide): Player[] {
  const order = players(world, side.onPitch)
    .filter((p) => p.position !== 'GK')
    .sort((a, b) => b.attrs.composure + b.attrs.shooting - a.attrs.composure - a.attrs.shooting);
  const at = order.findIndex((p) => p.id === s.focus.playerId);
  if (at > 2) order.splice(2, 0, ...order.splice(at, 1));
  return order.length ? order : players(world, side.onPitch);
}

// Decided: one side cannot be caught, or sudden death has a winner.
function shootoutOver(so: NonNullable<MatchState['shootout']>): boolean {
  if (so.round >= 30) return !so.homeTaken;
  if (so.round >= 5) return !so.homeTaken && so.h !== so.a;
  const homeLeft = 5 - so.round - (so.homeTaken ? 1 : 0);
  const awayLeft = 5 - so.round;
  return so.h > so.a + awayLeft || so.a > so.h + homeLeft;
}

function recordKick(s: MatchState, side: SideKey, taker: Player, scored: boolean, played?: boolean) {
  const so = s.shootout!;
  if (side === 'home') {
    if (scored) so.h++;
    so.homeTaken = true;
  } else {
    if (scored) so.a++;
    so.homeTaken = false;
    so.round++;
  }
  push(s, s.minute, side, 'info', `${shortName(taker)} ${scored ? 'scores' : 'misses'}. Penalties: ${so.h}-${so.a}.`, taker.id, played);
}

const kickGoes = (rng: Rng, taker: Player, keeper: Player) => rng.chance(clamp(0.74 + (taker.attrs.composure - keeper.attrs.goalkeeping) / 400 + 0.03 * skillLevel(taker, 'setpiece'), 0.5, 0.92));

// Five kicks each, then sudden death. It stops when the user's player is up,
// and carries on from his kick.
function runShootout(world: World, s: MatchState, rng: Rng) {
  const so = s.shootout!;
  while (!shootoutOver(so)) {
    const key: SideKey = so.homeTaken ? 'away' : 'home';
    const order = shootoutOrder(world, s, s[key]);
    const taker = order[so.round % order.length];
    const keeper = keeperOf(world, s[other(key)]);
    if (taker.id === s.focus.playerId) {
      s.pending = { side: key, minute: s.minute, keeperId: keeper.id, bonus: 0, kind: 'penalty', actorId: taker.id, shootout: true };
      if (s.visual) {
        const spot = toPitch(key, { depth: 0.895, lat: 0.5 });
        s.play = [{ ...spot, carrier: taker.id, side: key, act: 'start', restart: 'penalty' }, { ...spot, carrier: taker.id, side: key, act: 'moment' }];
      }
      return;
    }
    recordKick(s, key, taker, kickGoes(rng, taker, keeper));
  }
  const homeWins = so.h > so.a;
  s.penaltyWinner = homeWins ? s.home.clubId : s.away.clubId;
  s.finished = true;
  push(s, s.endMinute, homeWins ? 'home' : 'away', 'goal', `${teamById(world, s.penaltyWinner).name} win ${Math.max(so.h, so.a)}-${Math.min(so.h, so.a)} on penalties!`);
}

function userKick(world: World, s: MatchState, m: KeyMoment, played: Played) {
  const rng = new Rng(s.rngState);
  const taker = world.players[m.actorId];
  const scored = played.forced ? played.forced === 'goal' : kickGoes(rng, taker, world.players[m.keeperId]);
  recordKick(s, m.side, taker, scored, true);
  runShootout(world, s, rng);
  s.rngState = rng.state;
}

export function resumeFromHalf(s: MatchState): void {
  s.pausedAtHalf = false;
}

// Runs to the end, auto-resolving any moments. Used for skip and AI games.
export function simToEnd(world: World, s: MatchState): void {
  let guard = 0;
  while (!s.finished && guard++ < 400) {
    if (s.pending) resolveMoment(world, s, null);
    else if (s.pausedAtHalf) resumeFromHalf(s);
    else stepMinute(world, s);
  }
}

// On the bench: plays on until the user's player comes on, or to the end
// if he never does.
export function simUntilOn(world: World, s: MatchState): void {
  const id = s.focus.playerId;
  const on = () => !!id && (s.home.onPitch.includes(id) || s.away.onPitch.includes(id));
  let guard = 0;
  while (!s.finished && !on() && guard++ < 400) {
    if (s.pending) resolveMoment(world, s, null);
    else if (s.pausedAtHalf) resumeFromHalf(s);
    else stepMinute(world, s);
  }
}

// Plays on to half time (or the end, if that comes first).
export function simToHalf(world: World, s: MatchState): void {
  let guard = 0;
  while (!s.finished && s.half === 1 && guard++ < 200) {
    if (s.pending) resolveMoment(world, s, null);
    else stepMinute(world, s);
  }
}

export function possessionPct(s: MatchState): [number, number] {
  const total = s.home.possession + s.away.possession;
  if (!total) return [50, 50];
  const h = Math.round((100 * s.home.possession) / total);
  return [h, 100 - h];
}

// Writes a finished match back into the world: result, stats, fitness, injuries.
export function commitMatch(world: World, s: MatchState, fixture: Fixture): void {
  if (s.hooked && s.focus.playerId) world.players[s.focus.playerId].morale = clamp(world.players[s.focus.playerId].morale - 4, 0, 100);
  fixture.played = true;
  fixture.homeGoals = s.home.goals;
  fixture.awayGoals = s.away.goals;
  fixture.scorers = s.scorers;
  fixture.penaltyWinner = s.penaltyWinner;
  const international = !!teamById(world, s.home.clubId).national;
  // A qualifier in the middle of the club season leaves club football alone:
  // no tired legs, knocks or bans carried back.
  const quiet = fixture.stage === 'Qualifier';
  const diff = s.home.goals - s.away.goals;
  for (const side of [s.home, s.away]) {
    const isHome = side === s.home;
    const result = isHome ? Math.sign(diff) : -Math.sign(diff);
    for (const id of side.usedIds) {
      const p = world.players[id];
      if (!international) p.form = [...(p.form ?? []), s.ratings[id] ?? 6].slice(-5);
      if (international) {
        p.caps++;
        p.intlGoals += s.goals[id] ?? 0;
      } else {
        p.stats.apps++;
        p.stats.goals += s.goals[id] ?? 0;
        p.stats.assists += s.assists[id] ?? 0;
        p.stats.ratingSum += s.ratings[id] ?? 6;
      }
      const played = (s.minutes[id] ?? 90) - (s.cameOn[id] ?? 0);
      const engine = 1 - 0.15 * skillLevel(p, 'engine');
      if (!quiet) p.fitness = clamp(p.fitness - (played / 90) * (side.style === 'press' ? 28 : 22) * engine, 30, 100);
    }
    if (international) continue;
    const leaders = side.usedIds.reduce((n, id) => n + skillLevel(world.players[id], 'leader'), 0);
    for (const id of teamById(world, side.clubId).playerIds) {
      const p = world.players[id];
      p.morale = clamp(p.morale + result * 5 + (result > 0 ? Math.min(3, leaders) : 0) + (side.usedIds.includes(id) ? 1 : -2), 10, 100);
    }
  }
  if (quiet) return;
  for (const [id, weeks] of Object.entries(s.injuries)) {
    const p = world.players[id];
    p.injuryWeeks = Math.max(p.injuryWeeks, skillLevel(p, 'ironman') ? Math.max(1, weeks - 1) : weeks);
    p.morale = clamp(p.morale - 2 * weeks, 10, 100);
  }
  // The week's recovery takes one off straight after a league match. After a
  // midweek game the league match that week is the first he misses.
  if (!international) for (const [id, games] of Object.entries(s.sentOff)) world.players[id].suspendedWeeks = Math.max(world.players[id].suspendedWeeks ?? 0, games + (fixture.europe ? 0 : 1));
}

export function quickSim(world: World, fixture: Fixture, seed: number): MatchState {
  const s = createMatch(world, fixture, {}, seed);
  simToEnd(world, s);
  commitMatch(world, s, fixture);
  return s;
}

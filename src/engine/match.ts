import { Fixture, Player, Position, Style, World } from './types';
import { Rng, clamp } from './rng';
import { matchRating, shortName } from './player';
import { bench, startingXI, teamById } from './lineup';
import { SKILL_MOVES, finishBonus, hasMove, skillLevel } from './skills';
import { ROLES, isRole } from './roles';
import { celebrationText } from './creation';
import { line, LineKind } from './commentary';
import { Pattern, ShotFacts, goalLine, missLine, saveLine } from './shotText';
import { PlayOutcome, PlayStart, PlayStep, addFinish, assignNumbers, assignSlots, buildPlay, nextStart, playSeed, toPitch } from './play';

export type SideKey = 'home' | 'away';
// 'choice' asks the user what to do (shoot, pass or dribble) before the
// matching mini-game; 'header' meets a cross.
// 'intercept', 'block' and 'clear' are the defending moments: read a pass,
// throw yourself in front of a shot, head a cross away.
export type MomentKind = 'shot' | 'dribble' | 'pass' | 'penalty' | 'freekick' | 'save' | 'tackle' | 'header' | 'choice' | 'intercept' | 'block' | 'clear';

// Where the career player plays in a match. It decides which moments come
// to him: shots and men to beat up front, passes, long shots and
// interceptions in the middle, tackles, blocks and headers at the back.
export type Zone = 'defend' | 'middle' | 'attack';

// Career player's calls from the pitch. Each lasts a spell of the match and
// then needs a rest before the next.
export type ShoutKind = 'call' | 'run' | 'track';
export const SHOUT_MINUTES = 8;
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
  const add = (p: Player | undefined, kind: PassKind, openness: number, threat: number) => {
    if (!p) return;
    used.push(p.id);
    out.push({ playerId: p.id, kind, openness, threat });
  };
  const runner = shooterId ? world.players[shooterId] : undefined;
  add(runner && runner.position !== 'GK' ? runner : pick(forwards.length ? forwards : mates, used), 'through', rng.range(0.3, 0.6), rng.range(0.24, 0.32));
  add(pick(mates.filter((p) => p.position !== 'DEF'), used), 'square', rng.range(0.5, 0.78), rng.range(0.12, 0.2));
  add(pick(mates.filter((p) => p.position !== 'FWD'), used), 'safe', rng.range(0.82, 0.96), rng.range(0.02, 0.06));
  if (tall && !used.includes(tall.id) && rng.chance(0.6)) add(tall, 'cross', rng.range(0.4, 0.65), rng.range(0.15, 0.24));
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
  // Where a shot or header comes from, for how the moment looks.
  view?: 'box' | 'outside' | 'oneonone' | 'cross' | 'corner';
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
  half: 1 | 2;
  finished: boolean;
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
  // Knockout games go to penalties when level.
  knockout: boolean;
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
  // Side that kicks off next, after a goal or at half time.
  kickoff?: SideKey;
  // The pass the last pass moment played: who it was for and whether it
  // arrived. The pitch draws exactly that pass: a cross as a cross, and an
  // offside flag when the pass scene called it.
  lastPass?: { to: string; ok: boolean; kind?: PassKind; offside?: boolean; cutBy?: string };
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
const BASE_CHANCE = 0.215;
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
    knockout: !!fixture.stage && fixture.stage !== 'Group',
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
    for (const p of ps) {
      const weight = LINE_WEIGHTS[kind][p.position];
      sum += weight * matchRating(p);
      w += weight;
    }
    // Fewer than 11 players (red card or injury with no subs left) hurts.
    return (w ? sum / w : 30) * (0.6 + 0.4 * (ps.length / 11));
  };
  return { attack: calc('attack'), mid: calc('mid'), defense: calc('defense') };
}

function keeperOf(world: World, side: MatchSide): Player {
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
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : ZONE_SHOOT[zone] * (shoutActive(s, 'run') ? 1.8 : shoutActive(s, 'call') ? 1.5 : 1));
  return rng.weighted(ps, ps.map((p) => SHOOT_WEIGHT[p.position] * (p.attrs.shooting / 50) ** 2 * boost(p)));
}

function pickAssister(rng: Rng, world: World, s: MatchState, side: MatchSide, shooter: Player): Player | undefined {
  if (!rng.chance(0.7)) return undefined;
  const ps = players(world, side.onPitch).filter((p) => p.id !== shooter.id);
  if (!ps.length) return undefined;
  const zone = zoneOf(world, s);
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : ZONE_ASSIST[zone] * (shoutActive(s, 'call') ? 3 : 1));
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

function recordGoal(world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, kind: LineKind, played: boolean, facts?: ShotFacts) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
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
  push(s, s.minute, sideKey, 'goal', text, shooter.id, played);
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
  } else if (!how.penalty && !how.header && rng.chance(0.22)) {
    f.blocker = how.freekick ? 'wall' : 'lane';
    f.aim = rng.range(0.2, 0.8);
  } else if (shape !== 'low' && rng.chance(0.4)) {
    f.over = true;
    f.aim = rng.range(0.25, 0.75);
  } else {
    f.aim = rng.chance(0.5) ? rng.range(-0.18, -0.04) : rng.range(1.04, 1.18);
    f.deflected = !how.penalty && rng.chance(0.18);
  }
  return f;
}

// What the user's mini-game showed, as shot facts.
function factsFrom(rng: Rng, result: 'goal' | 'save' | 'miss', p: Played, how: { header?: boolean; penalty?: boolean; freekick?: boolean }): ShotFacts {
  if (p.aim === undefined) return decideShot(rng, result, how);
  const inside = p.aim >= 0.02 && p.aim <= 0.98;
  return {
    aim: p.aim,
    shape: p.shape ?? 'driven',
    header: how.header,
    penalty: how.penalty,
    freekick: how.freekick,
    blocker: result === 'miss' ? (p.wall ? 'wall' : p.blocker) : undefined,
    over: result === 'miss' && !p.blocker && !p.wall && (p.over ?? inside),
    tipped: result === 'save' && rng.chance(0.33),
  };
}

function autoShot(rng: Rng, world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, bonus: number, how: { header?: boolean; pattern?: Pattern } = {}) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
  side.shots++;
  const finishing = (shooter.attrs.shooting + shooter.attrs.composure) / 2;
  const onTargetP = clamp(0.28 + 0.25 * (shooter.attrs.shooting / 99) + bonus, 0.1, 0.9);
  const vars = { p: shortName(shooter), k: shortName(keeper), a: assister && how.pattern !== 'solo' && how.pattern !== 'longshot' ? shortName(assister) : undefined };
  if (!rng.chance(onTargetP)) {
    bump(s, shooter.id, -0.05);
    const f = decideShot(rng, 'miss', how);
    push(s, s.minute, sideKey, 'miss', missLine(rng, f, vars), shooter.id);
    s.events[s.events.length - 1].shot = f;
    return;
  }
  const skills = 0.03 * skillLevel(shooter, 'finisher') + 0.01 * skillLevel(shooter, 'finesse');
  const goalP = clamp(0.27 + (0.3 * (finishing - keeper.attrs.goalkeeping)) / 99 + bonus + skills + STYLE_MOD[side.style].finish, 0.05, 0.85);
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
  const base = { side: sideKey, minute: s.minute, keeperId, bonus: 0 };
  const focusId = s.focus.playerId;
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
  if (shooter.id === focusId && (kind === 'shot' || kind === 'dribble') && rng.chance(0.6)) {
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
  const view = kind === 'header' ? (rng.chance(0.4) ? 'corner' : 'cross') : rng.chance(0.3) ? 'outside' : 'box';
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
    const slot = assignSlots(world, teamById(world, s[attKey].clubId), s[attKey].onPitch)[id] ?? { depth: 0.5, lat: 0.5 };
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
    s.pending = { ...m, kind, choices: undefined, assistId: kind === 'shot' ? m.assistId : undefined };
  }
  s.rngState = rng.state;
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
  else s.pending = { ...base, kind: 'shot', view: depth > 0.82 ? 'box' : 'outside', range: clamp((0.82 - depth) / 0.4, 0, 1) };
  s.rngState = rng.state;
  return true;
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
  const depth = m.side === 'home' ? s.ball.y : 1 - s.ball.y;
  s.pending = { ...m, kind: 'shot', options: undefined, assistId: undefined, view: depth > 0.8 ? 'box' : 'outside' };
}

// What the sim would do with a choice: the option that suits the player.
function autoChoice(world: World, m: KeyMoment): MomentKind {
  const p = world.players[m.actorId];
  const opts = m.choices ?? ['shot'];
  const score = (k: MomentKind) => (k === 'shot' ? p.attrs.shooting + 4 : k === 'dribble' ? p.attrs.dribbling : (p.attrs.passing + p.attrs.vision) / 2 - 2);
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
  forced?: 'goal' | 'save' | 'miss';
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
  const skill = (v: number) => 0.55 + (0.45 * v) / 99;
  const keeperPenalty = ((keeper.attrs.goalkeeping - 50) / 99) * 0.12;

  const finish = (pGoal: number, kind: LineKind, missKind: LineKind, assistId?: string) => {
    side.shots++;
    pGoal += finishBonus(actor, m.kind);
    const scored = forced ? forced === 'goal' : rng.chance(clamp(pGoal, 0.02, 0.92));
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
      // From distance it takes a real shooter.
      finish(0.02 + 0.3 * q * skill(actor.attrs.shooting) - keeperPenalty + m.bonus + 0.025 * lvl('finisher') - (m.view === 'outside' ? (0.06 + 0.14 * (m.range ?? 0)) * (1 - actor.attrs.shooting / 99) : 0), 'goal', q > 0.35 ? 'save' : 'miss', m.assistId);
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
      const ok = rng.chance(clamp(0.2 + 0.7 * q * skill(actor.attrs.dribbling) + 0.04 * (lvl('speedster') + lvl('dribbler')) + flair, 0.05, 0.94));
      if (ok) {
        bump(s, actor.id, 0.2 + (move ? 0.05 * move.stars : 0));
        push(s, s.minute, m.side, 'info', move ? `${shortName(actor)} beats his man with a ${move.label.toLowerCase()} and is through!` : `${shortName(actor)} skips past the defender and is through!`, actor.id, played);
        // A beaten defender leaves a clear shot, which the user also plays.
        s.pending = { ...m, kind: 'shot', bonus: 0.06, view: 'oneonone' };
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
      if (target) s.lastPass = { to: target.playerId, ok: !!ok, kind: target.kind, offside: passed === 'offside' || undefined };
      if (ok && target && target.kind === 'safe' && focused && !m.deep && (m.chain ?? 0) < 2) {
        // A one-two: the ball comes back and the user goes again, a little
        // further forward.
        bump(s, actor.id, 0.1);
        const mate = world.players[target.playerId];
        push(s, s.minute, m.side, 'info', `${shortName(actor)} plays a one-two with ${shortName(mate)}.`, actor.id, played);
        s.pending = { ...m, kind: 'choice', choices: ['shot', 'dribble', 'pass'], options: undefined, assistId: mate.id, bonus: m.bonus + 0.04, chain: (m.chain ?? 0) + 1 };
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
  if (side.subsUsed >= 5 || !side.onPitch.includes(outId) || !side.bench.includes(inId)) return false;
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

function aiSubs(rng: Rng, world: World, s: MatchState, sideKey: SideKey) {
  const side = s[sideKey];
  if (s.focus.clubId === side.clubId) return;
  if (!SUB_MINUTES.includes(s.minute) || !side.bench.length) return;
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

// --- Live pitch ------------------------------------------------------------

function playSide(world: World, s: MatchState, key: SideKey) {
  const side = s[key];
  return { key, team: teamById(world, side.clubId), ids: side.onPitch, keeperId: side.onPitch.length ? keeperOf(world, side).id : undefined };
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
  let steps = buildPlay(world, playSeed(s.rngState, s.minute, s.events.length), playSide(world, s, attKey), playSide(world, s, other(attKey)), from, outcome);
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
  const slot = assignSlots(world, teamById(world, s[attKey].clubId), s[attKey].onPitch)[inv.id] ?? { depth: 0.5, lat: 0.5 };
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
    const slot = assignSlots(world, teamById(world, s[attKey].clubId), s[attKey].onPitch)[id] ?? { depth: 0.6, lat: 0.5 };
    return toPitch(attKey, { depth: Math.min(0.9, slot.depth + 0.22), lat: slot.lat });
  };
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
      const winner = pass.cutBy ?? (defenders.length ? rng.pick(defenders) : null);
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
    const winner = defenders.length ? rng.pick(defenders) : null;
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
    push(s, 45, null, 'half', `Half time: ${s.home.goals}-${s.away.goals}.`);
    if (s.focus.clubId) s.pausedAtHalf = true;
    s.rngState = rng.state;
    return;
  }
  if (s.minute > s.endMinute) {
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
  const attKey: SideKey = rng.chance(pHome) ? 'home' : 'away';
  const defKey = other(attKey);
  s[attKey].possession++;
  const start = moveStart(s);
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
    BASE_CHANCE * (att.attack / def.defense) ** 1.6 * STYLE_MOD[s[attKey].style].chance * STYLE_MOD[s[defKey].style].concede;

  if (rng.chance(chanceP)) {
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
  if (rng.chance(0.035)) {
    const side = s[rng.chance(0.5) ? 'home' : 'away'];
    const sideKey: SideKey = side === s.home ? 'home' : 'away';
    const p = world.players[rng.pick(side.onPitch)];
    const red = rng.chance(0.05);
    incident = { kind: 'card', id: p.id, side: sideKey, red };
    if (red) {
      side.onPitch = side.onPitch.filter((id) => id !== p.id);
      s.minutes[p.id] = s.minute;
      bump(s, p.id, -1.5);
      push(s, s.minute, sideKey, 'red', line(rng, 'red', { p: shortName(p) }), p.id);
    } else {
      bump(s, p.id, -0.2);
      push(s, s.minute, sideKey, 'card', line(rng, 'yellow', { p: shortName(p) }), p.id);
    }
  }
  if (rng.chance(0.0012)) {
    const sideKey: SideKey = rng.chance(0.5) ? 'home' : 'away';
    const side = s[sideKey];
    const p = world.players[rng.pick(side.onPitch)];
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
}

type Incident = { kind: 'card'; id: string; side: SideKey; red: boolean } | { kind: 'injury'; id: string; side: SideKey };

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
function setPieceLead(world: World, s: MatchState, attKey: SideKey, m: KeyMoment) {
  const steps = s.play;
  if (!s.visual || !steps?.length) return;
  const at = steps[steps.length - 1].act === 'moment' ? steps.length - 1 : steps.length;
  const rng = new Rng(playSeed(s.rngState, s.minute, s.events.length + 3));
  const spot = m.kind === 'penalty' ? toPitch(attKey, { depth: 0.895, lat: 0.5 }) : toPitch(attKey, { depth: rng.range(0.7, 0.76), lat: rng.range(0.3, 0.7) });
  const foulAt = m.kind === 'penalty' ? toPitch(attKey, { depth: rng.range(0.9, 0.95), lat: rng.range(0.35, 0.65) }) : spot;
  const defs = s[other(attKey)].onPitch.filter((id) => world.players[id]?.position !== 'GK');
  const fouler = defs.length ? rng.pick(defs) : null;
  const lead: PlayStep[] = [
    { ...foulAt, carrier: m.actorId, side: attKey, act: 'run' },
    { ...foulAt, carrier: fouler, side: attKey, act: 'foul', other: m.actorId, restart: 'freekick' },
    { ...spot, carrier: m.actorId, side: attKey, act: 'start', restart: 'freekick' },
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
  push(s, s.endMinute, null, 'full', `Full time: ${teamById(world, s.home.clubId).name} ${s.home.goals}-${s.away.goals} ${teamById(world, s.away.clubId).name}.`);
  if (s.knockout && diff === 0) shootout(world, s, rng);
  s.rngState = rng.state;
}

// Five kicks each, then sudden death. Takers are the best finishers on the pitch.
function shootout(world: World, s: MatchState, rng: Rng) {
  const takers = (side: MatchSide) =>
    players(world, side.onPitch)
      .filter((p) => p.position !== 'GK')
      .sort((a, b) => b.attrs.composure + b.attrs.shooting - a.attrs.composure - a.attrs.shooting);
  const kick = (taker: Player, keeper: Player) =>
    rng.chance(clamp(0.74 + (taker.attrs.composure - keeper.attrs.goalkeeping) / 400 + 0.03 * skillLevel(taker, 'setpiece'), 0.5, 0.92));
  const ht = takers(s.home);
  const at = takers(s.away);
  const hk = keeperOf(world, s.home);
  const ak = keeperOf(world, s.away);
  let h = 0;
  let a = 0;
  for (let i = 0; i < 30; i++) {
    if (kick(ht[i % ht.length], ak)) h++;
    if (kick(at[i % at.length], hk)) a++;
    if (i >= 4 && h !== a) break;
  }
  const homeWins = h > a;
  s.penaltyWinner = homeWins ? s.home.clubId : s.away.clubId;
  const winner = teamById(world, s.penaltyWinner).name;
  push(s, s.endMinute, homeWins ? 'home' : 'away', 'goal', `${winner} win ${Math.max(h, a)}-${Math.min(h, a)} on penalties!`);
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
  fixture.played = true;
  fixture.homeGoals = s.home.goals;
  fixture.awayGoals = s.away.goals;
  fixture.scorers = s.scorers;
  fixture.penaltyWinner = s.penaltyWinner;
  const international = !!teamById(world, s.home.clubId).national;
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
      p.fitness = clamp(p.fitness - (played / 90) * (side.style === 'press' ? 24 : 18) * engine, 30, 100);
    }
    if (international) continue;
    const leaders = side.usedIds.reduce((n, id) => n + skillLevel(world.players[id], 'leader'), 0);
    for (const id of teamById(world, side.clubId).playerIds) {
      const p = world.players[id];
      p.morale = clamp(p.morale + result * 4 + (result > 0 ? Math.min(3, leaders) : 0) + (side.usedIds.includes(id) ? 1 : -1), 10, 100);
    }
  }
  for (const [id, weeks] of Object.entries(s.injuries)) world.players[id].injuryWeeks = Math.max(world.players[id].injuryWeeks, weeks);
}

export function quickSim(world: World, fixture: Fixture, seed: number): MatchState {
  const s = createMatch(world, fixture, {}, seed);
  simToEnd(world, s);
  commitMatch(world, s, fixture);
  return s;
}

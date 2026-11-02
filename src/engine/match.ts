import { Fixture, Player, Position, Style, World } from './types';
import { Rng, clamp } from './rng';
import { matchRating, shortName } from './player';
import { bench, startingXI, teamById } from './lineup';
import { skillLevel } from './skills';
import { ROLES, isRole } from './roles';
import { celebrationText } from './creation';
import { line, LineKind } from './commentary';
import { PlayOutcome, PlayStart, PlayStep, addFinish, assignNumbers, buildPlay, nextStart, playSeed } from './play';

export type SideKey = 'home' | 'away';
// 'choice' asks the user what to do (shoot, pass or dribble) before the
// matching mini-game; 'header' meets a cross.
export type MomentKind = 'shot' | 'dribble' | 'pass' | 'penalty' | 'freekick' | 'save' | 'tackle' | 'header' | 'choice';

// Career player's calls from the pitch. Each lasts a spell of the match and
// then needs a rest before the next.
export type ShoutKind = 'call' | 'run' | 'track';
export const SHOUT_MINUTES = 10;
export const SHOUT_COOLDOWN = 12;

export type PassKind = 'safe' | 'square' | 'through' | 'cross';

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
  // The career player's current call, and when the next one is allowed.
  shout?: { kind: ShoutKind; until: number };
  shoutReady?: number;
}

const MAX_MOMENTS = 8;
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

function shoutActive(s: MatchState, kind: ShoutKind): boolean {
  return s.shout?.kind === kind && s.minute <= s.shout.until;
}

function pickShooter(rng: Rng, world: World, s: MatchState, side: MatchSide): Player {
  const ps = players(world, side.onPitch);
  // Making a run or calling for it puts the user's player on the end of more chances.
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : shoutActive(s, 'run') ? 2.2 : shoutActive(s, 'call') ? 1.5 : 1);
  return rng.weighted(ps, ps.map((p) => SHOOT_WEIGHT[p.position] * (p.attrs.shooting / 50) ** 2 * boost(p)));
}

function pickAssister(rng: Rng, world: World, s: MatchState, side: MatchSide, shooter: Player): Player | undefined {
  if (!rng.chance(0.7)) return undefined;
  const ps = players(world, side.onPitch).filter((p) => p.id !== shooter.id);
  if (!ps.length) return undefined;
  const boost = (p: Player) => (p.id !== s.focus.playerId ? 1 : shoutActive(s, 'call') ? 2.2 : 1.2);
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

function recordGoal(world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, kind: LineKind, played: boolean) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
  side.goals++;
  side.onTarget++;
  s.goals[shooter.id] = (s.goals[shooter.id] ?? 0) + 1;
  bump(s, shooter.id, 1.0);
  if (assister) {
    s.assists[assister.id] = (s.assists[assister.id] ?? 0) + 1;
    bump(s, assister.id, 0.6);
  }
  bump(s, keeper.id, -0.3);
  for (const p of players(world, s[other(sideKey)].onPitch)) if (p.position === 'DEF') bump(s, p.id, -0.15);
  s.scorers.push({ playerId: shooter.id, clubId: side.clubId, minute: s.minute });
  s.ball = { x: 0.5, y: sideKey === 'home' ? 0.99 : 0.01 };
  s.kickoff = other(sideKey);
  const rng = new Rng(s.rngState);
  const text = line(rng, assister && kind === 'goal' ? 'goalAssist' : kind, {
    p: shortName(shooter),
    a: assister ? shortName(assister) : '',
    k: shortName(keeper),
    ...names(world, s, sideKey),
  });
  s.rngState = rng.state;
  push(s, s.minute, sideKey, 'goal', text, shooter.id, played);
  if (shooter.id === s.focus.playerId && s.focus.celebration) {
    push(s, s.minute, sideKey, 'info', `${shortName(shooter)} ${celebrationText(s.focus.celebration)}`, shooter.id);
  }
}

function autoShot(rng: Rng, world: World, s: MatchState, sideKey: SideKey, shooter: Player, assister: Player | undefined, bonus: number) {
  const side = s[sideKey];
  const keeper = keeperOf(world, s[other(sideKey)]);
  side.shots++;
  const finishing = (shooter.attrs.shooting + shooter.attrs.composure) / 2;
  const onTargetP = clamp(0.28 + 0.25 * (shooter.attrs.shooting / 99) + bonus, 0.1, 0.9);
  if (!rng.chance(onTargetP)) {
    bump(s, shooter.id, -0.05);
    push(s, s.minute, sideKey, 'miss', line(rng, rng.chance(0.25) ? 'blocked' : 'miss', { p: shortName(shooter) }), shooter.id);
    return;
  }
  const skills = 0.03 * skillLevel(shooter, 'finisher') + 0.01 * skillLevel(shooter, 'finesse');
  const goalP = clamp(0.27 + (0.3 * (finishing - keeper.attrs.goalkeeping)) / 99 + bonus + skills + STYLE_MOD[side.style].finish, 0.05, 0.85);
  if (rng.chance(goalP)) {
    s.rngState = rng.state;
    recordGoal(world, s, sideKey, shooter, assister, 'goal', false);
    rng.state = s.rngState;
  } else {
    side.onTarget++;
    bump(s, keeper.id, 0.2);
    if (keeper.id === s.focus.playerId) s.userSaves++;
    push(s, s.minute, sideKey, 'save', line(rng, 'save', { p: shortName(shooter), k: shortName(keeper) }), shooter.id);
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
  const weakFoot = shooter.id === focusId && (kind === 'shot' || kind === 'freekick' || kind === 'choice') && rng.chance(0.35);
  return { ...base, kind, actorId: shooter.id, assistId: kind === 'shot' || kind === 'header' || kind === 'choice' ? assister?.id : undefined, weakFoot, choices };
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
  // Tracking back brings even forwards into the defending.
  const tracking = shoutActive(s, 'track');
  const p = tracking ? Math.max(role?.defends ?? 0, 0.3) + 0.25 : role?.defends ?? 0;
  if (!p || !rng.chance(p)) return null;
  const base = { side: defKey, minute: s.minute, keeperId: keeperOf(world, s[defKey]).id, bonus: 0, actorId: focusId, attackerId: shooter.id, assistId: assister?.id };
  return { ...base, kind: me.position === 'GK' ? 'save' : 'tackle' };
}

// The user picks what to do with a 'choice' moment.
export function chooseMoment(world: World, s: MatchState, kind: MomentKind): void {
  const m = s.pending;
  if (!m || m.kind !== 'choice') return;
  const rng = new Rng(s.rngState);
  if (kind === 'pass') {
    s.pending = { ...m, kind: 'pass', options: passOptions(rng, world, s, m.side, m.actorId), assistId: undefined, choices: undefined };
  } else {
    s.pending = { ...m, kind, choices: undefined, assistId: kind === 'shot' ? m.assistId : undefined };
  }
  s.rngState = rng.state;
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
  if (!id || s.finished || s.minute < (s.shoutReady ?? 0)) return false;
  const side: SideKey = s.home.onPitch.includes(id) ? 'home' : s.away.onPitch.includes(id) ? 'away' : 'home';
  if (!s[side].onPitch.includes(id)) return false;
  s.shout = { kind, until: s.minute + SHOUT_MINUTES };
  s.shoutReady = s.minute + SHOUT_COOLDOWN;
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
          : m.kind === 'tackle'
            ? p.attrs.defending
            : m.kind === 'header'
              ? (p.attrs.physical + p.attrs.shooting) / 2
              : (p.attrs.shooting + p.attrs.composure) / 2;
  return clamp(rng.normal(skill / 140, 0.15), 0, 1);
}

export function resolveMoment(world: World, s: MatchState, quality: number | null, chosenPlayerId?: string): void {
  let m = s.pending;
  if (!m) return;
  if (m.kind === 'choice') {
    chooseMoment(world, s, autoChoice(world, m));
    m = s.pending!;
  }
  s.pending = null;
  const from = s.events.length;
  resolveMomentInner(world, s, m, quality, chosenPlayerId);
  visualizeMoment(world, s, m, from);
}

function resolveMomentInner(world: World, s: MatchState, m: KeyMoment, quality: number | null, chosenPlayerId?: string): void {
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
    if (rng.chance(clamp(pGoal, 0.02, 0.92))) {
      s.rngState = rng.state;
      recordGoal(world, s, m.side, actor, assistId ? world.players[assistId] : undefined, kind, played);
      return;
    }
    if (q > 0.35) {
      side.onTarget++;
      bump(s, keeper.id, 0.25);
    }
    bump(s, actor.id, -0.15);
    push(s, s.minute, m.side, q > 0.35 ? 'save' : 'miss', line(rng, missKind, { p: shortName(actor), k: shortName(keeper) }), actor.id, played);
    s.rngState = rng.state;
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
        push(s, s.minute, attSide, 'save', line(rng, 'save', { p: shortName(shooter), k: shortName(actor) }), actor.id, played);
        s.rngState = rng.state;
      } else {
        // recordGoal counts the shot on target and hits the keeper's rating.
        s.rngState = rng.state;
        recordGoal(world, s, attSide, shooter, m.assistId ? world.players[m.assistId] : undefined, 'goal', false);
      }
      break;
    }
    case 'tackle': {
      const attSide = other(m.side);
      const attacker = world.players[m.attackerId!];
      const won = rng.chance(clamp(0.25 + 0.6 * q * skill(actor.attrs.defending) + 0.03 * lvl('wall') - (attacker.attrs.dribbling - 60) / 400, 0.08, 0.9));
      if (won) {
        s.userTackles++;
        bump(s, actor.id, 0.3);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} reads it and wins the ball off ${shortName(attacker)}!`, actor.id, played);
      } else {
        bump(s, actor.id, -0.15);
        push(s, s.minute, attSide, 'info', `${shortName(attacker)} gets past ${shortName(actor)}...`, attacker.id, played);
        autoShot(rng, world, s, attSide, attacker, m.assistId ? world.players[m.assistId] : undefined, 0.05);
      }
      s.rngState = rng.state;
      break;
    }
    // Tuned so a skipped moment converts about as often as an AI shot from
    // a player of the same quality; playing the mini-game well beats that.
    case 'shot':
      finish(0.02 + 0.3 * q * skill(actor.attrs.shooting) - keeperPenalty + m.bonus + 0.025 * lvl('finisher'), 'goal', q > 0.35 ? 'save' : 'miss', m.assistId);
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
      const ok = rng.chance(clamp(0.2 + 0.7 * q * skill(actor.attrs.dribbling) + 0.04 * (lvl('speedster') + lvl('dribbler')), 0.05, 0.92));
      if (ok) {
        bump(s, actor.id, 0.2);
        push(s, s.minute, m.side, 'info', `${shortName(actor)} skips past the defender and is through!`, actor.id, played);
        // A beaten defender leaves a clear shot, which the user also plays.
        s.pending = { ...m, kind: 'shot', bonus: 0.06 };
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
      const passQ = played ? q : q * (target?.openness ?? 0.5);
      const ok = target && rng.chance(clamp(0.25 + 0.65 * passQ * skill(actor.attrs.passing) + 0.04 * lvl('playmaker'), 0.05, 0.95));
      const focused = actor.id === s.focus.playerId;
      if (ok && target && target.kind === 'safe' && focused && (m.chain ?? 0) < 2) {
        // A one-two: the ball comes back and the user goes again, a little
        // further forward.
        bump(s, actor.id, 0.1);
        const mate = world.players[target.playerId];
        push(s, s.minute, m.side, 'info', `${shortName(actor)} plays a one-two with ${shortName(mate)}.`, actor.id, played);
        s.pending = { ...m, kind: 'choice', choices: ['shot', 'dribble', 'pass'], options: undefined, assistId: mate.id, bonus: m.bonus + 0.04, chain: (m.chain ?? 0) + 1 };
      } else if (ok && target) {
        bump(s, actor.id, 0.15);
        const receiver = world.players[target.playerId];
        autoShot(rng, world, s, m.side, receiver, actor, target.threat ?? 0.12 + 0.15 * target.openness);
        const last = s.events[s.events.length - 1];
        if (last) last.played = played;
      } else {
        bump(s, actor.id, -0.1);
        push(s, s.minute, m.side, 'info', line(rng, 'passFail', { p: shortName(actor) }), actor.id, played);
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

function visualize(world: World, s: MatchState, attKey: SideKey, from: PlayStart, outcome: PlayOutcome) {
  if (!s.visual) return;
  const steps = buildPlay(world, playSeed(s.rngState, s.minute, s.events.length), playSide(world, s, attKey), playSide(world, s, other(attKey)), from, outcome);
  s.play = steps;
  const end = steps[steps.length - 1];
  if (end) s.ball = { x: Math.min(1, Math.max(0, end.x)), y: Math.min(1, Math.max(0, end.y)) };
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
  if (s.pending) {
    // A beaten man: the run goes on and the user gets the shot.
    steps.push({ x: start.x + rng.range(-0.06, 0.06), y: start.y + forward * 0.06, carrier: m.actorId, side: attKey, act: 'run' });
    const last = steps[steps.length - 1];
    steps.push({ x: last.x, y: last.y, carrier: m.actorId, side: attKey, act: 'moment' });
  } else if (result && lastShot?.playerId) {
    const shooter = lastShot.playerId === m.actorId && m.kind === 'save' ? holder : lastShot.playerId;
    if (shooter !== holder && s[attKey].onPitch.includes(shooter)) {
      steps.push({ x: 0.5 + rng.range(-0.14, 0.14), y: (attKey === 'home' ? 1 : 0) - forward * rng.range(0.1, 0.15), carrier: shooter, side: attKey, act: m.kind === 'pass' ? 'pass' : 'cross' });
    }
    addFinish(steps, rng, attKey, shooter, result, playSide(world, s, defKey).keeperId, m.kind === 'header');
  } else if (m.kind === 'tackle') {
    // The user's own tackle: won cleanly.
    steps.push({ x: start.x + rng.range(-0.03, 0.03), y: start.y - forward * 0.03, carrier: m.actorId, side: defKey, act: 'tackle', other: holder });
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

  const att = attKey === 'home' ? hs : as;
  const def = attKey === 'home' ? as : hs;
  const walls = Math.min(6, players(world, s[defKey].onPitch).reduce((n, p) => n + skillLevel(p, 'wall'), 0));
  // A run or a call adds a little threat; tracking back takes a little away
  // from the other side.
  const focusSide = s.focus.playerId ? (s.home.onPitch.includes(s.focus.playerId) ? 'home' : s.away.onPitch.includes(s.focus.playerId) ? 'away' : null) : null;
  const shoutMod = !focusSide ? 1 : attKey === focusSide ? (shoutActive(s, 'run') || shoutActive(s, 'call') ? 1.08 : 1) : shoutActive(s, 'track') ? 0.93 : 1;
  const chanceP =
    (1 - 0.02 * walls) *
    shoutMod *
    BASE_CHANCE * (att.attack / def.defense) ** 1.6 * STYLE_MOD[s[attKey].style].chance * STYLE_MOD[s[defKey].style].concede;

  if (rng.chance(chanceP)) {
    s.ball = { x: rng.range(0.3, 0.7), y: forward(rng.range(0.84, 0.92)) };
    const shooter = pickShooter(rng, world, s, s[attKey]);
    const assister = pickAssister(rng, world, s, s[attKey], shooter);
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
      visualize(world, s, attKey, start, { result: 'moment', shooterId: s.pending.actorId, assistId: passer ? undefined : assister?.id, cross: s.pending.kind === 'header' });
      return;
    }
    autoShot(rng, world, s, attKey, shooter, assister, 0);
    outcome = { result: shotResult(s, before), shooterId: shooter.id, assistId: assister?.id };
  } else if (rng.chance(0.03)) {
    push(s, s.minute, attKey, 'info', line(rng, 'quiet', names(world, s, attKey)));
  }

  // Cards and injuries.
  if (rng.chance(0.035)) {
    const side = s[rng.chance(0.5) ? 'home' : 'away'];
    const sideKey: SideKey = side === s.home ? 'home' : 'away';
    const p = world.players[rng.pick(side.onPitch)];
    if (rng.chance(0.05)) {
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
  visualize(world, s, attKey, start, outcome);
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

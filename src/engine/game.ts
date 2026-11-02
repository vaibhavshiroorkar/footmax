import { Build, Confederation, Fixture, Game, Look, Nation, Position, World } from './types';
import { Rng } from './rng';
import { createPlayer, ensureDomesticLeague, generateWorld, majorNations, nationById } from './generator';
import { fixtureFor } from './league';
import { addMessage } from './inbox';
import { MatchState, commitMatch, createMatch, simToEnd, MatchFocus } from './match';
import { afterCareerMatch } from './career';
import { managerAfterMatch } from './manager';
import { advanceWeek, userClubId, WeekResult } from './season';
import { pickNationalSquad, refreshNationalSquads, tournamentFixtureFor } from './international';
import { DataPack } from '../data/pack';
import { formCheck } from './relations';
import { checkMilestones, progressOf, recordMatchProgress } from './progress';
import { ROLES, Role } from './roles';
import { Allocation, STAT_POINTS, STYLE_PRESETS, applyAllocation, autoAllocate } from './creation';
import { fairWage, fullName } from './player';

export const SAVE_VERSION = 2;

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export interface NewCareerOptions {
  firstName: string;
  lastName: string;
  nationId: string;
  // Broad position; ignored when a role is given.
  position?: Position;
  role?: Role;
  foot?: 'L' | 'R';
  weakFoot?: number;
  heightCm?: number;
  build?: Build;
  style?: string;
  // Starting stat points. Defaults to the role's first style preset.
  allocation?: Allocation;
  nickname?: string;
  number?: number;
  celebration?: string;
  look?: Look;
  // Optional: a specific club. Defaults to a random small club in one of
  // the weakest leagues of the player's confederation.
  clubId?: string;
  seed?: number;
  pack?: DataPack;
}

const DEFAULT_ROLE: Record<Position, Role> = { GK: 'GK', DEF: 'CB', MID: 'CM', FWD: 'ST' };

// The weakest leagues in a confederation. Every career starts in one of
// them, wherever the player was born, and climbs from there.
export function starterNations(world: World, conf: Confederation): Nation[] {
  const list = majorNations(world)
    .filter((n) => n.conf === conf && n.clubNames.length >= 6 && n.leagueLevel > 0)
    .sort((a, b) => a.leagueLevel - b.leagueLevel);
  return list.slice(0, Math.max(3, Math.ceil(list.length / 4)));
}

// Smaller clubs in a nation's lowest league.
export function starterClubs(world: World, nationId: string): string[] {
  const league = ensureDomesticLeague(world, nationId);
  const order = [...league.clubIds].sort((a, b) => world.clubs[a].reputation - world.clubs[b].reputation);
  return order.slice(0, Math.max(4, Math.ceil(order.length / 2)));
}

// A random small club from one of the confederation's weakest leagues.
export function drawStarterClub(world: World, conf: Confederation, rng: Rng): string {
  const nations = starterNations(world, conf);
  const nation = nations.length ? rng.pick(nations) : majorNations(world).filter((n) => n.conf === conf)[0];
  return rng.pick(starterClubs(world, nation.id));
}

export function newCareerGame(opts: NewCareerOptions, world?: World): Game {
  world = world ?? generateWorld(opts.seed ?? newSeed(), opts.pack);
  const rng = new Rng(world.rngState);
  const nation = nationById(world, opts.nationId) ?? world.nations[0];
  const club = world.clubs[opts.clubId && world.clubs[opts.clubId] ? opts.clubId : drawStarterClub(world, nation.conf, rng)];
  if (!club.leagueId) ensureDomesticLeague(world, club.nationId);
  const role = opts.role ?? DEFAULT_ROLE[opts.position ?? 'FWD'];
  const body = { heightCm: opts.heightCm ?? 180, build: opts.build ?? 'athletic' };
  const weakFoot = opts.weakFoot ?? 2;
  const style = STYLE_PRESETS[role].find((s) => s.id === opts.style) ?? STYLE_PRESETS[role][0];
  const allocation = opts.allocation ?? autoAllocate(role, style.weights, STAT_POINTS - Math.max(0, weakFoot - 2) * 4);
  const p = createPlayer(world, rng, {
    position: ROLES[role].broad,
    target: 46,
    age: 16,
    nationId: nation.id,
    clubId: club.id,
    potential: rng.int(84, 93),
    firstName: opts.firstName.trim() || 'Alex',
    lastName: opts.lastName.trim() || 'Rivera',
    role,
  });
  // The chosen build replaces the generated attributes.
  p.attrs = applyAllocation(role, body, allocation, weakFoot);
  p.wage = fairWage(p);
  p.foot = opts.foot ?? 'R';
  p.weakFoot = weakFoot;
  p.heightCm = body.heightCm;
  p.build = body.build;
  p.style = style.id;
  p.skills = {};
  p.contractYears = 2;
  p.morale = 80;
  club.playerIds.push(p.id);
  world.rngState = rng.state;
  const game: Game = {
    version: SAVE_VERSION,
    mode: 'career',
    world,
    career: {
      playerId: p.id,
      energy: 100,
      money: 500,
      fame: 0,
      items: [],
      sponsors: [],
      trainedThisWeek: 0,
      retired: false,
      requestCooldown: 0,
      xp: 0,
      level: 1,
      skillPoints: 1,
      wantsMove: false,
      look: opts.look ?? { skin: 2, hair: 0, hairColor: 0, boots: 0 },
      number: opts.number ?? 9,
      nickname: opts.nickname?.trim() || undefined,
      celebration: opts.celebration ?? 'knee-slide',
    },
    manager: null,
    inbox: [],
    negotiations: {},
  };
  refreshNationalSquads(game);
  progressOf(game);
  addMessage(
    game,
    'news',
    `Welcome to ${club.name}`,
    `${fullName(p)}, 16, signs a first professional deal with ${club.name}. Train hard, earn skill points, take your chances, and the big clubs will come calling.`,
  );
  return game;
}

export function newManagerGame(world: World, clubId: string | null, nationalTeamId: string | null, managerName: string): Game {
  if (clubId) {
    const club = world.clubs[clubId];
    if (!club.leagueId) ensureDomesticLeague(world, club.nationId);
  }
  const game: Game = {
    version: SAVE_VERSION,
    mode: 'manager',
    world,
    career: null,
    manager: { name: managerName.trim() || 'The Boss', clubId, nationalTeamId, boardConfidence: 60, nationConfidence: 60, seasonsManaged: 0, trophies: [] },
    inbox: [],
    negotiations: {},
  };
  refreshNationalSquads(game);
  if (nationalTeamId) {
    const team = world.nationalTeams[nationalTeamId];
    team.playerIds = pickNationalSquad(world, team.nationId);
  }
  const jobs = [clubId && world.clubs[clubId].name, nationalTeamId && world.nationalTeams[nationalTeamId].name].filter(Boolean).join(' and ');
  addMessage(game, 'news', `New manager: ${game.manager!.name}`, `${game.manager!.name} takes charge of ${jobs}. Expectations are high.`);
  return game;
}

export { generateWorld };

function teamIsNational(game: Game, id: string): boolean {
  return !!game.world.nationalTeams[id];
}

// The team the user plays matches for right now: club in the season,
// national team in the summer.
export function userTeamId(game: Game): string | null {
  const world = game.world;
  if (world.phase === 'tournament') {
    if (game.mode === 'manager') return game.manager?.nationalTeamId ?? null;
    if (game.career && !game.career.retired) {
      const p = world.players[game.career.playerId];
      const team = world.nationalTeams[nationById(world, p.nationId)?.teamId ?? ''];
      return team?.playerIds.includes(p.id) ? team.id : null;
    }
    return null;
  }
  return userClubId(game);
}

export function userFixture(game: Game): Fixture | undefined {
  const world = game.world;
  const teamId = userTeamId(game);
  if (!teamId) return undefined;
  if (world.phase === 'tournament') return tournamentFixtureFor(world, teamId);
  const f = fixtureFor(world, teamId, world.week);
  return f && !f.played ? f : undefined;
}

export function matchFocus(game: Game): MatchFocus {
  if (game.mode === 'career' && game.career) return { playerId: game.career.playerId, celebration: game.career.celebration, number: game.career.number };
  const teamId = userTeamId(game);
  return teamId ? { clubId: teamId } : {};
}

export function startUserMatch(game: Game): MatchState | null {
  const f = userFixture(game);
  if (!f) return null;
  const world = game.world;
  let seed = world.pendingMatch?.fixtureId === f.id ? world.pendingMatch.seed : 0;
  if (!seed) {
    const rng = new Rng(world.rngState);
    seed = rng.int(1, 2 ** 31);
    world.rngState = rng.state;
    world.pendingMatch = { fixtureId: f.id, seed };
  }
  return createMatch(world, f, matchFocus(game), seed);
}

// Marks this week's match as started; from now on leaving it sims the rest.
export function markKickOff(game: Game): void {
  if (game.world.pendingMatch) game.world.pendingMatch.kicked = true;
}

// A match that was kicked off but never finished, e.g. after a reload.
export function interruptedMatch(game: Game): boolean {
  const p = game.world.pendingMatch;
  return !!p?.kicked && p.fixtureId === userFixture(game)?.id;
}

export interface FinishResult extends WeekResult {
  levelUp: string | null;
}

// Commits the user's match, then sims the rest of the week.
export function finishUserMatch(game: Game, s: MatchState): FinishResult {
  const f = userFixture(game);
  let levelUp: string | null = null;
  game.world.pendingMatch = undefined;
  if (f && f.id === s.fixtureId) {
    if (!s.finished) simToEnd(game.world, s);
    commitMatch(game.world, s, f);
    if (game.mode === 'career' && game.career) {
      levelUp = afterCareerMatch(game, s);
      if (!teamIsNational(game, f.homeId)) {
        formCheck(game);
        const id = game.career.playerId;
        const side = s.home.usedIds.includes(id) ? s.home : s.away.usedIds.includes(id) ? s.away : null;
        const conceded = side === s.home ? s.away.goals : s.home.goals;
        recordMatchProgress(game, !!side, conceded, s.userTackles, s.userSaves, s.goals[id] ?? 0);
      } else checkMilestones(game);
      // The full-time card lists what this match unlocked.
      const last = game.career.lastMatch;
      if (last && last.fixtureId === s.fixtureId) {
        last.unlocks = (game.career.progress?.rewards ?? [])
          .filter((r) => r.title !== 'Level up!')
          .map((r) => (r.title === 'Objective complete!' ? `Objective done: ${r.sub.split('.')[0]}` : `Milestone: ${r.title}`));
      }
    }
    if (game.mode === 'manager' && game.manager) managerAfterMatch(game, f);
  }
  return { ...advanceWeek(game), levelUp };
}

// For weeks without a playable match, or when the user wants to skip ahead.
export function skipWeek(game: Game): FinishResult {
  const s = startUserMatch(game);
  if (s) return finishUserMatch(game, s);
  return { ...advanceWeek(game), levelUp: null };
}

// Plays the whole summer of tournaments at once.
export function skipSummer(game: Game): FinishResult {
  let r: FinishResult = { newSeason: false, summerStarted: false, levelUp: null };
  let guard = 0;
  while (game.world.phase === 'tournament' && guard++ < 20) r = skipWeek(game);
  return r;
}

import { Club, League, Nation, Player, Position, World } from './types';
import { Rng, clamp } from './rng';
import { clubBudget, emptyStats, fairWage, makeAttributes, overall, splitName } from './player';
import { makeFixtures, SEASON_WEEKS } from './league';
import { autoSkills } from './skills';
import { BUILTIN_PACK } from '../data/builtin';
import { ClubSeed, DataPack, PlayerSeed } from '../data/pack';
import { MINOR_NATIONS, NATION_SEEDS } from '../data/nations';
import { NAME_GROUPS } from '../data/names';

export const START_YEAR = 2026;
const SQUAD_TARGET = 23;
const SQUAD_SHAPE: Record<Position, number> = { GK: 3, DEF: 8, MID: 7, FWD: 5 };
const NATION_POOL = 30;

const DOMESTIC_LEAGUE_NAMES: Record<string, string> = {
  KSA: 'Saudi Pro League',
  USA: 'MLS',
  BRA: 'Brasileirao',
  ARG: 'Liga Profesional',
  TUR: 'Super Lig',
  SCO: 'Scottish Premiership',
  BEL: 'Pro League',
  MEX: 'Liga MX',
  JPN: 'J1 League',
  KOR: 'K League 1',
  EGY: 'Egyptian Premier League',
  QAT: 'Qatar Stars League',
  GRE: 'Super League Greece',
  AUS: 'A-League',
  CHN: 'Chinese Super League',
};

export function newId(world: World, prefix: string): string {
  return `${prefix}${world.nextId++}`;
}

// Squad quality a club of this reputation fields.
export function targetOverall(reputation: number): number {
  return Math.round(38 + reputation * 0.47);
}

export function nationById(world: World, id: string): Nation | undefined {
  return world.nations.find((n) => n.id === id);
}

export function majorNations(world: World): Nation[] {
  return world.nations.filter((n) => !n.minor);
}

interface PlayerSpec {
  position: Position;
  target: number;
  age: number;
  nationId: string;
  clubId: string | null;
  potential?: number;
  firstName?: string;
  lastName?: string;
  real?: boolean;
  role?: string;
}

function randomName(world: World, rng: Rng, nationId: string) {
  const nation = nationById(world, nationId);
  const group = NAME_GROUPS[nation?.names ?? 'english'] ?? NAME_GROUPS.english;
  return { firstName: rng.pick(group.first), lastName: rng.pick(group.last) };
}

function growthPotential(rng: Rng, ovr: number, age: number): number {
  if (age <= 20) return clamp(Math.round(ovr + (22 - age) * 2.5 + rng.range(2, 9)), ovr, 95);
  if (age <= 24) return clamp(Math.round(ovr + (25 - age) * 1.5 + rng.range(0, 4)), ovr, 94);
  return ovr;
}

export function createPlayer(world: World, rng: Rng, spec: PlayerSpec): Player {
  const attrs = makeAttributes(rng, spec.position, spec.target, spec.role);
  const ovr = overall({ attrs, position: spec.position, role: spec.role });
  const name = spec.lastName !== undefined ? { firstName: spec.firstName ?? '', lastName: spec.lastName } : randomName(world, rng, spec.nationId);
  const p: Player = {
    id: newId(world, 'p'),
    ...name,
    nationId: spec.nationId,
    age: spec.age,
    position: spec.position,
    attrs,
    potential: spec.potential ?? growthPotential(rng, ovr, spec.age),
    clubId: spec.clubId,
    wage: 0,
    contractYears: rng.int(1, 5),
    morale: 70,
    fitness: 100,
    injuryWeeks: 0,
    retired: false,
    stats: emptyStats(),
    history: [],
    caps: 0,
    intlGoals: 0,
    real: spec.real,
    role: spec.role,
  };
  p.wage = fairWage(p);
  p.skills = autoSkills(p);
  world.players[p.id] = p;
  return p;
}

function createSeedPlayer(world: World, rng: Rng, seed: PlayerSeed, clubId: string | null, fallbackNation: string): Player {
  const nationId = nationById(world, seed.nation) ? seed.nation : fallbackNation;
  const age = clamp(START_YEAR - seed.born, 15, 45);
  const { firstName, lastName } = splitName(seed.name);
  const p = createPlayer(world, rng, { position: seed.pos, target: seed.ovr, age, nationId, clubId, firstName, lastName, real: true, role: seed.role });
  if (seed.pot) p.potential = Math.max(seed.pot, overall(p));
  // Spanish clubs put release clauses in most contracts.
  if (clubId && world.clubs[clubId]?.nationId === 'ESP') p.releaseClause = Math.round(p.wage * 4000 * rng.range(0.8, 1.6));
  return p;
}

export function createYouth(world: World, rng: Rng, club: Club, position?: Position): Player {
  const pos = position ?? rng.weighted<Position>(['GK', 'DEF', 'MID', 'FWD'], [1, 3, 3, 3]);
  const p = createPlayer(world, rng, {
    position: pos,
    target: clamp(Math.round(targetOverall(club.reputation) - rng.range(14, 24)), 30, 62),
    age: rng.int(16, 17),
    nationId: rng.chance(0.85) ? club.nationId : rng.pick(majorNations(world)).id,
    clubId: club.id,
  });
  p.potential = clamp(overall(p) + rng.int(10, 35), overall(p) + 5, 93);
  p.contractYears = 3;
  return p;
}

function makeClub(world: World, seed: ClubSeed, nationId: string, leagueId: string | null): Club {
  const club: Club = {
    id: newId(world, 'c'),
    name: seed.name,
    short: (seed.short || seed.name.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase(),
    nationId,
    leagueId,
    reputation: clamp(Math.round(seed.rep), 10, 99),
    budget: clubBudget(seed.rep),
    colors: seed.colors,
    playerIds: [],
    formation: '4-3-3',
    style: 'balanced',
    lineup: null,
  };
  world.clubs[club.id] = club;
  return club;
}

function addSeedPlayers(world: World, rng: Rng, club: Club, seed: ClubSeed) {
  for (const ps of seed.players) club.playerIds.push(createSeedPlayer(world, rng, ps, club.id, club.nationId).id);
}

// Tops a squad up with generated players in the positions it lacks.
export function fillSquad(world: World, rng: Rng, club: Club, size = SQUAD_TARGET, domestic = 0.65): void {
  const target = targetOverall(club.reputation);
  const current = club.playerIds.map((id) => world.players[id]);
  const realAvg = current.length ? current.reduce((s, p) => s + overall(p), 0) / current.length : target;
  const depthLevel = Math.min(target, realAvg) - 3;
  const nations = majorNations(world);
  const count = (pos: Position) => club.playerIds.filter((id) => world.players[id].position === pos).length;
  const scale = size / SQUAD_TARGET;
  while (club.playerIds.length < size) {
    const pos = (Object.keys(SQUAD_SHAPE) as Position[]).sort((a, b) => count(a) / (SQUAD_SHAPE[a] * scale) - count(b) / (SQUAD_SHAPE[b] * scale))[0];
    const p = createPlayer(world, rng, {
      position: pos,
      target: Math.round(depthLevel + rng.range(-6, 3)),
      age: rng.int(18, 33),
      nationId: rng.chance(domestic) ? club.nationId : rng.pick(nations).id,
      clubId: club.id,
    });
    club.playerIds.push(p.id);
  }
}

function nationalTeam(world: World, nation: Nation): Club {
  const team: Club = {
    id: nation.teamId,
    name: nation.name,
    short: nation.id,
    nationId: nation.id,
    leagueId: null,
    reputation: clamp(nation.strength + 15, 10, 99),
    budget: 0,
    colors: nation.colors,
    playerIds: [],
    formation: '4-3-3',
    style: 'balanced',
    lineup: null,
    national: true,
  };
  world.nationalTeams[team.id] = team;
  return team;
}

export function generateWorld(seed: number, pack: DataPack = BUILTIN_PACK): World {
  const rng = new Rng(seed);
  const world: World = {
    season: START_YEAR,
    week: 1,
    seasonWeeks: SEASON_WEEKS,
    phase: 'season',
    rngState: 0,
    nextId: 1,
    nations: [],
    leagues: [],
    clubs: {},
    nationalTeams: {},
    players: {},
    freeAgents: [],
    honours: [],
    tournaments: [],
  };

  for (const n of NATION_SEEDS) {
    const nation: Nation = { id: n.code, name: n.name, conf: n.conf, strength: n.strength, colors: n.colors, names: n.names, leagueIds: [], teamId: `nt-${n.code}`, clubNames: n.clubs, leagueLevel: n.leagueLevel };
    world.nations.push(nation);
    nationalTeam(world, nation);
  }
  for (const [code, name] of Object.entries(MINOR_NATIONS)) {
    world.nations.push({ id: code, name, conf: 'UEFA', strength: 45, colors: ['#888888', '#ffffff'], names: 'english', leagueIds: [], teamId: `nt-${code}`, clubNames: [], leagueLevel: 0, minor: true });
  }

  for (const ls of pack.leagues) {
    const nationId = nationById(world, ls.nation) ? ls.nation : 'ENG';
    const league: League = { id: ls.id, nationId, tier: ls.tier, name: ls.name, clubIds: [], fixtures: [], parentId: ls.parent, swap: ls.swap };
    world.leagues.push(league);
    nationById(world, nationId)!.leagueIds.push(league.id);
    for (const cs of ls.clubs) {
      const club = makeClub(world, cs, nationId, league.id);
      league.clubIds.push(club.id);
      addSeedPlayers(world, rng, club, cs);
      fillSquad(world, rng, club);
    }
  }

  // Clubs outside the simulated leagues hold real stars and national-team players.
  for (const oc of pack.otherClubs) {
    const nationId = nationById(world, oc.nation) ? oc.nation : 'ENG';
    for (const cs of oc.clubs) {
      const club = makeClub(world, cs, nationId, null);
      addSeedPlayers(world, rng, club, cs);
      fillSquad(world, rng, club, 14, 0.85);
    }
  }

  // Every real nation gets enough players for a national squad.
  for (const nation of majorNations(world)) {
    if (nation.leagueIds.length) continue;
    let homes = Object.values(world.clubs).filter((c) => c.nationId === nation.id && !c.leagueId);
    if (!homes.length) {
      homes = nation.clubNames.slice(0, 2).map((name, i) =>
        makeClub(world, { name, short: '', rep: nation.leagueLevel - i * 3, colors: nation.colors, players: [] }, nation.id, null),
      );
    }
    let have = Object.values(world.players).filter((p) => p.nationId === nation.id).length;
    let i = 0;
    while (have < NATION_POOL) {
      const club = homes[i++ % homes.length];
      const pos = rng.weighted<Position>(['GK', 'DEF', 'MID', 'FWD'], [3, 9, 9, 7]);
      const p = createPlayer(world, rng, {
        position: pos,
        target: Math.round(nation.strength + rng.normal(0, 5)),
        age: rng.int(19, 33),
        nationId: nation.id,
        clubId: club.id,
      });
      club.playerIds.push(p.id);
      have++;
    }
  }

  for (let i = 0; i < 80; i++) {
    const nation = rng.pick(majorNations(world));
    const p = createPlayer(world, rng, {
      position: rng.weighted<Position>(['GK', 'DEF', 'MID', 'FWD'], [1, 3, 3, 3]),
      target: Math.round(nation.strength - rng.range(2, 12)),
      age: rng.int(19, 34),
      nationId: nation.id,
      clubId: null,
    });
    world.freeAgents.push(p.id);
  }

  for (const league of world.leagues) league.fixtures = makeFixtures(league.clubIds, rng, () => newId(world, 'f'), world.seasonWeeks);
  world.rngState = rng.state;
  return world;
}

// Builds a playable league for a nation that has none yet, around its real
// clubs. Used when a career or manager game starts there.
export function ensureDomesticLeague(world: World, nationId: string): League {
  const nation = nationById(world, nationId)!;
  const existing = world.leagues.filter((l) => l.nationId === nationId).sort((a, b) => b.tier - a.tier)[0];
  if (existing) return existing;
  const rng = new Rng(world.rngState);
  const league: League = { id: `${nationId}1`, nationId, tier: 1, name: DOMESTIC_LEAGUE_NAMES[nationId] ?? `${nation.name} Premier League`, clubIds: [], fixtures: [] };
  const background = Object.values(world.clubs).filter((c) => c.nationId === nationId && !c.leagueId);
  const names = [...nation.clubNames];
  for (const c of background) if (!names.some((n) => n.toLowerCase() === c.name.toLowerCase())) names.push(c.name);
  names.forEach((name, i) => {
    let club = background.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!club) {
      const rep = Math.round(nation.leagueLevel + 4 - (16 * i) / Math.max(1, names.length - 1));
      club = makeClub(world, { name, short: '', rep, colors: rng.pick(CLUB_COLORS), players: [] }, nationId, league.id);
    }
    club.leagueId = league.id;
    league.clubIds.push(club.id);
    fillSquad(world, rng, club, 22, 0.85);
  });
  if (league.clubIds.length % 2) world.clubs[league.clubIds.pop()!].leagueId = null;
  world.leagues.push(league);
  nation.leagueIds.push(league.id);
  const weeksLeft = world.seasonWeeks - world.week + 1;
  league.fixtures = makeFixtures(league.clubIds, rng, () => newId(world, 'f'), weeksLeft).map((f) => ({ ...f, week: f.week + world.week - 1 }));
  world.rngState = rng.state;
  return league;
}

const CLUB_COLORS: [string, string][] = [
  ['#c8102e', '#ffffff'],
  ['#1d428a', '#ffffff'],
  ['#006a4e', '#ffd100'],
  ['#111111', '#ffffff'],
  ['#ffd100', '#1d1d1b'],
  ['#5b2c83', '#ffffff'],
  ['#e35205', '#ffffff'],
  ['#87ceeb', '#0b2545'],
  ['#7a0019', '#ffcc33'],
  ['#00843d', '#ffffff'],
];

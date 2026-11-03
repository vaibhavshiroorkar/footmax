import { Club, Confederation, Fixture, Game, Nation, Tournament, World } from './types';
import { Rng, clamp } from './rng';
import { matchRating, overall } from './player';
import { tableFrom, TableRow } from './league';
import { majorNations, newId } from './generator';
import { teamById } from './lineup';
import { quickSim } from './match';

export const SQUAD_SIZE = 26;
// League weeks with an international break. Squads gain caps; career
// players get a call-up message.
export const INTERNATIONAL_BREAKS = [9, 20, 30];

export interface TournamentDef {
  key: string;
  name: string;
  quotas: Partial<Record<Confederation, number>>;
  groups: number;
  bestThirds: number;
}

const WORLD_CUP: TournamentDef = { key: 'wc', name: 'World Cup', quotas: { UEFA: 16, CONMEBOL: 6, CONCACAF: 6, CAF: 9, AFC: 8, OFC: 1 }, groups: 12, bestThirds: 8 };
// 32 teams up to 2022.
const WORLD_CUP_32: TournamentDef = { key: 'wc', name: 'World Cup', quotas: { UEFA: 13, CONMEBOL: 5, CONCACAF: 4, CAF: 5, AFC: 4, OFC: 1 }, groups: 8, bestThirds: 0 };
const EURO: TournamentDef = { key: 'euro', name: 'European Championship', quotas: { UEFA: 24 }, groups: 6, bestThirds: 4 };
// 16 teams up to 2012.
const EURO_16: TournamentDef = { key: 'euro', name: 'European Championship', quotas: { UEFA: 16 }, groups: 4, bestThirds: 0 };
const COPA: TournamentDef = { key: 'copa', name: 'Copa America', quotas: { CONMEBOL: 10, CONCACAF: 2 }, groups: 3, bestThirds: 2 };
const AFCON: TournamentDef = { key: 'afcon', name: 'Africa Cup of Nations', quotas: { CAF: 12 }, groups: 3, bestThirds: 2 };
const ASIAN: TournamentDef = { key: 'asian', name: 'Asian Cup', quotas: { AFC: 8 }, groups: 2, bestThirds: 0 };
const GOLD: TournamentDef = { key: 'gold', name: 'Gold Cup', quotas: { CONCACAF: 7, AFC: 1 }, groups: 2, bestThirds: 0 };
const NATIONS_LEAGUE: TournamentDef = { key: 'unl', name: 'Nations League Finals', quotas: { UEFA: 4 }, groups: 0, bestThirds: 0 };

export function worldCupDef(year: number): TournamentDef {
  return year >= 2026 ? WORLD_CUP : WORLD_CUP_32;
}

// The summer after a season. World Cups in 2010, 2014... (48 teams from
// 2026), Euros in 2008, 2012... (24 teams from 2016). The smaller cups
// follow their real calendars: AFCON in even years until 2012, then odd
// years; the Copa America in odd years until 2019, then with the Euros; the
// Nations League Finals from 2019; the Asian Cup in 2007, 2011, 2015...
export function tournamentsForSummer(year: number): TournamentDef[] {
  const out: TournamentDef[] = [];
  if (year % 4 === 2) out.push(worldCupDef(year));
  if (year % 4 === 0) out.push(year >= 2016 ? EURO : EURO_16);
  if (year % 4 === 0 && year >= 2016) out.push(COPA);
  if (year % 2 === 1 && year <= 2019) out.push(COPA);
  if ((year % 2 === 0 && year <= 2012) || (year % 2 === 1 && year >= 2013)) out.push(AFCON);
  if (year % 4 === 3) out.push(ASIAN);
  if (year % 2 === 1) out.push(GOLD);
  if (year % 2 === 1 && year >= 2019) out.push(NATIONS_LEAGUE);
  return out;
}

export function nationOfTeam(world: World, teamId: string): Nation | undefined {
  return world.nations.find((n) => n.teamId === teamId);
}

export function nationalPool(world: World, nationId: string) {
  return Object.values(world.players).filter((p) => p.nationId === nationId && !p.retired && p.clubId);
}

// Best 26: at least 3 keepers, then the best available by match rating.
export function pickNationalSquad(world: World, nationId: string): string[] {
  const pool = nationalPool(world, nationId)
    .filter((p) => p.injuryWeeks === 0)
    .sort((a, b) => overall(b) - overall(a));
  const gks = pool.filter((p) => p.position === 'GK').slice(0, 3);
  const rest = pool.filter((p) => p.position !== 'GK').slice(0, SQUAD_SIZE - gks.length);
  return [...gks, ...rest].map((p) => p.id);
}

export function teamRating(world: World, team: Club): number {
  const best = team.playerIds
    .map((id) => world.players[id])
    .filter(Boolean)
    .sort((a, b) => matchRating(b) - matchRating(a))
    .slice(0, 11);
  return best.length ? best.reduce((s, p) => s + matchRating(p), 0) / best.length : 0;
}

// The user's own national team keeps the squad they picked, cleaned of
// anyone no longer eligible.
export function refreshNationalSquads(game: Game): void {
  const world = game.world;
  const managed = game.manager?.nationalTeamId;
  for (const nation of majorNations(world)) {
    const team = world.nationalTeams[nation.teamId];
    if (team.id === managed) {
      team.playerIds = team.playerIds.filter((id) => world.players[id] && !world.players[id].retired && world.players[id].nationId === nation.id);
      if (team.playerIds.length < 18) team.playerIds = pickNationalSquad(world, nation.id);
      continue;
    }
    team.playerIds = pickNationalSquad(world, nation.id);
    team.lineup = null;
  }
}

// taken: teams already in another tournament this summer. A team can only
// play one at a time (the Gold Cup's Asian guest used to be in the Asian Cup).
function qualify(world: World, rng: Rng, def: TournamentDef, taken: Set<string>): string[] {
  const nations = majorNations(world).filter((n) => !taken.has(n.teamId));
  const form = new Map(nations.map((n) => [n.id, teamRating(world, world.nationalTeams[n.teamId]) + rng.normal(0, 2.5)]));
  const picked: string[] = [];
  for (const [conf, quota] of Object.entries(def.quotas)) {
    const pool = nations.filter((n) => n.conf === conf).sort((a, b) => form.get(b.id)! - form.get(a.id)!);
    picked.push(...pool.slice(0, quota).map((n) => n.teamId));
  }
  const total = Object.values(def.quotas).reduce((a, b) => a + (b ?? 0), 0);
  const size = def.groups ? def.groups * 4 : total;
  const extra = nations.filter((n) => !picked.includes(n.teamId)).sort((a, b) => form.get(b.id)! - form.get(a.id)!);
  while (picked.length < size && extra.length) picked.push(extra.shift()!.teamId);
  return picked.slice(0, size);
}

function makeFixture(world: World, day: number, homeId: string, awayId: string, stage: string): Fixture {
  return { id: newId(world, 'f'), week: day, homeId, awayId, played: false, homeGoals: 0, awayGoals: 0, scorers: [], stage };
}

function koLabel(size: number): string {
  return size === 2 ? 'Final' : size === 4 ? 'Semi-final' : size === 8 ? 'Quarter-final' : `Round of ${size}`;
}

function koFixtures(world: World, t: Tournament) {
  const label = koLabel(t.bracket.length);
  for (let i = 0; i < t.bracket.length; i += 2) t.fixtures.push(makeFixture(world, t.day, t.bracket[i], t.bracket[i + 1], label));
}

export function startTournaments(game: Game): Tournament[] {
  const world = game.world;
  const rng = new Rng(world.rngState);
  refreshNationalSquads(game);
  const year = world.season + 1;
  const out: Tournament[] = [];
  const taken = new Set<string>();
  for (const def of tournamentsForSummer(year)) {
    // The World Cup takes the teams that came through qualifying.
    const q = world.qualifying;
    const teams = def.key === 'wc' && q?.year === year && q.qualified ? q.qualified.slice(0, def.groups * 4) : qualify(world, rng, def, taken);
    teams.forEach((id) => taken.add(id));
    const t: Tournament = {
      id: `${def.key}${year}`,
      name: `${def.name} ${year}`,
      year,
      teamIds: teams,
      groups: [],
      fixtures: [],
      day: 1,
      groupDays: def.groups ? 3 : 0,
      koLabels: [],
      bestThirds: def.bestThirds,
      bracket: [],
      done: false,
    };
    if (def.groups) {
      // Seeded draw: the best teams spread across groups.
      const seeded = [...teams].sort((a, b) => teamRating(world, teamById(world, b)) - teamRating(world, teamById(world, a)));
      t.groups = Array.from({ length: def.groups }, () => [] as string[]);
      seeded.forEach((id, i) => {
        const pot = Math.floor(i / def.groups);
        const g = pot % 2 === 0 ? i % def.groups : def.groups - 1 - (i % def.groups);
        t.groups[g].push(id);
      });
      const rounds = [
        [0, 1, 2, 3],
        [0, 2, 1, 3],
        [3, 0, 1, 2],
      ];
      for (const group of t.groups) {
        rounds.forEach((r, day) => {
          t.fixtures.push(makeFixture(world, day + 1, group[r[0]], group[r[1]], 'Group'));
          t.fixtures.push(makeFixture(world, day + 1, group[r[2]], group[r[3]], 'Group'));
        });
      }
    } else {
      t.bracket = rng.shuffle([...teams]);
      koFixtures(world, t);
    }
    out.push(t);
  }
  world.tournaments = out;
  world.rngState = rng.state;
  return out;
}

export function groupTable(world: World, t: Tournament, group: string[]): TableRow[] {
  return tableFrom(group, t.fixtures.filter((f) => f.stage === 'Group'), (id) => teamById(world, id).name);
}

function winnerOf(f: Fixture): string {
  if (f.homeGoals !== f.awayGoals) return f.homeGoals > f.awayGoals ? f.homeId : f.awayId;
  return f.penaltyWinner ?? f.homeId;
}

// Plays out the current day of every running tournament (the user's game
// should already be committed) and sets up the next day.
export function advanceTournaments(game: Game): void {
  const world = game.world;
  const rng = new Rng(world.rngState);
  for (const t of world.tournaments) {
    if (t.done) continue;
    for (const f of t.fixtures) if (f.week === t.day && !f.played) quickSim(world, f, rng.int(1, 2 ** 31));

    if (t.groupDays && t.day === t.groupDays) {
      const tables = t.groups.map((g) => groupTable(world, t, g));
      const winners = tables.map((tb) => tb[0]);
      const runners = tables.map((tb) => tb[1]);
      const thirds = tables
        .map((tb) => tb[2])
        .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
        .slice(0, t.bestThirds);
      const seeds = [...winners, ...runners, ...thirds].map((r) => r.clubId);
      t.bracket = [];
      for (let i = 0; i < seeds.length / 2; i++) t.bracket.push(seeds[i], seeds[seeds.length - 1 - i]);
      t.day++;
      koFixtures(world, t);
      continue;
    }
    if (t.day > t.groupDays) {
      const today = t.fixtures.filter((f) => f.week === t.day);
      t.bracket = today.map(winnerOf);
      if (t.bracket.length === 1) {
        t.done = true;
        t.championId = t.bracket[0];
        world.honours.push({ season: world.season, title: t.name, winner: teamById(world, t.championId).name, clubId: t.championId });
        continue;
      }
      t.day++;
      koFixtures(world, t);
      continue;
    }
    t.day++;
  }
  world.rngState = rng.state;
}

export function tournamentsDone(world: World): boolean {
  return world.tournaments.every((t) => t.done);
}

// Furthest stage a team reached, for federation reviews and messages.
export function stageReached(t: Tournament, teamId: string): string {
  if (t.championId === teamId) return 'Winners';
  const games = t.fixtures.filter((f) => f.played && (f.homeId === teamId || f.awayId === teamId));
  const last = games[games.length - 1];
  return last?.stage === 'Group' || !last ? 'Group stage' : last.stage!;
}

export function tournamentFixtureFor(world: World, teamId: string): Fixture | undefined {
  for (const t of world.tournaments) {
    if (t.done) continue;
    const f = t.fixtures.find((x) => x.week === t.day && !x.played && (x.homeId === teamId || x.awayId === teamId));
    if (f) return f;
  }
  return undefined;
}

// International break: everyone in a squad gets a cap or two from the
// friendlies. With qualifiers on, caps come from those matches instead.
export function internationalBreak(game: Game, rng: Rng, friendlies = true): void {
  const world = game.world;
  refreshNationalSquads(game);
  if (!friendlies) return;
  for (const nation of majorNations(world)) {
    const team = world.nationalTeams[nation.teamId];
    const starters = [...team.playerIds].sort((a, b) => matchRating(world.players[b]) - matchRating(world.players[a])).slice(0, 15);
    for (const id of starters) {
      const p = world.players[id];
      if (id === game.career?.playerId) continue;
      p.caps += rng.int(1, 2);
      if (p.position === 'FWD' && rng.chance(clamp(p.attrs.shooting / 250, 0, 0.4))) p.intlGoals++;
    }
  }
}

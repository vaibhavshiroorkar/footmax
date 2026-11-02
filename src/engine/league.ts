import { Fixture, League, World } from './types';
import { Rng } from './rng';

export const SEASON_WEEKS = 38;

// Double round robin by the circle method: first half, then the same
// rounds with home and away swapped. Rounds are spread over the season, so
// an 18-club league (34 rounds) has a few blank weeks.
export function makeFixtures(clubIds: string[], rng: Rng, makeId: () => string, seasonWeeks = SEASON_WEEKS): Fixture[] {
  const ids = rng.shuffle([...clubIds]);
  if (ids.length % 2) ids.push('BYE');
  const n = ids.length;
  const rounds: [string, string][][] = [];
  const rot = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      // Alternate who is at home so no club gets a long home or away run.
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rot.splice(1, 0, rot.pop()!);
  }
  const once = [...rounds, ...rounds.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string]))];
  // Small leagues meet two or three times, like the Scottish and Welsh
  // leagues do, so a 10-club league still has a game most weeks.
  const cycles = Math.max(1, Math.min(3, Math.floor(seasonWeeks / once.length)));
  const all = Array.from({ length: cycles }, (_, c) => (c % 2 ? once.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string])) : once)).flat();
  const total = all.length;
  const fixtures: Fixture[] = [];
  all.forEach((pairs, r) => {
    const week = total >= seasonWeeks ? r + 1 : Math.floor((r * seasonWeeks) / total) + 1;
    for (const [homeId, awayId] of pairs) {
      if (homeId === 'BYE' || awayId === 'BYE') continue;
      fixtures.push({ id: makeId(), week, homeId, awayId, played: false, homeGoals: 0, awayGoals: 0, scorers: [] });
    }
  });
  return fixtures;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function tableFrom(clubIds: string[], fixtures: Fixture[], nameOf: (id: string) => string): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const id of clubIds) rows.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  for (const f of fixtures) {
    if (!f.played) continue;
    const h = rows.get(f.homeId);
    const a = rows.get(f.awayId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  const list = [...rows.values()];
  for (const r of list) r.gd = r.gf - r.ga;
  return list.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || nameOf(x.clubId).localeCompare(nameOf(y.clubId)));
}

export function leagueTable(league: League, world: World): TableRow[] {
  return tableFrom(league.clubIds, league.fixtures, (id) => world.clubs[id].name);
}

export function leagueOf(world: World, clubId: string): League | undefined {
  const id = world.clubs[clubId]?.leagueId;
  return id ? world.leagues.find((l) => l.id === id) : undefined;
}

export function fixtureFor(world: World, clubId: string, week: number): Fixture | undefined {
  return leagueOf(world, clubId)?.fixtures.find((f) => f.week === week && (f.homeId === clubId || f.awayId === clubId));
}

export function nextFixture(world: World, clubId: string): Fixture | undefined {
  return leagueOf(world, clubId)?.fixtures.find((f) => !f.played && f.week >= world.week && (f.homeId === clubId || f.awayId === clubId));
}

export function tablePosition(world: World, clubId: string): number {
  const league = leagueOf(world, clubId);
  if (!league) return 0;
  return leagueTable(league, world).findIndex((r) => r.clubId === clubId) + 1;
}

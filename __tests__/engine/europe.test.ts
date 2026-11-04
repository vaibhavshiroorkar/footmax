import { newCareerGame, skipWeek, userFixture } from '../../src/engine/game';
import { LEAGUE_FROM, europeTable, leagueDraw, startEurope, tieWinner } from '../../src/engine/europe';
import { advanceWeek } from '../../src/engine/season';
import { Rng } from '../../src/engine/rng';
import { Fixture, Game } from '../../src/engine/types';

const fresh = (seed = 14) => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });

function playSeason(game: Game) {
  let guard = 0;
  while (game.world.phase === 'season' && guard++ < 60) advanceWeek(game);
}

describe('the league phase draw', () => {
  const game = fresh();
  const w = game.world;
  startEurope(w, new Rng(3), null);
  const e = w.europe!;
  const games = e.fixtures;

  it('has 36 clubs, none twice', () => {
    expect(e.format).toBe('league');
    expect(e.clubs.length).toBe(36);
    expect(new Set(e.clubs).size).toBe(36);
  });

  it('gives everyone eight games, four home and four away, against eight clubs', () => {
    for (const id of e.clubs) {
      const mine = games.filter((f) => f.homeId === id || f.awayId === id);
      expect(mine.length).toBe(8);
      expect(mine.filter((f) => f.homeId === id).length).toBe(4);
      expect(new Set(mine.map((f) => (f.homeId === id ? f.awayId : f.homeId))).size).toBe(8);
    }
  });

  it('never asks a club to play twice in a week, or in an international break', () => {
    for (const id of e.clubs) {
      const weeks = games.filter((f) => f.homeId === id || f.awayId === id).map((f) => f.week);
      expect(new Set(weeks).size).toBe(weeks.length);
    }
    for (const f of games) expect([9, 20, 30]).not.toContain(f.week);
  });

  it('keeps clubs of one nation apart where it can', () => {
    const pairs = leagueDraw(w, e.clubs, new Rng(5));
    const clashes = pairs.filter(([a, b]) => w.clubs[a].nationId === w.clubs[b].nationId);
    expect(clashes.length).toBeLessThan(pairs.length * 0.05);
  });
});

describe('a whole season', () => {
  const game = fresh(15);
  playSeason(game);
  const e = game.world.europe!;

  it('crowns a winner', () => {
    expect(e.round).toBe('done');
    expect(e.winner).toBeDefined();
    expect(game.world.honours.some((h) => h.title === 'Champions League winners')).toBe(true);
  });

  it('runs every round with the right number of ties', () => {
    const count = (stage: string) => e.fixtures.filter((f) => f.stage === stage).length;
    expect(count('League phase')).toBe(144);
    expect(count('Play-off')).toBe(16);
    expect(count('Round of 16')).toBe(16);
    expect(count('Quarter-final')).toBe(8);
    expect(count('Semi-final')).toBe(4);
    expect(count('Final')).toBe(1);
    expect(e.fixtures.every((f) => f.played)).toBe(true);
  });

  it('sends the top eight straight through and drops the bottom twelve', () => {
    const table = europeTable(game.world).map((r) => r.clubId);
    const r16 = new Set(e.fixtures.filter((f) => f.stage === 'Round of 16').flatMap((f) => [f.homeId, f.awayId]));
    const playoff = new Set(e.fixtures.filter((f) => f.stage === 'Play-off').flatMap((f) => [f.homeId, f.awayId]));
    expect(r16.size).toBe(16);
    expect(playoff.size).toBe(16);
    for (const id of e.clubs.slice(0, 8)) expect(r16.has(id)).toBe(true);
    for (const id of e.clubs.slice(24)) expect(playoff.has(id) || r16.has(id)).toBe(false);
    expect(table.length).toBe(36);
  });

  it('settles every second leg, on aggregate', () => {
    for (const f of e.fixtures.filter((x) => x.secondLeg)) {
      const first = e.fixtures.find((x) => x.stage === f.stage && !x.secondLeg && x.homeId === f.awayId && x.awayId === f.homeId)!;
      expect(first).toBeDefined();
      const a = first.homeGoals + f.awayGoals;
      const b = first.awayGoals + f.homeGoals;
      if (a === b) expect(f.penaltyWinner).toBeDefined();
      expect(first.penaltyWinner).toBeUndefined();
    }
  });
});

describe('before 2024/25', () => {
  it('plays 32 clubs in eight groups', () => {
    const game = fresh(16);
    game.world.season = LEAGUE_FROM - 5;
    startEurope(game.world, new Rng(9), null);
    const e = game.world.europe!;
    expect(e.format).toBe('groups');
    expect(e.clubs.length).toBe(32);
    expect(e.groups.length).toBe(8);
    for (const g of e.groups) {
      expect(g.length).toBe(4);
      for (const id of g) expect(e.fixtures.filter((f) => f.homeId === id || f.awayId === id).length).toBe(6);
    }
  });

  it('counts away goals until 2020/21, not after', () => {
    const leg = (h: string, a: string, hg: number, ag: number): Fixture => ({ id: h, week: 1, homeId: h, awayId: a, played: true, homeGoals: hg, awayGoals: ag, scorers: [] });
    const first = leg('a', 'b', 2, 1);
    const second = { ...leg('b', 'a', 1, 0), penaltyWinner: 'a' };
    expect(tieWinner(second, first, 2015)).toBe('b');
    expect(tieWinner(second, first, 2023)).toBe('a');
  });
});

describe("the user's week", () => {
  it('plays the European game first, then the league game, then moves on', () => {
    for (const seed of [17, 18, 19, 20, 21, 22, 23, 24]) {
      const game = fresh(seed);
      const w = game.world;
      w.week = 1;
      const club = Object.values(w.clubs).find((c) => c.leagueId && c.reputation > 85)!;
      const me = w.players[game.career!.playerId];
      w.clubs[me.clubId!].playerIds = w.clubs[me.clubId!].playerIds.filter((id) => id !== me.id);
      me.clubId = club.id;
      club.playerIds.push(me.id);
      startEurope(w, new Rng(seed), club.id);
      if (!w.europe!.clubs.includes(club.id)) continue;
      const mine = w.europe!.fixtures.filter((f) => f.homeId === club.id || f.awayId === club.id).sort((a, b) => a.week - b.week)[0];
      w.week = mine.week;
      expect(userFixture(game)?.europe).toBe(true);
      const week = w.week;
      skipWeek(game);
      expect(w.week).toBe(week);
      expect(mine.played).toBe(true);
      expect(userFixture(game)?.europe).toBeFalsy();
      skipWeek(game);
      expect(w.week).toBe(week + 1);
      return;
    }
    throw new Error('no seed gave a European game');
  });
});

describe('a small champion', () => {
  it('gets a qualifying tie for the last place', () => {
    const game = fresh(25);
    const w = game.world;
    const me = w.players[game.career!.playerId];
    const club = w.clubs[me.clubId!];
    w.lastFinish = { ...(w.lastFinish ?? {}), [club.leagueId!]: [club.id] };
    w.nations.find((n) => n.id === club.nationId)!.conf = 'UEFA';
    startEurope(w, new Rng(2), club.id);
    expect(w.europe!.challenger).toBe(club.id);
    expect(w.europe!.fixtures.filter((f) => f.stage === 'Qualifying').length).toBe(2);
  });
});

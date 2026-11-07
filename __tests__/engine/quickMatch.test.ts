import { finishUserMatch, generateWorld, newCareerGame, newManagerGame, quickUserMatch, startUserMatch, userFixture } from '../../src/engine/game';
import { simToEnd } from '../../src/engine/match';
import { gameForMatchResult } from '../../src/engine/matchResult';
import { overall } from '../../src/engine/player';

const career = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 183 });

describe('Quick Sim results', () => {
  it('retains final participants after season rollover retires them', () => {
    const world = generateWorld(44);
    const [home, away] = Object.values(world.nationalTeams);
    const game = newManagerGame(world, null, home.id, 'Manager');
    const fixture = { ...world.leagues[0].fixtures[0], id: 'final', homeId: home.id, awayId: away.id, week: 1, stage: 'Final', played: false, homeGoals: 0, awayGoals: 0, scorers: [] };
    world.phase = 'tournament';
    world.tournaments = [{ id: 'cup', name: 'Cup', year: world.season + 1, teamIds: [home.id, away.id], groups: [], fixtures: [fixture], day: 1, groupDays: 0, koLabels: ['Final'], bestThirds: 0, bracket: [home.id, away.id], done: false }];
    const result = quickUserMatch(game)!;
    const veteran = result.home.onPitch[0];
    world.players[veteran].age = 39;
    const attrs = { ...world.players[veteran].attrs };
    expect(finishUserMatch(game, result).newSeason).toBe(true);
    expect(world.players[veteran]).toBeUndefined();
    const display = gameForMatchResult(game, result);
    expect(display.world.players[veteran].age).toBe(39);
    expect(display.world.players[veteran].attrs).toEqual(attrs);
    for (const side of [result.home, result.away]) {
      for (const id of [...side.onPitch, ...side.bench, ...side.usedIds]) {
        expect(Number.isFinite(overall(display.world.players[id]))).toBe(true);
      }
    }
    expect(game.world.players[veteran]).toBeUndefined();
    expect(gameForMatchResult(game, null)).toBe(game);
  });

  it('keeps a finished match available for the normal result screen', () => {
    const game = career();
    const fixture = userFixture(game)!;
    const week = game.world.week;
    const result = quickUserMatch(game)!;
    expect(result.fixtureId).toBe(fixture.id);
    expect(result.finished).toBe(true);
    expect(result.pending).toBeNull();
    expect(fixture.played).toBe(false);
    expect(game.world.week).toBe(week);
    expect(game.world.pendingMatch?.kicked).toBe(true);
    finishUserMatch(game, result);
    expect(fixture.played).toBe(true);
    expect(game.career?.lastMatch?.fixtureId).toBe(result.fixtureId);
    const after = { week: game.world.week, xp: game.career!.xp, reward: game.career!.lastMatch, fixture: userFixture(game)?.id };
    finishUserMatch(game, result);
    expect({ week: game.world.week, xp: game.career!.xp, reward: game.career!.lastMatch, fixture: userFixture(game)?.id }).toEqual(after);
  });

  it('uses the same simulation as skipping a watched match', () => {
    const quick = career();
    const watched = career();
    const expected = startUserMatch(watched)!;
    simToEnd(watched.world, expected);
    const actual = quickUserMatch(quick)!;
    expect(actual).toEqual(expected);
  });
});

import { finishUserMatch, newCareerGame, quickUserMatch, startUserMatch, userFixture } from '../../src/engine/game';
import { simToEnd } from '../../src/engine/match';

const career = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 183 });

describe('Quick Sim results', () => {
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

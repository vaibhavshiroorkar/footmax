import { newCareerGame, skipSummer, skipWeek } from '../../src/engine/game';
import { careerPlayer, retire } from '../../src/engine/career';
import { endCareer } from '../../src/engine/lifeEvents';
import { retirementAge } from '../../src/engine/retirement';
import { careerStory } from '../../src/engine/totals';
import { Game } from '../../src/engine/types';

const fresh = (seed: number) => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });

function toNextSeason(game: Game) {
  const season = game.world.season;
  let guard = 0;
  while (game.world.season === season && guard++ < 120) {
    if (game.world.phase === 'tournament') skipSummer(game);
    else skipWeek(game);
  }
}

describe('the end of a career', () => {
  it('a forced ending clears the club and keeps the season in the history', () => {
    const game = fresh(61);
    const p = careerPlayer(game);
    const club = p.clubId!;
    p.stats = { apps: 12, goals: 4, assists: 2, ratingSum: 12 * 7 };
    endCareer(game, 'A career-ending injury.');
    expect(game.career!.retired).toBe(true);
    expect(game.career!.endReason).toBe('A career-ending injury.');
    expect(p.clubId).toBeNull();
    expect(game.world.clubs[club].playerIds).not.toContain(p.id);
    expect(p.history.at(-1)).toMatchObject({ clubId: club, apps: 12, goals: 4 });
  });

  it('retiring by choice does the same', () => {
    const game = fresh(62);
    const p = careerPlayer(game);
    retire(game);
    expect(p.retired).toBe(true);
    expect(p.clubId).toBeNull();
  });
});

describe('retirement age', () => {
  const game = fresh(63);
  const p = careerPlayer(game);

  it('lands between 30 and 41 whatever the body', () => {
    for (const physical of [1, 50, 99]) {
      p.attrs.physical = physical;
      for (const injured of [0, 200]) {
        game.career!.injuredWeeks = injured;
        const age = retirementAge(game);
        expect(age).toBeGreaterThanOrEqual(30);
        expect(age).toBeLessThanOrEqual(41);
      }
    }
  });

  it('keeps keepers going longer, and lets injuries cut it short', () => {
    p.attrs.physical = 70;
    game.career!.injuredWeeks = 0;
    p.position = 'FWD';
    const striker = retirementAge(game);
    p.position = 'GK';
    expect(retirementAge(game)).toBeGreaterThan(striker);
    p.position = 'FWD';
    game.career!.injuredWeeks = 60;
    expect(retirementAge(game)).toBeLessThan(striker);
  });

  it('ends the career at the season change once the limit is reached', () => {
    const g = fresh(64);
    const me = careerPlayer(g);
    me.age = retirementAge(g) - 1;
    toNextSeason(g);
    expect(g.career!.retired).toBe(true);
    expect(g.career!.endReason).toMatch(/^Retired at \d+/);
    expect(me.clubId).toBeNull();
    // The season just finished is part of the record.
    expect(careerStory(g).clubs.length).toBeGreaterThan(0);
  });
});

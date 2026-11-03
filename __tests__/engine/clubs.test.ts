import { newCareerGame } from '../../src/engine/game';
import { agentFee, fameNeeded, offerSelf, searchClubs, teamRating } from '../../src/engine/relations';
import { targetOverall, isCareerClub } from '../../src/engine/generator';
import { Game } from '../../src/engine/types';

function career(seed: number): Game {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  // In a transfer window, with the agent free to pitch.
  game.world.week = 2;
  game.career!.pitchCooldown = 0;
  return game;
}

const bigClub = (game: Game) => Object.values(game.world.clubs).filter((c) => isCareerClub(game.world, c)).sort((a, b) => b.reputation - a.reputation)[0];

describe('clubs', () => {
  it('a big club will not listen without the fame', () => {
    const game = career(4);
    const big = bigClub(game);
    game.career!.fame = 0;
    game.career!.money = 1e9;
    expect(fameNeeded(big)).toBeGreaterThan(0);
    const before = game.career!.money;
    expect(offerSelf(game, big.id)).toMatch(/fame/);
    expect(game.career!.money).toBe(before);
  });

  it('the agent charges his fee for a pitch', () => {
    const game = career(5);
    const big = bigClub(game);
    game.career!.fame = 100;
    game.career!.money = 1e9;
    const fee = agentFee(big);
    expect(fee).toBeGreaterThan(0);
    offerSelf(game, big.id);
    expect(game.career!.money).toBe(1e9 - fee);
  });

  it('cannot pitch without the money for the fee', () => {
    const game = career(6);
    const big = bigClub(game);
    game.career!.fame = 100;
    game.career!.money = 0;
    expect(offerSelf(game, big.id)).toMatch(/agent wants/);
  });

  it('search finds clubs by name', () => {
    const game = career(7);
    const big = bigClub(game);
    const hits = searchClubs(game, big.name.slice(0, 5));
    expect(hits.some((h) => h.clubId === big.id)).toBe(true);
  });

  it('team rating sits near the club level', () => {
    const game = career(8);
    const big = bigClub(game);
    expect(Math.abs(teamRating(game.world, big) - targetOverall(big.reputation))).toBeLessThan(12);
  });
});

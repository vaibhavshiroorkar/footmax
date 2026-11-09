import { newCareerGame } from '../../src/engine/game';
import { awardBlock, computeAwards } from '../../src/engine/awards';
import { leagueStrength } from '../../src/engine/generator';
import { careerPlayer } from '../../src/engine/career';
import { Game, Player } from '../../src/engine/types';

// Award eligibility follows the real awards (RESEARCH.md, "Awards").

const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 42 });
const world = game.world;
const leagueOf = (id: string) => world.leagues.find((l) => l.id === id)!;
const playersIn = (leagueId: string) => leagueOf(leagueId).clubIds.flatMap((c) => world.clubs[c].playerIds.map((id) => world.players[id]));
const season = (p: Player, apps: number, goals: number, rating: number) => (p.stats = { apps, goals, assists: 0, ratingSum: apps * rating });

// A season of ordinary numbers in every simulated league.
for (const l of world.leagues) for (const p of playersIn(l.id)) season(p, 20, 1, 6.8);

const me = careerPlayer(game);
const myLeague = leagueOf(world.clubs[me.clubId!].leagueId!);
const striker = (leagueId: string) => playersIn(leagueId).find((p) => p.position === 'FWD' && p.id !== me.id)!;

describe('award eligibility', () => {
  it('starts the career in a league too small to be noticed', () => {
    expect(leagueStrength(world, myLeague)).toBeLessThan(60);
  });

  it("keeps a record season in a local league off the Ballon d'Or list", () => {
    season(me, 30, 60, 9.6);
    const a = computeAwards(game);
    expect(a.ballonDor.some((e) => e.playerId === me.id)).toBe(false);
    expect(awardBlock(game, me, 'ballonDor')).toMatch(/too small/);
    // The Golden Shoe does count small European leagues, once per goal.
    const boot = a.goldenBoot.find((e) => e.playerId === me.id);
    expect(boot?.score).toBe(60);
    season(me, 30, 0, 6.5);
  });

  it("crowns a Ballon d'Or winner from one of the five strongest leagues", () => {
    const dutch = striker('NED1');
    season(dutch, 34, 45, 8.9);
    const a = computeAwards(game);
    // Shortlisted, but not the winner.
    expect(a.ballonDor.some((e) => e.playerId === dutch.id)).toBe(true);
    const winner = world.players[a.ballonDor[0].playerId];
    expect(['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1']).toContain(world.clubs[winner.clubId!].leagueId);
    season(dutch, 20, 1, 6.8);
  });

  it('weights Golden Boot goals by league, and keeps the real count', () => {
    const dutch = striker('NED1');
    const english = striker('ENG1');
    season(dutch, 30, 26, 7.2);
    season(english, 30, 20, 7.2);
    const boot = computeAwards(game).goldenBoot;
    const rank = (id: string) => boot.findIndex((e) => e.playerId === id);
    // 20 x 2 beats 26 x 1.5.
    expect(rank(english.id)).toBeLessThan(rank(dutch.id));
    expect(boot[rank(english.id)].goals).toBe(20);
    expect(boot[rank(english.id)].score).toBe(40);
  });

  it('gives the Golden Boy only to under-21s in a European top flight', () => {
    const kid = playersIn('ENG2').find((p) => p.position !== 'GK')!;
    kid.age = 19;
    season(kid, 30, 25, 8.5);
    const older = striker('ENG1');
    older.age = 21;
    season(older, 30, 25, 8.5);
    const boy = computeAwards(game).goldenBoy;
    expect(boy.some((e) => e.playerId === kid.id)).toBe(false);
    expect(boy.some((e) => e.playerId === older.id)).toBe(false);
    for (const e of boy) expect(world.players[e.playerId].age).toBeLessThanOrEqual(20);
  });
});

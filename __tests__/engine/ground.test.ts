import { newCareerGame } from '../../src/engine/game';
import { capacityFor, groundFor, rungOf } from '../../src/engine/ground';
import { leagueStrength } from '../../src/engine/generator';
import { careerPlayer, xpStage } from '../../src/engine/career';
import { Fixture, Game } from '../../src/engine/types';

// Grounds and crowds by level (RESEARCH.md, "Grounds and crowds").

const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 42 });
const world = game.world;
const fixture = (homeId: string, awayId: string, extra: Partial<Fixture> = {}): Fixture => ({ id: `t-${homeId}-${awayId}`, week: 1, homeId, awayId, played: false, homeGoals: 0, awayGoals: 0, scorers: [], ...extra });
const league = (id: string) => world.leagues.find((l) => l.id === id)!;
const biggest = (id: string) => [...league(id).clubIds].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation);
const me = careerPlayer(game);
const myClub = world.clubs[me.clubId!];
const local = league(myClub.leagueId!);

describe('grounds', () => {
  it('sizes grounds like the real tiers', () => {
    expect(capacityFor(80)).toBeGreaterThan(40000);
    expect(capacityFor(63)).toBeGreaterThan(15000);
    expect(capacityFor(63)).toBeLessThan(25000);
    expect(capacityFor(30)).toBeLessThan(1500);
  });

  it('puts a local club on a rail with a few hundred watching', () => {
    const g = groundFor(world, fixture(myClub.id, local.clubIds.find((c) => c !== myClub.id)!));
    expect(g.level).toBe(rungOf(leagueStrength(world, local)));
    expect(g.stands === 'rail' || g.stands === 'main').toBe(true);
    expect(g.attendance).toBeLessThan(3000);
    expect(g.grass.wear).toBeGreaterThan(0.3);
  });

  it('fills a big Premier League ground and gives the visitors their allocation', () => {
    const [a, b] = biggest('ENG1');
    const g = groundFor(world, fixture(a, b));
    expect(g.level).toBe(4);
    expect(g.stands).toBe('bowl');
    expect(g.attendance).toBeGreaterThan(0.9 * g.capacity);
    expect(g.awayFans).toBe(3000);
    expect(g.grass.mowing).toBe('checks');
    expect(g.noise).toBeGreaterThan(groundFor(world, fixture(myClub.id, local.clubIds[1])).noise);
  });

  it('lights every European night and gives away fans 5%', () => {
    const [a, b] = biggest('ESP1');
    const g = groundFor(world, fixture(a, b, { europe: true, stage: 'League phase' }));
    expect(g.lights).toBe(true);
    expect(g.awayFans).toBeLessThanOrEqual(Math.ceil(g.capacity * 0.05) + 10);
    expect(g.awayFans).toBeGreaterThan(g.capacity * 0.04);
  });

  it('splits a final between both sets of fans', () => {
    const [a, b] = biggest('ITA1');
    const g = groundFor(world, fixture(a, b, { europe: true, stage: 'Final' }));
    expect(g.neutral).toBe(true);
    expect(g.attendance).toBe(g.capacity);
    expect(Math.abs(g.awayFans - g.attendance * 0.45)).toBeLessThan(20);
  });

  it('gives the same crowd to the same fixture every time', () => {
    const [a, b] = biggest('GER1');
    expect(groundFor(world, fixture(a, b))).toEqual(groundFor(world, fixture(a, b)));
  });
});

describe('stage rewards', () => {
  it('teaches more on bigger stages', () => {
    const top = world.clubs[biggest('ENG1')[0]];
    expect(xpStage(game, myClub, 'x')).toBeCloseTo(1 + rungOf(leagueStrength(world, local)) * 0.1);
    expect(xpStage(game, top, 'x')).toBeCloseTo(1.4);
    expect(xpStage(game, top, 'x')).toBeGreaterThan(xpStage(game, myClub, 'x'));
  });
});

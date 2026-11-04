import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { LONG_RANGE, placeMoment, quickSim, resolveMoment, takeAction } from '../../src/engine/match';
import { distanceChance, longShot, longWindow } from '../../src/engine/contact';
import { Rng } from '../../src/engine/rng';
import { Fixture } from '../../src/engine/types';

const rng = new Rng(77);
const rand = () => rng.next();
const rate = (o: Partial<Parameters<typeof longShot>[0]>) => {
  let g = 0;
  for (let i = 0; i < 6000; i++) if (longShot({ metres: 50, shooting: 70, keeperOut: 2, kind: 'driven', error: 0.3, rand, ...o }).outcome === 'goal') g++;
  return g / 6000;
};

describe('long shots', () => {
  it('fall away exponentially with distance', () => {
    expect(distanceChance(16.5)).toBeCloseTo(0.1, 3);
    expect(distanceChance(27)).toBeCloseTo(0.03, 2);
    expect(distanceChance(52.5)).toBeLessThan(0.002);
    // Each ten metres cuts it by the same factor.
    expect(distanceChance(30) / distanceChance(40)).toBeCloseTo(distanceChance(40) / distanceChance(50), 3);
  });

  it('narrow the window the further out you are', () => {
    expect(longWindow(50, 70)).toBeLessThan(longWindow(36, 70));
    expect(longWindow(50, 90)).toBeGreaterThan(longWindow(50, 50));
  });

  it('almost never go in from halfway with the keeper at home', () => {
    expect(rate({ metres: 52 })).toBeLessThan(0.03);
  });

  it('are a real chance when the keeper is off his line, for a lob most of all', () => {
    const out = rate({ metres: 50, keeperOut: 16, kind: 'lob' });
    expect(out).toBeGreaterThan(rate({ metres: 50, keeperOut: 2, kind: 'lob' }) * 4);
    expect(out).toBeGreaterThan(rate({ metres: 50, keeperOut: 16, kind: 'driven' }));
  });

  it('miss if you do not hit the window', () => {
    expect(rate({ error: 1.2, keeperOut: 20, kind: 'lob' })).toBe(0);
  });

  it('open the long scene from where he really is', () => {
    // A seed where he starts, so there is someone on the pitch to shoot.
    const start = [2, 3, 4, 5, 6, 7, 8, 9].map((seed) => {
      const g = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
      return { game: g, s: startUserMatch(g)! };
    }).find(({ game: g, s: m }) => [...m.home.onPitch, ...m.away.onPitch].includes(g.career!.playerId))!;
    const { game, s } = start;
    const home = s.home.onPitch.includes(game.career!.playerId);
    expect(takeAction(game.world, s, 'shot', { x: 0.5, y: 0.5 })).toBe(true);
    expect(s.pending?.view).toBe('long');
    expect(s.pending?.metres).toBeGreaterThanOrEqual(LONG_RANGE);
    placeMoment(s, { x: 0.5, y: home ? 0.9 : 0.1 });
    expect(s.pending?.view).toBe('box');
    resolveMoment(game.world, s, 0.5, undefined, undefined, { forced: 'miss', aim: 1.2 });
  });
});

describe('tempers', () => {
  const world = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 6 }).world;
  const clubs = Object.values(world.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
  const fixture = (i: number): Fixture => ({ id: `f${i}`, week: 1, homeId: clubs[i % clubs.length].id, awayId: clubs[(i + 1) % clubs.length].id, played: false, homeGoals: 0, awayGoals: 0, scorers: [] });
  const matches = Array.from({ length: 500 }, (_, i) => {
    const m = quickSim(world, fixture(i), 5000 + i);
    for (const c of [clubs[i % clubs.length], clubs[(i + 1) % clubs.length]]) for (const id of c.playerIds) Object.assign(world.players[id], { suspendedWeeks: 0, injuryWeeks: 0 });
    return m;
  });
  const text = (re: RegExp) => matches.reduce((n, m) => n + m.events.filter((e) => re.test(e.text)).length, 0);

  it('flare up now and then, and most calm down', () => {
    const all = text(/square up|head to head|come to blows|lashes out/);
    expect(all).toBeGreaterThan(5);
    expect(all / matches.length).toBeLessThan(0.3);
    expect(text(/square up/) + text(/head to head/)).toBeGreaterThan(text(/come to blows|lashes out/));
  });

  it('can send both men off, and both get a long ban', () => {
    const both = matches.find((m) => m.events.some((e) => /come to blows/.test(e.text)));
    if (!both) return;
    const reds = both.events.filter((e) => e.type === 'red').map((e) => e.playerId!);
    expect(reds.length).toBeGreaterThanOrEqual(2);
    for (const id of reds.slice(0, 2)) expect(both.sentOff[id]).toBeGreaterThanOrEqual(1);
  });

  it('keeps red cards near real levels', () => {
    const reds = matches.reduce((n, m) => n + m.events.filter((e) => e.type === 'red').length, 0) / matches.length;
    expect(reds).toBeLessThan(0.3);
  });
});

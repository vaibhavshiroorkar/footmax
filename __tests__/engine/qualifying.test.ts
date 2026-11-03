import { generateWorld, majorNations } from '../../src/engine/generator';
import { newManagerGame } from '../../src/engine/game';
import { Rng } from '../../src/engine/rng';
import { playQualifyingBreak, qualifyingLive, startQualifying, worldCupAfter } from '../../src/engine/qualifying';
import { startTournaments, tournamentsForSummer } from '../../src/engine/international';

describe('World Cup qualifying', () => {
  const world = generateWorld(7);
  // 2029/30 leads into the 2030 World Cup.
  world.season = 2029;
  const india = world.nations.find((n) => n.id === 'IND')!;
  const game = newManagerGame(world, null, india.teamId, 'Boss');
  const rng = new Rng(3);
  startQualifying(world, rng);
  const q = world.qualifying!;

  it('runs only in the season before a World Cup', () => {
    expect(worldCupAfter(2029)).toBe(2030);
    expect(worldCupAfter(2009)).toBe(2010);
    expect(worldCupAfter(2026)).toBeNull();
  });

  it('draws every nation once, in groups of two to four', () => {
    const drawn = q.groups.flatMap((g) => g.teamIds);
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(drawn.sort()).toEqual(majorNations(world).map((n) => n.teamId).sort());
    for (const g of q.groups) {
      expect(g.teamIds.length).toBeGreaterThanOrEqual(2);
      expect(g.teamIds.length).toBeLessThanOrEqual(4);
    }
    expect(q.groups.some((g) => g.teamIds.includes(india.teamId))).toBe(true);
  });

  it('plays home and away within six matchdays', () => {
    for (const g of q.groups) {
      const set = new Set(g.teamIds);
      const games = q.fixtures.filter((f) => set.has(f.homeId));
      expect(games).toHaveLength(g.teamIds.length * (g.teamIds.length - 1));
      for (const f of games) expect(f.week).toBeGreaterThanOrEqual(1);
      for (const f of games) expect(f.week).toBeLessThanOrEqual(6);
    }
  });

  it('fills the World Cup from the qualifiers after three breaks', () => {
    for (let b = 0; b < 3; b++) {
      expect(qualifyingLive(world)).toBe(true);
      playQualifyingBreak(game, rng);
    }
    expect(qualifyingLive(world)).toBe(false);
    expect(q.fixtures.every((f) => f.played)).toBe(true);
    expect(q.qualified).toHaveLength(48);
    expect(new Set(q.qualified).size).toBe(48);
    // Each confederation gets at least its places.
    const conf = (id: string) => world.nations.find((n) => n.teamId === id)!.conf;
    expect(q.qualified!.filter((id) => conf(id) === 'UEFA').length).toBeGreaterThanOrEqual(16);
    expect(q.qualified!.filter((id) => conf(id) === 'OFC').length).toBeGreaterThanOrEqual(1);
    // The user hears how it went.
    expect(game.inbox.some((m) => /World Cup/.test(m.title))).toBe(true);
    const [wc] = startTournaments(game);
    expect(wc.name).toBe('World Cup 2030');
    expect([...wc.teamIds].sort()).toEqual([...q.qualified!].sort());
  });

  it('uses the tournament formats of each era', () => {
    expect(tournamentsForSummer(2010).find((t) => t.key === 'wc')!.groups).toBe(8);
    expect(tournamentsForSummer(2030).find((t) => t.key === 'wc')!.groups).toBe(12);
    expect(tournamentsForSummer(2008).find((t) => t.key === 'euro')!.groups).toBe(4);
    expect(tournamentsForSummer(2024).find((t) => t.key === 'euro')!.groups).toBe(6);
    expect(tournamentsForSummer(2007).map((t) => t.key)).toEqual(['copa', 'asian', 'gold']);
  });
});

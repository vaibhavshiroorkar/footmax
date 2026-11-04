import { newCareerGame } from '../../src/engine/game';
import { careerPlayer, lifeAction } from '../../src/engine/career';
import { formShift, moodWeekly } from '../../src/engine/mood';
import { logMatch, resultFor } from '../../src/engine/matchLog';
import { matchRating } from '../../src/engine/player';
import { Rng } from '../../src/engine/rng';
import { MatchRecord } from '../../src/engine/types';
import { dribblePick } from '../../src/ui/moments/dribblePick';
import { MatchState } from '../../src/engine/match';

const career = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 41 });

describe('form', () => {
  it('lifts a happy player a little and drags a low, tired one a lot', () => {
    const up = formShift({ morale: 100, fitness: 100 });
    const down = formShift({ morale: 15, fitness: 40 });
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(-up * 2);
  });

  it('is felt in a player\'s match rating', () => {
    const p = careerPlayer(career());
    const low = matchRating({ ...p, morale: 15, fitness: 100 });
    const settled = matchRating({ ...p, morale: 70, fitness: 100 });
    expect(settled / low).toBeGreaterThan(1.06);
  });
});

describe('depression', () => {
  function low(weeks: number) {
    const game = career();
    const p = careerPlayer(game);
    const rng = new Rng(7);
    for (let i = 0; i < weeks && !game.career!.retired; i++) {
      p.morale = 15;
      moodWeekly(game, rng);
    }
    return { game, p, rng };
  }

  it('comes after weeks of low morale, not after one', () => {
    expect(low(2).game.career!.depressed).toBeFalsy();
    expect(low(5).game.career!.depressed).toBe(true);
  });

  it('can end a career if nothing changes', () => {
    const { game } = low(120);
    expect(game.career!.retired).toBe(true);
    expect(game.career!.endReason).toMatch(/mental health/);
  });

  it('lifts with help', () => {
    const { game, p, rng } = low(6);
    game.career!.money = 100000;
    game.career!.energy = 100;
    for (let i = 0; i < 3; i++) lifeAction(game, 'therapy');
    expect(p.morale).toBeGreaterThanOrEqual(45);
    moodWeekly(game, rng);
    expect(game.career!.depressed).toBe(false);
  });

  it('costs money you must have', () => {
    const game = career();
    game.career!.money = 500;
    expect(lifeAction(game, 'therapy').ok).toBe(false);
  });
});

describe('match history', () => {
  const record = (over: Partial<MatchRecord>): MatchRecord => ({ teamId: 'a', season: 2026, week: 1, comp: 'League', homeId: 'a', awayId: 'b', homeGoals: 1, awayGoals: 1, ...over });

  it('reads a result from the user\'s side', () => {
    expect(resultFor(record({ homeGoals: 2 }))).toBe('W');
    expect(resultFor(record({ teamId: 'b', homeGoals: 2 }))).toBe('L');
    expect(resultFor(record({}))).toBe('D');
    expect(resultFor(record({ penaltyWinner: 'b' }))).toBe('L');
    expect(resultFor(record({ penaltyWinner: 'a' }))).toBe('W');
  });

  it('keeps a bounded log', () => {
    const game = career();
    const f = { id: 'f', week: 1, homeId: 'a', awayId: 'b', played: true, homeGoals: 0, awayGoals: 0, scorers: [] };
    const s = { home: { goals: 1, usedIds: [] }, away: { goals: 0, usedIds: [] }, ratings: {}, goals: {}, assists: {} } as unknown as MatchState;
    for (let i = 0; i < 900; i++) logMatch(game, f, s, 'a');
    expect(game.matchLog!.length).toBe(800);
    expect(game.matchLog![0].homeGoals).toBe(1);
  });
});

describe('dribbling', () => {
  it('never hands out the nutmeg game unless it is learned', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(dribblePick([], null, seed)).not.toBe('gap');
      expect(dribblePick(undefined, null, seed)).not.toBe('gap');
      expect(dribblePick([], 'nutmeg', seed)).not.toBe('gap');
      expect(dribblePick(['stepover'], 'nutmeg', seed)).not.toBe('gap');
    }
    expect(dribblePick(['nutmeg'], 'nutmeg', 0)).toBe('gap');
  });
});

import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, createMatch, passIsBetter, quickSim, resolveMoment, simToEnd, spamCost, stepMinute } from '../../src/engine/match';
import { Fixture } from '../../src/engine/types';

const world = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 5 }).world;

function tie(w: ReturnType<typeof world>, i: number, extra: Partial<Fixture> = {}): Fixture {
  const clubs = Object.values(w.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
  return { id: `k${i}`, week: 1, homeId: clubs[i % clubs.length].id, awayId: clubs[(i + 1) % clubs.length].id, played: false, homeGoals: 0, awayGoals: 0, scorers: [], stage: 'Final', ...extra };
}

describe('a knockout tie', () => {
  const w = world();
  const games = Array.from({ length: 120 }, (_, i) => quickSim(w, tie(w, i), 500 + i));
  const extra = games.filter((s) => s.extraTime);

  it('goes to extra time when level, and only then', () => {
    expect(extra.length).toBeGreaterThan(10);
    for (const s of games) {
      if (!s.extraTime) expect(s.home.goals).not.toBe(s.away.goals);
      else expect(s.minute).toBeGreaterThanOrEqual(120);
    }
  });

  it('settles level games on penalties and leaves none drawn', () => {
    for (const s of games) {
      expect(s.finished).toBe(true);
      if (s.home.goals !== s.away.goals) expect(s.penaltyWinner).toBeUndefined();
      else {
        expect(s.shootout).toBeDefined();
        expect(s.penaltyWinner).toBe(s.shootout!.h > s.shootout!.a ? s.home.clubId : s.away.clubId);
      }
    }
    expect(games.some((s) => s.shootout)).toBe(true);
  });

  it('stops a shoot-out once one side cannot be caught', () => {
    for (const s of games.filter((g) => g.shootout)) {
      const kicks = s.events.filter((e) => /Penalties: /.test(e.text));
      expect(kicks.length).toBeGreaterThanOrEqual(6);
      if (s.shootout!.round <= 5) expect(kicks.length).toBeLessThanOrEqual(10);
      else expect(kicks.length).toBe(s.shootout!.round * 2);
    }
  });

  it('never counts a shoot-out kick as a goal', () => {
    for (const s of games) expect(s.scorers.length).toBe(s.home.goals + s.away.goals);
  });

  it('gives each side one more substitute in extra time', () => {
    for (const s of extra) expect(s.laws.maxSubs).toBeGreaterThanOrEqual(4);
  });

  it('leaves a league game drawn', () => {
    const drawn = Array.from({ length: 60 }, (_, i) => quickSim(w, tie(w, i, { stage: undefined }), 900 + i)).filter((s) => s.home.goals === s.away.goals);
    expect(drawn.length).toBeGreaterThan(0);
    for (const s of drawn) {
      expect(s.extraTime).toBeUndefined();
      expect(s.penaltyWinner).toBeUndefined();
    }
  });
});

describe('the user in a shoot-out', () => {
  function toShootout(): { game: ReturnType<typeof newCareerGame>; s: MatchState } {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 12 });
    const s = startUserMatch(game)!;
    s.knockout = true;
    // Force a level game at the end of extra time, with him on the pitch.
    const id = game.career!.playerId;
    if (!s.home.onPitch.includes(id) && !s.away.onPitch.includes(id)) s.home.onPitch[s.home.onPitch.length - 1] = id;
    for (let i = 0; i < 400 && !s.pending && !s.finished; i++) {
      s.home.goals = 0;
      s.away.goals = 0;
      s.scorers = [];
      s.minute = Math.max(s.minute, s.extraTime ? 200 : 100);
      stepMinute(game.world, s);
      s.pending = s.shootout ? s.pending : null;
    }
    return { game, s };
  }

  it('stops for his kick and carries on after it', () => {
    const { game, s } = toShootout();
    expect(s.pending?.shootout).toBe(true);
    expect(s.finished).toBe(false);
    const before = s.home.goals + s.away.goals;
    resolveMoment(game.world, s, null, undefined, undefined, { forced: 'goal' });
    simToEnd(game.world, s);
    expect(s.finished).toBe(true);
    expect(s.penaltyWinner).toBeDefined();
    expect(s.home.goals + s.away.goals).toBe(before);
    expect(s.events.some((e) => e.played && /scores\. Penalties/.test(e.text))).toBe(true);
  });
});

describe('shooting again and again', () => {
  it('costs more each time until a pass clears it', () => {
    const w = world();
    const s = createMatch(w, tie(w, 1), {}, 3);
    expect(spamCost(s)).toBe(0);
    s.spam = 2;
    expect(spamCost(s)).toBeCloseTo(0.1);
    s.spam = 9;
    expect(spamCost(s)).toBeCloseTo(0.15);
  });

  it('says a pass is better from far out, or after a shot', () => {
    const w = world();
    const s = createMatch(w, tie(w, 1), {}, 3);
    const m = { kind: 'choice', side: 'home', minute: 1, actorId: 'x', keeperId: 'y', bonus: 0, choices: ['shot', 'pass'], view: 'box' } as const;
    const moment = { ...m, choices: [...m.choices] };
    expect(passIsBetter(s, moment)).toBe(false);
    expect(passIsBetter(s, { ...moment, view: 'outside' })).toBe(true);
    s.spam = 1;
    expect(passIsBetter(s, moment)).toBe(true);
    expect(passIsBetter(s, { ...moment, view: 'oneonone' })).toBe(false);
  });
});

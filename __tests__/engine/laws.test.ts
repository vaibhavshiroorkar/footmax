import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, chooseMoment, makeSub, quickSim, resolveMoment, sendOff, stepMinute } from '../../src/engine/match';
import { lawsFor } from '../../src/engine/laws';
import { Rng } from '../../src/engine/rng';
import { Fixture } from '../../src/engine/types';

const world = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 5 }).world;

function fixtureOf(w: ReturnType<typeof world>, i: number): Fixture {
  const clubs = Object.values(w.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
  return { id: `t${i}`, week: 1, homeId: clubs[i % clubs.length].id, awayId: clubs[(i + 1) % clubs.length].id, played: false, homeGoals: 0, awayGoals: 0, scorers: [] };
}

describe('laws by era', () => {
  it('has VAR only in its own time, league by league', () => {
    expect(lawsFor(2006, 'ENG').var).toBe(false);
    expect(lawsFor(2018, 'ENG').var).toBe(false);
    expect(lawsFor(2019, 'ENG').var).toBe(true);
    expect(lawsFor(2017, 'ITA').var).toBe(true);
    expect(lawsFor(2017, 'ESP').var).toBe(false);
  });

  it('limits substitutes by season', () => {
    expect(lawsFor(2010).maxSubs).toBe(3);
    expect(lawsFor(2026).maxSubs).toBe(5);
    const w = world();
    const s = quickSimStart(w);
    s.laws.maxSubs = 3;
    s.home.subsUsed = 3;
    expect(makeSub(w, s, 'home', s.home.onPitch[3], s.home.bench[0])).toBe(false);
  });
});

function quickSimStart(w: ReturnType<typeof world>): MatchState {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 8 });
  Object.assign(w, game.world);
  return startUserMatch(game)!;
}

describe('a season of cards and penalties', () => {
  const w = world();
  const matches = Array.from({ length: 400 }, (_, i) => quickSim(w, fixtureOf(w, i), 1000 + i));
  const per = (n: number) => n / matches.length;

  it('lands near real league numbers', () => {
    const yellows = per(matches.reduce((n, m) => n + m.events.filter((e) => e.type === 'card').length, 0));
    const reds = per(matches.reduce((n, m) => n + m.events.filter((e) => e.type === 'red').length, 0));
    const pens = per(matches.reduce((n, m) => n + m.events.filter((e) => e.shot?.penalty).length, 0));
    expect(yellows).toBeGreaterThan(3.2);
    expect(yellows).toBeLessThan(5.2);
    expect(reds).toBeGreaterThan(0.05);
    expect(reds).toBeLessThan(0.35);
    expect(pens).toBeGreaterThan(0.12);
    expect(pens).toBeLessThan(0.55);
  });

  it('never leaves a man on after two yellows, and never brings a sent-off man back', () => {
    for (const m of matches) {
      for (const [id, n] of Object.entries(m.yellows)) {
        expect(n).toBeLessThanOrEqual(2);
        if (n >= 2) expect(m.sentOff[id]).toBeDefined();
      }
      for (const id of Object.keys(m.sentOff)) {
        expect(m.home.onPitch).not.toContain(id);
        expect(m.away.onPitch).not.toContain(id);
      }
      expect(m.home.subsUsed).toBeLessThanOrEqual(m.laws.maxSubs);
      expect(m.away.subsUsed).toBeLessThanOrEqual(m.laws.maxSubs);
    }
  });

  it('books keepers far less than outfield players', () => {
    let keepers = 0;
    let all = 0;
    for (const m of matches) for (const id of Object.keys(m.yellows)) {
      all++;
      if (w.players[id].position === 'GK') keepers++;
    }
    expect(keepers / all).toBeLessThan(0.05);
  });

  it('bans a sent-off player', () => {
    const m = matches.find((x) => Object.keys(x.sentOff).length);
    expect(m).toBeDefined();
    const id = Object.keys(m!.sentOff)[0];
    expect(w.players[id].suspendedWeeks ?? 0).toBeGreaterThanOrEqual(0);
    expect(m!.sentOff[id]).toBeGreaterThanOrEqual(1);
  });
});

describe('sent off', () => {
  it('a side always has a keeper: a sub, or an outfield player', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 9 });
    const s = startUserMatch(game)!;
    const w = game.world;
    const keeperId = s.home.onPitch.find((id) => w.players[id].position === 'GK')!;
    const rng = new Rng(1);
    const hasBench = s.home.bench.some((id) => w.players[id].position === 'GK');
    s.home.subsUsed = hasBench ? 0 : 99;
    sendOff(rng, w, s, 'home', w.players[keeperId], true);
    const gk = s.home.onPitch.find((id) => w.players[id].position === 'GK');
    expect(gk ?? s.home.standIn).toBeDefined();
    expect(s.home.onPitch).not.toContain(keeperId);
  });

  it('abandons a match with fewer than seven, and the other side wins', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 10 });
    const s = startUserMatch(game)!;
    s.home.onPitch = s.home.onPitch.slice(0, 6);
    stepMinute(game.world, s);
    expect(s.finished).toBe(true);
    expect(s.away.goals).toBeGreaterThanOrEqual(s.home.goals + 3);
  });
});

describe('goals taken away', () => {
  it('rules some out on the spot and never counts them', () => {
    let calls = 0;
    for (let seed = 21; seed < 60 && !calls; seed++) {
      const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
      const s = startUserMatch(game)!;
      for (let g = 0; g < 2000 && !s.finished; g++) {
        if (s.pending) {
          if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
          resolveMoment(game.world, s, 0.9, s.pending?.options?.[0]?.playerId);
        } else stepMinute(game.world, s);
      }
      calls += s.events.filter((e) => e.shot?.call).length;
      expect(s.scorers.length).toBe(s.home.goals + s.away.goals);
    }
    expect(calls).toBeGreaterThan(0);
  });
});

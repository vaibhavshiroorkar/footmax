import { finishUserMatch, newCareerGame, newManagerGame, skipWeek, startUserMatch } from '../../src/engine/game';
import { MatchState, chooseMoment, commitMatch, quickSim, resolveMoment, shootInstead, simToEnd, stepMinute } from '../../src/engine/match';
import { startEurope } from '../../src/engine/europe';
import { flyShot } from '../../src/engine/contact';
import { unlockNode } from '../../src/engine/career';
import { allNodes } from '../../src/engine/skillTree';
import { PlayStep, nextStart } from '../../src/engine/play';
import { Rng } from '../../src/engine/rng';
import { deserialize, serialize } from '../../src/engine/save';
import { ROLE_LIST } from '../../src/engine/roles';
import { Fixture, Game } from '../../src/engine/types';

const career = (seed: number, role = 'ST') => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: role as never, seed });

describe('every kind of moment survives every way of playing it', () => {
  it.each(ROLE_LIST)('a %s can skip every moment and still finish', (role) => {
    for (const seed of [401, 402, 403]) {
      const game = career(seed, role);
      const s = startUserMatch(game);
      if (!s) continue;
      for (let i = 0; i < 3000 && !s.finished; i++) {
        if (s.pending) resolveMoment(game.world, s, null);
        else stepMinute(game.world, s);
      }
      expect(s.finished).toBe(true);
      expect(s.pending).toBeNull();
    }
  });

  it('a match left half way sims to the end', () => {
    for (const seed of [411, 412, 413, 414]) {
      const game = career(seed);
      const s = startUserMatch(game)!;
      for (let i = 0; i < 40 && !s.finished; i++) {
        if (s.pending) break;
        stepMinute(game.world, s);
      }
      simToEnd(game.world, s);
      expect(s.finished).toBe(true);
    }
  });

  it('a skipped shot from halfway is as hard as a played one', () => {
    let goals = 0;
    let shots = 0;
    for (let seed = 420; seed < 520; seed++) {
      const game = career(seed);
      const s = startUserMatch(game);
      if (!s) continue;
      const me = game.career!.playerId;
      const side = s.home.onPitch.includes(me) ? 'home' : s.away.onPitch.includes(me) ? 'away' : null;
      if (!side) continue;
      s.pending = { side, minute: 20, keeperId: s[side === 'home' ? 'away' : 'home'].onPitch[0], actorId: me, bonus: 0, kind: 'shot', view: 'long', metres: 52, range: 1 };
      const before = s[side].goals;
      resolveMoment(game.world, s, null);
      shots++;
      if (s[side].goals > before) goals++;
    }
    expect(shots).toBeGreaterThan(40);
    expect(goals / shots).toBeLessThan(0.08);
  });
});

describe('manager mode', () => {
  it('plays a whole season with Europe and the new shapes', () => {
    const world = career(4401).world;
    const club = Object.values(world.clubs).find((c) => c.leagueId && c.reputation > 85)!;
    const game = newManagerGame(world, club.id, null, 'A B');
    let guard = 0;
    const season = game.world.season;
    while (game.world.season === season && guard++ < 140) skipWeek(game);
    expect(game.world.season).toBe(season + 1);
    expect(game.world.honours.some((h) => h.title === 'Champions League winners')).toBe(true);
  });
});

describe('fixes from the code review', () => {
  it('a Champions League draw never double-books a club, whatever the seed', () => {
    const game = career(600);
    for (let seed = 1; seed <= 12; seed++) {
      startEurope(game.world, new Rng(seed), null);
      const e = game.world.europe!;
      for (const id of e.clubs) {
        const weeks = e.fixtures.filter((f) => f.homeId === id || f.awayId === id).map((f) => f.week);
        expect(weeks.length).toBe(8);
        expect(new Set(weeks).size).toBe(8);
      }
    }
  });

  it('a flare-up that ends in bookings does not send off the man just booked', () => {
    const world = career(610).world;
    const clubs = Object.values(world.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
    let booked = 0;
    for (let i = 0; i < 500 && booked < 2; i++) {
      const f: Fixture = { id: `b${i}`, week: 1, homeId: clubs[i % clubs.length].id, awayId: clubs[(i + 1) % clubs.length].id, played: false, homeGoals: 0, awayGoals: 0, scorers: [] };
      const m = quickSim(world, f, 7000 + i);
      for (const c of [clubs[i % clubs.length], clubs[(i + 1) % clubs.length]]) for (const id of c.playerIds) Object.assign(world.players[id], { suspendedWeeks: 0, injuryWeeks: 0 });
      const at = m.events.findIndex((e) => /books them both/.test(e.text));
      if (at < 0) continue;
      booked++;
      // Straight after the row, nobody is sent off for it unless already on a yellow.
      const after = m.events.slice(at + 1, at + 3).filter((e) => e.type === 'red');
      expect(after.length).toBeLessThanOrEqual(1);
    }
    expect(booked).toBeGreaterThan(0);
  });

  it('a stoppage survives a flare-up', () => {
    const steps: PlayStep[] = [
      { x: 0.4, y: 0.5, carrier: 'd', side: 'home', act: 'foul', other: 'a', restart: 'freekick' },
      { x: 0.4, y: 0.5, carrier: 'd', side: 'home', act: 'card', card: 'yellow' },
      { x: 0.4, y: 0.5, carrier: 'd', other: 'a', side: 'home', act: 'brawl', fight: 'calm' },
    ];
    expect(nextStart(steps, { x: 0.5, y: 0.5 }).restart).toBe('freekick');
  });

  it('a shot from far out is a long shot however it came about', () => {
    const game = career(620);
    const s = startUserMatch(game)!;
    const me = game.career!.playerId;
    s.ball = { x: 0.5, y: 0.5 };
    s.pending = { side: 'home', minute: 20, keeperId: s.away.onPitch[0], actorId: me, bonus: 0, kind: 'pass', options: [] };
    shootInstead(s);
    expect(s.pending?.view).toBe('long');
    expect(s.pending?.metres).toBeGreaterThan(50);
  });

  it('a one-star weak foot can still buy the first star', () => {
    const game = career(621);
    const p = game.world.players[game.career!.playerId];
    p.weakFoot = 1;
    p.attrs.composure = 99;
    game.career!.skillPoints = 9;
    const star = allNodes(p).find((n) => n.kind === 'foot' && n.stars === 3)!;
    expect(unlockNode(game, star.id).ok).toBe(true);
  });

  it('a finishing edge beats the keeper more on shots that are played', () => {
    const rng = new Rng(8);
    const rate = (edge: number) => {
      let g = 0;
      for (let i = 0; i < 4000; i++) if (flyShot({ aim: 0.7, height: 0.4, flight: 0.6, keeper: { at: 0.5, skill: 60, edge }, rand: () => rng.next() }).outcome === 'goal') g++;
      return g;
    };
    expect(rate(0.15)).toBeGreaterThan(rate(0));
  });

  it('a ban from a midweek game costs the games it says', () => {
    const game = career(622);
    const s = startUserMatch(game)!;
    const id = s.away.onPitch[3];
    s.sentOff[id] = 1;
    s.finished = true;
    const f: Fixture = { id: 'x', week: 1, homeId: s.home.clubId, awayId: s.away.clubId, played: false, homeGoals: 0, awayGoals: 0, scorers: [], europe: true };
    commitMatch(game.world, s, f);
    expect(game.world.players[id].suspendedWeeks).toBe(1);
  });
});

describe('saves', () => {
  const season = (game: Game, weeks: number) => {
    for (let i = 0; i < weeks * 2; i++) skipWeek(game);
  };

  it('keep everything new through a save and load', () => {
    const game = career(430);
    season(game, 8);
    const me = game.world.players[game.career!.playerId];
    game.career!.moveTraining = { id: 'stepover', weeksLeft: 2, weeks: 3 };
    me.roles = ['CF', 'LW'];
    me.tree = ['pace.a'];
    const back = deserialize(serialize(game))!;
    expect(back).not.toBeNull();
    const p = back.world.players[back.career!.playerId];
    expect(p.roles).toEqual(['CF', 'LW']);
    expect(p.tree).toEqual(['pace.a']);
    expect(back.career!.moveTraining?.id).toBe('stepover');
    expect(back.world.europe?.clubs.length).toBe(game.world.europe?.clubs.length);
    expect(back.world.europe?.fixtures.length).toBe(game.world.europe?.fixtures.length);
  });

  it('a loaded game plays on', () => {
    const game = career(431);
    season(game, 6);
    const back = deserialize(serialize(game))!;
    const week = back.world.week;
    for (let i = 0; i < 6; i++) skipWeek(back);
    expect(back.world.week).toBeGreaterThan(week);
  });
});

describe('a match finishes properly after every late addition', () => {
  it('commits a played match with a ban, a sub and a shape change', () => {
    const game = career(432);
    const s: MatchState | null = startUserMatch(game);
    if (!s) return;
    for (let i = 0; i < 3000 && !s.finished; i++) {
      if (s.pending) {
        if (s.pending.kind === 'choice') chooseMoment(game.world, s, s.pending.choices?.[0] ?? 'shot');
        resolveMoment(game.world, s, 0.5, s.pending?.options?.[0]?.playerId);
      } else stepMinute(game.world, s);
    }
    const r = finishUserMatch(game, s);
    expect(r).toBeDefined();
    expect(game.world.pendingMatch).toBeUndefined();
  });
});

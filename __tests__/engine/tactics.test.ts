import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, POOR_RATING, quickSim, setFormation, stepMinute } from '../../src/engine/match';
import { FORMATIONS, autoLineup, teamById } from '../../src/engine/lineup';
import { assignSlots } from '../../src/engine/play';
import { FORMATION_LEAN, FORMATION_SLOTS } from '../../src/engine/roles';
import { Formation, Fixture } from '../../src/engine/types';

const game = () => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 4 });
const shapes = Object.keys(FORMATIONS) as Formation[];

describe('formations', () => {
  it('has twelve shapes, each a legal eleven', () => {
    expect(shapes.length).toBe(12);
    for (const f of shapes) {
      const c = FORMATIONS[f];
      expect(c.GK + c.DEF + c.MID + c.FWD).toBe(11);
      expect(FORMATION_SLOTS[f].flat().length).toBe(10);
      expect(FORMATION_LEAN[f]).toBeDefined();
      expect(f.split('-').map(Number).reduce((a, b) => a + b, 0)).toBe(10);
      expect(f.split('-').map(Number)).toEqual(FORMATION_SLOTS[f].map((r) => r.length));
    }
  });

  it('puts a full eleven in place for every shape', () => {
    const g = game();
    const club = Object.values(g.world.clubs).find((c) => c.leagueId && c.playerIds.length >= 20)!;
    for (const f of shapes) {
      const team = { ...club, formation: f };
      const xi = autoLineup(g.world, team);
      expect(xi.length).toBe(11);
      const slots = assignSlots(g.world, team, xi);
      expect(Object.keys(slots).length).toBe(11);
      expect(xi.filter((id) => g.world.players[id].position === 'GK').length).toBe(1);
    }
  });

  it('a change in a match stays in that match', () => {
    const g = game();
    const s = startUserMatch(g)!;
    const before = teamById(g.world, s.home.clubId).formation;
    setFormation(g.world, s, 'home', before === '5-4-1' ? '3-4-3' : '5-4-1');
    expect(s.home.formation).not.toBe(before);
    expect(teamById(g.world, s.home.clubId).formation).toBe(before);
  });
});

describe('coaches at half time', () => {
  it('go for it when behind and shut up shop when well ahead', () => {
    const g = game();
    const clubs = Object.values(g.world.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
    let up = 0;
    let down = 0;
    for (let i = 0; i < 400; i++) {
      const f: Fixture = { id: `x${i}`, week: 1, homeId: clubs[i % clubs.length].id, awayId: clubs[(i + 1) % clubs.length].id, played: false, homeGoals: 0, awayGoals: 0, scorers: [] };
      const m = quickSim(g.world, f, 300 + i);
      for (const c of [clubs[i % clubs.length], clubs[(i + 1) % clubs.length]]) for (const id of c.playerIds) Object.assign(g.world.players[id], { suspendedWeeks: 0, injuryWeeks: 0 });
      for (const side of [m.home, m.away]) {
        const was = FORMATION_LEAN[teamById(g.world, side.clubId).formation];
        const now = FORMATION_LEAN[side.formation];
        if (now > was) up++;
        if (now < was) down++;
      }
    }
    expect(up).toBeGreaterThan(10);
    expect(down).toBeGreaterThan(3);
  });
});

describe('being taken off', () => {
  // Plays to the hour with the user's rating held where the test wants it.
  const hookedAt = (rating: number, seed: number) => {
    const g = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
    const s: MatchState | null = startUserMatch(g);
    const me = g.career!.playerId;
    if (!s || ![...s.home.onPitch, ...s.away.onPitch].includes(me)) return null;
    for (let i = 0; i < 400 && s.minute < 82 && !s.finished; i++) {
      s.pending = null;
      s.ratings[me] = rating;
      s.goals[me] = 0;
      s.assists[me] = 0;
      stepMinute(g.world, s);
    }
    return !!s.hooked;
  };

  it('happens to a poor player, and never to a good one', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => 200 + i);
    const poor = seeds.map((x) => hookedAt(POOR_RATING - 1, x)).filter((v) => v !== null);
    const good = seeds.map((x) => hookedAt(7.2, x)).filter((v) => v !== null);
    expect(poor.filter(Boolean).length).toBeGreaterThan(poor.length * 0.3);
    expect(good.filter(Boolean).length).toBe(0);
  });
});

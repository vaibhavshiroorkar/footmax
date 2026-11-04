import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, Zone, chooseMoment, resolveMoment, shout, stepMinute, takeAction } from '../../src/engine/match';
import { teamById } from '../../src/engine/lineup';
import { PlayStep, formationSpots } from '../../src/engine/play';
import { Game } from '../../src/engine/types';
import { Role } from '../../src/engine/roles';
import { PL, PW, PitchSim } from '../../src/ui/pitchSim';

// Plays a whole match through the pitch the way the match screen does:
// a new minute only when the pitch is idle, each move queued once (by the
// identity of the engine's array), and calls made in the middle of moves.
function watch(seed: number, role: Role = 'ST', zone?: Zone) {
  const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role, seed });
  const s: MatchState = startUserMatch(game)!;
  s.zone = zone;
  const sim = new PitchSim();
  const sync = () =>
    sim.sync(
      (['home', 'away'] as const).flatMap((side) => {
        const team = teamById(game.world, s[side].clubId);
        const spots = formationSpots(game.world, team, s[side].onPitch);
        return s[side].onPitch.map((id) => ({ id, side, spot: spots[id], pos: game.world.players[id].position, pace: game.world.players[id].attrs.pace, name: id }));
      }),
    );
  sync();
  let shownGoals = 0;
  const keeperGaps: { kind: 'goal' | 'save'; gap: number }[] = [];
  const defendingKeeper = (attacking: 'home' | 'away') => [...sim.bodies.values()].find((b) => b.pos === 'GK' && b.side !== attacking);
  sim.setHooks({
    onGoal: () => {
      shownGoals++;
      const step = sim.act?.step;
      const k = step ? defendingKeeper(step.side) : undefined;
      if (k) keeperGaps.push({ kind: 'goal', gap: Math.hypot(k.x - sim.ball.x, k.y - sim.ball.y) });
    },
  });
  let queued: PlayStep[] | undefined;
  let queuedCount = 0;
  let lastCallout: unknown = null;
  const enqueue = () => {
    if (s.play && s.play !== queued) {
      queued = s.play;
      queuedCount++;
      sim.enqueue(s.play.map((x) => ({ ...x })));
    }
  };
  for (let frame = 0; frame < 60000 && !s.finished; frame++) {
    if (sim.holding && s.pending) {
      if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
      resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
      enqueue();
    } else if (sim.idle()) {
      if (s.minute === 46) sim.halfTime('away');
      stepMinute(game.world, s);
      sync();
      enqueue();
    }
    // Calls in the middle of a move add events but must not replay it.
    if (frame % 700 === 0) {
      shout(game.world, s, 'run');
      enqueue();
    }
    sim.update(0.05);
    if (sim.callout !== lastCallout) {
      lastCallout = sim.callout;
      if (sim.callout?.text === 'SAVED!') {
        // Where the ball met him: the start of the parry, or the ball itself.
        const f = sim.ball.flight;
        const bx = f ? f.fx : sim.ball.x;
        const by = f ? f.fy : sim.ball.y;
        const k = [...sim.bodies.values()].find((b) => b.pos === 'GK' && Math.abs(b.y - (by < PL / 2 ? 0 : PL)) < 6);
        if (k) keeperGaps.push({ kind: 'save', gap: Math.hypot(k.x - bx, k.y - by) });
      }
    }
  }
  return { s, shownGoals, keeperGaps, queuedCount };
}

describe('live pitch', () => {
  // A striker up front, plus a centre-back and a midfielder in their own
  // zones, so the defending and midfield moments are on the pitch too.
  const runs = [watch(11), watch(12), watch(13), watch(14, 'CB', 'defend'), watch(15, 'CM', 'middle')];

  it('shows every goal exactly once, even with calls in the middle of moves', () => {
    for (const r of runs) {
      expect(r.s.finished).toBe(true);
      expect(r.shownGoals).toBe(r.s.scorers.length);
    }
  });

  it('puts the keeper on the ball for a save and leaves him beaten for a goal', () => {
    const gaps = runs.flatMap((r) => r.keeperGaps);
    const saves = gaps.filter((g) => g.kind === 'save');
    const goals = gaps.filter((g) => g.kind === 'goal');
    expect(saves.length).toBeGreaterThan(0);
    expect(goals.length).toBeGreaterThan(0);
    for (const g of saves) expect(g.gap).toBeLessThan(1.5);
    for (const g of goals) expect(g.gap).toBeGreaterThan(1);
  });
});

describe('aimed shots on the pitch', () => {
  // The shooter's left post: low x when attacking up the pitch (home), high
  // x when attacking down it (away).
  const shoot = (side: 'home' | 'away', aim: number) => {
    const sim = new PitchSim();
    const spot = { depth: 0.5, lat: 0.5 };
    sim.sync([
      { id: 's', side, spot, pos: 'FWD', pace: 70, name: 's' },
      { id: 'k', side: side === 'home' ? 'away' : 'home', spot: { depth: 0.04, lat: 0.5 }, pos: 'GK', pace: 50, name: 'k' },
    ]);
    sim.layout = 'play';
    sim.ball.owner = 's';
    sim.enqueue([{ x: 0.5, y: side === 'home' ? 1 : 0, carrier: null, side, act: 'goal', aim }]);
    sim.update(0.01);
    return sim.ball.flight!.tx;
  };
  it('goes to the side the user aimed, whichever way the team attacks', () => {
    expect(shoot('home', 0.1)).toBeLessThan(PW / 2);
    expect(shoot('home', 0.9)).toBeGreaterThan(PW / 2);
    expect(shoot('away', 0.1)).toBeGreaterThan(PW / 2);
    expect(shoot('away', 0.9)).toBeLessThan(PW / 2);
  });
});

describe('shots fly at the goal the shooter attacks', () => {
  // A tipped save and a deflected miss name the attackers, who take the
  // corner. They once read as the defending side and flew the other way.
  const flight = (side: 'home' | 'away', step: Partial<PlayStep>) => {
    const sim = new PitchSim();
    const other = side === 'home' ? 'away' : 'home';
    sim.sync([
      { id: 's', side, spot: { depth: 0.8, lat: 0.5 }, pos: 'FWD', pace: 70, name: 's' },
      { id: 'k', side: other, spot: { depth: 0.04, lat: 0.5 }, pos: 'GK', pace: 50, name: 'k' },
      { id: 'mine', side, spot: { depth: 0.04, lat: 0.5 }, pos: 'GK', pace: 50, name: 'mine' },
    ]);
    sim.layout = 'play';
    sim.ball.owner = 's';
    sim.enqueue([{ x: 0.5, y: side === 'home' ? 1 : 0, carrier: 'k', side, act: 'save', ...step }]);
    sim.update(0.01);
    return { ty: sim.ball.flight!.ty, keeper: sim.act?.keeperId };
  };
  it.each(['home', 'away'] as const)('for %s, whatever the restart', (side) => {
    const goal = side === 'home' ? PL : 0;
    const other = side === 'home' ? 'away' : 'home';
    const shots: Partial<PlayStep>[] = [
      { act: 'save', restart: 'corner' },
      { act: 'miss', restart: 'corner', carrier: null },
      { act: 'save', side: other },
      { act: 'miss', side: other, restart: 'goalkick', carrier: null },
      { act: 'goal', carrier: null },
    ];
    for (const shot of shots) {
      const { ty, keeper } = flight(side, shot);
      expect(Math.abs(ty - goal)).toBeLessThan(PL / 2);
      expect(keeper).toBe('k');
    }
  });
});

describe('acting on the ball', () => {
  it('lets the user shoot, pass or dribble from where the ball is', () => {
    const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 21 });
    const s: MatchState = startUserMatch(game)!;
    const me = game.career!.playerId;
    const side = s.home.onPitch.includes(me) ? 'home' : s.away.onPitch.includes(me) ? 'away' : null;
    if (!side) {
      // On the bench: nothing to act on.
      expect(takeAction(game.world, s, 'shot', { x: 0.5, y: 0.5 })).toBe(false);
      return;
    }
    const far = side === 'home' ? 0.4 : 0.6;
    expect(takeAction(game.world, s, 'shot', { x: 0.5, y: far })).toBe(true);
    expect(s.pending?.kind).toBe('shot');
    expect(s.pending?.view).toBe('outside');
    expect(s.pending?.range).toBeGreaterThan(0.5);
    resolveMoment(game.world, s, 0.5, undefined, undefined, { forced: 'miss', aim: 1.3 });
    expect(s.pending).toBeNull();
    expect(takeAction(game.world, s, 'pass', { x: 0.5, y: 0.5 })).toBe(true);
    expect(s.pending?.options?.length).toBeGreaterThan(1);
  });
});

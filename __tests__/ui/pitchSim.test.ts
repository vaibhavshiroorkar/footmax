import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, chooseMoment, resolveMoment, shout, stepMinute } from '../../src/engine/match';
import { teamById } from '../../src/engine/lineup';
import { PlayStep, formationSpots } from '../../src/engine/play';
import { Game } from '../../src/engine/types';
import { PL, PitchSim } from '../../src/ui/pitchSim';

// Plays a whole match through the pitch the way the match screen does:
// a new minute only when the pitch is idle, each move queued once (by the
// identity of the engine's array), and calls made in the middle of moves.
function watch(seed: number) {
  const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  const s: MatchState = startUserMatch(game)!;
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
  const runs = [11, 12, 13].map(watch);

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

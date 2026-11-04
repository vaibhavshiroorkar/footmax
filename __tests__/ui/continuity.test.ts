import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { chooseMoment, placeMoment, resolveMoment } from '../../src/engine/match';
import { teamById } from '../../src/engine/lineup';
import { moveToShow, stepWatched } from '../../src/engine/pace';
import { PlayStep, formationSpots } from '../../src/engine/play';
import { PL, PW, PitchSim } from '../../src/ui/pitchSim';

// Plays a match the way the screen does and watches what is on the pitch.
function watch(seed: number, onFrame: (sim: PitchSim, half: boolean) => void, onMoment?: (sim: PitchSim, actor: string) => void) {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  const s = startUserMatch(game)!;
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
  let queued: PlayStep[] | undefined;
  const enqueue = () => {
    const steps = moveToShow(s);
    if (steps && steps !== queued) {
      queued = steps;
      sim.enqueue(steps.map((x) => ({ ...x })));
    }
  };
  for (let f = 0; f < 80000 && !s.finished; f++) {
    let half = false;
    if (sim.holding && s.pending) {
      placeMoment(s, { x: sim.ball.x / PW, y: sim.ball.y / PL });
      onMoment?.(sim, s.pending.actorId);
      if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
      resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
      enqueue();
    } else if (sim.idle()) {
      if (s.minute === 46) {
        sim.halfTime('away');
        half = true;
      }
      stepWatched(game.world, s, sim.pitchSeconds(), sim.positions());
      sync();
      enqueue();
    }
    sim.update(1 / 60);
    onFrame(sim, half);
  }
  return s;
}

describe('continuity on the pitch', () => {
  it('never jumps the ball', () => {
    for (const seed of [71, 72]) {
      let x = PW / 2;
      let y = PL / 2;
      let worst = 0;
      watch(seed, (sim, half) => {
        const d = Math.hypot(sim.ball.x - x, sim.ball.y - y);
        if (!half && !sim.ball.flight) worst = Math.max(worst, d);
        x = sim.ball.x;
        y = sim.ball.y;
      });
      expect(worst).toBeLessThan(3.2);
    }
  });

  it('keeps every keeper between his posts until the ball is near', () => {
    watch(73, (sim) => {
      for (const b of sim.bodies.values()) {
        if (b.pos !== 'GK' || sim.layout !== 'play' || sim.celebrate) continue;
        const ownGoal = b.side === 'home' ? 0 : PL;
        const far = Math.hypot(sim.ball.x - PW / 2, sim.ball.y - ownGoal) > 35;
        if (far) expect(Math.abs(b.x - PW / 2)).toBeLessThan(5);
      }
    });
  });

  it('draws the shot from the pitch: the keeper where he stands, the men in the way', () => {
    let checked = 0;
    watch(74, () => undefined, (sim, actor) => {
      const scene = sim.shotScene(actor);
      expect(scene.keeper).toBeGreaterThanOrEqual(0.12);
      expect(scene.keeper).toBeLessThanOrEqual(0.88);
      const me = sim.bodies.get(actor)!;
      const goal = me.side === 'home' ? PL : 0;
      for (const lane of sim.laneDefenders(actor)) {
        const man = sim.bodies.get(lane.id)!;
        expect(man.side).not.toBe(me.side);
        expect(Math.abs(man.y - goal)).toBeLessThan(Math.abs(me.y - goal));
      }
      checked++;
    });
    expect(checked).toBeGreaterThan(0);
  });
});

describe('the defending shape', () => {
  it('has someone in the way for most shots, and stays a compact block', () => {
    let shots = 0;
    let covered = 0;
    let frames = 0;
    let deep = 0;
    for (const seed of [75, 76, 77]) {
      let last: unknown = null;
      watch(seed, (sim) => {
        const owner = sim.ball.owner ? sim.bodies.get(sim.ball.owner) : undefined;
        if (owner && sim.layout === 'play' && !sim.celebrate && !sim.setPiece) {
          const ys = [...sim.bodies.values()].filter((b) => b.side !== owner.side && b.pos !== 'GK').map((b) => b.y);
          frames++;
          deep += Math.max(...ys) - Math.min(...ys);
        }
        const a = sim.act;
        if (!a || a === last) return;
        last = a;
        const me = a.from ? sim.bodies.get(a.from) : undefined;
        if (!me || !['goal', 'save', 'miss'].includes(a.step.act)) return;
        const goalY = me.side === 'home' ? PL : 0;
        const d = Math.hypot(me.x - PW / 2, me.y - goalY);
        const ux = (PW / 2 - me.x) / d;
        const uy = (goalY - me.y) / d;
        shots++;
        const inLane = [...sim.bodies.values()].some((b) => {
          if (b.side === me.side || b.pos === 'GK') return false;
          const along = (b.x - me.x) * ux + (b.y - me.y) * uy;
          return along > 0.5 && along < d && Math.abs((b.x - me.x) * uy - (b.y - me.y) * ux) < 3;
        });
        if (inLane) covered++;
      });
    }
    expect(shots).toBeGreaterThan(30);
    expect(covered / shots).toBeGreaterThan(0.5);
    expect(deep / frames).toBeLessThan(45);
  });
});

import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { resolvePhysicalShot } from '../../src/engine/match';
import { PitchSim } from '../../src/engine/matchRuntime/pitch';
import { acceptInteraction } from '../../src/engine/matchRuntime/interaction';

const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 183 });
function setup(kind: 'goal' | 'save' | 'block') {
  const match = startUserMatch(game)!;
  const actorId = match.home.onPitch.find((id) => game.world.players[id].position === 'FWD')!;
  const keeperId = match.away.onPitch.find((id) => game.world.players[id].position === 'GK')!;
  const sim = new PitchSim(42);
  sim.sync([
    { id: actorId, side: 'home', pos: 'FWD', pace: 70, name: 'Shooter', spot: { depth: 0.9, lat: 0.5 } },
    { id: keeperId, side: 'away', pos: 'GK', pace: 70, name: 'Keeper', spot: { depth: 0.04, lat: 0.5 } },
  ]);
  Object.assign(sim.bodies.get(actorId)!, { x: 34, y: 99, vx: 0, vy: 0 });
  Object.assign(sim.bodies.get(keeperId)!, { x: kind === 'goal' ? 30 : 34, y: 104, vx: 0, vy: 0, pos: kind === 'block' ? 'DEF' : 'GK' });
  Object.assign(sim.ball, { x: 34, y: 100, z: 0, owner: actorId });
  sim.holding = true;
  const token = sim.beginInteraction('shot')!.interaction!;
  match.pending = { kind: 'shot', side: 'home', minute: 1, actorId, keeperId, bonus: 0, view: 'box' };
  sim.submitShot(token.id, token.revision, { actorId, aim: 0, power: 0.7, timing: 0, shooting: 80, pressure: 0, shape: 'low' });
  return { match, sim, token, actorId };
}

describe('physical shot statistics', () => {
  it.each(['goal', 'save', 'block'] as const)('commits a physical %s once without replaying the action', (kind) => {
    const { match, sim, token, actorId } = setup(kind);
    match.visual = true;
    match.rngState = 1216;
    expect(resolvePhysicalShot(game.world, match, sim, token.id, token.revision)).toBe(false);
    for (let i = 0; i < 120 && !sim.physicalShot?.outcome; i++) sim.update(1 / 60);
    expect(sim.physicalShot?.outcome?.kind).toBe(kind);
    const ball = { ...sim.ball };
    expect(acceptInteraction(sim, sim.snapshot(), match.pending!, match.pending)).toBe(false);
    const shots = match.home.shots;
    expect(resolvePhysicalShot(game.world, match, sim, token.id, token.revision + 1)).toBe(false);
    expect(resolvePhysicalShot(game.world, match, sim, token.id, token.revision)).toBe(true);
    expect(match.home.shots).toBe(shots + 1);
    expect(match.goals[actorId] ?? 0).toBe(kind === 'goal' ? 1 : 0);
    expect(match.home.onTarget).toBe(kind === 'block' ? 0 : 1);
    expect(match.pending).toBeNull();
    expect(match.play).toEqual([]);
    expect(sim.ball).toEqual(ball);
    expect(match.ball).toEqual({ x: ball.x / 68, y: ball.y / 105 });
    expect(resolvePhysicalShot(game.world, match, sim, token.id, token.revision)).toBe(false);
    expect(match.home.shots).toBe(shots + 1);
    if (kind === 'block') expect(match.events.at(-1)?.shot?.blockOut).toBe('loose');
  });
});

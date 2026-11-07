import { PitchSim } from '../../src/engine/matchRuntime/pitch';

const attempt = { actorId: 'shooter', aim: 0, power: 0.7, timing: 0, shooting: 80, pressure: 0, shape: 'low' as const };
function setup() {
  const sim = new PitchSim(42);
  sim.sync([{ id: 'shooter', side: 'home', pos: 'FWD', name: 'Shooter', pace: 70, spot: { depth: 0.9, lat: 0.5 } }]);
  Object.assign(sim.bodies.get('shooter')!, { x: 34, y: 99, vx: 0, vy: 0 });
  Object.assign(sim.ball, { x: 34, y: 100, z: 0, owner: 'shooter' });
  sim.holding = true;
  const token = sim.beginInteraction('shot-1')!.interaction!;
  return { sim, token };
}

describe('runtime physical shots', () => {
  it('accepts once against the current capture and keeps actual starting positions', () => {
    const { sim, token } = setup();
    const before = sim.snapshot();
    expect(sim.submitShot(token.id, token.revision + 1, attempt)).toBe(false);
    expect(sim.submitShot(token.id, token.revision, attempt)).toBe(true);
    expect(sim.submitShot(token.id, token.revision, attempt)).toBe(false);
    expect(sim.snapshot().players).toEqual(before.players);
    expect(sim.ball).toMatchObject({ x: 34, y: 100, z: 0, owner: null });
    expect(sim.endInteraction(token.id, token.revision)).toBe(false);
  });

  it('rejects an absent, distant or non-owning actor without consuming random state', () => {
    const { sim, token } = setup();
    const before = sim.snapshot().randomState;
    expect(sim.submitShot(token.id, token.revision, { ...attempt, actorId: 'absent' })).toBe(false);
    sim.ball.owner = null;
    expect(sim.submitShot(token.id, token.revision, attempt)).toBe(false);
    sim.ball.owner = 'shooter';
    sim.ball.y = 70;
    expect(sim.submitShot(token.id, token.revision, attempt)).toBe(false);
    expect(sim.snapshot().randomState).toBe(before);
  });

  it('advances the same ball and resolves once without legacy reconstruction', () => {
    const { sim, token } = setup();
    sim.submitShot(token.id, token.revision, attempt);
    sim.enqueue([{ act: 'miss', side: 'home', carrier: 'shooter', x: 0, y: 0 }]);
    expect(sim.queue).toEqual([]);
    for (let i = 0; i < 120 && !sim.physicalShot?.outcome; i++) sim.update(1 / 60);
    expect(sim.physicalShot?.outcome?.kind).toBe('goal');
    expect(sim.ball.y).toBeCloseTo(105.11);
    const before = sim.snapshot();
    sim.update(1);
    expect(sim.snapshot()).toEqual(before);
    expect(sim.endInteraction(token.id, token.revision)).toBe(true);
    expect(sim.ball).toEqual(before.ball);
    expect(sim.endInteraction(token.id, token.revision)).toBe(false);
  });

  it('detaches action snapshots and clears an action at an explicit period reset', () => {
    const { sim, token } = setup();
    sim.submitShot(token.id, token.revision, attempt);
    const view = sim.snapshot();
    view.physicalShot!.ball.y = 0;
    view.physicalShot!.bodies[0].x = 0;
    expect(sim.physicalShot!.ball.y).toBe(100);
    expect(sim.physicalShot!.bodies[0].x).toBe(34);
    sim.resetForPeriod('away');
    expect(sim.physicalShot).toBeNull();
    expect(sim.endInteraction(token.id, token.revision)).toBe(false);
  });

  it('preserves the interaction token when takeover is requested during or after a shot', () => {
    const { sim, token } = setup();
    sim.submitShot(token.id, token.revision, attempt);
    sim.takeOver('shooter');
    expect(sim.snapshot().interaction).toEqual(token);
    for (let i = 0; i < 120 && !sim.physicalShot?.outcome; i++) sim.update(1 / 60);
    sim.takeOver('shooter');
    expect(sim.snapshot().interaction).toEqual(token);
    expect(sim.endInteraction(token.id, token.revision)).toBe(true);
    sim.takeOver('shooter');
    expect(sim.beginInteraction('next')).not.toBeNull();
  });
});

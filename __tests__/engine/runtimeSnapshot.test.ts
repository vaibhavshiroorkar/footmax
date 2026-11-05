import { PitchSim, PW, PL } from '../../src/ui/pitchSim';

function match(seed = 12) {
  const sim = new PitchSim(seed);
  sim.sync((['home', 'away'] as const).flatMap((side) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: `${side}-${i}`, side, name: `${side}-${i}`, pace: 70,
      pos: i === 0 ? 'GK' as const : i < 5 ? 'DEF' as const : 'FWD' as const,
      spot: { depth: i === 0 ? 0.04 : 0.4 + i * 0.04, lat: (i + 1) / 12 },
    })),
  ));
  sim.layout = 'play';
  sim.attacking = 'home';
  sim.ball.owner = 'home-9';
  return sim;
}

describe('engine snapshots', () => {
  it('preserves every player and physical coordinate without camera clipping', () => {
    const sim = match();
    Object.assign(sim.bodies.get('home-9')!, { x: 12, y: 71, vx: 3, vy: -2 });
    Object.assign(sim.bodies.get('away-0')!, { x: PW - 9, y: PL - 8 });
    Object.assign(sim.ball, { x: 12.3, y: 71, z: 0.4, vx: 3, vy: -2 });
    const view = sim.snapshot();
    expect(view.players).toHaveLength(22);
    expect(new Set(view.players.map((p) => p.id)).size).toBe(22);
    expect(view.players.find((p) => p.id === 'home-9')).toMatchObject({ x: 12, y: 71, vx: 3, vy: -2 });
    expect(view.players.find((p) => p.id === 'away-0')).toMatchObject({ x: 59, y: 97 });
    expect(view.ball).toMatchObject({ x: 12.3, y: 71, z: 0.4, owner: 'home-9' });
  });

  it('cannot change live movement through a captured snapshot', () => {
    const sim = match();
    sim.ball.flight = { fx: 10, fy: 20, tx: 30, ty: 40, t: 0, dur: 1, peak: 0.2 };
    sim.setPiece = { kind: 'freekick', side: 'home', x: 12, y: 71, wall: ['away-1'], taker: 'home-9' };
    sim.enqueue([{ x: 0.4, y: 0.6, carrier: 'home-9', side: 'home', act: 'pass' }]);
    const view = sim.snapshot();
    view.players[0].x = -500;
    view.players[0].spot.lat = 99;
    view.ball.flight!.tx = -500;
    view.setPiece!.wall.push('away-2');
    view.queue[0].x = 99;
    expect(sim.bodies.get('home-0')!.x).not.toBe(-500);
    expect(sim.bodies.get('home-0')!.spot.lat).toBeCloseTo(1 / 12);
    expect(sim.ball.flight.tx).toBe(30);
    expect(sim.setPiece.wall).toEqual(['away-1']);
    expect(sim.queue[0].x).toBe(0.4);
  });

  it('retains a captured frame after live movement advances', () => {
    const sim = match();
    const view = sim.snapshot();
    const saved = JSON.stringify(view);
    for (let frame = 0; frame < 90; frame++) sim.update(1 / 60);
    expect(JSON.stringify(view)).toBe(saved);
    expect(sim.snapshot().revision).toBeGreaterThan(view.revision);
    expect(sim.snapshot().clock).toBeGreaterThan(view.clock);
  });

  it('repeats physical movement for the same seed independently of other matches', () => {
    const a = match(83);
    const b = match(83);
    const unrelated = match(19);
    for (let frame = 0; frame < 600; frame++) {
      a.update(1 / 60);
      unrelated.update(1 / 60);
      b.update(1 / 60);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().players).not.toEqual(unrelated.snapshot().players);
  });
});

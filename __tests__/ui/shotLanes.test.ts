import { PL, PW, PitchSim } from '../../src/ui/pitchSim';

// The shot game draws the defenders the pitch has in the way, and a shot
// it calls blocked must hit that same man on the pitch.
function setup() {
  const sim = new PitchSim();
  sim.sync([
    { id: 'me', side: 'home', spot: { depth: 0.8, lat: 0.5 }, pos: 'FWD', pace: 70, name: 'Me' },
    { id: 'cb', side: 'away', spot: { depth: 0.2, lat: 0.5 }, pos: 'DEF', pace: 70, name: 'Stopper' },
    { id: 'gk', side: 'away', spot: { depth: 0, lat: 0.5 }, pos: 'GK', pace: 50, name: 'Keeper' },
  ]);
  const put = (id: string, x: number, y: number) => Object.assign(sim.bodies.get(id)!, { x, y, vx: 0, vy: 0 });
  put('me', PW / 2, PL - 20);
  put('gk', PW / 2, PL - 0.7);
  return { sim, put };
}

describe('everyone ahead of the shooter', () => {
  it('shows defenders wide of the goal too, who cannot block', () => {
    const { sim, put } = setup();
    put('cb', PW / 2 + 9, PL - 12);
    const lanes = sim.laneDefenders('me');
    expect(lanes.map((l) => l.id)).toContain('cb');
    expect(lanes[0].x).toBeGreaterThan(1);
  });
});

describe('a free kick', () => {
  it('puts the wall on the near side and the keeper on the far side', () => {
    const { sim, put } = setup();
    const ball = { x: PW / 2 + 12, y: PL - 22 };
    put('cb', ball.x, ball.y - 12);
    sim.setPiece = { kind: 'freekick', side: 'home', ...ball, wall: ['cb'] };
    const wall = sim['setPieceSpot'](sim.bodies.get('cb')!, sim.setPiece)!;
    const keeper = sim['setPieceSpot'](sim.bodies.get('gk')!, sim.setPiece)!;
    expect(keeper.x).toBeLessThan(PW / 2);
    expect(wall.x).toBeGreaterThan(PW / 2);
    expect(Math.hypot(wall.x - ball.x, wall.y - ball.y)).toBeCloseTo(9.15, 1);
  });
});

describe('defenders in the shooting lane', () => {
  it('puts a man straight in front in the middle of the goal', () => {
    const { sim, put } = setup();
    put('cb', PW / 2, PL - 12);
    const [d] = sim.laneDefenders('me');
    expect(d.id).toBe('cb');
    expect(d.x).toBeCloseTo(0.5, 2);
    expect(d.near).toBeCloseTo(0.6, 2);
  });

  it('puts a man to the shooter\'s left on the left of the goal', () => {
    const { sim, put } = setup();
    // Home attacks up the pitch, so his left is low x.
    put('cb', PW / 2 - 1, PL - 12);
    const [d] = sim.laneDefenders('me');
    expect(d.x).toBeLessThan(0.3);
  });

  it('ignores a man behind the shooter', () => {
    const { sim, put } = setup();
    put('cb', PW / 2, PL - 26);
    expect(sim.laneDefenders('me')).toEqual([]);
  });

  it('shows a blocked shot hitting that defender, then a corner', () => {
    const { sim, put } = setup();
    put('cb', PW / 2, PL - 12);
    sim.ball.owner = 'me';
    Object.assign(sim.ball, { x: PW / 2, y: PL - 20 });
    sim.enqueue([
      { x: 0.5, y: (PL - 20) / PL, carrier: 'me', side: 'home', act: 'start' },
      { x: 0.5, y: 0.85, carrier: null, side: 'home', act: 'miss', restart: 'corner', aim: 0.5, blocker: 'cb' },
    ]);
    let closest = Infinity;
    let blocked = false;
    for (let i = 0; i < 600 && !blocked; i++) {
      sim.update(1 / 60);
      const cb = sim.bodies.get('cb')!;
      if (sim.act?.step.act === 'miss') closest = Math.min(closest, Math.hypot(sim.ball.x - cb.x, sim.ball.y - cb.y));
      blocked = sim.callout?.text === 'BLOCKED!';
    }
    expect(blocked).toBe(true);
    expect(closest).toBeLessThan(1.5);
  });
});

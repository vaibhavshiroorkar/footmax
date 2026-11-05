import { PitchSim } from '../../src/engine/matchRuntime/pitch';

function situation(press: boolean, keeper = false) {
  const sim = new PitchSim(4);
  sim.sync([
    { id: 'user', side: 'home', name: 'User', pos: keeper ? 'GK' : 'MID', pace: 70, spot: { depth: 0.2, lat: 0.2 } },
    { id: 'cover', side: 'home', name: 'Cover', pos: 'DEF', pace: 70, spot: { depth: 0.3, lat: 0.5 } },
    { id: 'cover2', side: 'home', name: 'Cover 2', pos: 'DEF', pace: 70, spot: { depth: 0.3, lat: 0.6 } },
    { id: 'cover3', side: 'home', name: 'Cover 3', pos: 'DEF', pace: 70, spot: { depth: 0.3, lat: 0.7 } },
    { id: 'opponent', side: 'away', name: 'Opponent', pos: 'MID', pace: 70, spot: { depth: 0.5, lat: 0.5 } },
  ]);
  Object.assign(sim.bodies.get('user')!, { x: 8, y: 10 });
  Object.assign(sim.bodies.get('cover')!, { x: 53, y: 60 });
  Object.assign(sim.bodies.get('cover2')!, { x: 50, y: 54 });
  Object.assign(sim.bodies.get('cover3')!, { x: 47, y: 52 });
  Object.assign(sim.bodies.get('opponent')!, { x: 55, y: 60 });
  sim.layout = 'play';
  sim.takeOver('opponent');
  sim.act = null;
  sim.holding = false;
  Object.assign(sim.ball, { x: 55, y: 60 });
  sim.focus = { id: 'user', zone: 'defend', shout: press ? 'track' : null };
  return sim;
}

describe('Press action', () => {
  it('closes the carrier from beyond 22 metres instead of retreating into shape', () => {
    const press = situation(true);
    press.update(1 / 60);
    const pressing = press.bodies.get('user')!;
    const dx = press.ball.x - pressing.x;
    const dy = press.ball.y - pressing.y;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(22);
    const alignment = (pressing.vx * dx + pressing.vy * dy) / (Math.hypot(pressing.vx, pressing.vy) * Math.hypot(dx, dy));
    expect(alignment).toBeGreaterThan(0.999);
  });

  it('does not send a goalkeeper out of position', () => {
    const press = situation(true, true);
    const shape = situation(false, true);
    for (let i = 0; i < 120; i++) {
      press.update(1 / 60);
      shape.update(1 / 60);
    }
    expect(press.bodies.get('user')).toEqual(shape.bodies.get('user'));
  });

  it('respects free-kick spacing instead of charging the taker', () => {
    const sim = situation(true);
    Object.assign(sim.bodies.get('user')!, { x: 55, y: 57 });
    sim.setPiece = { kind: 'freekick', side: 'away', x: 55, y: 60, wall: [], taker: 'opponent' };
    sim.act = { step: { act: 'start', restart: 'freekick', carrier: 'opponent', side: 'away', x: 55 / 68, y: 60 / 105 }, t: 0, stage: 0, wait: 100, from: 'opponent', tx: 55, ty: 60 };
    sim.ball.owner = null;
    for (let i = 0; i < 180; i++) sim.update(1 / 60);
    const player = sim.bodies.get('user')!;
    expect(Math.hypot(player.x - sim.ball.x, player.y - sim.ball.y)).toBeGreaterThanOrEqual(9.15);
  });
});

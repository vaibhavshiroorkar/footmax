import { Rng } from '../../src/engine/rng';
import { FIXED_STEP } from '../../src/engine/matchRuntime/clock';
import { createShot, stepShot, ShotState, ShotBody } from '../../src/engine/matchRuntime/shot';

const body = (id: string, x: number, y: number, extra: Partial<ShotBody> = {}): ShotBody => ({ id, x, y, vx: 0, vy: 0, radius: 0.3, height: 1.8, ...extra });
const state = (extra: Partial<ShotState> = {}): ShotState => ({
  ball: { x: 34, y: 100, z: 0.11, vx: 0, vy: 30, vz: 0, spin: 0, rotation: 0 },
  bodies: [], elapsed: 0, direction: 1, actorId: 'shooter', outcome: null, ...extra,
});
const run = (s: ShotState) => {
  for (let i = 0; i < 1200 && !s.outcome; i++) stepShot(s, FIXED_STEP);
  expect(s.outcome).not.toBeNull();
  return s;
};

describe('physical shot action', () => {
  it('scores only after the whole ball crosses the line', () => {
    const s = state();
    s.ball.y = 104.9;
    stepShot(s, 0.005);
    expect(s.outcome).toBeNull();
    run(s);
    expect(s.outcome?.kind).toBe('goal');
    expect(s.ball.y).toBeCloseTo(105.11);
  });

  it('gives mirrored results when attacking the other goal', () => {
    const a = run(state());
    const b = state({ direction: -1 });
    b.ball.y = 5;
    b.ball.vy = -30;
    run(b);
    expect(b.outcome?.kind).toBe(a.outcome?.kind);
    expect(b.ball.y).toBeCloseTo(105 - a.ball.y);
    expect(b.elapsed).toBeCloseTo(a.elapsed);
  });

  it('hits a defender between frame endpoints and keeps rebound velocity', () => {
    const s = state({ bodies: [body('defender', 34, 100.25)] });
    s.ball.y = 99;
    s.ball.z = 1;
    s.ball.vy = 200;
    stepShot(s, FIXED_STEP);
    expect(s.outcome).toMatchObject({ kind: 'block', playerId: 'defender' });
    expect(s.ball.y).toBeCloseTo(99.84);
    expect(s.ball.vy).toBeLessThan(0);
  });

  it('sweeps against a moving defender in relative space', () => {
    const s = state({ bodies: [body('runner', 33, 100, { vx: 120 })] });
    s.ball.y = 99;
    s.ball.vy = 120;
    stepShot(s, FIXED_STEP);
    expect(s.outcome).toMatchObject({ kind: 'block', playerId: 'runner' });
  });

  it('does not teleport an off-centre keeper to save an unreachable shot', () => {
    const s = state({ bodies: [body('keeper', 30, 104, { keeper: 99 })] });
    const start = s.bodies[0].x;
    run(s);
    expect(s.outcome?.kind).toBe('goal');
    expect(Math.abs(s.bodies[0].x - start)).toBeLessThan(1);
  });

  it('saves only when the ball meets the keeper', () => {
    const s = run(state({ bodies: [body('keeper', 34, 104, { keeper: 60 })] }));
    expect(s.outcome).toMatchObject({ kind: 'save', playerId: 'keeper' });
    expect(s.ball.y).toBeLessThan(104);
  });

  it('distinguishes posts, crossbar, wide and high balls', () => {
    const post = state();
    post.ball.x = 37.66;
    expect(run(post).outcome?.kind).toBe('woodwork');
    const bar = state();
    bar.ball.z = 2.44;
    bar.ball.vz = 0.85;
    expect(run(bar).outcome?.kind).toBe('woodwork');
    const wide = state();
    wide.ball.x = 39;
    expect(run(wide).outcome?.kind).toBe('out');
    const high = state();
    high.ball.z = 4;
    expect(run(high).outcome?.kind).toBe('out');
  });

  it('replays identical input and seed exactly', () => {
    const input = { actorId: 'shooter', direction: 1 as const, aim: 0.5, power: 0.7, timing: 0.1, shooting: 70, pressure: 0.2, shape: 'driven' as const };
    const a = createShot(state().ball, [], input, new Rng(42));
    const b = createShot(state().ball, [], input, new Rng(42));
    expect(run(a)).toEqual(run(b));
  });

  it('keeps low bounces above the ground and stops advancing resolved actions', () => {
    const s = state();
    s.ball.vz = 0.03;
    s.ball.vy = 1;
    for (let i = 0; i < 120 && !s.outcome; i++) {
      stepShot(s, FIXED_STEP);
      expect(s.ball.z).toBeGreaterThanOrEqual(0.11);
    }
    expect(s.outcome?.kind).toBe('stopped');
    const before = JSON.stringify(s);
    stepShot(s, 1);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('starts at the actual ball and rewards shooting skill with power and accuracy', () => {
    const input = { actorId: 'shooter', direction: 1 as const, aim: 0, power: 0.9, timing: 0.6, shooting: 20, pressure: 0.4, shape: 'driven' as const };
    const ball = { ...state().ball, x: 28, y: 84 };
    const low = createShot(ball, [], input, new Rng(1));
    const high = createShot(ball, [], { ...input, shooting: 95 }, new Rng(1));
    expect({ x: high.ball.x, y: high.ball.y, z: high.ball.z }).toEqual({ x: 28, y: 84, z: 0.11 });
    expect(Math.hypot(high.ball.vx, high.ball.vy)).toBeGreaterThan(Math.hypot(low.ball.vx, low.ball.vy));
    const ideal = Math.atan2(6, 21);
    expect(Math.abs(Math.atan2(high.ball.vx, high.ball.vy) - ideal)).toBeLessThan(Math.abs(Math.atan2(low.ball.vx, low.ball.vy) - ideal));
    expect(ball.vy).toBe(30);
  });
});

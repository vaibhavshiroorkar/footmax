import { FixedClock, FIXED_STEP, MAX_STEPS } from '../../src/engine/matchRuntime/clock';
import { PitchSim } from '../../src/engine/matchRuntime/pitch';

function moving() {
  const sim = new PitchSim(44);
  sim.sync((['home', 'away'] as const).flatMap((side) => Array.from({ length: 11 }, (_, i) => ({
    id: `${side}-${i}`, name: `${side}-${i}`, side, pos: i === 0 ? 'GK' as const : 'MID' as const,
    pace: 70, spot: { depth: 0.1 + i * 0.07, lat: (i + 1) / 12 },
  }))));
  sim.layout = 'play';
  sim.attacking = 'home';
  sim.ball.owner = 'home-9';
  return sim;
}

describe('fixed physical clock', () => {
  it('advances the same state at 30, 60 and 120 display frames per second', () => {
    const states = [30, 60, 120].map((fps) => {
      const sim = moving();
      for (let i = 0; i < fps * 4; i++) sim.update(1 / fps);
      return sim.snapshot();
    });
    expect(states[0]).toEqual(states[1]);
    expect(states[1]).toEqual(states[2]);
  });

  it('bounds long frames and retains all time for later calls', () => {
    const clock = new FixedClock();
    const ticks: number[] = [];
    expect(clock.advance(2, (dt) => ticks.push(dt))).toBe(MAX_STEPS);
    expect(clock.pendingSeconds).toBeCloseTo(2 - MAX_STEPS * FIXED_STEP);
    for (let i = 0; i < 10; i++) clock.advance(0, (dt) => ticks.push(dt));
    expect(ticks).toHaveLength(120);
    expect(ticks.every((dt) => dt === FIXED_STEP)).toBe(true);
    expect(clock.pendingSeconds).toBe(0);
  });

  it('discards queued time on pause and resumes with fresh frame time', () => {
    const sim = moving();
    sim.update(2);
    sim.update(0);
    const paused = sim.snapshot();
    for (let i = 0; i < 300; i++) sim.update(0);
    expect(sim.snapshot()).toEqual(paused);
    sim.update(1 / 60);
    expect(sim.clock - paused.clock).toBeCloseTo(FIXED_STEP);
  });

  it('ignores invalid elapsed times without poisoning later frames', () => {
    const sim = moving();
    const before = sim.snapshot();
    for (const value of [NaN, Infinity, -1]) sim.update(value);
    expect(sim.snapshot()).toEqual(before);
    sim.update(1 / 60);
    expect(Number.isFinite(sim.clock)).toBe(true);
  });

  it('stops remaining ticks at the captured interaction frame', () => {
    const sim = moving();
    sim.enqueue([{ act: 'moment', carrier: 'home-9', x: 0.5, y: 0.5, side: 'home' }]);
    let captured: ReturnType<PitchSim['snapshot']> | null = null;
    sim.setHooks({ onMoment: () => { captured = sim.beginInteraction('chance'); } });
    for (let i = 0; i < 1000 && !captured; i++) sim.update(0.05);
    expect(captured).not.toBeNull();
    expect(sim.snapshot()).toEqual(captured);
    sim.update(2);
    expect(sim.snapshot()).toEqual(captured);
  });
});

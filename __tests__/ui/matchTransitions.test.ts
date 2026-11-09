import { PitchSim, PW, PL } from '../../src/ui/pitchSim';
import { acceptInteraction } from '../../src/engine/matchRuntime/interaction';
import { KeyMoment, simToHalf, stepMinute } from '../../src/engine/match';
import { newCareerGame, startUserMatch } from '../../src/engine/game';

function held() {
  const sim = new PitchSim(9);
  sim.sync([{ id: 'a', side: 'home', spot: { depth: 0.6, lat: 0.4 }, pos: 'FWD', pace: 70, name: 'A' }]);
  sim.layout = 'play';
  sim.ball.owner = 'a';
  sim.takeOver('a');
  return sim;
}

describe('interaction transitions', () => {
  it('keeps the complete physical state still while awaiting a decision', () => {
    const sim = held();
    const opened = sim.beginInteraction('chance-1')!;
    for (let i = 0; i < 120; i++) sim.update(1 / 60);
    expect(sim.snapshot()).toEqual(opened);
  });

  it('accepts a completion once and then resumes physical play', () => {
    const sim = held();
    const token = sim.beginInteraction('chance-1')!.interaction!;
    expect(sim.endInteraction(token.id, token.revision)).toBe(true);
    expect(sim.endInteraction(token.id, token.revision)).toBe(false);
    expect(sim.holding).toBe(false);
    expect(sim.act).toBeNull();
    const before = sim.clock;
    sim.update(1 / 60);
    expect(sim.clock).toBeGreaterThan(before);
  });

  it('rejects a callback from before the period break even if its label is reused', () => {
    const sim = held();
    const old = sim.beginInteraction('chance')!.interaction!;
    sim.resetForPeriod('away');
    sim.takeOver('a');
    const current = sim.beginInteraction('chance')!;
    expect(sim.endInteraction(old.id, old.revision)).toBe(false);
    expect(sim.snapshot()).toEqual(current);
    expect(sim.endInteraction('chance', current.interaction!.revision)).toBe(true);
  });

  it('clears every stopped-play state before a second-half kickoff', () => {
    const sim = held();
    sim.beginInteraction('corner');
    sim.queue = [{ x: 0.2, y: 0.8, carrier: 'a', side: 'home', act: 'cross' }];
    sim.setPiece = { kind: 'corner', side: 'home', x: 0, y: PL, wall: [] };
    sim.varCheck = { at: 0, x: 0, y: 0, beat: 'review', next: null, beatAt: 0 };
    sim.callout = { text: 'CORNER', tone: 'stop', until: 999 };
    sim.ball.flight = { fx: 0, fy: PL, tx: 34, ty: 98, t: 0, dur: 1, peak: 2 };
    sim.halfTime('away');
    expect(sim.snapshot()).toMatchObject({
      holding: false, interaction: null, action: null, queue: [], setPiece: null,
      varCheck: null, callout: null, layout: 'kickoff', kickoffSide: 'away',
      ball: { x: PW / 2, y: PL / 2, z: 0, vx: 0, vy: 0, flight: null, owner: null },
    });
    sim.enqueue([{ x: 0.5, y: 0.5, carrier: 'a', side: 'away', act: 'start', restart: 'kickoff' }]);
    sim.update(1 / 60);
    expect(sim.act?.step.restart).toBe('kickoff');
  });

  it('cannot open an interaction while the ball is still being played', () => {
    const sim = new PitchSim();
    expect(sim.beginInteraction('premature')).toBeNull();
  });

  it('rejects an earlier choice after the player changes to shooting', () => {
    const sim = held();
    const capture = sim.beginInteraction('chance')!;
    const choice: KeyMoment = { kind: 'choice', actorId: 'a', keeperId: 'k', minute: 5, side: 'home', bonus: 0 };
    const shot: KeyMoment = { ...choice, kind: 'shot' };
    expect(acceptInteraction(sim, capture, choice, shot)).toBe(false);
    expect(sim.snapshot()).toEqual(capture);
    expect(acceptInteraction(sim, capture, shot, shot)).toBe(true);
    expect(acceptInteraction(sim, capture, shot, shot)).toBe(false);
  });

  it('can accept a fresh interaction after skipping a pending chance to halftime', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 90 });
    const match = startUserMatch(game)!;
    for (let i = 0; i < 60 && !match.pending; i++) stepMinute(game.world, match);
    expect(match.pending).not.toBeNull();
    const before = match.pending!;
    const sim = held();
    const capture = sim.beginInteraction('chance')!;
    simToHalf(game.world, match);
    sim.resetForPeriod('away');
    expect(match.half).toBe(2);
    expect(acceptInteraction(sim, capture, before, match.pending)).toBe(false);
    for (let i = 0; i < 60 && !match.pending && !match.finished; i++) stepMinute(game.world, match);
    expect(match.pending).not.toBeNull();
    sim.takeOver('a');
    const next = sim.beginInteraction('next')!;
    expect(acceptInteraction(sim, next, match.pending!, match.pending)).toBe(true);
  });
});

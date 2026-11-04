import { ShotInput, ShotRun, ballSpeed, coverage, flyShot, keeperBody, passWeight, powerStray } from '../../src/engine/contact';
import { Rng } from '../../src/engine/rng';

const rng = new Rng(99);
const rand = () => rng.next();
const shot = (o: Partial<ShotInput> & { skill?: number }): ShotRun => flyShot({ aim: 0.5, height: 0.4, flight: 0.6, rand, ...o, keeper: { at: 0.5, skill: o.skill ?? 60, ...o.keeper } });

function many(n: number, make: () => ShotRun) {
  const out = { goal: 0, save: 0, miss: 0 };
  for (let i = 0; i < n; i++) out[make().outcome]++;
  return { goal: out.goal / n, save: out.save / n, miss: out.miss / n };
}

describe('a shot against a real body', () => {
  it('can only be saved with a touch', () => {
    for (let i = 0; i < 4000; i++) {
      const r = shot({ aim: rand(), height: rand() * 1.1, flight: 0.4 + rand(), skill: 40 + rand() * 59 });
      if (r.outcome === 'save') expect(r.touch).toBeDefined();
      if (!r.touch) expect(r.outcome).not.toBe('save');
    }
  });

  it('does not always go in: he stops what is near him', () => {
    expect(many(800, () => shot({ aim: 0.5, height: 0.4, flight: 0.6 })).save).toBeGreaterThan(0.9);
    // A hard shot into the corner beats him most of the time.
    expect(many(800, () => shot({ aim: 0.95, height: 0.2, flight: 0.45 })).goal).toBeGreaterThan(0.6);
    // A soft one does not.
    expect(many(800, () => shot({ aim: 0.92, height: 0.3, flight: 1.1 })).save).toBeGreaterThan(0.5);
  });

  it('gives a fair spread over the goal, near the real save rate', () => {
    const r = many(4000, () => shot({ aim: 0.03 + rand() * 0.94, height: 0.1 + rand() * 0.8, flight: 0.45 + rand() * 0.4 }));
    expect(r.save).toBeGreaterThan(0.4);
    expect(r.save).toBeLessThan(0.8);
    expect(r.goal).toBeGreaterThan(0.15);
  });

  it('never lets the ball pass through him', () => {
    for (let i = 0; i < 5000; i++) {
      const aim = 0.03 + rand() * 0.94;
      const r = shot({ aim, height: 0.1 + rand() * 0.8, flight: 0.45 + rand() * 0.5, skill: 30 + rand() * 60 });
      if (r.end === 'net') expect(Math.abs(r.keeperTo - aim) * 7.32).toBeGreaterThan(1);
    }
  });

  it('makes a harder shot faster and less true', () => {
    expect(ballSpeed(0.9)).toBeGreaterThan(ballSpeed(0.3));
    expect(powerStray(0.9)).toBeGreaterThan(powerStray(0.3));
  });

  it('beats him more often in the very corner', () => {
    const spot = many(3000, () => shot({ aim: 0.86, height: 0.5, flight: 1 })).goal;
    const corner = many(3000, () => shot({ aim: 0.94, height: 0.85, flight: 1 })).goal;
    expect(corner).toBeGreaterThan(spot);
  });

  it('weighs a pass by how close the charge was', () => {
    expect(passWeight(0.5, 0.5)).toBe(1);
    expect(passWeight(0.9, 0.5)).toBeLessThan(passWeight(0.6, 0.5));
    expect(passWeight(0, 1)).toBeGreaterThan(0);
  });

  it('rewards a better keeper', () => {
    const at = (skill: number) => many(3000, () => shot({ aim: 0.1 + rand() * 0.8, height: 0.3, flight: 0.55, skill })).goal;
    expect(at(90)).toBeLessThan(at(45));
    expect(keeperBody(90).reaction).toBeLessThan(keeperBody(45).reaction);
    expect(coverage(90, 0.6)).toBeGreaterThan(coverage(45, 0.6));
  });

  it('keeps wide and over as misses, and uses the woodwork', () => {
    expect(shot({ aim: 1.1 }).end).toBe('wide');
    expect(shot({ height: 1.2 }).end).toBe('over');
    const ends = new Set<string>();
    for (let i = 0; i < 600; i++) ends.add(shot({ aim: 0.995, height: 0.3, flight: 0.45, skill: 40 }).end);
    expect(ends.has('post') || ends.has('inOffPost')).toBe(true);
  });

  it('tips high ones over and pushes corners round the post', () => {
    const ends = new Set<string>();
    for (let i = 0; i < 2500; i++) ends.add(shot({ aim: 0.05 + rand() * 0.9, height: 0.7 + rand() * 0.28, flight: 0.7 }).end);
    expect(ends.has('tipOver')).toBe(true);
    expect(ends.has('tipRound') || ends.has('parry')).toBe(true);
  });

  it('a penalty keeper who goes the wrong way cannot save it', () => {
    const r = many(500, () => shot({ aim: 0.85, height: 0.3, flight: 0.5, keeper: { at: 0.5, skill: 80, guess: 0.2 } }));
    expect(r.save).toBe(0);
    const right = many(500, () => shot({ aim: 0.8, height: 0.3, flight: 0.5, keeper: { at: 0.5, skill: 80, guess: 0.78 } }));
    expect(right.save).toBeGreaterThan(0.5);
  });

  it('a fake leaves him short', () => {
    const plain = many(3000, () => shot({ aim: 0.72, height: 0.3, flight: 0.6 })).goal;
    const faked = many(3000, () => shot({ aim: 0.72, height: 0.3, flight: 0.6, keeper: { at: 0.5, skill: 60, fooled: true } })).goal;
    expect(faked).toBeGreaterThan(plain);
  });
});

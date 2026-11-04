import { ARM, BONES, solve, twoBone } from '../../src/ui/rig/skeleton';
import { dive, jump, point, ready, run, slide, spread, stand, straddle } from '../../src/ui/rig/poses';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('two-bone limbs', () => {
  it('puts the hand exactly on any target in reach', () => {
    const root = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) {
      const a = i * 0.4;
      const r = 3 + (i % 19);
      const target = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      const limb = twoBone(root, target, 11.5, 11.5, 1);
      expect(limb.reached).toBe(true);
      expect(dist(limb.end, target)).toBeLessThan(0.02);
      expect(dist(root, limb.mid)).toBeCloseTo(11.5, 3);
      expect(dist(limb.mid, limb.end)).toBeCloseTo(11.5, 1);
    }
  });

  it('stops at full stretch when the target is out of reach', () => {
    const limb = twoBone({ x: 0, y: 0 }, { x: 40, y: 0 }, 11.5, 11.5, 1);
    expect(limb.reached).toBe(false);
    expect(dist({ x: 0, y: 0 }, limb.end)).toBeLessThanOrEqual(ARM);
    expect(limb.end.x).toBeGreaterThan(ARM - 0.5);
  });

  it('bends elbows and knees away from the body, whichever way the limb points', () => {
    for (const ty of [-20, -5, 10, 20]) {
      const left = twoBone({ x: -11, y: -48 }, { x: -13, y: -48 + ty }, 11.5, 11.5, -1);
      const right = twoBone({ x: 11, y: -48 }, { x: 13, y: -48 + ty }, 11.5, 11.5, 1);
      expect(left.mid.x).toBeLessThan(-11);
      expect(right.mid.x).toBeGreaterThan(11);
    }
  });
});

describe('poses', () => {
  const all = { stand: stand(), ready: ready(), run: run(1), spread: spread(24), straddle: straddle(16), jump: jump(1), slide: slide(1), dive: dive(1, 1), point: point(1) };
  it.each(Object.entries(all))('%s keeps every bone its true length', (_, pose) => {
    const s = solve(pose);
    for (const [root, limb, l1] of [[s.shoulderL, s.armL, BONES.upperArm], [s.shoulderR, s.armR, BONES.upperArm], [s.hipL, s.legL, BONES.thigh], [s.hipR, s.legR, BONES.thigh]] as const) {
      expect(dist(root, limb.mid)).toBeCloseTo(l1, 1);
    }
    expect(dist(s.hip, s.neck)).toBeCloseTo(BONES.spine, 3);
  });

  it('a dive stretches the keeper toward the side he goes', () => {
    const left = solve(dive(-1, 1));
    const right = solve(dive(1, 1));
    expect(left.armL.end.x).toBeLessThan(-30);
    expect(right.armR.end.x).toBeGreaterThan(30);
    expect(Math.abs(left.hip.x)).toBeGreaterThan(15);
  });

  it('a dive with a target puts the gloves on the ball when he can reach it', () => {
    const target = { x: 38, y: -40 };
    const s = solve(dive(1, 1, target));
    expect(s.armR.reached).toBe(true);
    expect(dist(s.armR.end, { x: target.x + 3, y: target.y })).toBeLessThan(0.1);
  });
});

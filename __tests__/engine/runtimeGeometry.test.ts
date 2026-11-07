import { firstContact, sweepSphereCapsule, Vec3, Capsule } from '../../src/engine/matchRuntime/geometry';

const body: Capsule = { id: 'defender', from: { x: 0, y: 0, z: 0.3 }, to: { x: 0, y: 0, z: 1.5 }, radius: 0.3 };
const ballRadius = 0.11;

describe('swept ball contact', () => {
  it('hits a defender even when both frame endpoints miss the body', () => {
    const hit = sweepSphereCapsule({ x: 0, y: -2, z: 1 }, { x: 0, y: 2, z: 1 }, ballRadius, body)!;
    expect(hit.id).toBe('defender');
    expect(hit.fraction).toBeCloseTo((2 - 0.41) / 4);
    expect(hit.centre.y).toBeCloseTo(-0.41);
    expect(hit.normal).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('allows a ball outside the whole body and its end caps to pass', () => {
    expect(sweepSphereCapsule({ x: 0.42, y: -2, z: 1 }, { x: 0.42, y: 2, z: 1 }, ballRadius, body)).toBeNull();
    expect(sweepSphereCapsule({ x: 0, y: -2, z: 1.92 }, { x: 0, y: 2, z: 1.92 }, ballRadius, body)).toBeNull();
  });

  it('detects contact on a rounded end cap while moving along the capsule axis', () => {
    const hit = sweepSphereCapsule({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 1 }, ballRadius, body)!;
    expect(hit.centre.z).toBeCloseTo(1.91);
    expect(hit.normal).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('reports initial overlap without dividing by zero for a stationary ball', () => {
    const at = { x: 0, y: 0, z: 1 };
    const hit = sweepSphereCapsule(at, at, ballRadius, body)!;
    expect(hit.fraction).toBe(0);
    expect(Object.values(hit.normal).every(Number.isFinite)).toBe(true);
    expect(Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z)).toBeCloseTo(1);
    expect(sweepSphereCapsule({ x: 5, y: 5, z: 1 }, { x: 5, y: 5, z: 1 }, ballRadius, body)).toBeNull();
  });

  it('handles a zero-length capsule as a sphere', () => {
    const capsule = { ...body, to: body.from };
    const hit = sweepSphereCapsule({ x: 0, y: -2, z: 0.3 }, { x: 0, y: 2, z: 0.3 }, ballRadius, capsule)!;
    expect(hit.centre.y).toBeCloseTo(-0.41);
  });

  it('checks both posts and a horizontal crossbar', () => {
    const post = { id: 'post', from: { x: 3.66, y: 0, z: 0 }, to: { x: 3.66, y: 0, z: 2.44 }, radius: 0.06 };
    const bar = { id: 'bar', from: { x: -3.66, y: 0, z: 2.44 }, to: { x: 3.66, y: 0, z: 2.44 }, radius: 0.06 };
    expect(sweepSphereCapsule({ x: 3.66, y: -1, z: 1 }, { x: 3.66, y: 1, z: 1 }, ballRadius, post)?.centre.y).toBeCloseTo(-0.17);
    expect(sweepSphereCapsule({ x: 0, y: -1, z: 2.44 }, { x: 0, y: 1, z: 2.44 }, ballRadius, bar)?.centre.y).toBeCloseTo(-0.17);
  });

  it('gives mirrored contact for the other attack direction', () => {
    const mirror = (p: Vec3): Vec3 => ({ x: 68 - p.x, y: 105 - p.y, z: p.z });
    const from = { x: 0, y: -2, z: 1 };
    const to = { x: 0, y: 2, z: 1 };
    const a = sweepSphereCapsule(from, to, ballRadius, body)!;
    const b = sweepSphereCapsule(mirror(from), mirror(to), ballRadius, { ...body, from: mirror(body.from), to: mirror(body.to) })!;
    expect(b.fraction).toBeCloseTo(a.fraction);
    expect(b.centre.y).toBeCloseTo(105 - a.centre.y);
    expect(b.normal.y).toBeCloseTo(-a.normal.y);
  });

  it('chooses the first body hit, independently of collider list order', () => {
    const near = { ...body, id: 'near' };
    const far = { ...body, id: 'far', from: { ...body.from, y: 1 }, to: { ...body.to, y: 1 } };
    const from = { x: 0, y: -2, z: 1 };
    const to = { x: 0, y: 2, z: 1 };
    expect(firstContact(from, to, ballRadius, [far, near])).toEqual(firstContact(from, to, ballRadius, [near, far]));
    expect(firstContact(from, to, ballRadius, [far, near])?.id).toBe('near');
    expect(firstContact(from, to, ballRadius, [{ ...near, id: 'z' }, { ...near, id: 'a' }])?.id).toBe('a');
  });
});

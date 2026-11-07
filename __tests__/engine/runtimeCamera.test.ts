import { shotCamera, project } from '../../src/engine/matchRuntime/camera';

describe('world shot camera', () => {
  it('uses the same depth scale for players and the ball', () => {
    const camera = shotCamera({ x: 34, y: 85 }, 1, 320, 220);
    const near = project(camera, { x: 34, y: 85, z: 0 })!;
    const far = project(camera, { x: 34, y: 95, z: 0 })!;
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(project(camera, { x: 34, y: 95, z: 1.8 })!.y).toBeCloseTo(far.y - 1.8 * far.scale);
    expect(project(camera, { x: 34, y: 95, z: 0.11 })!.y).toBeCloseTo(far.y - 0.11 * far.scale);
  });

  it('mirrors both attack directions without moving the world', () => {
    const a = project(shotCamera({ x: 26, y: 85 }, 1, 320, 220), { x: 30, y: 95, z: 1 })!;
    const b = project(shotCamera({ x: 42, y: 20 }, -1, 320, 220), { x: 38, y: 10, z: 1 })!;
    for (const key of ['x', 'y', 'depth', 'scale'] as const) expect(b[key]).toBeCloseTo(a[key], 10);
  });

  it('clips points behind the camera and keeps a captured camera stable during flight', () => {
    const ball = { x: 34, y: 85 };
    const camera = shotCamera(ball, 1, 320, 220);
    const before = project(camera, { x: 34, y: 105, z: 2.44 });
    ball.y = 104;
    expect(project(camera, { x: 34, y: 105, z: 2.44 })).toEqual(before);
    expect(project(camera, { x: 34, y: 70, z: 0 })).toBeNull();
  });
});

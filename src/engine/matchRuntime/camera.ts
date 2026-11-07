import type { Vec3 } from './geometry';

export interface WorldCamera {
  x: number; y: number; z: number;
  forwardX: number; forwardY: number;
  width: number; horizon: number; focal: number;
}

export function shotCamera(ball: { x: number; y: number }, direction: 1 | -1, width: number, height: number): WorldCamera {
  const dx = 34 - ball.x;
  const dy = (direction > 0 ? 105 : 0) - ball.y;
  const length = Math.hypot(dx, dy);
  const forwardX = length > 0.01 ? dx / length : 0;
  const forwardY = length > 0.01 ? dy / length : direction;
  return { x: ball.x - forwardX * 6, y: ball.y - forwardY * 6, z: 2.6, forwardX, forwardY, width, horizon: height * 0.2, focal: width * 0.7 };
}

export function project(camera: WorldCamera, point: Vec3): { x: number; y: number; scale: number; depth: number } | null {
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const depth = dx * camera.forwardX + dy * camera.forwardY;
  if (depth <= 0.25) return null;
  const scale = camera.focal / depth;
  return { x: camera.width / 2 + (dx * camera.forwardY - dy * camera.forwardX) * scale, y: camera.horizon + (camera.z - point.z) * scale, scale, depth };
}

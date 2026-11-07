import { clamp, Rng } from '../rng';
import { FIXED_STEP } from './clock';
import { Capsule, Contact, firstContact, sweepSphereCapsule } from './geometry';

const RADIUS = 0.11;
const GRAVITY = 9.81;
const WIDTH = 68;
const LENGTH = 105;
const GOAL_HALF = 3.66;
const GOAL_HEIGHT = 2.44;

export interface ShotBall {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spin: number;
  rotation: number;
}
export interface ShotBody {
  id: string;
  x: number; y: number; vx: number; vy: number;
  radius: number;
  height: number;
  keeper?: number;
}
export interface ShotOutcome {
  kind: 'goal' | 'save' | 'block' | 'woodwork' | 'out' | 'stopped';
  playerId?: string;
  colliderId?: string;
}
export interface ShotState {
  shape?: ShotAttempt['shape'];
  ball: ShotBall;
  bodies: ShotBody[];
  actorId: string;
  direction: 1 | -1;
  elapsed: number;
  outcome: ShotOutcome | null;
}
export interface ShotAttempt {
  actorId: string;
  direction: 1 | -1;
  // -1 to 1 across the goal, in the attacker's view. Values beyond it aim wide.
  aim: number;
  power: number;
  // Signed timing error, with zero at the centre of the input window.
  timing: number;
  shooting: number;
  pressure: number;
  weakFoot?: boolean;
  shape: 'driven' | 'low' | 'curl';
}

export function createShot(ball: ShotBall, bodies: readonly ShotBody[], input: ShotAttempt, rng: Rng): ShotState {
  const skill = clamp(input.shooting / 99, 0, 1);
  const power = clamp(input.power, 0, 1);
  const goalY = input.direction > 0 ? LENGTH : 0;
  const targetX = WIDTH / 2 + input.direction * input.aim * GOAL_HALF;
  const dx = targetX - ball.x;
  const dy = goalY - ball.y;
  const distance = Math.max(0.5, Math.hypot(dx, dy));
  const angle = Math.atan2(dx, dy);
  const hard = Math.max(0, power - (0.5 + 0.4 * skill));
  const error = (0.006 + 0.035 * (1 - skill) + hard * 0.1)
    * (1 + clamp(input.pressure, 0, 1) + (input.weakFoot ? 0.7 : 0));
  const deviation = rng.normal() * error + clamp(input.timing, -1, 1) * error * 2;
  const speed = (9 + power * (15 + skill * 12)) * (input.shape === 'curl' ? 0.9 : 1);
  const flight = distance / speed;
  const height = input.shape === 'low' ? RADIUS : 0.4 + power * 0.8 + hard * 8;
  const vz = input.shape === 'low' ? 0 : (height - ball.z) / flight + GRAVITY * flight / 2;
  return {
    ball: { ...ball, vx: Math.sin(angle + deviation * input.direction) * speed, vy: Math.cos(angle + deviation * input.direction) * speed, vz, spin: input.shape === 'curl' ? input.direction * 4 : 0 },
    bodies: bodies.map((body) => ({ ...body })), actorId: input.actorId,
    direction: input.direction, shape: input.shape, elapsed: 0, outcome: null,
  };
}

const FRAMES: Capsule[] = [0, LENGTH].flatMap((y) => [
  ...[-GOAL_HALF, GOAL_HALF].map((offset) => ({ id: `post:${y}:${offset}`, from: { x: WIDTH / 2 + offset, y, z: 0 }, to: { x: WIDTH / 2 + offset, y, z: GOAL_HEIGHT }, radius: 0.06 })),
  { id: `bar:${y}`, from: { x: WIDTH / 2 - GOAL_HALF, y, z: GOAL_HEIGHT }, to: { x: WIDTH / 2 + GOAL_HALF, y, z: GOAL_HEIGHT }, radius: 0.06 },
]);

function tick(state: ShotState, dt: number): void {
  const b = state.ball;
  const from = { x: b.x, y: b.y, z: b.z };
  const grounded = b.z <= RADIUS + 1e-8 && b.vz <= 0;
  if (grounded) { b.z = RADIUS; b.vz = 0; from.z = RADIUS; }
  const az = grounded ? 0 : -GRAVITY;
  const to = { x: b.x + b.vx * dt, y: b.y + b.vy * dt, z: b.z + b.vz * dt + az * dt * dt / 2 };
  let hit = firstContact(from, to, RADIUS, FRAMES);
  let hitBody: ShotBody | undefined;
  const velocities = state.bodies.map((body) => {
    let vx = body.vx;
    let vy = body.vy;
    if (body.keeper !== undefined) {
      const skill = clamp(body.keeper / 99, 0, 1);
      const reaction = 0.28 - skill * 0.12;
      const active = clamp((state.elapsed + dt - reaction) / dt, 0, 1);
      const flight = Math.abs(b.vy) > 1e-8 ? Math.max(0, (body.y - b.y) / b.vy) : 0;
      const target = clamp(b.x + b.vx * flight, WIDTH / 2 - GOAL_HALF, WIDTH / 2 + GOAL_HALF);
      const wanted = clamp((target - body.x) * 8, -3.2 - skill * 1.2, 3.2 + skill * 1.2);
      vx += clamp(wanted - vx, -12 * dt, 12 * dt) * active;
      vy *= Math.max(0, 1 - dt * 8);
    }
    return { vx, vy };
  });
  for (let i = 0; i < state.bodies.length; i++) {
    const body = state.bodies[i];
    if (body.id === state.actorId) continue;
    const move = velocities[i];
    const capsule: Capsule = { id: body.id, from: { x: body.x, y: body.y, z: body.radius }, to: { x: body.x, y: body.y, z: Math.max(body.radius, body.height - body.radius) }, radius: body.radius };
    const contact = sweepSphereCapsule(from, { x: to.x - move.vx * dt, y: to.y - move.vy * dt, z: to.z }, RADIUS, capsule);
    if (contact && (!hit || contact.fraction < hit.fraction || (contact.fraction === hit.fraction && contact.id < hit.id))) {
      hit = { ...contact, centre: { x: contact.centre.x + move.vx * dt * contact.fraction, y: contact.centre.y + move.vy * dt * contact.fraction, z: contact.centre.z } };
      hitBody = body;
    }
  }

  let boundary: { fraction: number; goalLine: boolean } | null = null;
  for (const [axis, line, goalLine] of [['x', -RADIUS, false], ['x', WIDTH + RADIUS, false], ['y', -RADIUS, true], ['y', LENGTH + RADIUS, true]] as const) {
    const delta = to[axis] - from[axis];
    const fraction = (line - from[axis]) / delta;
    if (delta !== 0 && fraction >= 0 && fraction <= 1 && (!boundary || fraction < boundary.fraction)) boundary = { fraction, goalLine };
  }
  const groundTime = grounded ? Infinity : (b.vz + Math.sqrt(b.vz * b.vz + 2 * GRAVITY * Math.max(0, from.z - RADIUS))) / GRAVITY;
  const groundFraction = groundTime <= dt ? groundTime / dt : Infinity;
  const fraction = Math.min(hit?.fraction ?? Infinity, boundary?.fraction ?? Infinity, groundFraction, 1);
  const seconds = dt * fraction;
  b.x = from.x + (to.x - from.x) * fraction;
  b.y = from.y + (to.y - from.y) * fraction;
  b.z = from.z + (to.z - from.z) * fraction;
  b.vz += az * seconds;
  b.rotation += Math.hypot(b.vx, b.vy, b.vz) * seconds / RADIUS;
  for (let i = 0; i < state.bodies.length; i++) {
    const body = state.bodies[i];
    body.vx = velocities[i].vx;
    body.vy = velocities[i].vy;
    body.x += body.vx * seconds;
    body.y += body.vy * seconds;
  }
  state.elapsed += seconds;
  if (hit && fraction === hit.fraction) {
    reflect(b, hit, hitBody);
    state.outcome = hitBody ? { kind: hitBody.keeper === undefined ? 'block' : 'save', playerId: hitBody.id } : { kind: 'woodwork', colliderId: hit.id };
    return;
  }
  if (boundary && fraction === boundary.fraction) {
    const targetLine = state.direction > 0 ? b.y > LENGTH : b.y < 0;
    const inside = Math.abs(b.x - WIDTH / 2) + RADIUS < GOAL_HALF && b.z + RADIUS < GOAL_HEIGHT;
    state.outcome = { kind: boundary.goalLine && targetLine && inside ? 'goal' : 'out' };
    return;
  }
  if (fraction === groundFraction) {
    b.z = RADIUS;
    b.vz = Math.abs(b.vz) > 1 ? -b.vz * 0.45 : 0;
    b.vx *= 0.82;
    b.vy *= 0.82;
    if (dt - seconds > 1e-8) tick(state, dt - seconds);
    return;
  }
  const speed = Math.hypot(b.vx, b.vy);
  const drag = grounded ? Math.max(0, 1 - 1.6 * dt / Math.max(speed, 0.01)) : Math.max(0, 1 - 0.008 * speed * dt);
  const vx = b.vx;
  b.vx = (b.vx - b.vy * b.spin * 0.015 * dt) * drag;
  b.vy = (b.vy + vx * b.spin * 0.015 * dt) * drag;
  b.spin *= Math.max(0, 1 - dt * 0.15);
  if (grounded && speed < 0.2) state.outcome = { kind: 'stopped' };
}

function reflect(ball: ShotBall, hit: Contact, body?: ShotBody): void {
  const vx = ball.vx - (body?.vx ?? 0);
  const vy = ball.vy - (body?.vy ?? 0);
  const dot = vx * hit.normal.x + vy * hit.normal.y + ball.vz * hit.normal.z;
  if (dot >= 0) return;
  const bounce = body ? 0.35 : 0.65;
  ball.vx -= (1 + bounce) * dot * hit.normal.x;
  ball.vy -= (1 + bounce) * dot * hit.normal.y;
  ball.vz -= (1 + bounce) * dot * hit.normal.z;
}

export function stepShot(state: ShotState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.outcome) return;
  let left = seconds;
  while (left > 1e-10 && !state.outcome) {
    const dt = Math.min(FIXED_STEP, left);
    tick(state, dt);
    left -= dt;
  }
}

export interface Vec3 { x: number; y: number; z: number }
export interface Capsule { id: string; from: Vec3; to: Vec3; radius: number }
export interface Contact { id: string; fraction: number; centre: Vec3; normal: Vec3 }

const EPS = 1e-10;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const along = (a: Vec3, d: Vec3, t: number): Vec3 => ({ x: a.x + d.x * t, y: a.y + d.y * t, z: a.z + d.z * t });

function roots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < EPS) return [];
  const discriminant = b * b - a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b - root) / a, (-b + root) / a];
}

// Expand the capsule by the ball radius, then sweep the ball's centre.
export function sweepSphereCapsule(from: Vec3, to: Vec3, radius: number, capsule: Capsule): Contact | null {
  const axis = sub(capsule.to, capsule.from);
  const length2 = dot(axis, axis);
  const delta = sub(to, from);
  const speed2 = dot(delta, delta);
  const offset = sub(from, capsule.from);
  const r = radius + capsule.radius;
  const closest = (point: Vec3) => along(capsule.from, axis, length2 > EPS ? Math.max(0, Math.min(1, dot(sub(point, capsule.from), axis) / length2)) : 0);
  const contact = (fraction: number): Contact => {
    const centre = along(from, delta, fraction);
    let normal = sub(centre, closest(centre));
    let size = Math.sqrt(dot(normal, normal));
    if (size < EPS) {
      normal = speed2 > EPS ? sub(from, to) : { x: 1, y: 0, z: 0 };
      size = Math.sqrt(dot(normal, normal));
    }
    return { id: capsule.id, fraction, centre, normal: { x: normal.x / size, y: normal.y / size, z: normal.z / size } };
  };
  const separation = sub(from, closest(from));
  if (dot(separation, separation) <= r * r) return contact(0);
  if (speed2 < EPS) return null;
  const candidates: number[] = [];
  if (length2 > EPS) {
    const axialSpeed = dot(axis, delta);
    const axialOffset = dot(axis, offset);
    for (const t of roots(length2 * speed2 - axialSpeed * axialSpeed,
      length2 * dot(delta, offset) - axialOffset * axialSpeed,
      length2 * (dot(offset, offset) - r * r) - axialOffset * axialOffset)) {
      const height = axialOffset + t * axialSpeed;
      if (height >= 0 && height <= length2) candidates.push(t);
    }
  }
  for (const end of [capsule.from, capsule.to]) {
    const relative = sub(from, end);
    candidates.push(...roots(speed2, dot(delta, relative), dot(relative, relative) - r * r));
  }
  const valid = candidates.filter((t) => t >= 0 && t <= 1);
  return valid.length ? contact(Math.min(...valid)) : null;
}

export function firstContact(from: Vec3, to: Vec3, radius: number, capsules: readonly Capsule[]): Contact | null {
  let first: Contact | null = null;
  for (const capsule of capsules) {
    const hit = sweepSphereCapsule(from, to, radius, capsule);
    if (hit && (!first || hit.fraction < first.fraction || (hit.fraction === first.fraction && hit.id < first.id))) first = hit;
  }
  return first;
}

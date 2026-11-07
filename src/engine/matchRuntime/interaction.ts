import type { KeyMoment } from '../match';
import type { PitchSim } from './pitch';
import type { PitchSnapshot } from './snapshot';

// A choice can change kind without changing its pitch capture. Object identity
// rejects a delayed callback from the earlier choice within that same capture.
export function acceptInteraction(
  sim: PitchSim,
  capture: PitchSnapshot,
  expected: KeyMoment,
  current: KeyMoment | null,
): boolean {
  const token = capture.interaction;
  return current === expected && !!token && sim.endInteraction(token.id, token.revision);
}

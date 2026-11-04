import { SKILL_MOVES } from '../../engine/skills';

export type DribbleKind = 'combo' | 'gap' | 'race' | 'plain';

// Which dribble game you get. A trick has to be learned before it can be used:
// the gap game is a nutmeg, so it never appears without one.
export function dribblePick(learned: string[] | undefined, move: string | null, seed: number): DribbleKind {
  const m = move && learned?.includes(move) ? SKILL_MOVES.find((x) => x.id === move) : undefined;
  if (m && ['stepover', 'elastico', 'roulette', 'heelflick', 'rainbow'].includes(m.id)) return 'combo';
  if (m && (m.id === 'nutmeg' || m.id === 'ballroll')) return 'gap';
  if (m) return 'plain';
  return seed % 2 ? 'race' : 'plain';
}

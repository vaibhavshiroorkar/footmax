import { Player } from './types';
import { SkillMove } from './skills';

// What high attributes give you off the pitch. Energy stays out of 100, so
// physical lowers what a session costs rather than raising the cap.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Energy a training session costs: 28 up to 50 physical, down to 22 at 90.
export function sessionEnergy(p: Pick<Player, 'attrs'>, base = 28): number {
  return Math.round(base - clamp01((p.attrs.physical - 50) / 40) * 6);
}

// Extra fitness back each week: pace keeps you fresh.
export const weeklyFitness = (p: Pick<Player, 'attrs'>) => Math.round(clamp01((p.attrs.pace - 50) / 40) * 6);

// Vision sees one more pass from this level.
export const EXTRA_PASS_VISION = 75;

// A cool head halves the chance a night out goes wrong, at 90 composure.
export const nightOutRisk = (p: Pick<Player, 'attrs'>) => 1 - clamp01((p.attrs.composure - 50) / 40) * 0.5;

// Skill moves: stars set the fee and the weeks. A good passer picks them up for
// less, as he needs fewer sessions with the coach.
export function moveFee(m: SkillMove, p: Pick<Player, 'attrs'>): number {
  const base = 500 * 4 ** (m.stars - 1);
  return Math.round((base * (1 - clamp01((p.attrs.passing - 50) / 40) * 0.25)) / 50) * 50;
}

export const moveWeeks = (m: SkillMove) => m.stars + 1;

export interface PerkLine {
  label: string;
  value: string;
}

// What the player's attributes are giving him right now.
export function perkLines(p: Player): PerkLine[] {
  const out: PerkLine[] = [{ label: 'Physical', value: `${sessionEnergy(p)} energy a session` }];
  if (weeklyFitness(p)) out.push({ label: 'Pace', value: `+${weeklyFitness(p)} fitness each week` });
  if (p.attrs.vision >= EXTRA_PASS_VISION) out.push({ label: 'Vision', value: 'One more pass on offer' });
  if (nightOutRisk(p) < 1) out.push({ label: 'Composure', value: `${Math.round((1 - nightOutRisk(p)) * 100)}% less trouble on nights out` });
  if (p.attrs.passing > 50) out.push({ label: 'Passing', value: `Skill move training ${Math.round(clamp01((p.attrs.passing - 50) / 40) * 25)}% cheaper` });
  return out;
}

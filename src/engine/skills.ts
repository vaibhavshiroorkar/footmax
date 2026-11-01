import { AttrKey, Player } from './types';

// Progressive skills. Each has three levels; a level needs skill points
// and a minimum attribute. The career player earns points by levelling up.
// AI players get skills from their attributes when created.

export interface SkillDef {
  id: string;
  label: string;
  description: string;
  attr: AttrKey;
  // Attribute needed for levels 1, 2 and 3.
  needs: [number, number, number];
}

export const SKILLS: SkillDef[] = [
  { id: 'finisher', label: 'Clinical Finisher', description: 'Higher chance to score from any shot.', attr: 'shooting', needs: [60, 72, 84] },
  { id: 'finesse', label: 'Finesse Shot', description: 'Wider power sweet spot in the shot mini-game.', attr: 'composure', needs: [58, 70, 82] },
  { id: 'speedster', label: 'Speed Burst', description: 'Beat defenders more often; longer dribble window.', attr: 'pace', needs: [62, 74, 86] },
  { id: 'dribbler', label: 'Close Control', description: 'Better dribble success and more dribble chances.', attr: 'dribbling', needs: [60, 72, 84] },
  { id: 'playmaker', label: 'Playmaker', description: 'More time to pick passes; passes find their man more.', attr: 'vision', needs: [58, 70, 82] },
  { id: 'setpiece', label: 'Dead Ball Specialist', description: 'Better free kicks and penalties.', attr: 'shooting', needs: [62, 74, 86] },
  { id: 'engine', label: 'Engine', description: 'Lose less fitness in matches and training.', attr: 'physical', needs: [55, 67, 79] },
  { id: 'wall', label: 'Rock at the Back', description: 'Your team concedes fewer chances while you play.', attr: 'defending', needs: [60, 72, 84] },
  { id: 'leader', label: 'Leader', description: 'Lifts team morale after wins; better match ratings.', attr: 'composure', needs: [62, 74, 86] },
  { id: 'shotstopper', label: 'Shot Stopper', description: 'Better at saves, including your save moments.', attr: 'goalkeeping', needs: [55, 68, 80] },
  { id: 'clutch', label: 'Big Game Player', description: 'Better key moments after the 75th minute.', attr: 'composure', needs: [64, 76, 88] },
];

// XP needed to go from this level to the next. Rises so early levels come
// fast and the last skills take most of a career.
export function xpForLevel(level: number): number {
  return 180 + 45 * level;
}

export function skillLevel(p: Player, id: string): number {
  return p.skills?.[id] ?? 0;
}

const GK_SKILLS = ['shotstopper', 'playmaker', 'engine', 'leader', 'clutch'];

// Skills that make sense for the player's position.
export function skillsFor(p: Pick<Player, 'position'>): SkillDef[] {
  return p.position === 'GK' ? SKILLS.filter((s) => GK_SKILLS.includes(s.id)) : SKILLS.filter((s) => s.id !== 'shotstopper');
}

export function canUpgrade(p: Player, id: string, points: number): { ok: boolean; reason?: string } {
  const def = skillsFor(p).find((s) => s.id === id);
  if (!def) return { ok: false, reason: 'Not available for your position.' };
  const lvl = skillLevel(p, id);
  if (lvl >= 3) return { ok: false, reason: 'Maxed out.' };
  const cost = lvl + 1;
  if (points < cost) return { ok: false, reason: `Needs ${cost} skill point${cost > 1 ? 's' : ''}.` };
  if (p.attrs[def.attr] < def.needs[lvl]) return { ok: false, reason: `Needs ${def.attr} ${def.needs[lvl]}.` };
  return { ok: true };
}

// AI players: skills follow from attributes.
export function autoSkills(p: Player): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of SKILLS) {
    let lvl = 0;
    for (let i = 0; i < 3; i++) if (p.attrs[def.attr] >= def.needs[i] + 6) lvl = i + 1;
    if (def.id === 'wall' && p.position !== 'DEF' && p.position !== 'GK') lvl = 0;
    if ((def.id === 'finisher' || def.id === 'setpiece') && p.position === 'GK') lvl = 0;
    if (def.id === 'shotstopper' && p.position !== 'GK') lvl = 0;
    if (lvl) out[def.id] = lvl;
  }
  return out;
}

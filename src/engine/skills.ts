import { AttrKey, Player } from './types';

// Progressive skills. Each has three levels; a level needs skill points
// and a minimum attribute. The career player earns points by levelling up.
// AI players get skills from their attributes when created.

export interface SkillDef {
  id: string;
  label: string;
  description: string;
  attr: AttrKey;
  // Attribute the career player needs for levels 1, 2 and 3. Level 1 is in
  // reach early, so the first skill points can be spent straight away.
  needs: [number, number, number];
  // Thresholds AI players are measured against. Kept apart so making
  // upgrades friendlier does not hand every AI player extra skills.
  ai: [number, number, number];
}

export const SKILLS: SkillDef[] = [
  { id: 'finisher', label: 'Clinical Finisher', description: 'Higher chance to score from any shot.', attr: 'shooting', needs: [48, 66, 82], ai: [60, 72, 84] },
  { id: 'finesse', label: 'Finesse Shot', description: 'Wider power sweet spot in the shot mini-game.', attr: 'composure', needs: [46, 64, 80], ai: [58, 70, 82] },
  { id: 'speedster', label: 'Speed Burst', description: 'Beat defenders more often; longer dribble window.', attr: 'pace', needs: [50, 68, 84], ai: [62, 74, 86] },
  { id: 'dribbler', label: 'Close Control', description: 'Better dribble success and more dribble chances.', attr: 'dribbling', needs: [48, 66, 82], ai: [60, 72, 84] },
  { id: 'playmaker', label: 'Playmaker', description: 'More time to pick passes; passes find their man more.', attr: 'vision', needs: [46, 64, 80], ai: [58, 70, 82] },
  { id: 'setpiece', label: 'Dead Ball Specialist', description: 'Better free kicks and penalties.', attr: 'shooting', needs: [50, 68, 84], ai: [62, 74, 86] },
  { id: 'engine', label: 'Engine', description: 'Lose less fitness in matches and training.', attr: 'physical', needs: [43, 61, 77], ai: [55, 67, 79] },
  { id: 'wall', label: 'Rock at the Back', description: 'Your team concedes fewer chances while you play.', attr: 'defending', needs: [48, 66, 82], ai: [60, 72, 84] },
  { id: 'leader', label: 'Leader', description: 'Lifts team morale after wins; better match ratings.', attr: 'composure', needs: [50, 68, 84], ai: [62, 74, 86] },
  { id: 'shotstopper', label: 'Shot Stopper', description: 'Better at saves, including your save moments.', attr: 'goalkeeping', needs: [43, 62, 78], ai: [55, 68, 80] },
  { id: 'clutch', label: 'Big Game Player', description: 'Better key moments after the 75th minute.', attr: 'composure', needs: [52, 70, 86], ai: [64, 76, 88] },
];

export const ABILITY_COST = 1;

// Skill moves: tricks the career player unlocks with skill points. Dribble
// moves are picked in a dribble moment for a better chance of beating the
// man; finishing moves add a little to the shots they suit.
export interface SkillMove {
  id: string;
  label: string;
  kind: 'dribble' | 'finish';
  stars: 1 | 2 | 3 | 4 | 5;
  // Icon name from the app's icon set.
  icon: string;
  // Dribbling (dribble moves) or shooting (finishing moves) needed.
  needs: number;
  description: string;
}

export const SKILL_MOVES: SkillMove[] = [
  { id: 'dragback', label: 'Drag back', kind: 'dribble', stars: 1, icon: 'return-down-back', needs: 35, description: 'Pull it back and turn away.' },
  { id: 'stepover', label: 'Stepover', kind: 'dribble', stars: 2, icon: 'swap-horizontal', needs: 44, description: 'Fake one way, go the other.' },
  { id: 'ballroll', label: 'Ball roll', kind: 'dribble', stars: 2, icon: 'sync', needs: 46, description: 'Roll it across your body.' },
  { id: 'nutmeg', label: 'Nutmeg', kind: 'dribble', stars: 2, icon: 'git-merge', needs: 48, description: 'Through his legs.' },
  { id: 'turn', label: 'Hook turn', kind: 'dribble', stars: 3, icon: 'refresh', needs: 55, description: 'A sharp turn behind the standing leg.' },
  { id: 'heelflick', label: 'Heel flick', kind: 'dribble', stars: 3, icon: 'footsteps', needs: 58, description: 'Flick it past him with the heel.' },
  { id: 'roulette', label: 'Roulette', kind: 'dribble', stars: 4, icon: 'reload-circle', needs: 66, description: 'Spin over the ball, twice.' },
  { id: 'elastico', label: 'Elastico', kind: 'dribble', stars: 4, icon: 'pulse', needs: 70, description: 'Out and back in one touch.' },
  { id: 'rainbow', label: 'Rainbow flick', kind: 'dribble', stars: 5, icon: 'sparkles', needs: 78, description: 'Over his head from behind.' },
  { id: 'placed', label: 'Placed finish', kind: 'finish', stars: 1, icon: 'locate', needs: 40, description: 'Shots: a little more accurate.' },
  { id: 'chip', label: 'Chip shot', kind: 'finish', stars: 2, icon: 'trending-up', needs: 50, description: 'One on ones: lift it over the keeper.' },
  { id: 'trivela', label: 'Outside foot', kind: 'finish', stars: 3, icon: 'navigate', needs: 60, description: 'Curl it with the outside of the boot.' },
  { id: 'knuckle', label: 'Knuckleball', kind: 'finish', stars: 3, icon: 'flash', needs: 62, description: 'Free kicks that dip and swerve.' },
  { id: 'powerheader', label: 'Power header', kind: 'finish', stars: 3, icon: 'arrow-up-circle', needs: 58, description: 'Headers: more power, more goals.' },
  { id: 'scissor', label: 'Scissor kick', kind: 'finish', stars: 5, icon: 'rocket', needs: 76, description: 'Acrobatic volleys from crosses.' },
];

export function moveCost(m: SkillMove): number {
  return m.stars;
}

export function hasMove(p: Player, id: string): boolean {
  return !!p.moves?.includes(id);
}

export function canLearnMove(p: Player, id: string, points: number): { ok: boolean; reason?: string } {
  const m = SKILL_MOVES.find((x) => x.id === id);
  if (!m) return { ok: false, reason: 'Unknown move.' };
  if (hasMove(p, id)) return { ok: false, reason: 'Already learned.' };
  if (p.position === 'GK') return { ok: false, reason: 'Keepers leave the tricks to others.' };
  const attr = m.kind === 'dribble' ? p.attrs.dribbling : p.attrs.shooting;
  if (attr < m.needs) return { ok: false, reason: `Needs ${m.kind === 'dribble' ? 'dribbling' : 'shooting'} ${m.needs}.` };
  if (points < moveCost(m)) return { ok: false, reason: `Needs ${moveCost(m)} skill point${moveCost(m) > 1 ? 's' : ''}.` };
  return { ok: true };
}

// The extra chance a finishing move adds to a kind of key moment.
export function finishBonus(p: Player, kind: string): number {
  const has = (id: string) => hasMove(p, id);
  let b = has('placed') ? 0.015 : 0;
  if (kind === 'shot' && has('chip')) b += 0.02;
  if (kind === 'shot' && has('trivela')) b += 0.015;
  if (kind === 'freekick' && has('knuckle')) b += 0.04;
  if (kind === 'header' && has('powerheader')) b += 0.04;
  if (kind === 'header' && has('scissor')) b += 0.02;
  return b;
}

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
  // Abilities are the cheap upgrade: one point a level. Skill moves (below)
  // are where points go further.
  const cost = ABILITY_COST;
  if (points < cost) return { ok: false, reason: `Needs ${cost} skill point${cost > 1 ? 's' : ''}.` };
  if (p.attrs[def.attr] < def.needs[lvl]) return { ok: false, reason: `Needs ${def.attr} ${def.needs[lvl]}.` };
  return { ok: true };
}

// AI players: skills follow from attributes.
export function autoSkills(p: Player): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of SKILLS) {
    let lvl = 0;
    for (let i = 0; i < 3; i++) if (p.attrs[def.attr] >= def.ai[i] + 6) lvl = i + 1;
    if (def.id === 'wall' && p.position !== 'DEF' && p.position !== 'GK') lvl = 0;
    if ((def.id === 'finisher' || def.id === 'setpiece') && p.position === 'GK') lvl = 0;
    if (def.id === 'shotstopper' && p.position !== 'GK') lvl = 0;
    if (lvl) out[def.id] = lvl;
  }
  return out;
}

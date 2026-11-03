import { AttrKey, Game, Player } from './types';
import { Rng, clamp } from './rng';
import { avgRating, formatMoney, overall, seasonRows, weightsFor } from './player';
import { MatchState } from './match';
import { ROLES, ROLE_NEIGHBOURS, SECONDARY_ROLE_COST, SECONDARY_ROLE_LEVEL, isRole } from './roles';
import { ABILITY_COST, SKILL_MOVES, canLearnMove, canUpgrade, moveCost, skillLevel, SKILLS } from './skills';
import { movePlayer } from './transfers';
import { recordTraining } from './progress';
import { addXp, careerPlayer, gainFame, squadStatus } from './careerBase';
import { canUnlock, nodeCost, nodeLabel, nodeOwned, treeFor } from './skillTree';

export { addXp, careerPlayer, squadStatus };

export interface Drill {
  id: string;
  label: string;
  attrs: AttrKey[];
  energy: number;
}

// Three sessions a week (84 of the 100 energy), leaving room for a rest day.
export const DRILLS: Drill[] = [
  { id: 'finishing', label: 'Finishing', attrs: ['shooting', 'composure'], energy: 28 },
  { id: 'speed', label: 'Sprints and gym', attrs: ['pace', 'physical'], energy: 28 },
  { id: 'playmaking', label: 'Passing patterns', attrs: ['passing', 'vision'], energy: 28 },
  { id: 'technique', label: 'Ball mastery', attrs: ['dribbling', 'composure'], energy: 28 },
  { id: 'defending', label: 'Defensive shape', attrs: ['defending', 'physical'], energy: 28 },
  { id: 'keeping', label: 'Goalkeeping', attrs: ['goalkeeping', 'composure'], energy: 28 },
];

// Keepers get their own drill; outfield players do not see it.
const GK_DRILLS = ['keeping', 'speed', 'playmaking'];

export function drillsFor(p: Player): Drill[] {
  return p.position === 'GK' ? DRILLS.filter((d) => GK_DRILLS.includes(d.id)) : DRILLS.filter((d) => d.id !== 'keeping');
}

export interface ShopItem {
  id: string;
  label: string;
  price: number;
  description: string;
}

export const SHOP: ShopItem[] = [
  { id: 'nutrition', label: 'Nutritionist', price: 10_000, description: 'Recover 6 more fitness each week. Slower decline with age.' },
  { id: 'physio', label: 'Private physio', price: 25_000, description: 'Injuries heal twice as fast.' },
  { id: 'trainer', label: 'Personal trainer', price: 40_000, description: 'Training gains up 25% and +10 XP per session.' },
  { id: 'agent', label: 'Top agent', price: 80_000, description: 'Better contracts and more offers.' },
  { id: 'car', label: 'Sports car', price: 150_000, description: 'A big fame boost. Fans love it.' },
  { id: 'house', label: 'Seaside villa', price: 1_500_000, description: 'Morale stays high all season.' },
];

export interface LifeAction {
  id: string;
  label: string;
  energy: number;
  description: string;
}

// Rest day leads: it is the one players reach for most.
export const LIFE_ACTIONS: LifeAction[] = [
  { id: 'rest', label: 'Rest day', energy: 15, description: 'Recover 20 fitness.' },
  { id: 'post', label: 'Post on social media', energy: 10, description: 'Small fame boost. Bigger after a good game.' },
  { id: 'charity', label: 'Charity visit', energy: 20, description: 'Fame and morale up. Costs $1K.' },
  { id: 'night', label: 'Night out', energy: 15, description: 'Morale up, fitness down.' },
  { id: 'video', label: 'Video analysis', energy: 15, description: '+15 XP toward your next skill point.' },
];


export type ActionResult = { ok: boolean; text: string };


// Training slows as a player ages and as he nears his ceiling.
export function trainingGain(p: Player, hasTrainer: boolean): number {
  // Teenagers improve fastest, so early seasons feel rewarding; growth then
  // tapers so the peak arrives in the mid-to-late twenties, not at 21.
  const age = p.age <= 18 ? 1.1 : p.age <= 19 ? 0.9 : p.age <= 21 ? 0.6 : p.age <= 23 ? 0.45 : p.age <= 27 ? 0.35 : p.age <= 30 ? 0.2 : 0.1;
  const room = clamp((p.potential - overall(p)) / 20, 0.03, 1);
  return 0.26 * age * room * (hasTrainer ? 1.25 : 1) * (0.85 + (0.3 * p.morale) / 100);
}

// score is the training mini-game result, 0..1. Quick training uses 0.35.
export function train(game: Game, drillId: string, score = 0.35): ActionResult & { gains?: Partial<Record<AttrKey, number>>; xp?: number } {
  const c = game.career!;
  const drill = DRILLS.find((d) => d.id === drillId);
  const p = careerPlayer(game);
  if (!drill) return { ok: false, text: 'Unknown drill.' };
  if (p.injuryWeeks > 0) return { ok: false, text: 'You are injured. Rest up.' };
  if (c.energy < drill.energy) return { ok: false, text: 'Not enough energy this week.' };
  const rng = new Rng(game.world.rngState);
  c.energy -= drill.energy;
  c.trainedThisWeek++;
  const mult = 0.6 + 0.9 * Math.max(0, Math.min(1, score));
  const gain = trainingGain(p, c.items.includes('trainer')) * mult;
  const gains: string[] = [];
  const deltas: Partial<Record<AttrKey, number>> = {};
  for (const k of drill.attrs) {
    const before = p.attrs[k];
    const g = gain * rng.range(0.8, 1.2);
    p.attrs[k] = clamp(p.attrs[k] + g, 1, 99);
    deltas[k] = p.attrs[k] - before;
    gains.push(`${k} +${g.toFixed(1)}`);
  }
  p.fitness = clamp(p.fitness - 4 * (1 - 0.15 * skillLevel(p, 'engine')), 0, 100);
  const xp = Math.round((c.items.includes('trainer') ? 22 : 15) * (0.7 + score));
  let text = `${drill.label}: ${gains.join(', ')}. +${xp} XP.`;
  const lvl = addXp(game, xp);
  recordTraining(game);
  if (lvl) text += ` ${lvl}`;
  // Pushing on tired legs risks a knock.
  if (p.fitness < 45 && rng.chance(0.1)) {
    p.injuryWeeks = rng.int(1, 3);
    text += ` You felt something go. Out for ${p.injuryWeeks} week(s).`;
  }
  game.world.rngState = rng.state;
  return { ok: true, text, gains: deltas, xp };
}

export function upgradeSkill(game: Game, skillId: string): ActionResult {
  const c = game.career!;
  const p = careerPlayer(game);
  const check = canUpgrade(p, skillId, c.skillPoints);
  if (!check.ok) return { ok: false, text: check.reason! };
  const lvl = skillLevel(p, skillId) + 1;
  c.skillPoints -= ABILITY_COST;
  p.skills = { ...(p.skills ?? {}), [skillId]: lvl };
  const def = SKILLS.find((s) => s.id === skillId)!;
  return { ok: true, text: `${def.label} is now level ${lvl}.` };
}

// Unlocks the next node of a skill tree branch (see skillTree.ts).
export function unlockNode(game: Game, branchId: string, index: number): ActionResult {
  const c = game.career!;
  const p = careerPlayer(game);
  const branch = treeFor(p).find((b) => b.id === branchId);
  const node = branch?.nodes[index];
  if (!branch || !node) return { ok: false, text: 'Not in your tree.' };
  if (!branch.nodes.slice(0, index).every((n) => nodeOwned(p, n))) return { ok: false, text: 'Unlock the one above it first.' };
  const check = canUnlock(p, node, c.skillPoints);
  if (!check.ok) return { ok: false, text: check.reason! };
  if (node.kind === 'skill') return upgradeSkill(game, node.skill);
  c.skillPoints -= nodeCost(node);
  p.skills = { ...(p.skills ?? {}), [node.tech]: 1 };
  return { ok: true, text: `${nodeLabel(node)} unlocked.` };
}

export function learnMove(game: Game, moveId: string): ActionResult {
  const c = game.career!;
  const p = careerPlayer(game);
  const check = canLearnMove(p, moveId, c.skillPoints);
  if (!check.ok) return { ok: false, text: check.reason! };
  const m = SKILL_MOVES.find((x) => x.id === moveId)!;
  c.skillPoints -= moveCost(m);
  p.moves = [...(p.moves ?? []), m.id];
  return { ok: true, text: `${m.label} learned.` };
}

export function lifeAction(game: Game, actionId: string): ActionResult {
  const c = game.career!;
  const a = LIFE_ACTIONS.find((x) => x.id === actionId);
  const p = careerPlayer(game);
  if (!a) return { ok: false, text: 'Unknown action.' };
  if (c.energy < a.energy) return { ok: false, text: 'Not enough energy this week.' };
  if (a.id === 'charity' && c.money < 1000) return { ok: false, text: 'You need $1K for the charity visit.' };
  const rng = new Rng(game.world.rngState);
  c.energy -= a.energy;
  let text = '';
  switch (a.id) {
    case 'post': {
      const gain = clamp(rng.range(0.2, 1) * (avgRating(p.stats) >= 7 ? 2 : 1), 0, 3);
      gainFame(c, gain);
      text = `Your post gets ${Math.round(gain * 1200 + rng.int(50, 400) + c.fame * 900)} likes. Fame +${gain.toFixed(1)}.`;
      break;
    }
    case 'charity':
      c.money -= 1000;
      gainFame(c, 1.5);
      p.morale = clamp(p.morale + 6, 0, 100);
      text = 'The kids loved meeting you. Fame and morale up.';
      break;
    case 'night':
      p.morale = clamp(p.morale + 10, 0, 100);
      p.fitness = clamp(p.fitness - 10, 0, 100);
      text = 'A fun night out. Morale up, legs heavy.';
      break;
    case 'rest':
      p.fitness = clamp(p.fitness + 20, 0, 100);
      text = 'You put your feet up. Fitness +20.';
      break;
    case 'video': {
      const lvl = addXp(game, 15);
      text = `You study your last game. +15 XP.${lvl ? ` ${lvl}` : ''}`;
      break;
    }
  }
  game.world.rngState = rng.state;
  return { ok: true, text };
}

export function buyItem(game: Game, itemId: string): ActionResult {
  const c = game.career!;
  const item = SHOP.find((i) => i.id === itemId);
  const p = careerPlayer(game);
  if (!item) return { ok: false, text: 'Unknown item.' };
  if (c.items.includes(item.id)) return { ok: false, text: 'You already own that.' };
  if (c.money < item.price) return { ok: false, text: `You need ${formatMoney(item.price)}.` };
  c.money -= item.price;
  c.items.push(item.id);
  if (item.id === 'car') gainFame(c, 5);
  if (item.id === 'house') p.morale = 100;
  return { ok: true, text: `Bought: ${item.label}.` };
}

// After a match: fame, XP, and a little growth from game time.
export function afterCareerMatch(game: Game, s: MatchState): string | null {
  const c = game.career!;
  const p = careerPlayer(game);
  const played = s.home.usedIds.includes(p.id) || s.away.usedIds.includes(p.id);
  const homeSide = played ? s.home.usedIds.includes(p.id) : s.home.bench.includes(p.id);
  const mine = homeSide ? s.home : s.away;
  const theirs = homeSide ? s.away : s.home;
  const result: 'W' | 'D' | 'L' = mine.goals > theirs.goals || s.penaltyWinner === mine.clubId ? 'W' : mine.goals < theirs.goals || s.penaltyWinner ? 'L' : 'D';
  if (!played) {
    p.morale = clamp(p.morale - 3, 0, 100);
    c.lastMatch = { fixtureId: s.fixtureId, played: false, result, rating: 0, goals: 0, assists: 0, xp: 0, fame: 0, money: 0, levels: 0, motm: false };
    return null;
  }
  const rating = s.ratings[p.id] ?? 6;
  const goals = s.goals[p.id] ?? 0;
  const assists = s.assists[p.id] ?? 0;
  const homeTeam = game.world.clubs[s.home.clubId] ?? game.world.nationalTeams[s.home.clubId];
  const myTeamId = s.home.usedIds.includes(p.id) ? s.home.clubId : s.away.clubId;
  const team = game.world.clubs[myTeamId] ?? game.world.nationalTeams[myTeamId] ?? homeTeam;
  const stage = 0.6 + team.reputation / 100 + (team.national ? 0.5 : 0);
  const fameBefore = c.fame;
  gainFame(c, stage * (0.2 + goals * 0.5 + assists * 0.4 + Math.max(0, rating - 7) * 0.5 + (result === 'W' ? 0.15 : 0)));
  // A win bonus, so winning pays as well as feeling good.
  const bonus = result === 'W' && !team.national ? Math.max(250, Math.round((p.wage * 0.5) / 50) * 50) : 0;
  c.money += bonus;
  const best = Math.max(...Object.values(s.ratings));
  const w = weightsFor(p);
  const young = p.age <= 19 ? 1 : p.age <= 23 ? 0.5 : 0.2;
  for (const k of Object.keys(w) as AttrKey[]) p.attrs[k] = clamp(p.attrs[k] + 0.06 * (w[k] ?? 0) * 4 * young * (overall(p) < p.potential ? 1 : 0), 1, 99);
  const xp = Math.round(20 + goals * 15 + assists * 14 + Math.max(0, rating - 6) * 10 + (result === 'W' ? 10 : 0));
  const levelBefore = c.level;
  const xpBefore = c.xp;
  const lvl = addXp(game, xp);
  c.lastMatch = { fixtureId: s.fixtureId, played: true, result, rating, goals, assists, xp, fame: c.fame - fameBefore, money: bonus, levels: c.level - levelBefore, xpBefore, levelBefore, motm: rating >= best };
  return lvl;
}

export function retire(game: Game): void {
  const c = game.career!;
  const p = careerPlayer(game);
  c.retired = true;
  p.retired = true;
  p.history.push(...seasonRows(p, game.world.season));
  p.stats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
  p.seasonSplits = undefined;
  if (p.clubId) movePlayer(game.world, p, null);
  game.world.freeAgents = game.world.freeAgents.filter((id) => id !== p.id);
  // Nothing left to answer once the boots are hung up.
  for (const m of game.inbox) if (m.action && !m.action.resolved) m.action.resolved = 'expired';
}


export function learnSecondary(game: Game, role: string): ActionResult {
  const c = game.career!;
  const p = careerPlayer(game);
  if (c.level < SECONDARY_ROLE_LEVEL) return { ok: false, text: `Unlocks at level ${SECONDARY_ROLE_LEVEL}.` };
  if (!p.role || !isRole(p.role) || !isRole(role) || !ROLE_NEIGHBOURS[p.role].includes(role)) return { ok: false, text: 'That position does not suit you.' };
  if (p.secondaryRole === role) return { ok: false, text: 'You already play there.' };
  if (c.skillPoints < SECONDARY_ROLE_COST) return { ok: false, text: `Needs ${SECONDARY_ROLE_COST} skill points.` };
  c.skillPoints -= SECONDARY_ROLE_COST;
  p.secondaryRole = role;
  return { ok: true, text: `You can now play ${ROLES[role].label}.` };
}

import { Game, Message } from './types';
import { SKILL_MOVES, SkillMove, canLearnMove } from './skills';
import { nodeLabel, readyNodes } from './skillTree';
import { claimables } from './progress';
import { ROLE_NEIGHBOURS, SECONDARY_ROLE_COST, SECONDARY_ROLE_LEVEL, isRole } from './roles';

// The game only nags about things the player has to act on: messages that
// need an answer and upgrades they can buy right now. News stays quiet.

// Open messages, the ones about to expire first.
export function actionMessages(game: Game): Message[] {
  return game.inbox.filter((m) => m.action && !m.action.resolved).sort((a, b) => (a.action!.weeksLeft ?? 99) - (b.action!.weeksLeft ?? 99));
}

// Tree nodes the career player can unlock with the points they have now.
export function readyUpgrades(game: Game): { id: string; label: string }[] {
  const c = game.career;
  if (!c || c.retired) return [];
  const p = game.world.players[c.playerId];
  return readyNodes(p, c.skillPoints).map(({ node }) => ({ id: node.kind === 'skill' ? node.skill : node.tech, label: nodeLabel(node) }));
}

// A second position counts as an upgrade only until one is learned, so
// the badge does not stay on for good once it is unlocked.
export function canLearnSecondary(game: Game): boolean {
  const c = game.career;
  if (!c || c.retired) return false;
  const p = game.world.players[c.playerId];
  return c.level >= SECONDARY_ROLE_LEVEL && c.skillPoints >= SECONDARY_ROLE_COST && !p.secondaryRole && !!p.role && isRole(p.role) && ROLE_NEIGHBOURS[p.role].length > 0;
}

// Every upgrade costs at least a point, so with one point there is one
// upgrade to make, however many skills qualify.
export function readyMoves(game: Game): SkillMove[] {
  const c = game.career;
  if (!c || c.retired) return [];
  const p = game.world.players[c.playerId];
  return SKILL_MOVES.filter((m) => canLearnMove(p, m.id, c.skillPoints).ok);
}

export function upgradeCount(game: Game): number {
  const total = readyUpgrades(game).length + readyMoves(game).length + (canLearnSecondary(game) ? 1 : 0);
  return Math.min(total, game.career?.skillPoints ?? 0);
}

export function navBadges(game: Game): Record<string, number> {
  return {
    '/career': claimables(game).length, '/inbox': actionMessages(game).length, '/career/train': upgradeCount(game) };
}

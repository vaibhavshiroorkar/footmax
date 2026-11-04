import { Game, Message } from './types';
import { SKILL_MOVES, SkillMove, canLearnMove } from './skills';
import { moveFee } from './perks';
import { nodeLabel, readyNodes } from './skillTree';
import { claimables } from './progress';

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
  return readyNodes(p, c.skillPoints).map((node) => ({ id: node.id, label: nodeLabel(node) }));
}

// Skill moves he could start training right now.
export function readyMoves(game: Game): SkillMove[] {
  const c = game.career;
  if (!c || c.retired || c.moveTraining) return [];
  const p = game.world.players[c.playerId];
  return SKILL_MOVES.filter((m) => canLearnMove(p, m.id).ok && c.money >= moveFee(m, p));
}

// Every node costs at least a point, so with one point there is one upgrade
// to make, however many qualify. A move to train counts once.
export function upgradeCount(game: Game): number {
  return Math.min(readyUpgrades(game).length, game.career?.skillPoints ?? 0) + (readyMoves(game).length ? 1 : 0);
}

export function navBadges(game: Game): Record<string, number> {
  return {
    '/career/profile': claimables(game).length, '/inbox': actionMessages(game).length, '/career/train': upgradeCount(game) };
}

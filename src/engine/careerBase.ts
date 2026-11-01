import { Game, Player, Position } from './types';
import { ratingAt, squad } from './lineup';
import { ROLES, isRole } from './roles';
import { xpForLevel } from './skills';

// Career helpers shared by career, progress, relations and offers. Kept
// apart so those modules do not import each other in a circle.

export function careerPlayer(game: Game): Player {
  return game.world.players[game.career!.playerId];
}

// XP turns into levels; each level gives one skill point.
export function addXp(game: Game, xp: number): string | null {
  const c = game.career!;
  c.xp += xp;
  let levelled = 0;
  while (c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++;
    c.skillPoints++;
    levelled++;
  }
  return levelled ? `Level up! You are level ${c.level}. +${levelled} skill point${levelled > 1 ? 's' : ''}.` : null;
}

// Squad rank among team-mates for the "playing time" hint. A learned
// secondary role counts too; the better of the two is reported.
export function squadStatus(game: Game): string {
  const p = careerPlayer(game);
  if (!p.clubId) return 'Free agent';
  const club = game.world.clubs[p.clubId];
  const slots: Record<Position, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
  const positions: Position[] = [p.position];
  if (p.secondaryRole && isRole(p.secondaryRole)) positions.push(ROLES[p.secondaryRole].broad);
  let best = 99;
  let bestPos = p.position;
  for (const pos of positions) {
    const ranked = squad(game.world, club)
      .filter((x) => ratingAt(x, pos) >= 0)
      .sort((a, b) => ratingAt(b, pos) - ratingAt(a, pos));
    const rank = ranked.findIndex((x) => x.id === p.id) + 1 - slots[pos];
    if (rank < best) {
      best = rank;
      bestPos = pos;
    }
  }
  if (best <= 0) return bestPos === p.position ? 'Starter' : 'Starter (2nd position)';
  if (best <= 2) return 'Rotation';
  return 'Squad player';
}

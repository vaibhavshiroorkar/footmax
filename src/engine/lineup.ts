import { Club, Formation, Player, Position, World } from './types';
import { matchRating, overall } from './player';
import { ROLES, isRole } from './roles';

export const FORMATIONS: Record<Formation, Record<Position, number>> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
};

export const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

// Clubs and national teams share the Club shape; matches look up either.
export function teamById(world: World, id: string): Club {
  return world.clubs[id] ?? world.nationalTeams[id];
}

export function squad(world: World, club: Club): Player[] {
  return club.playerIds.map((id) => world.players[id]).filter(Boolean);
}

export function available(p: Player): boolean {
  return p.injuryWeeks === 0 && !(p.suspendedWeeks ?? 0) && !p.retired;
}

// Best XI for the formation. Gaps in a position are filled by the best
// remaining outfield players so a club never fields fewer than 11.
// How well a player fills a broad slot: his main position, or his learned
// secondary role at a small penalty.
// Recent form nudges selection: a run of poor games gets you dropped.
export function formFactor(p: Player): number {
  const f = p.form ?? [];
  if (f.length < 3) return 1;
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  return 1 + Math.max(-0.1, Math.min(0.06, (avg - 6.6) * 0.06));
}

export function formAverage(p: Player): number | null {
  const f = p.form ?? [];
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
}

export function ratingAt(p: Player, pos: Position): number {
  if (p.position === pos) return matchRating(p) * formFactor(p);
  if (p.secondaryRole && isRole(p.secondaryRole) && ROLES[p.secondaryRole].broad === pos) {
    return matchRating(p) * formFactor(p) * (overall({ ...p, role: p.secondaryRole }) / Math.max(1, overall(p))) * 0.97;
  }
  return -1;
}

export function autoLineup(world: World, club: Club): string[] {
  const players = squad(world, club).filter(available);
  const shape = FORMATIONS[club.formation];
  const chosen: Player[] = [];
  for (const pos of POSITIONS) {
    const best = players
      .filter((p) => ratingAt(p, pos) >= 0 && !chosen.includes(p))
      .sort((a, b) => ratingAt(b, pos) - ratingAt(a, pos))
      .slice(0, shape[pos]);
    chosen.push(...best);
  }
  const rest = players.filter((p) => !chosen.includes(p)).sort((a, b) => matchRating(b) - matchRating(a));
  while (chosen.length < 11 && rest.length) chosen.push(rest.shift()!);
  return chosen.map((p) => p.id);
}

export function validLineup(world: World, club: Club, ids: string[] | null): boolean {
  if (!ids || ids.length !== 11 || new Set(ids).size !== 11) return false;
  return ids.every((id) => club.playerIds.includes(id) && world.players[id] && available(world.players[id]));
}

export function startingXI(world: World, club: Club): string[] {
  return validLineup(world, club, club.lineup) ? club.lineup! : autoLineup(world, club);
}

// Best reserves, with at most one keeper on the bench.
export function bench(world: World, club: Club, xi: string[], size = 7): string[] {
  const reserves = squad(world, club)
    .filter((p) => available(p) && !xi.includes(p.id))
    .sort((a, b) => matchRating(b) - matchRating(a));
  const keeper = reserves.find((p) => p.position === 'GK');
  const outfield = reserves.filter((p) => p.position !== 'GK');
  return [...(keeper ? [keeper] : []), ...outfield].slice(0, size).map((p) => p.id);
}

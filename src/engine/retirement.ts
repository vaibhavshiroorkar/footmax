import { Game } from './types';
import { clamp } from './rng';
import { careerPlayer } from './careerBase';
import { overall, seasonRows } from './player';
import { movePlayer } from './transfers';

// Ends the career, by choice or not. The season so far goes into the history
// first, so the summary has every game; then the player leaves his club and
// nothing in the inbox is left to answer.
export function closeCareer(game: Game, reason?: string): void {
  const c = game.career!;
  const p = careerPlayer(game);
  c.retired = true;
  if (reason) c.endReason = reason;
  p.retired = true;
  p.history.push(...seasonRows(p, game.world.season));
  p.stats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
  p.seasonSplits = undefined;
  if (p.clubId) movePlayer(game.world, p, null);
  game.world.freeAgents = game.world.freeAgents.filter((id) => id !== p.id);
  for (const m of game.inbox) if (m.action && !m.action.resolved) m.action.resolved = 'expired';
}

// A fixed part of each body: some last, some do not. -2 to +2 years.
function constitution(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) - 2;
}

// The age at which the body and the career say stop. Players retire at 32.7
// on average (sd 4.3, range 21 to 45, RESEARCH.md) and keepers play longest.
// This career player turned pro at 16, so the base sits above that average.
// The result moves each season with his body, his level and his injuries,
// and always lands between 30 and 41.
export function retirementAge(game: Game): number {
  const c = game.career!;
  const p = careerPlayer(game);
  const position = p.position === 'GK' ? 4 : p.position === 'DEF' ? 1 : p.position === 'FWD' ? -1 : 0;
  const body = clamp((p.attrs.physical - 70) / 10, -2, 2);
  const care = c.items.includes('nutrition') ? 1 : 0;
  // Twenty weeks out injured cost a year, up to three.
  const wear = -Math.min(3, Math.floor((c.injuredWeeks ?? 0) / 20));
  // Still good enough for a big club: there is always another contract.
  const level = overall(p) >= 82 ? 1 : overall(p) < 62 ? -2 : overall(p) < 70 ? -1 : 0;
  const mind = c.depressed ? -1 : 0;
  return Math.round(clamp(34 + position + body + care + wear + level + mind + constitution(p.id), 30, 41));
}

import type { MatchState } from './match';
import type { Game, World } from './types';

export function captureResultPlayers(world: World, match: MatchState): void {
  if (match.resultPlayers) return;
  const ids = new Set([match.home, match.away].flatMap((side) => [...side.onPitch, ...side.bench, ...side.usedIds]));
  match.resultPlayers = Object.fromEntries([...ids].map((id) => [id, JSON.parse(JSON.stringify(world.players[id]))]));
}

export function gameForMatchResult(game: Game, match: MatchState | null): Game {
  if (!match?.finished || !match.resultPlayers) return game;
  return { ...game, world: { ...game.world, players: { ...game.world.players, ...match.resultPlayers } } };
}

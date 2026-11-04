import { Fixture, Game, MatchRecord } from './types';
import { MatchState } from './match';

// Enough for a long career. The oldest go first.
const KEEP = 800;

// Which competition a fixture belongs to, for the history list.
function competition(game: Game, f: Fixture): string {
  const w = game.world;
  if (f.europe) return f.stage ? `Champions League, ${f.stage}` : 'Champions League';
  const league = w.leagues.find((l) => l.fixtures.includes(f));
  if (league) return league.name;
  const cup = w.tournaments?.find((t) => t.fixtures.includes(f));
  if (cup) return f.stage ? `${cup.name}, ${f.stage}` : cup.name;
  return f.stage ?? 'International';
}

// Writes one finished match of the user's team into the history.
export function logMatch(game: Game, f: Fixture, s: MatchState, teamId: string): void {
  const id = game.career?.playerId;
  const played = !!id && (s.home.usedIds.includes(id) || s.away.usedIds.includes(id));
  const entry: MatchRecord = {
    teamId,
    season: game.world.season,
    week: f.week,
    comp: competition(game, f),
    homeId: f.homeId,
    awayId: f.awayId,
    homeGoals: s.home.goals,
    awayGoals: s.away.goals,
    penaltyWinner: s.penaltyWinner,
    pens: s.shootout ? [s.shootout.h, s.shootout.a] : undefined,
    extraTime: s.extraTime || undefined,
  };
  if (played && id) {
    entry.rating = s.ratings[id];
    entry.goals = s.goals[id] ?? 0;
    entry.assists = s.assists[id] ?? 0;
  }
  game.matchLog = [...(game.matchLog ?? []), entry].slice(-KEEP);
}

// W, D or L for the user's team. A shoot-out counts as a win or a loss.
export function resultFor(r: MatchRecord): 'W' | 'D' | 'L' {
  const mine = r.homeId === r.teamId ? r.homeGoals : r.awayGoals;
  const theirs = r.homeId === r.teamId ? r.awayGoals : r.homeGoals;
  if (r.penaltyWinner) return r.penaltyWinner === r.teamId ? 'W' : 'L';
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}

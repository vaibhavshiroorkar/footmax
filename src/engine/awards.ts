import { AwardEntry, Game, Player, SeasonAwards } from './types';
import { avgRating, fullName } from './player';
import { leagueTable } from './league';
import { addMessage } from './inbox';

// Global awards at the end of the league season: Ballon d'Or (best player),
// Golden Boy (best under-21), Yashin Trophy (best keeper), Golden Boot (most
// league goals). Only players in the simulated leagues are eligible.

function entry(game: Game, p: Player, score: number): AwardEntry {
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  return { playerId: p.id, name: fullName(p), clubName: club?.name ?? 'Free agent', score: Math.round(score * 10) / 10 };
}

// minApps defaults to 10 for the real ceremony; the live race mid-season
// uses a lower bar so it has names from the first weeks.
export function computeAwards(game: Game, minApps = 10): SeasonAwards {
  const world = game.world;
  const champions = new Set(world.leagues.map((l) => leagueTable(l, world)[0]?.clubId));
  const topTier = new Set(world.leagues.filter((l) => l.tier === 1).flatMap((l) => l.clubIds));
  const pool = world.leagues.flatMap((l) => l.clubIds.flatMap((id) => world.clubs[id].playerIds.map((pid) => world.players[pid]))).filter((p) => p && p.stats.apps >= minApps);

  // Stage matters: a top-flight title winner beats the same numbers in a
  // smaller league.
  const score = (p: Player) => {
    const stage = topTier.has(p.clubId ?? '') ? 1 : 0.7;
    const title = champions.has(p.clubId ?? '') ? 8 : 0;
    const keeper = p.position === 'GK' ? 6 : 0;
    return (avgRating(p.stats) * 8 + p.stats.goals * 0.9 + p.stats.assists * 0.55 + title + keeper) * stage;
  };
  const ranked = (list: Player[], fn: (p: Player) => number, n: number) =>
    list
      .map((p) => ({ p, s: fn(p) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map(({ p, s }) => entry(game, p, s));

  return {
    season: world.season,
    ballonDor: ranked(pool, score, 30),
    goldenBoy: ranked(pool.filter((p) => p.age <= 21), score, 10),
    yashin: ranked(pool.filter((p) => p.position === 'GK'), (p) => avgRating(p.stats) * 10 + (champions.has(p.clubId ?? '') ? 5 : 0), 10),
    goldenBoot: ranked(pool, (p) => p.stats.goals + p.stats.assists * 0.01, 10),
  };
}

export const AWARD_NAMES: Record<keyof Omit<SeasonAwards, 'season'>, string> = {
  ballonDor: "Ballon d'Or",
  goldenBoy: 'Golden Boy',
  yashin: 'Yashin Trophy',
  goldenBoot: 'European Golden Boot',
};

// Stores the awards, adds honours, and tells a career player where he placed.
export function presentAwards(game: Game): SeasonAwards {
  const world = game.world;
  const a = computeAwards(game);
  world.awards = [a, ...(world.awards ?? [])].slice(0, 15);
  for (const key of Object.keys(AWARD_NAMES) as (keyof typeof AWARD_NAMES)[]) {
    const w = a[key][0];
    if (w) world.honours.push({ season: world.season, title: AWARD_NAMES[key], winner: w.name, playerId: w.playerId });
  }
  const id = game.career?.playerId;
  if (id) {
    const lines: string[] = [];
    for (const key of Object.keys(AWARD_NAMES) as (keyof typeof AWARD_NAMES)[]) {
      const rank = a[key].findIndex((e) => e.playerId === id);
      if (rank === 0) lines.push(`You won the ${AWARD_NAMES[key]}!`);
      else if (rank > 0) lines.push(`${AWARD_NAMES[key]}: you finished ${rank + 1}${rank + 1 === 2 ? 'nd' : rank + 1 === 3 ? 'rd' : 'th'}.`);
    }
    if (lines.length) {
      if (game.career) game.career.fame = Math.min(100, game.career.fame + (lines.some((l) => l.startsWith('You won')) ? 15 : 4));
      addMessage(game, 'season', `Awards night ${world.season}/${String(world.season + 1).slice(2)}`, lines.join(' '));
    }
  }
  return a;
}

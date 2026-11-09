import { gainFame } from './careerBase';
import { AwardEntry, Game, Player, SeasonAwards } from './types';
import { avgRating, fullName } from './player';
import { leagueTable } from './league';
import { leagueStrength } from './generator';
import { addMessage } from './inbox';

// Global awards at the end of the league season: Ballon d'Or (best player),
// Golden Boy (best under-21), Yashin Trophy (best keeper), Golden Boot (most
// league goals). Who can win follows the real awards (RESEARCH.md):
// - Ballon d'Or and Yashin: a top flight strong enough to be noticed, or a
//   Champions League club. Every winner since 1995 played in one of the five
//   strongest leagues, so the winner comes from those, or from the club that
//   won the Champions League.
// - Golden Boy: under 21, in the top flight of a European league.
// - Golden Boot: European top flights only. Goals count double in the five
//   strongest, 1.5 times in a strong league (about the next 16 in Europe),
//   once elsewhere. The world builds smaller leagues only when a career
//   needs one, so strength decides the middle band, not rank.

// The weakest top flight whose players can make a shortlist.
const SHORTLIST_STRENGTH = 60;
// The weakest league whose Golden Boot goals count 1.5 times.
const BOOT_STRENGTH = 58;

interface Stage {
  // League strength (mean club reputation), and its rank among European top flights.
  strength: number;
  europeRank: number | null;
  topFlight: boolean;
}

function stages(game: Game): Map<string, Stage> {
  const world = game.world;
  const uefa = new Set(world.nations.filter((n) => n.conf === 'UEFA').map((n) => n.id));
  const out = new Map<string, Stage>();
  for (const l of world.leagues) out.set(l.id, { strength: leagueStrength(world, l), europeRank: null, topFlight: l.tier === 1 });
  const european = world.leagues.filter((l) => l.tier === 1 && uefa.has(l.nationId)).sort((a, b) => out.get(b.id)!.strength - out.get(a.id)!.strength);
  european.forEach((l, i) => (out.get(l.id)!.europeRank = i + 1));
  return out;
}

const bigFive = (st: Stage | undefined) => !!st?.europeRank && st.europeRank <= 5;

function entry(game: Game, p: Player, score: number, goals?: number): AwardEntry {
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  return { playerId: p.id, name: fullName(p), clubName: club?.name ?? 'Free agent', score: Math.round(score * 10) / 10, ...(goals === undefined ? {} : { goals }) };
}

// Why this player cannot win an award this season, or null when he can.
export function awardBlock(game: Game, p: Player, award: keyof Omit<SeasonAwards, 'season'>): string | null {
  const world = game.world;
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const st = club?.leagueId ? stages(game).get(club.leagueId) : undefined;
  const inEurope = !!club && world.europe?.season === world.season && world.europe.clubs.includes(club.id);
  if (award === 'goldenBoy') {
    if (p.age > 20) return 'The Golden Boy is for players under 21.';
    return st?.europeRank ? null : 'The Golden Boy only looks at top flights in Europe.';
  }
  if (award === 'goldenBoot') return st?.europeRank ? null : 'The Golden Boot only counts goals in European top flights.';
  if (award === 'yashin' && p.position !== 'GK') return 'The Yashin Trophy is for goalkeepers.';
  if (bigFive(st) || inEurope) return null;
  return "Award voters watch the big leagues and the Champions League. Your league is too small to win the Ballon d'Or or the Yashin Trophy.";
}

// minApps defaults to 10 for the real ceremony; the live race mid-season
// uses a lower bar so it has names from the first weeks.
export function computeAwards(game: Game, minApps = 10): SeasonAwards {
  const world = game.world;
  const champions = new Set(world.leagues.map((l) => leagueTable(l, world)[0]?.clubId));
  const europe = world.europe?.season === world.season ? world.europe : undefined;
  const europeWinner = europe?.winner;
  const inEurope = new Set(europe?.clubs ?? []);
  const st = stages(game);
  const stageOf = (p: Player) => st.get(world.clubs[p.clubId ?? '']?.leagueId ?? '');
  const pool = world.leagues.flatMap((l) => l.clubIds.flatMap((id) => world.clubs[id].playerIds.map((pid) => world.players[pid]))).filter((p) => p && p.stats.apps >= minApps);

  // Seen by the voters: a strong enough top flight, or Europe's big stage.
  const noticed = (p: Player) => {
    const s = stageOf(p);
    return inEurope.has(p.clubId ?? '') || (!!s?.topFlight && s.strength >= SHORTLIST_STRENGTH);
  };
  const canWin = (p: Player) => bigFive(stageOf(p)) || (!!europeWinner && p.clubId === europeWinner);
  const weight = (p: Player) => (bigFive(stageOf(p)) ? 1 : inEurope.has(p.clubId ?? '') ? 0.85 : 0.75);

  // Stage matters: a big-league title winner beats the same numbers elsewhere.
  const score = (p: Player) => {
    const title = (champions.has(p.clubId ?? '') ? 8 : 0) + (europeWinner && p.clubId === europeWinner ? 10 : 0);
    const keeper = p.position === 'GK' ? 6 : 0;
    return (avgRating(p.stats) * 8 + p.stats.goals * 0.9 + p.stats.assists * 0.55 + title + keeper) * weight(p);
  };
  const keeperScore = (p: Player) => (avgRating(p.stats) * 10 + (champions.has(p.clubId ?? '') ? 5 : 0)) * weight(p);
  const sorted = (list: Player[], fn: (p: Player) => number) => list.map((p) => ({ p, s: fn(p) })).sort((a, b) => b.s - a.s);
  // The winner must be able to win: the best such player moves to the top.
  const crowned = (rows: { p: Player; s: number }[]) => {
    const first = rows.findIndex((r) => canWin(r.p));
    if (first > 0) rows.unshift(...rows.splice(first, 1));
    return first >= 0 ? rows : [];
  };
  const shortlist = pool.filter(noticed);
  const goalFactor = (p: Player) => {
    const rank = stageOf(p)?.europeRank;
    return !rank ? 0 : rank <= 5 ? 2 : stageOf(p)!.strength >= BOOT_STRENGTH ? 1.5 : 1;
  };

  return {
    season: world.season,
    ballonDor: crowned(sorted(shortlist, score))
      .slice(0, 30)
      .map(({ p, s }) => entry(game, p, s)),
    goldenBoy: sorted(pool.filter((p) => p.age <= 20 && !!stageOf(p)?.europeRank), score)
      .slice(0, 10)
      .map(({ p, s }) => entry(game, p, s)),
    yashin: crowned(sorted(shortlist.filter((p) => p.position === 'GK'), keeperScore))
      .slice(0, 10)
      .map(({ p, s }) => entry(game, p, s)),
    goldenBoot: sorted(pool.filter((p) => goalFactor(p) > 0 && p.stats.goals > 0), (p) => p.stats.goals * goalFactor(p) + p.stats.assists * 0.001)
      .slice(0, 10)
      .map(({ p }) => entry(game, p, p.stats.goals * goalFactor(p), p.stats.goals)),
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
      if (game.career) gainFame(game.career, lines.some((l) => l.startsWith('You won')) ? 15 : 4);
      addMessage(game, 'season', `Awards night ${world.season}/${String(world.season + 1).slice(2)}`, lines.join(' '));
    }
  }
  return a;
}

import { Game } from './types';
import { fullName, overall, seasonRows } from './player';
import { MILESTONES, progressOf } from './progress';
import { AWARD_NAMES } from './awards';

// Career-long numbers for the summary screen, leaderboards and profiles.
// One place computes them so every screen agrees.
export interface Totals {
  mode: 'career' | 'manager';
  name: string;
  club: string | null;
  peakOvr: number | null;
  apps: number;
  goals: number;
  assists: number;
  seasons: number;
  ballonDors: number;
  trophies: number;
  leagueTitles: number;
  retired: boolean;
}

export function careerTotals(game: Game): Totals {
  const world = game.world;
  const c = game.career!;
  const p = world.players[c.playerId];
  const rows = [...p.history, ...seasonRows(p, world.season)];
  const apps = rows.reduce((s, h) => s + h.apps, 0);
  const goals = rows.reduce((s, h) => s + h.goals, 0);
  const assists = rows.reduce((s, h) => s + h.assists, 0);
  const personal = world.honours.filter((h) => h.playerId === p.id);
  // A league title counts when the player was at the champion that season.
  const leagueTitles = world.honours.filter((h) => h.clubId && h.title.endsWith('champions') && rows.some((s) => s.season === h.season && s.clubId === h.clubId)).length;
  const peak = Math.max(overall(p), ...progressOf(game).ovrHistory.map((x) => x.ovr));
  return {
    mode: 'career',
    name: fullName(p),
    club: p.clubId ? world.clubs[p.clubId]?.name ?? null : null,
    peakOvr: Math.min(99, Math.max(1, Math.round(peak))),
    apps,
    goals,
    assists,
    seasons: new Set(rows.map((r) => r.season)).size,
    ballonDors: personal.filter((h) => h.title === "Ballon d'Or").length,
    trophies: personal.length + leagueTitles,
    leagueTitles,
    retired: c.retired,
  };
}

export function managerTotals(game: Game): Totals {
  const m = game.manager!;
  const club = m.clubId ? game.world.clubs[m.clubId] : null;
  // League trophies are stored as "<season> <league>"; cups by name.
  const leagueTitles = m.trophies.filter((t) => /^\d{4} /.test(t)).length;
  return {
    mode: 'manager',
    name: m.name,
    club: club?.name ?? (m.nationalTeamId ? game.world.nationalTeams[m.nationalTeamId]?.name ?? null : null),
    peakOvr: null,
    apps: 0,
    goals: 0,
    assists: 0,
    seasons: m.seasonsManaged,
    ballonDors: 0,
    trophies: m.trophies.length,
    leagueTitles: Math.min(leagueTitles, m.seasonsManaged),
    retired: false,
  };
}

export function gameTotals(game: Game): Totals {
  return game.mode === 'career' && game.career ? careerTotals(game) : managerTotals(game);
}

export interface ClubSpell {
  clubId: string;
  name: string;
  from: number;
  to: number;
  apps: number;
  goals: number;
  assists: number;
}

// Everything the career-over screen shows beyond the totals: each club in
// order with his numbers there, top-three award finishes, and milestones.
export interface CareerStory {
  clubs: ClubSpell[];
  avgRating: number;
  intlGoals: number;
  podiums: { season: number; award: string; place: number }[];
  milestones: string[];
}

export function careerStory(game: Game): CareerStory {
  const world = game.world;
  const p = world.players[game.career!.playerId];
  const rows = [...p.history, ...seasonRows(p, world.season)];
  const clubs: ClubSpell[] = [];
  for (const r of rows) {
    const last = clubs[clubs.length - 1];
    // A loan and back makes two spells at the parent club, as in real records.
    if (last && last.clubId === r.clubId) {
      last.to = r.season;
      last.apps += r.apps;
      last.goals += r.goals;
      last.assists += r.assists;
    } else clubs.push({ clubId: r.clubId, name: world.clubs[r.clubId]?.name ?? 'Unknown club', from: r.season, to: r.season, apps: r.apps, goals: r.goals, assists: r.assists });
  }
  const apps = rows.reduce((s, r) => s + r.apps, 0);
  const podiums: CareerStory['podiums'] = [];
  for (const a of world.awards ?? []) {
    for (const key of Object.keys(AWARD_NAMES) as (keyof typeof AWARD_NAMES)[]) {
      const place = a[key].findIndex((e) => e.playerId === p.id);
      if (place >= 0 && place < 3) podiums.push({ season: a.season, award: AWARD_NAMES[key], place: place + 1 });
    }
  }
  podiums.sort((x, y) => x.season - y.season || x.place - y.place);
  const reached = new Set(progressOf(game).milestones);
  return {
    clubs,
    avgRating: apps ? rows.reduce((s, r) => s + r.ratingSum, 0) / apps : 0,
    intlGoals: p.intlGoals,
    podiums,
    milestones: MILESTONES.filter((m) => reached.has(m.id)).map((m) => m.label),
  };
}

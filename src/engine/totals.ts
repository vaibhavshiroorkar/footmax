import { Game } from './types';
import { fullName, overall, seasonRows } from './player';
import { progressOf } from './progress';

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

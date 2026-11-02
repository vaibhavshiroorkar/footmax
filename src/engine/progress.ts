import { Attributes, Game, Position } from './types';
import { Rng } from './rng';
import { overall } from './player';
import { careerPlayer, addXp, gainFame, squadStatus } from './careerBase';
import { adjustRelation } from './relations';
import { addMessage } from './inbox';

// Career progression on top of raw attributes: season objectives from the
// coach, lifetime milestones, and snapshots that show growth. Unlocks go
// into career.rewards; the UI pops them as celebrations.

export type ObjectiveKind = 'apps' | 'goals' | 'assists' | 'cleanSheets' | 'tackles' | 'saves' | 'training' | 'rating';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  label: string;
  target: number;
  progress: number;
  reward: { xp: number; money: number; trust: number };
  done: boolean;
}

export interface Reward {
  title: string;
  sub: string;
  icon: string;
}

export interface Counters {
  cleanSheets: number;
  tackles: number;
  saves: number;
  training: number;
  firstTeamGoals: number;
}

export interface SeasonSnapshot {
  season: number;
  ovr: number;
  attrs: Attributes;
}

export interface CareerProgress {
  objectives: Objective[];
  milestones: string[];
  rewards: Reward[];
  // Lifetime and this-season counters that raw stats do not track.
  season: Counters;
  total: Counters;
  ovrHistory: { season: number; ovr: number }[];
  seasonStart: SeasonSnapshot;
  // Set at the new season; the UI shows a review card once and clears it.
  review?: { season: number; before: SeasonSnapshot; after: SeasonSnapshot };
}

const zero = (): Counters => ({ cleanSheets: 0, tackles: 0, saves: 0, training: 0, firstTeamGoals: 0 });

export function progressOf(game: Game): CareerProgress {
  const c = game.career!;
  if (!c.progress) {
    const p = careerPlayer(game);
    c.progress = {
      objectives: [],
      milestones: [],
      rewards: [],
      season: zero(),
      total: zero(),
      ovrHistory: [{ season: game.world.season, ovr: overall(p) }],
      seasonStart: { season: game.world.season, ovr: overall(p), attrs: { ...p.attrs } },
    };
    c.progress.objectives = makeObjectives(game);
  }
  return c.progress;
}

function obj(kind: ObjectiveKind, label: string, target: number, xp: number, money: number, trust: number): Objective {
  return { id: `${kind}-${target}`, kind, label, target, progress: 0, reward: { xp, money, trust }, done: false };
}

// Three or four goals for the season, scaled to the player's role and place
// in the squad.
export function makeObjectives(game: Game): Objective[] {
  const p = careerPlayer(game);
  const status = squadStatus(game);
  const starter = status.startsWith('Starter');
  const rotation = status === 'Rotation';
  const apps = starter ? 28 : rotation ? 16 : 8;
  const pay = Math.max(2000, Math.round(p.wage * 4));
  const list: Objective[] = [obj('apps', `Play ${apps} league games`, apps, 150, pay, 10)];
  const pos: Position = p.position;
  if (pos === 'FWD') list.push(obj('goals', `Score ${starter ? 12 : rotation ? 6 : 3} league goals`, starter ? 12 : rotation ? 6 : 3, 200, pay * 2, 12));
  if (pos === 'MID') list.push(obj('assists', `Make ${starter ? 7 : 3} assists`, starter ? 7 : 3, 180, pay * 2, 10));
  if (pos === 'MID' && starter) list.push(obj('goals', 'Score 4 league goals', 4, 120, pay, 6));
  if (pos === 'DEF') list.push(obj('tackles', `Win ${starter ? 25 : 10} tackles`, starter ? 25 : 10, 180, pay * 2, 10));
  if (pos === 'DEF' || pos === 'GK') list.push(obj('cleanSheets', `Keep ${starter ? 8 : 3} clean sheets`, starter ? 8 : 3, 180, pay * 2, 10));
  if (pos === 'GK') list.push(obj('saves', `Make ${starter ? 40 : 12} saves`, starter ? 40 : 12, 160, pay, 8));
  list.push(obj('training', 'Complete 40 training sessions', 40, 120, 0, 6));
  list.push(obj('rating', 'Average 7.0 or better (10+ games)', 7, 220, pay * 2, 15));
  return list;
}

function progressFor(game: Game, kind: ObjectiveKind): number {
  const p = careerPlayer(game);
  const pr = progressOf(game);
  switch (kind) {
    case 'apps':
      return p.stats.apps;
    case 'goals':
      return p.stats.goals;
    case 'assists':
      return p.stats.assists;
    case 'cleanSheets':
      return pr.season.cleanSheets;
    case 'tackles':
      return pr.season.tackles;
    case 'saves':
      return pr.season.saves;
    case 'training':
      return pr.season.training;
    case 'rating':
      return p.stats.apps >= 10 ? Math.round((p.stats.ratingSum / p.stats.apps) * 100) / 100 : 0;
  }
}

function grant(game: Game, r: { xp: number; money: number; trust: number }) {
  const c = game.career!;
  c.money += r.money;
  const p = careerPlayer(game);
  if (p.clubId && r.trust) adjustRelation(game, p.clubId, r.trust);
  const lvl = addXp(game, r.xp);
  if (lvl) progressOf(game).rewards.push({ title: 'Level up!', sub: lvl.replace(/^Level up! /, ''), icon: 'star' });
}

export function checkObjectives(game: Game): void {
  const pr = progressOf(game);
  for (const o of pr.objectives) {
    if (o.done) continue;
    o.progress = progressFor(game, o.kind);
    if (o.progress >= o.target) {
      o.done = true;
      grant(game, o.reward);
      pr.rewards.push({ title: 'Objective complete!', sub: `${o.label}. +${o.reward.xp} XP${o.reward.money ? `, +$${Math.round(o.reward.money / 1000)}K` : ''}.`, icon: 'flag' });
    }
  }
}

interface MilestoneDef {
  id: string;
  label: string;
  icon: string;
  xp: number;
  fame: number;
  test: (game: Game) => boolean;
}

function lifetime(game: Game) {
  const p = careerPlayer(game);
  const apps = p.history.reduce((s, h) => s + h.apps, 0) + p.stats.apps;
  const goals = p.history.reduce((s, h) => s + h.goals, 0) + p.stats.goals;
  const assists = p.history.reduce((s, h) => s + h.assists, 0) + p.stats.assists;
  return { p, apps, goals, assists };
}

export const MILESTONES: MilestoneDef[] = [
  { id: 'debut', label: 'First-team debut', icon: 'football', xp: 100, fame: 2, test: (g) => lifetime(g).apps >= 1 },
  { id: 'goal1', label: 'First goal', icon: 'flame', xp: 120, fame: 3, test: (g) => lifetime(g).goals >= 1 },
  { id: 'assist1', label: 'First assist', icon: 'git-branch', xp: 80, fame: 1, test: (g) => lifetime(g).assists >= 1 },
  { id: 'clean1', label: 'First clean sheet', icon: 'shield', xp: 100, fame: 2, test: (g) => progressOf(g).total.cleanSheets >= 1 },
  { id: 'apps25', label: '25 games', icon: 'calendar', xp: 150, fame: 2, test: (g) => lifetime(g).apps >= 25 },
  { id: 'apps100', label: '100 games', icon: 'calendar', xp: 300, fame: 5, test: (g) => lifetime(g).apps >= 100 },
  { id: 'apps300', label: '300 games', icon: 'calendar', xp: 500, fame: 8, test: (g) => lifetime(g).apps >= 300 },
  { id: 'goals10', label: '10 goals', icon: 'football', xp: 200, fame: 3, test: (g) => lifetime(g).goals >= 10 },
  { id: 'goals50', label: '50 goals', icon: 'football', xp: 350, fame: 6, test: (g) => lifetime(g).goals >= 50 },
  { id: 'goals100', label: '100 goals', icon: 'trophy', xp: 500, fame: 10, test: (g) => lifetime(g).goals >= 100 },
  { id: 'hattrick', label: 'Hat-trick hero', icon: 'flash', xp: 250, fame: 5, test: (g) => !!g.career?.flags?.hattrick },
  { id: 'cap1', label: 'International debut', icon: 'flag', xp: 250, fame: 6, test: (g) => careerPlayer(g).caps >= 1 },
  { id: 'cap25', label: '25 caps', icon: 'flag', xp: 400, fame: 8, test: (g) => careerPlayer(g).caps >= 25 },
  { id: 'ovr60', label: 'Reach 60 overall', icon: 'trending-up', xp: 150, fame: 1, test: (g) => overall(careerPlayer(g)) >= 60 },
  { id: 'ovr70', label: 'Reach 70 overall', icon: 'trending-up', xp: 250, fame: 3, test: (g) => overall(careerPlayer(g)) >= 70 },
  { id: 'ovr80', label: 'Reach 80 overall', icon: 'trending-up', xp: 400, fame: 6, test: (g) => overall(careerPlayer(g)) >= 80 },
  { id: 'ovr90', label: 'Reach 90 overall', icon: 'diamond', xp: 600, fame: 10, test: (g) => overall(careerPlayer(g)) >= 90 },
  { id: 'topflight', label: 'Play in a top league', icon: 'star', xp: 300, fame: 5, test: (g) => { const p = careerPlayer(g); const l = g.world.leagues.find((x) => x.id === g.world.clubs[p.clubId ?? '']?.leagueId); return !!l && l.tier === 1 && p.stats.apps >= 1; } },
  { id: 'title', label: 'League champion', icon: 'trophy', xp: 500, fame: 8, test: (g) => g.world.honours.some((h) => h.title.endsWith('champions') && careerPlayer(g).history.some((s) => s.season === h.season && s.clubId === h.clubId && s.apps >= 5)) },
  { id: 'award', label: 'Individual award', icon: 'medal', xp: 400, fame: 8, test: (g) => g.world.honours.some((h) => h.playerId === careerPlayer(g).id) },
  { id: 'millionaire', label: 'First million', icon: 'cash', xp: 200, fame: 3, test: (g) => (g.career?.money ?? 0) >= 1_000_000 },
];

export function checkMilestones(game: Game): void {
  const pr = progressOf(game);
  const c = game.career!;
  for (const m of MILESTONES) {
    if (pr.milestones.includes(m.id) || !m.test(game)) continue;
    pr.milestones.push(m.id);
    gainFame(c, m.fame);
    pr.rewards.push({ title: m.label, sub: `Milestone unlocked. +${m.xp} XP, +${m.fame} fame.`, icon: m.icon });
    const lvl = addXp(game, m.xp);
    if (lvl) pr.rewards.push({ title: 'Level up!', sub: lvl.replace(/^Level up! /, ''), icon: 'star' });
  }
}

// After a club match: counters for objectives and milestones.
export function recordMatchProgress(game: Game, played: boolean, conceded: number, tackles: number, saves: number, goals: number): void {
  const pr = progressOf(game);
  if (played) {
    if (conceded === 0 && (careerPlayer(game).position === 'GK' || careerPlayer(game).position === 'DEF')) {
      pr.season.cleanSheets++;
      pr.total.cleanSheets++;
    }
    pr.season.tackles += tackles;
    pr.total.tackles += tackles;
    pr.season.saves += saves;
    pr.total.saves += saves;
    if (goals >= 3 && game.career) game.career.flags = { ...(game.career.flags ?? {}), hattrick: true };
  }
  checkObjectives(game);
  checkMilestones(game);
}

export function recordTraining(game: Game): void {
  const pr = progressOf(game);
  pr.season.training++;
  pr.total.training++;
  checkObjectives(game);
}

// New season: snapshot growth for the review card, fresh objectives.
export function seasonRollover(game: Game, rng: Rng): void {
  const pr = progressOf(game);
  const p = careerPlayer(game);
  const after: SeasonSnapshot = { season: game.world.season, ovr: overall(p), attrs: { ...p.attrs } };
  const done = pr.objectives.filter((o) => o.done).length;
  pr.review = { season: pr.seasonStart.season, before: pr.seasonStart, after };
  pr.ovrHistory.push({ season: game.world.season, ovr: after.ovr });
  pr.seasonStart = after;
  pr.season = zero();
  pr.objectives = makeObjectives(game);
  if (done) addMessage(game, 'season', 'Coach objectives', `You completed ${done} objective${done > 1 ? 's' : ''} last season. New targets are on your home screen.`);
  void rng;
  checkMilestones(game);
}

export function takeRewards(game: Game): Reward[] {
  if (!game.career?.progress) return [];
  const out = game.career.progress.rewards;
  game.career.progress.rewards = [];
  return out;
}

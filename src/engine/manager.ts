import { Club, Fixture, Game } from './types';
import { Rng, clamp } from './rng';
import { clubIncome } from './player';
import { leagueOf, leagueTable } from './league';
import { squad } from './lineup';
import { addMessage } from './inbox';
import { wageCost } from './transfers';
import { majorNations } from './generator';
import { stageReached, teamRating } from './international';

export function managerClub(game: Game): Club | null {
  const id = game.manager?.clubId;
  return id ? game.world.clubs[id] : null;
}

export function managerNation(game: Game): Club | null {
  const id = game.manager?.nationalTeamId;
  return id ? game.world.nationalTeams[id] : null;
}

export function weeklyWages(game: Game, club: Club): number {
  const own = squad(game.world, club).reduce((sum, p) => sum + wageCost(p), 0);
  // Players out on loan still draw the part of their wage the borrowing
  // club does not cover.
  let lent = 0;
  for (const p of Object.values(game.world.players)) if (p.loan?.fromClubId === club.id) lent += Math.round(p.wage * (1 - p.loan.wageShare));
  return own + lent;
}

export function weeklyIncome(game: Game, club: Club, homeGame: boolean): number {
  const tier = leagueOf(game.world, club.id)?.tier ?? 2;
  return Math.round(clubIncome(club.reputation, homeGame) * (tier === 1 ? 1.1 : 0.8));
}

// Rank the board expects, from reputation order within the league.
export function expectedRank(game: Game, club: Club): number {
  const league = leagueOf(game.world, club.id);
  if (!league) return 1;
  const order = [...league.clubIds].sort((a, b) => game.world.clubs[b].reputation - game.world.clubs[a].reputation);
  return order.indexOf(club.id) + 1;
}

export function boardMood(conf: number): string {
  if (conf >= 80) return 'Delighted';
  if (conf >= 60) return 'Pleased';
  if (conf >= 40) return 'Content';
  if (conf >= 20) return 'Worried';
  return 'Furious';
}

export function managerAfterMatch(game: Game, fixture: Fixture): void {
  const m = game.manager!;
  const world = game.world;
  const clubId = m.clubId;
  if (!clubId || (fixture.homeId !== clubId && fixture.awayId !== clubId)) return;
  const isHome = fixture.homeId === clubId;
  const me = world.clubs[clubId];
  const opp = world.clubs[isHome ? fixture.awayId : fixture.homeId];
  const gf = isHome ? fixture.homeGoals : fixture.awayGoals;
  const ga = isHome ? fixture.awayGoals : fixture.homeGoals;
  const points = gf > ga ? 3 : gf === ga ? 1 : 0;
  const expected = clamp(1.4 + (me.reputation - opp.reputation) / 25 + (isHome ? 0.2 : -0.2), 0.3, 2.6);
  m.boardConfidence = clamp(m.boardConfidence + (points - expected) * 3.5, 0, 100);
}

export function managerWeekly(game: Game, homeGame: boolean): void {
  const club = managerClub(game);
  if (!club) return;
  club.budget += weeklyIncome(game, club, homeGame) - weeklyWages(game, club);
  if (club.budget < 0) game.manager!.boardConfidence = clamp(game.manager!.boardConfidence - 2, 0, 100);
  checkSacking(game);
}

function checkSacking(game: Game) {
  const m = game.manager!;
  const club = managerClub(game);
  if (!club || m.boardConfidence > 0) return;
  m.clubId = null;
  addMessage(game, 'news', 'You have been sacked', `The ${club.name} board have lost faith and ended your contract. Look out for offers from other clubs.`);
  jobOffers(game, new Rng(game.world.rngState + 7), club.reputation - 20, club.reputation - 4, 3, club.id);
}

export function jobOffers(game: Game, rng: Rng, minRep: number, maxRep: number, count: number, excludeId?: string): void {
  const current = game.manager!.clubId ?? excludeId;
  const all = Object.values(game.world.clubs).filter((c) => c.id !== current && c.leagueId);
  let options = all.filter((c) => c.reputation >= minRep && c.reputation <= maxRep);
  // The band can be empty (a low-reputation club sacked you). Fall back to
  // the smallest clubs so there is always a way back into work.
  if (options.length < count) options = [...options, ...all.filter((c) => !options.includes(c)).sort((a, b) => a.reputation - b.reputation).slice(0, count * 3)];
  for (const club of rng.shuffle(options).slice(0, count)) {
    addMessage(game, 'offer', `Job offer: ${club.name}`, `${club.name} (rep ${club.reputation}) want you as manager.`, {
      type: 'job',
      clubId: club.id,
      weeksLeft: 4,
      choices: [
        { id: 'accept', label: 'Take the job' },
        { id: 'decline', label: 'Decline' },
      ],
    });
  }
}

// National team jobs go to managers with a track record.
export function nationJobOffer(game: Game, rng: Rng): void {
  const m = game.manager!;
  if (m.nationalTeamId) return;
  const record = m.trophies.length * 8 + m.seasonsManaged * 2 + (managerClub(game)?.reputation ?? 50) / 10;
  const nations = majorNations(game.world).filter((n) => n.strength <= 45 + record);
  if (!nations.length) return;
  const nation = rng.pick(nations);
  addMessage(game, 'national', `${nation.name} want you`, `The ${nation.name} federation offer you the national team job. You can do it alongside club work.`, {
    type: 'nation-job',
    nationId: nation.id,
    weeksLeft: 4,
    choices: [
      { id: 'accept', label: 'Accept' },
      { id: 'decline', label: 'Decline' },
    ],
  });
}

export function managerSeasonReview(game: Game, rng: Rng, finalRank: number, tier: number, promoted: boolean, relegated: boolean): void {
  const m = game.manager!;
  const club = managerClub(game);
  if (!club) return;
  const exp = expectedRank(game, club);
  let delta = (exp - finalRank) * 3;
  if (finalRank === 1) {
    delta += 25;
    m.trophies.push(`${game.world.season} ${leagueOf(game.world, club.id)?.name ?? 'League'}`);
  }
  if (promoted) delta += 20;
  if (relegated) delta -= 30;
  m.boardConfidence = clamp(m.boardConfidence + delta + 10, 0, 100);
  m.seasonsManaged++;
  addMessage(game, 'season', `Board review ${game.world.season}`, `Finished ${ordinal(finalRank)} (target ${ordinal(exp)}). Board mood: ${boardMood(m.boardConfidence)}.`);
  checkSacking(game);
  if (m.clubId && finalRank <= 3 && m.boardConfidence >= 65) jobOffers(game, rng, club.reputation + 4, club.reputation + 18, tier === 1 ? 1 : 2);
  if (rng.chance(0.25 + m.trophies.length * 0.1)) nationJobOffer(game, rng);
}

// After a summer tournament: the federation judges you against seeding.
export function nationReview(game: Game): void {
  const m = game.manager!;
  const team = managerNation(game);
  if (!team) return;
  const t = game.world.tournaments.find((x) => x.teamIds.includes(team.id));
  if (!t) {
    // Missing the World Cup is the worst thing a manager can do.
    const q = game.world.qualifying;
    if (q?.qualified && q.year === game.world.season + 1 && !q.qualified.includes(team.id) && q.groups.some((g) => g.teamIds.includes(team.id))) {
      m.nationConfidence = clamp(m.nationConfidence - 30, 0, 100);
      addMessage(game, 'national', `${team.name} missed the World Cup`, 'The federation expected better. Confidence has taken a big hit.');
      if (m.nationConfidence <= 0) m.nationalTeamId = null;
    }
    return;
  }
  const ranked = [...t.teamIds].sort((a, b) => teamRating(game.world, game.world.nationalTeams[b]) - teamRating(game.world, game.world.nationalTeams[a]));
  const seed = ranked.indexOf(team.id) + 1;
  const reached = stageReached(t, team.id);
  const order = ['Group stage', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Winners'];
  const expected = seed <= 2 ? 'Semi-final' : seed <= 8 ? 'Quarter-final' : seed <= t.teamIds.length / 2 ? 'Round of 16' : 'Group stage';
  const diff = order.indexOf(reached) - order.indexOf(expected);
  m.nationConfidence = clamp(m.nationConfidence + diff * 15, 0, 100);
  if (reached === 'Winners') m.trophies.push(t.name);
  addMessage(game, 'national', `${t.name}: ${reached}`, `${team.name} reached: ${reached}. The federation expected: ${expected}.`);
  if (m.nationConfidence <= 0) {
    m.nationalTeamId = null;
    addMessage(game, 'national', 'Federation ends your contract', `${team.name} have replaced you as national team manager.`);
  }
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function leaguePositionOf(game: Game, clubId: string): number {
  const league = leagueOf(game.world, clubId);
  if (!league) return 0;
  return leagueTable(league, game.world).findIndex((r) => r.clubId === clubId) + 1;
}

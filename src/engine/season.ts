import { Game, Player } from './types';
import { Rng, clamp } from './rng';
import { applyDevelopment, avgRating, clubBudget, emptyStats, fairWage, fullName, overall, seasonalDevelopment } from './player';
import { leagueTable, makeFixtures } from './league';
import { createPlayer, createYouth, fillSquad, majorNations, newId, nationById, targetOverall } from './generator';
import { quickSim } from './match';
import { addMessage, expireOffers } from './inbox';
import { MAX_SQUAD, MIN_SQUAD, inTransferWindow, movePlayer, returnLoans, runAiTransfers, weakestPosition } from './transfers';
import { careerPlayer } from './career';
import { managerSeasonReview, managerWeekly, nationReview } from './manager';
import { squad } from './lineup';
import { INTERNATIONAL_BREAKS, advanceTournaments, internationalBreak, startTournaments, tournamentsDone } from './international';
import { callUpMessage, careerOffers, managerOffers, ownClubRenewal } from './offers';
import { autoSkills } from './skills';
import { presentAwards } from './awards';
import { seasonRollover } from './progress';

const rep = (v: number) => Math.round(clamp(v, 10, 95));

export function userClubId(game: Game): string | null {
  if (game.mode === 'career') return game.career && !game.career.retired ? careerPlayer(game).clubId : null;
  return game.manager?.clubId ?? null;
}

export interface WeekResult {
  newSeason: boolean;
  summerStarted: boolean;
}

// Sims everything left this week, runs the weekly updates and moves on.
export function advanceWeek(game: Game): WeekResult {
  const world = game.world;
  const result: WeekResult = { newSeason: false, summerStarted: false };

  if (world.phase === 'tournament') {
    advanceTournaments(game);
    weeklyRecovery(game);
    expireOffers(game);
    if (tournamentsDone(world)) {
      const rng = new Rng(world.rngState);
      if (game.manager) nationReview(game);
      rollover(game, rng);
      world.rngState = rng.state;
      result.newSeason = true;
    }
    return result;
  }

  const rng = new Rng(world.rngState);
  const myClub = userClubId(game);
  let homeGame = false;
  for (const league of world.leagues) {
    for (const f of league.fixtures) {
      if (f.week !== world.week) continue;
      if (f.homeId === myClub) homeGame = true;
      if (!f.played) quickSim(world, f, rng.int(1, 2 ** 31));
    }
  }

  weeklyRecovery(game);

  if (INTERNATIONAL_BREAKS.includes(world.week)) {
    internationalBreak(game, rng);
    if (game.career && !game.career.retired) {
      const p = careerPlayer(game);
      const team = world.nationalTeams[nationById(world, p.nationId)?.teamId ?? ''];
      if (team?.playerIds.includes(p.id)) callUpMessage(game);
    }
  }

  if (game.mode === 'career' && game.career && !game.career.retired) careerWeekly(game, rng);
  if (game.mode === 'manager' && game.manager) {
    managerWeekly(game, homeGame);
    managerOffers(game, rng);
  }
  if (inTransferWindow(world.week)) runAiTransfers(game, rng, 8);
  if (world.week === 5 || world.week === 22) game.negotiations = {};

  world.week++;
  expireOffers(game);
  if (world.week > world.seasonWeeks) {
    closeLeagueSeason(game, rng);
    world.rngState = rng.state;
    startTournaments(game);
    world.phase = 'tournament';
    result.summerStarted = true;
    return result;
  }
  world.rngState = rng.state;
  return result;
}

function weeklyRecovery(game: Game) {
  for (const p of Object.values(game.world.players)) {
    if (p.injuryWeeks > 0) p.injuryWeeks--;
    p.fitness = clamp(p.fitness + 20, 0, 100);
  }
}

function careerWeekly(game: Game, rng: Rng) {
  const c = game.career!;
  const p = careerPlayer(game);
  c.money += p.clubId ? p.wage : 0;
  for (const s of c.sponsors) {
    c.money += s.weekly;
    s.weeksLeft--;
  }
  c.sponsors = c.sponsors.filter((s) => s.weeksLeft > 0);
  c.energy = 100;
  c.trainedThisWeek = 0;
  c.fame = clamp(c.fame - 0.15, 0, 100);
  if (c.items.includes('nutrition')) p.fitness = clamp(p.fitness + 6, 0, 100);
  if (c.items.includes('physio') && p.injuryWeeks > 0) p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
  if (c.items.includes('house')) p.morale = clamp(p.morale + 3, 0, 100);
  careerOffers(game, rng);
}

// End of the league season: awards, prize money, promotion and relegation.
// Ageing and contracts wait until after the summer tournaments.
function closeLeagueSeason(game: Game, rng: Rng) {
  const world = game.world;
  const season = world.season;
  const myClub = userClubId(game);
  const careerId = game.career?.playerId;
  const summary: string[] = [];
  let myRank = 0;
  let myTier = 1;
  let promoted = false;
  let relegated = false;

  for (const league of world.leagues) {
    const table = leagueTable(league, world);
    const champ = world.clubs[table[0].clubId];
    world.honours.push({ season, title: `${league.name} champions`, winner: champ.name, clubId: champ.id });
    champ.reputation = rep(champ.reputation + 3);
    const leaguePlayers = league.clubIds.flatMap((id) => squad(world, world.clubs[id]));
    const scorer = [...leaguePlayers].sort((a, b) => b.stats.goals - a.stats.goals)[0];
    if (scorer?.stats.goals) world.honours.push({ season, title: `${league.name} Golden Boot (${scorer.stats.goals})`, winner: fullName(scorer), playerId: scorer.id });
    const best = leaguePlayers.filter((p) => p.stats.apps >= 12).sort((a, b) => avgRating(b.stats) - avgRating(a.stats))[0];
    if (best) world.honours.push({ season, title: `${league.name} player of the season`, winner: fullName(best), playerId: best.id });
    const young = leaguePlayers.filter((p) => p.stats.apps >= 10 && p.age <= 21).sort((a, b) => avgRating(b.stats) - avgRating(a.stats))[0];
    if (young) world.honours.push({ season, title: `${league.name} young player of the season`, winner: fullName(young), playerId: young.id });
    for (const id of [scorer?.id, best?.id, young?.id]) {
      if (id && id === careerId && game.career) game.career.fame = clamp(game.career.fame + 6, 0, 100);
    }
    const order = [...league.clubIds].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation);
    table.forEach((row, i) => {
      const club = world.clubs[row.clubId];
      club.budget += Math.round(clubBudget(club.reputation) * (0.15 + (0.25 * (table.length - i)) / table.length));
      // Slow pull toward the middle stops one club running away forever.
      club.reputation = rep(club.reputation + clamp((order.indexOf(club.id) - i) * 0.3, -3, 3) + (65 - club.reputation) * 0.02);
      if (club.id === myClub) {
        myRank = i + 1;
        myTier = league.tier;
      }
    });
    if (league.tier === 1) summary.push(`${champ.name} win the ${league.name}.`);
  }

  // Awards look at this season's leagues, before clubs move up or down.
  presentAwards(game);

  // Promotion and relegation between linked leagues.
  for (const low of world.leagues) {
    if (!low.parentId || !low.swap) continue;
    const top = world.leagues.find((l) => l.id === low.parentId);
    if (!top) continue;
    const down = leagueTable(top, world).slice(-low.swap).map((r) => r.clubId);
    const up = leagueTable(low, world).slice(0, low.swap).map((r) => r.clubId);
    for (const id of down) {
      world.clubs[id].leagueId = low.id;
      world.clubs[id].reputation = rep(world.clubs[id].reputation - 4);
      if (id === myClub) relegated = true;
    }
    for (const id of up) {
      world.clubs[id].leagueId = top.id;
      world.clubs[id].reputation = rep(world.clubs[id].reputation + 4);
      if (id === myClub) promoted = true;
    }
    top.clubIds = top.clubIds.filter((id) => !down.includes(id)).concat(up);
    low.clubIds = low.clubIds.filter((id) => !up.includes(id)).concat(down);
  }

  if (game.mode === 'manager' && game.manager && myClub) managerSeasonReview(game, rng, myRank, myTier, promoted, relegated);
  if (myClub && myRank) summary.unshift(`${world.clubs[myClub].name} finish ${myRank}${promoted ? ' and are promoted!' : relegated ? ' and are relegated.' : '.'}`);
  summary.push(`Summer ${season + 1}: international tournaments are next.`);
  addMessage(game, 'season', `Season ${season}/${String(season + 1).slice(2)} review`, summary.join(' '));
}

function recordHistory(game: Game, p: Player) {
  if (!p.clubId || !p.stats.apps) return;
  p.history.push({ season: game.world.season, clubId: p.clubId, ...p.stats });
}

// New season: ageing, development, contracts, retirements, youth, fixtures.
function rollover(game: Game, rng: Rng) {
  const world = game.world;
  const careerId = game.career?.playerId;
  const myClub = userClubId(game);

  const keepHistory = new Set<string>();
  if (careerId) keepHistory.add(careerId);
  if (myClub) world.clubs[myClub].playerIds.forEach((id) => keepHistory.add(id));
  for (const p of Object.values(world.players)) if (p.real) keepHistory.add(p.id);

  returnLoans(world);
  const retiring: string[] = [];
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    if (keepHistory.has(p.id)) recordHistory(game, p);
    p.age++;
    const isUser = p.id === careerId;
    let delta = seasonalDevelopment(rng, p);
    // The user's player grows mostly through training; nutrition slows decline.
    if (isUser) delta = delta > 0 ? delta * 0.12 : delta * (game.career!.items.includes('nutrition') ? 0.5 : 1);
    applyDevelopment(p, delta, rng);
    if (!isUser) p.skills = autoSkills(p);
    p.stats = emptyStats();
    p.fitness = 100;
    p.injuryWeeks = 0;
    if (isUser) continue;
    const retireP = p.age >= 39 ? 1 : p.age >= 34 ? (p.age - 33) * 0.2 : 0;
    if (rng.chance(retireP)) {
      retiring.push(p.id);
      continue;
    }
    if (p.clubId) {
      p.contractYears--;
      if (p.contractYears <= 0) {
        const club = world.clubs[p.clubId];
        const wanted = overall(p) >= targetOverall(club.reputation) - 8 && p.age < 33;
        if (wanted && rng.chance(0.8)) {
          p.contractYears = rng.int(1, 4);
          p.wage = fairWage(p);
        } else if (club.playerIds.length > MIN_SQUAD || !club.leagueId) {
          movePlayer(world, p, null);
        } else {
          p.contractYears = 1;
        }
      }
    }
  }
  for (const id of retiring) {
    const p = world.players[id];
    if (p.clubId) movePlayer(world, p, null);
    world.freeAgents = world.freeAgents.filter((x) => x !== id);
    for (const t of Object.values(world.nationalTeams)) t.playerIds = t.playerIds.filter((x) => x !== id);
    delete world.players[id];
  }

  if (game.career && careerId) careerRollover(game, rng);

  const managed = game.manager?.clubId;
  for (const club of Object.values(world.clubs)) {
    if (club.leagueId) {
      for (let i = 0; i < 2; i++) if (club.playerIds.length < MAX_SQUAD) club.playerIds.push(createYouth(world, rng, club).id);
    } else if (rng.chance(0.6)) {
      club.playerIds.push(createYouth(world, rng, club).id);
    }
    if (club.id === managed || !club.leagueId) continue;
    while (club.playerIds.length < MIN_SQUAD + 3) signFreeAgentOrGenerate(game, rng, club.id);
    while (club.playerIds.length > MAX_SQUAD - 3) {
      const worst = squad(world, club)
        .filter((p) => p.id !== careerId && !p.loan)
        .sort((a, b) => overall(a) - overall(b))[0];
      if (!worst) break;
      movePlayer(world, worst, null);
    }
    club.budget = Math.max(club.budget, Math.round(clubBudget(club.reputation) * 0.5));
  }
  if (managed) {
    const club = world.clubs[managed];
    while (club.playerIds.length < MIN_SQUAD) signFreeAgentOrGenerate(game, rng, club.id);
    addMessage(game, 'news', 'Youth intake', `Two youngsters join ${club.name} from the academy.`);
  }

  // National pools stay deep enough for a squad as stars retire.
  for (const nation of majorNations(world)) {
    const count = Object.values(world.players).filter((p) => p.nationId === nation.id && p.clubId).length;
    if (count >= 26) continue;
    const homes = Object.values(world.clubs).filter((c) => c.nationId === nation.id);
    if (!homes.length) continue;
    for (let i = count; i < 26; i++) {
      const club = homes[i % homes.length];
      const p = createPlayer(world, rng, { position: rng.pick(['GK', 'DEF', 'MID', 'FWD'] as const), target: Math.round(nation.strength + rng.normal(0, 5)), age: rng.int(19, 26), nationId: nation.id, clubId: club.id });
      club.playerIds.push(p.id);
    }
  }

  const agents = world.freeAgents.map((id) => world.players[id]).filter(Boolean);
  const dropped = agents.filter((p) => p.id !== careerId && !p.real).sort((a, b) => overall(b) - overall(a)).slice(250);
  for (const p of dropped) {
    world.freeAgents = world.freeAgents.filter((id) => id !== p.id);
    delete world.players[p.id];
  }

  world.season++;
  world.week = 1;
  world.phase = 'season';
  world.tournaments = [];
  for (const league of world.leagues) {
    for (const id of league.clubIds) fillSquad(world, rng, world.clubs[id], MIN_SQUAD + 2);
    league.fixtures = makeFixtures(league.clubIds, rng, () => newId(world, 'f'), world.seasonWeeks);
  }
  addMessage(game, 'season', `Season ${world.season}/${String(world.season + 1).slice(2)} begins`, 'Pre-season is over. The transfer window is open until week 5.');
}

function careerRollover(game: Game, rng: Rng) {
  const world = game.world;
  const p = careerPlayer(game);
  seasonRollover(game, rng);
  if (p.clubId) {
    p.contractYears--;
    if (p.contractYears <= 0) {
      movePlayer(world, p, null);
      addMessage(game, 'news', 'Contract expired', 'Your contract has run out. You are a free agent until you sign for a new club.');
    } else if (p.contractYears === 1) {
      ownClubRenewal(game, rng);
    }
  }
  if (p.age >= 38) addMessage(game, 'news', 'Time to hang up the boots', 'At 38 your body says stop. Retire from your profile whenever you are ready.');
  else if (p.age >= 33) addMessage(game, 'news', 'Thinking about the future?', 'You can retire at any time from your profile.');
}

function signFreeAgentOrGenerate(game: Game, rng: Rng, clubId: string) {
  const world = game.world;
  const club = world.clubs[clubId];
  const { position } = weakestPosition(world, club);
  const target = targetOverall(club.reputation);
  const careerId = game.career?.playerId;
  const pick = world.freeAgents
    .map((id) => world.players[id])
    .filter((p) => p && p.id !== careerId && p.position === position && overall(p) <= target + 5)
    .sort((a, b) => overall(b) - overall(a))[0];
  if (pick) {
    movePlayer(world, pick, club.id);
    return;
  }
  const p = createPlayer(world, rng, { position, target: Math.round(target - rng.range(2, 8)), age: rng.int(19, 29), nationId: club.nationId, clubId: null });
  world.freeAgents.push(p.id);
  movePlayer(world, p, club.id);
}

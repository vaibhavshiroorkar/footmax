import { gainFame } from './careerBase';
import { addMessage } from './inbox';
import { newId } from './generator';
import { TableRow, tableFrom } from './league';
import { teamById } from './lineup';
import { quickSim } from './match';
import { Rng } from './rng';
import { Fixture, Game, World } from './types';

// The Champions League. From 2024/25 it is one table of 36 clubs, eight games
// each; before that, 32 clubs in eight groups. Then two-legged ties and a
// one-game final. Matches sit midweek, so a week can hold two for the user.

export type EuropeRound = 'qualifier' | 'league' | 'groups' | 'playoff' | 'r16' | 'qf' | 'sf' | 'final' | 'done';

export interface Europe {
  season: number;
  format: 'league' | 'groups';
  clubs: string[];
  groups: string[][];
  fixtures: Fixture[];
  round: EuropeRound;
  winner?: string;
  // A small nation's champion playing for the last place.
  challenger?: string;
}

export const LEAGUE_FROM = 2024;
const AWAY_GOALS_UNTIL = 2020;
const SIZE = { league: 36, groups: 32 };

// Places by nation. The rest go to the next best European clubs.
const PLACES: Record<string, number> = { ENG: 5, ESP: 5, GER: 4, ITA: 4, FRA: 3, POR: 2, NED: 2 };
const OLD_PLACES: Record<string, number> = { ENG: 4, ESP: 4, GER: 4, ITA: 4, FRA: 3, POR: 2, NED: 2 };

// Weeks, kept clear of the international breaks at 9, 20 and 30.
const QUALIFIER_WEEKS = [2, 3];
const LEAGUE_WEEKS = [5, 7, 11, 13, 15, 16, 18, 22, 24];
const GROUP_WEEKS = [5, 7, 11, 13, 15, 18];
const TIE_WEEKS: Record<string, [number, number?]> = { playoff: [26, 27], r16: [28, 29], qf: [31, 32], sf: [34, 35], final: [37] };

const STAGE: Record<string, string> = { qualifier: 'Qualifying', league: 'League phase', groups: 'Group stage', playoff: 'Play-off', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', final: 'Final' };

export const europeStage = (round: EuropeRound) => STAGE[round] ?? '';

function fixture(world: World, week: number, homeId: string, awayId: string, round: EuropeRound, extra: Partial<Fixture> = {}): Fixture {
  return { id: newId(world, 'e'), week, homeId, awayId, played: false, homeGoals: 0, awayGoals: 0, scorers: [], stage: STAGE[round], europe: true, noShootout: true, ...extra };
}

const rep = (world: World, id: string) => world.clubs[id]?.reputation ?? 0;

// Who plays. Last season's table where there is one, reputation otherwise.
function entrants(world: World, size: number, season: number): string[] {
  const places = season >= LEAGUE_FROM ? PLACES : OLD_PLACES;
  const out: string[] = [];
  for (const [nationId, n] of Object.entries(places)) {
    const league = world.leagues.filter((l) => l.nationId === nationId).sort((a, b) => a.tier - b.tier)[0];
    if (!league) continue;
    const order = world.lastFinish?.[league.id] ?? [...league.clubIds].sort((a, b) => rep(world, b) - rep(world, a));
    out.push(...order.filter((id) => world.clubs[id]?.leagueId === league.id).slice(0, n));
  }
  const uefa = new Set(world.nations.filter((n) => n.conf === 'UEFA').map((n) => n.id));
  const perNation: Record<string, number> = {};
  const rest = Object.values(world.clubs)
    .filter((c) => uefa.has(c.nationId) && !places[c.nationId] && c.playerIds.length >= 14)
    .sort((a, b) => b.reputation - a.reputation);
  for (const c of rest) {
    if (out.length >= size) break;
    if ((perNation[c.nationId] = (perNation[c.nationId] ?? 0) + 1) <= 2) out.push(c.id);
  }
  return out.slice(0, size);
}

// A league champion from outside the big nations gets a shot at the last place.
function challenger(world: World, clubs: string[], clubId: string | null): string | undefined {
  if (!clubId || clubs.includes(clubId)) return undefined;
  const club = world.clubs[clubId];
  const league = world.leagues.find((l) => l.id === club?.leagueId);
  const nation = world.nations.find((n) => n.id === club?.nationId);
  if (!league || nation?.conf !== 'UEFA' || PLACES[club.nationId]) return undefined;
  return world.lastFinish?.[league.id]?.[0] === clubId ? clubId : undefined;
}

// The draw for this season: who is in, and any qualifying tie.
export function startEurope(world: World, rng: Rng, userClub: string | null): void {
  const format = world.season >= LEAGUE_FROM ? 'league' : 'groups';
  const clubs = entrants(world, SIZE[format], world.season);
  const e: Europe = { season: world.season, format, clubs, groups: [], fixtures: [], round: 'qualifier' };
  world.europe = e;
  const hopeful = challenger(world, clubs, userClub);
  if (hopeful && clubs.length) {
    e.challenger = hopeful;
    const seeded = clubs[clubs.length - 1];
    e.fixtures.push(fixture(world, QUALIFIER_WEEKS[0], hopeful, seeded, 'qualifier'));
    e.fixtures.push(secondLeg(world, QUALIFIER_WEEKS[1], seeded, hopeful, 'qualifier'));
  } else drawMainStage(world, rng);
}

// The second leg plays to a finish: it is settled on the tie.
function secondLeg(world: World, week: number, homeId: string, awayId: string, round: EuropeRound): Fixture {
  return fixture(world, week, homeId, awayId, round, { noShootout: false, secondLeg: true });
}

// Four pots of nine by standing. Each club meets two from each pot, one home and
// one away, and never a club from its own nation if the draw can avoid it.
export function leagueDraw(world: World, clubs: string[], rng: Rng): [string, string][] {
  const sorted = [...clubs].sort((a, b) => rep(world, b) - rep(world, a));
  const size = sorted.length / 4;
  const nation = (id: string) => world.clubs[id]?.nationId;
  let best: [string, string][] = [];
  let bestClashes = Infinity;
  for (let attempt = 0; attempt < 120 && bestClashes > 0; attempt++) {
    const pots = [0, 1, 2, 3].map((i) => rng.shuffle(sorted.slice(i * size, (i + 1) * size)));
    const games: [string, string][] = [];
    pots.forEach((pot, i) => {
      pot.forEach((id, k) => games.push([id, pot[(k + 1) % size]]));
      for (let j = i + 1; j < 4; j++) {
        const off = rng.int(0, size - 1);
        pot.forEach((id, k) => {
          games.push([id, pots[j][(k + off) % size]]);
          games.push([pots[j][(k + off + 1) % size], id]);
        });
      }
    });
    const clashes = games.filter(([a, b]) => nation(a) === nation(b)).length;
    if (clashes < bestClashes) {
      best = games;
      bestClashes = clashes;
    }
  }
  return best;
}

// Gives each game a slot so that no club has two in one slot. A game that
// finds no slot free for both clubs swaps two slots along a chain of games
// (a Kempe chain) to free one, which is how edge colouring works.
export function colourGames(games: [string, string][], slots: number, rng: Rng): number[] | null {
  const at = new Map<string, (number | undefined)[]>();
  const row = (id: string) => at.get(id) ?? at.set(id, Array(slots).fill(undefined)).get(id)!;
  const colour: number[] = Array(games.length).fill(-1);
  const put = (g: number, c: number) => {
    colour[g] = c;
    row(games[g][0])[c] = g;
    row(games[g][1])[c] = g;
  };
  const clear = (g: number) => {
    row(games[g][0])[colour[g]] = undefined;
    row(games[g][1])[colour[g]] = undefined;
  };
  const free = (id: string) => row(id).flatMap((g, c) => (g === undefined ? [c] : []));
  for (const g of rng.shuffle(games.map((_, i) => i))) {
    const [u, v] = games[g];
    const fu = free(u);
    const fv = free(v);
    const both = fu.find((c) => fv.includes(c));
    if (both !== undefined) {
      put(g, both);
      continue;
    }
    let done = false;
    for (const a of fu) {
      for (const b of fv) {
        // Walk the a/b chain from v. If it does not reach u, swap it.
        const chain: number[] = [];
        let id = v;
        let want = a;
        for (;;) {
          const next = row(id)[want];
          if (next === undefined) break;
          chain.push(next);
          id = games[next][0] === id ? games[next][1] : games[next][0];
          want = want === a ? b : a;
        }
        if (id === u || chain.some((e) => games[e].includes(u))) continue;
        const swapped = chain.map((e) => [e, colour[e] === a ? b : a] as const);
        chain.forEach(clear);
        swapped.forEach(([e, c]) => put(e, c));
        put(g, a);
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) return null;
  }
  return colour;
}

// Spreads games over the weeks so nobody plays twice in one.
function schedule(world: World, games: [string, string][], weeks: number[], rng: Rng): Fixture[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const slots = colourGames(games, weeks.length, rng);
    if (slots) return games.map(([h, a], i) => fixture(world, weeks[slots[i]], h, a, 'league'));
  }
  throw new Error('No schedule found for the league phase.');
}

function drawMainStage(world: World, rng: Rng) {
  const e = world.europe!;
  if (e.format === 'league') {
    e.round = 'league';
    e.fixtures.push(...schedule(world, leagueDraw(world, e.clubs, rng), LEAGUE_WEEKS, rng));
    return;
  }
  e.round = 'groups';
  const sorted = [...e.clubs].sort((a, b) => rep(world, b) - rep(world, a));
  e.groups = Array.from({ length: 8 }, () => [] as string[]);
  for (let pot = 0; pot < 4; pot++) rng.shuffle(sorted.slice(pot * 8, pot * 8 + 8)).forEach((id, g) => e.groups[g].push(id));
  const rounds = [[0, 1, 2, 3], [0, 2, 3, 1], [3, 0, 1, 2], [1, 0, 3, 2], [2, 0, 1, 3], [0, 3, 2, 1]];
  for (const g of e.groups) {
    rounds.forEach((r, day) => {
      e.fixtures.push(fixture(world, GROUP_WEEKS[day], g[r[0]], g[r[1]], 'groups', { stage: STAGE.groups }));
      e.fixtures.push(fixture(world, GROUP_WEEKS[day], g[r[2]], g[r[3]], 'groups', { stage: STAGE.groups }));
    });
  }
}

export function europeTable(world: World, ids?: string[]): TableRow[] {
  const e = world.europe;
  if (!e) return [];
  const stage = e.format === 'league' ? STAGE.league : STAGE.groups;
  return tableFrom(ids ?? e.clubs, e.fixtures.filter((f) => f.stage === stage), (id) => teamById(world, id).name);
}

// Who won a two-legged tie. Away goals count until 2020/21.
export function tieWinner(second: Fixture, first: Fixture, season: number): string {
  // second.homeId is first.awayId.
  const a = first.homeId;
  const b = first.awayId;
  const goalsA = first.homeGoals + second.awayGoals;
  const goalsB = first.awayGoals + second.homeGoals;
  if (goalsA !== goalsB) return goalsA > goalsB ? a : b;
  if (season <= AWAY_GOALS_UNTIL && second.awayGoals !== first.awayGoals) return second.awayGoals > first.awayGoals ? a : b;
  return second.penaltyWinner ?? a;
}

function ties(e: Europe, round: EuropeRound): [Fixture, Fixture][] {
  const legs = e.fixtures.filter((f) => f.stage === STAGE[round]);
  const out: [Fixture, Fixture][] = [];
  for (const first of legs.filter((f) => !f.secondLeg)) {
    const second = legs.find((f) => f.secondLeg && f.homeId === first.awayId && f.awayId === first.homeId);
    if (second) out.push([first, second]);
  }
  return out;
}

function drawTies(world: World, pairs: [string, string][], round: EuropeRound) {
  const e = world.europe!;
  const [w1, w2] = TIE_WEEKS[round];
  for (const [a, b] of pairs) {
    if (w2 === undefined) {
      e.fixtures.push(fixture(world, w1, a, b, round, { noShootout: false }));
      continue;
    }
    e.fixtures.push(fixture(world, w1, a, b, round));
    const second = secondLeg(world, w2, b, a, round);
    e.fixtures.push(second);
  }
  e.round = round;
}

const seedPairs = (ids: string[]): [string, string][] => ids.slice(0, ids.length / 2).map((id, i) => [ids[ids.length - 1 - i], id]);

// Moves on once a round is played, and pays the clubs that went through.
function nextRound(game: Game, rng: Rng) {
  const world = game.world;
  const e = world.europe!;
  const done = (round: EuropeRound) => e.fixtures.filter((f) => f.stage === STAGE[round]).every((f) => f.played);
  const winners = (round: EuropeRound) => ties(e, round).map(([first, second]) => tieWinner(second, first, e.season));
  if (e.round === 'qualifier' && done('qualifier')) {
    const [tie] = ties(e, 'qualifier');
    if (tie) {
      const through = tieWinner(tie[1], tie[0], e.season);
      if (through === e.challenger) e.clubs[e.clubs.length - 1] = through;
      reward(game, through, 'qualifier');
    }
    drawMainStage(world, rng);
  } else if (e.round === 'league' && done('league')) {
    const table = europeTable(world).map((r) => r.clubId);
    e.clubs = table;
    drawTies(world, seedPairs(table.slice(8, 24)), 'playoff');
  } else if (e.round === 'groups' && done('groups')) {
    const firsts = e.groups.map((g) => europeTable(world, g)[0].clubId);
    const seconds = e.groups.map((g) => europeTable(world, g)[1].clubId);
    const pairs = firsts.map((id, i): [string, string] => [seconds[(i + 1) % 8], id]);
    [...firsts, ...seconds].forEach((id) => reward(game, id, 'r16'));
    drawTies(world, pairs, 'r16');
  } else if (e.round === 'playoff' && done('playoff')) {
    const through = rng.shuffle(winners('playoff'));
    const top = e.clubs.slice(0, 8);
    [...top, ...through].forEach((id) => reward(game, id, 'r16'));
    drawTies(world, top.map((id, i): [string, string] => [through[i], id]), 'r16');
  } else if (e.round === 'r16' && done('r16')) {
    const through = rng.shuffle(winners('r16'));
    through.forEach((id) => reward(game, id, 'qf'));
    drawTies(world, seedPairs(through), 'qf');
  } else if (e.round === 'qf' && done('qf')) {
    const through = rng.shuffle(winners('qf'));
    through.forEach((id) => reward(game, id, 'sf'));
    drawTies(world, seedPairs(through), 'sf');
  } else if (e.round === 'sf' && done('sf')) {
    const [a, b] = winners('sf');
    [a, b].forEach((id) => reward(game, id, 'final'));
    drawTies(world, [[a, b]], 'final');
  } else if (e.round === 'final' && done('final')) {
    const f = e.fixtures.find((x) => x.stage === STAGE.final)!;
    e.winner = f.homeGoals === f.awayGoals ? f.penaltyWinner ?? f.homeId : f.homeGoals > f.awayGoals ? f.homeId : f.awayId;
    e.round = 'done';
    world.honours.push({ season: e.season, title: 'Champions League winners', winner: teamById(world, e.winner).name, clubId: e.winner });
    reward(game, e.winner, 'done');
  }
}

const PRIZE: Partial<Record<EuropeRound, { money: number; fame: number; budget: number }>> = {
  qualifier: { money: 2_000, fame: 3, budget: 2_000_000 },
  r16: { money: 5_000, fame: 3, budget: 5_000_000 },
  qf: { money: 10_000, fame: 4, budget: 8_000_000 },
  sf: { money: 20_000, fame: 5, budget: 12_000_000 },
  final: { money: 40_000, fame: 6, budget: 20_000_000 },
  done: { money: 100_000, fame: 12, budget: 40_000_000 },
};

// Only the user's club is paid out: AI budgets are out of the game's hands.
function reward(game: Game, clubId: string, round: EuropeRound) {
  const prize = PRIZE[round];
  if (!prize) return;
  const name = teamById(game.world, clubId).name;
  if (game.career && game.world.players[game.career.playerId]?.clubId === clubId) {
    game.career.money += prize.money;
    gainFame(game.career, prize.fame);
    addMessage(game, 'news', round === 'done' ? 'Champions of Europe!' : `${name} go through`, round === 'done' ? 'You have won the Champions League.' : `Into the ${STAGE[round] ?? 'next round'}. A bonus of $${prize.money.toLocaleString('en-US')} is on its way.`);
  }
  if (game.manager?.clubId === clubId) game.world.clubs[clubId].budget += prize.budget;
}

// This week's European matches that are left, then the next round if it is due.
export function playEuropeWeek(game: Game, rng: Rng): void {
  const world = game.world;
  const e = world.europe;
  if (!e || e.season !== world.season || e.round === 'done') return;
  for (const f of e.fixtures) if (f.week === world.week && !f.played) quickSim(world, f, rng.int(1, 2 ** 31));
  nextRound(game, rng);
}

// The user's European match this week, if there is one left to play.
export function europeFixtureFor(world: World, teamId: string): Fixture | undefined {
  const e = world.europe;
  if (!e || e.season !== world.season) return undefined;
  return e.fixtures.find((f) => f.week === world.week && !f.played && (f.homeId === teamId || f.awayId === teamId));
}

// The first leg of a second leg, for the aggregate on the scoreboard.
export function firstLegOf(world: World, f: Fixture): Fixture | undefined {
  if (!f.secondLeg) return undefined;
  return world.europe?.fixtures.find((x) => x.stage === f.stage && !x.secondLeg && x.homeId === f.awayId && x.awayId === f.homeId);
}

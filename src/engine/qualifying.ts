import { Confederation, Fixture, Game, Qualifying, World } from './types';
import { Rng } from './rng';
import { TableRow, tableFrom } from './league';
import { majorNations, newId } from './generator';
import { teamById } from './lineup';
import { quickSim } from './match';
import { worldCupDef } from './international';
import { addMessage } from './inbox';
import { ordinal } from './manager';

// World Cup qualifying for every nation. In the season before a World Cup
// each confederation is drawn into groups of three or four (seeded, so
// every group has one strong side), played home and away over the three
// international breaks, two matchdays a break. Group winners go through,
// best first, then the best runners-up, until the confederation's places
// are filled; any places left go to the best teams that missed out.

export const QUALIFYING_ROUNDS = 6;
const CONFS: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

// The World Cup that a season's summer holds, if any.
export function worldCupAfter(season: number): number | null {
  return (season + 1) % 4 === 2 ? season + 1 : null;
}

// Group sizes for n teams: as few groups as fit four teams each, filled
// as evenly as possible (10 teams are 4, 3 and 3).
function groupSizes(n: number): number[] {
  const g = Math.ceil(n / 4);
  const base = Math.floor(n / g);
  return Array.from({ length: g }, (_, i) => base + (i < n % g ? 1 : 0));
}

// Home-and-away round robin over six matchdays. A group of three gets a
// bye each matchday.
function groupFixtures(world: World, teams: string[]): Fixture[] {
  const ids: (string | null)[] = [...teams];
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  const half: { home: string; away: string; round: number }[] = [];
  const order = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a && b) half.push(r % 2 ? { home: b, away: a, round: r + 1 } : { home: a, away: b, round: r + 1 });
    }
    order.splice(1, 0, order.pop()!);
  }
  const rounds = n - 1;
  const all = [...half, ...half.map((m) => ({ home: m.away, away: m.home, round: m.round + rounds }))];
  return all.map((m) => ({ id: newId(world, 'f'), week: m.round, homeId: m.home, awayId: m.away, played: false, homeGoals: 0, awayGoals: 0, scorers: [], stage: 'Qualifier', noShootout: true }));
}

// Draws qualifying for the World Cup after this season, if there is one
// and it is not drawn yet.
export function startQualifying(world: World, rng: Rng): void {
  const year = worldCupAfter(world.season);
  if (!year || world.qualifying?.year === year) return;
  const q: Qualifying = { year, groups: [], fixtures: [], round: 1, rounds: QUALIFYING_ROUNDS };
  for (const conf of CONFS) {
    // Seeded on strength, with a little luck in the draw.
    const pool = majorNations(world).filter((n) => n.conf === conf);
    const seed = new Map(pool.map((n) => [n.id, n.strength + rng.normal(0, 1.5)]));
    const nations = pool.sort((a, b) => seed.get(b.id)! - seed.get(a.id)!);
    if (!nations.length) continue;
    const sizes = groupSizes(nations.length);
    const groups: string[][] = sizes.map(() => []);
    // Snake seeding: pot 1 goes 1..g, pot 2 comes back g..1.
    let i = 0;
    for (let pot = 0; i < nations.length; pot++) {
      const order = pot % 2 === 0 ? groups.map((_, k) => k) : groups.map((_, k) => groups.length - 1 - k);
      for (const k of order) {
        if (i >= nations.length) break;
        if (groups[k].length < sizes[k]) groups[k].push(nations[i++].teamId);
      }
    }
    for (const g of groups) {
      q.groups.push({ conf, teamIds: g });
      q.fixtures.push(...groupFixtures(world, g));
    }
  }
  world.qualifying = q;
}

export function qualifyingTable(world: World, q: Qualifying, teamIds: string[]): TableRow[] {
  const set = new Set(teamIds);
  return tableFrom(
    teamIds,
    q.fixtures.filter((f) => set.has(f.homeId) && set.has(f.awayId)),
    (id) => teamById(world, id).name,
  );
}

// Ranks the teams of a confederation: group winners first, then
// runners-up and so on, each by points per game, goal difference per game
// and goals.
function ranked(world: World, q: Qualifying, conf: Confederation | null): string[] {
  const rows: { id: string; place: number; ppg: number; gd: number; gf: number }[] = [];
  for (const g of q.groups) {
    if (conf && g.conf !== conf) continue;
    qualifyingTable(world, q, g.teamIds).forEach((r, place) => {
      const n = Math.max(1, r.played);
      rows.push({ id: r.clubId, place, ppg: r.points / n, gd: r.gd / n, gf: r.gf / n });
    });
  }
  return rows.sort((a, b) => a.place - b.place || b.ppg - a.ppg || b.gd - a.gd || b.gf - a.gf).map((r) => r.id);
}

function finish(world: World, q: Qualifying): void {
  const def = worldCupDef(q.year);
  const size = def.groups * 4;
  const out: string[] = [];
  for (const conf of CONFS) out.push(...ranked(world, q, conf).slice(0, def.quotas[conf] ?? 0));
  // Places left over (the play-offs) go to the best of the rest.
  for (const id of ranked(world, q, null)) {
    if (out.length >= size) break;
    if (!out.includes(id)) out.push(id);
  }
  q.qualified = out.slice(0, size);
}

// The team the user cares about: the career player's nation or the
// manager's national team.
function userNationTeam(game: Game): string | undefined {
  if (game.career) {
    const p = game.world.players[game.career.playerId];
    return game.world.nations.find((n) => n.id === p?.nationId)?.teamId;
  }
  return game.manager?.nationalTeamId ?? undefined;
}

const LAST_BREAK = 30;

// Whether this season's breaks hold qualifiers still to play.
export function qualifyingLive(world: World): boolean {
  const q = world.qualifying;
  return !!q && !q.qualified && worldCupAfter(world.season) === q.year;
}

// Plays this international break's two qualifying matchdays and tells the
// user how their nation got on.
export function playQualifyingBreak(game: Game, rng: Rng): void {
  const world = game.world;
  const q = world.qualifying;
  if (!q || !qualifyingLive(world)) return;
  const mine = userNationTeam(game);
  const lines: string[] = [];
  // The career player's call-up is his own choice (see offers.ts), so these
  // matches add nothing to his record.
  const me = game.career ? world.players[game.career.playerId] : undefined;
  const record = me ? { caps: me.caps, goals: me.intlGoals } : null;
  // The last break of the season plays whatever is left, so a late draw finishes.
  const today = world.week >= LAST_BREAK ? q.rounds : 2;
  for (let k = 0; k < today && q.round <= q.rounds; k++, q.round++) {
    for (const f of q.fixtures) {
      if (f.week !== q.round || f.played) continue;
      quickSim(world, f, rng.int(1, 2 ** 31));
      if (mine && (f.homeId === mine || f.awayId === mine)) lines.push(`${teamById(world, f.homeId).name} ${f.homeGoals}-${f.awayGoals} ${teamById(world, f.awayId).name}`);
    }
  }
  if (me && record) {
    me.caps = record.caps;
    me.intlGoals = record.goals;
  }
  if (q.round > q.rounds) finish(world, q);
  if (!mine) return;
  const group = q.groups.find((g) => g.teamIds.includes(mine));
  if (!group) return;
  const name = teamById(world, mine).name;
  const place = qualifyingTable(world, q, group.teamIds).findIndex((r) => r.clubId === mine) + 1;
  if (q.qualified) {
    const through = q.qualified.includes(mine);
    addMessage(game, 'national', through ? `${name} are going to the World Cup` : `${name} miss the World Cup`, `${lines.join('. ')}${lines.length ? '. ' : ''}${through ? `${name} have qualified for the World Cup ${q.year}.` : `${name} finished ${ordinal(place)} in their group and are out.`}`);
  } else if (lines.length) {
    addMessage(game, 'national', `World Cup qualifying: ${name}`, `${lines.join('. ')}. ${name} are ${ordinal(place)} in their group.`);
  }
}

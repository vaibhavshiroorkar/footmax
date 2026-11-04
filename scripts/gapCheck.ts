// How much a stronger team dominates: a side of about 95 against one of
// about 75 (and closer gaps), over many matches.
// Run with `npx tsx scripts/gapCheck.ts`.
import { newCareerGame } from '../src/engine/game';
import { quickSim } from '../src/engine/match';
import { overall } from '../src/engine/player';
import { Fixture, Player } from '../src/engine/types';


// Scale every attribute so the club's players average the target overall.
function setLevel(world: ReturnType<typeof newCareerGame>['world'], ids: string[], target: number) {
  const ps = ids.map((id) => world.players[id]).filter(Boolean) as Player[];
  for (let i = 0; i < 6; i++) {
    const avg = ps.reduce((n, p) => n + overall(p), 0) / ps.length;
    const k = target / avg;
    for (const p of ps) for (const key of Object.keys(p.attrs) as (keyof Player['attrs'])[]) p.attrs[key] = Math.max(1, Math.min(99, p.attrs[key] * k));
  }
}

for (const [hi, lo] of [[95, 75], [85, 75], [80, 75]]) {
  const game = newCareerGame({ firstName: 'T', lastName: 'P', nationId: 'ENG', position: 'FWD', seed: 77 });
  const world = game.world;
  const [a, b] = Object.values(world.clubs).filter((c) => c.leagueId && c.playerIds.length >= 18);
  setLevel(world, a.playerIds, hi);
  setLevel(world, b.playerIds, lo);
  let w = 0;
  let d = 0;
  let gf = 0;
  let ga = 0;
  const n = 300;
  for (let i = 0; i < n; i++) {
    const home = i % 2 === 0;
    const f: Fixture = { id: `g${i}`, week: 1, homeId: home ? a.id : b.id, awayId: home ? b.id : a.id, played: false, homeGoals: 0, awayGoals: 0, scorers: [] };
    const s = quickSim(world, f, 1000 + i);
    // No weeks pass here, so bans and knocks would pile up and thin the squads.
    for (const id of [...a.playerIds, ...b.playerIds]) Object.assign(world.players[id], { suspendedWeeks: 0, injuryWeeks: 0 });
    const mine = home ? s.home.goals : s.away.goals;
    const theirs = home ? s.away.goals : s.home.goals;
    gf += mine;
    ga += theirs;
    if (mine > theirs) w++;
    else if (mine === theirs) d++;
  }
  console.log(`${hi} v ${lo}: win ${((100 * w) / n).toFixed(0)}%, draw ${((100 * d) / n).toFixed(0)}%, goals ${(gf / n).toFixed(2)}-${(ga / n).toFixed(2)}`);
}

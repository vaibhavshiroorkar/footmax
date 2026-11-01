// Headless balance check: sims whole seasons (including summer
// tournaments) and prints the numbers that matter for feel.
// Run with `npm run balance -- [seasons] [seed]`.
import { newCareerGame, skipSummer, skipWeek } from '../src/engine/game';
import { overall } from '../src/engine/player';
import { serialize } from '../src/engine/save';

const seasons = Number(process.argv[2] ?? 3);
const seed = Number(process.argv[3] ?? 1234);
let t0 = Date.now();
const game = newCareerGame({ firstName: 'Test', lastName: 'Player', nationId: 'ENG', position: 'FWD', seed });
console.log(`World built in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${Object.keys(game.world.players).length} players, ${Object.keys(game.world.clubs).length} clubs`);
t0 = Date.now();

for (let s = 0; s < seasons; s++) {
  const world = game.world;
  const season = world.season;
  let goals = 0;
  let matches = 0;
  let draws = 0;
  while (world.week < world.seasonWeeks) skipWeek(game);
  for (const l of world.leagues) {
    for (const f of l.fixtures) {
      if (!f.played) continue;
      matches++;
      goals += f.homeGoals + f.awayGoals;
      if (f.homeGoals === f.awayGoals) draws++;
    }
  }
  skipWeek(game);
  const cups = world.tournaments.map((t) => t.name).join(', ');
  skipSummer(game);
  const titles = world.honours.filter((h) => h.season === season && (h.title.endsWith('champions') || /Cup|Championship|Copa|Asian|Gold|Nations/.test(h.title)));
  const counts = Object.values(world.clubs)
    .filter((c) => c.leagueId)
    .map((c) => c.playerIds.length);
  console.log(
    `Season ${season}: goals/match ${(goals / matches).toFixed(2)}, draws ${((100 * draws) / matches).toFixed(0)}%, ` +
      `squads ${Math.min(...counts)}-${Math.max(...counts)}, players ${Object.keys(world.players).length}`,
  );
  console.log(`  summer: ${cups}`);
  console.log(`  winners: ${titles.map((h) => `${h.title.replace(' champions', '')}: ${h.winner}`).join('; ')}`);
  const p = world.players[game.career!.playerId];
  console.log(`  user player age ${p.age}, ovr ${overall(p)}`);
}
console.log(`Simmed in ${((Date.now() - t0) / 1000).toFixed(1)}s, save size ${(serialize(game).length / 1024).toFixed(0)} KB`);

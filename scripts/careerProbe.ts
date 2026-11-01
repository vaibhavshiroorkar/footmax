// Plays a career the way an active user would: trains every week, spends
// skill points and takes the first club offer that comes in.
// Run with `npm run probe -- [seasons] [seed]`.
import { newCareerGame, skipSummer, skipWeek } from '../src/engine/game';
import { careerPlayer, train, upgradeSkill } from '../src/engine/career';
import { overall } from '../src/engine/player';
import { openOffers } from '../src/engine/inbox';
import { respond } from '../src/engine/offers';
import { SKILLS } from '../src/engine/skills';

const seasons = Number(process.argv[2] ?? 6);
const game = newCareerGame({ firstName: 'Test', lastName: 'Player', nationId: 'ENG', position: 'FWD', seed: Number(process.argv[3] ?? 7) });
const drills = ['finishing', 'speed', 'technique'];
for (let s = 0; s < seasons; s++) {
  const season = game.world.season;
  while (game.world.season === season) {
    for (const d of drills) train(game, d);
    for (const sk of SKILLS) upgradeSkill(game, sk.id);
    for (const m of openOffers(game)) {
      const t = m.action!.type;
      if (t === 'club-offer' || t === 'sponsor' || t === 'callup' || t === 'renewal') respond(game, m.id, 'accept');
    }
    if (game.world.phase === 'tournament') skipSummer(game);
    else skipWeek(game);
  }
  const p = careerPlayer(game);
  const h = p.history.at(-1);
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  const c = game.career!;
  console.log(
    `age ${p.age} ovr ${overall(p)} club ${club?.name ?? 'none'} (rep ${club?.reputation ?? '-'}) apps ${h?.season === season ? h.apps : 0} goals ${h?.season === season ? h.goals : 0} ` +
      `caps ${p.caps} level ${c.level} skills ${JSON.stringify(p.skills)} fame ${c.fame.toFixed(0)}`,
  );
}
